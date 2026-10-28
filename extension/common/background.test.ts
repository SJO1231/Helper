import { describe, expect, test } from 'vitest';
import { createHandlers } from './background';
import { createConnection } from './connection';
import type { ConnectionInfo, Diagnostics } from '../../shared/types';

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/';
const TAB = { tab: { id: 7, url: 'https://example.invalid/' }, url: 'https://example.invalid/' };
const EXT_PAGE = { url: ORIGIN + 'viewer.html' };

const baseDiag: Diagnostics = {
  forms: 1, grids: 1, droppedEmptyRef: 2, droppedSameDataList: 1, failedGrids: 0,
  droppedParam: 0, unknownKeys: 0, core: 'ok',
};
const rawCapture = {
  state: { menuNo: 'M0001' },
  param: {},
  pointInfo: [
    { k: 'dmA.keyA', v: 'V1', l: 'L-screen', visible: true },
    { k: 'dmA.other', v: 'V2', l: 'L2', visible: true },
  ],
  tables: [{ id: 'g', dataList: 'dl', visible: true, columns: [{ k: 'colA', l: 'LA' }], rows: [{ colA: 'V' }] }],
};
const collected = { raw: rawCapture, diag: baseDiag, screen: { menuNo: 'M0001', scrnNo: 'S0001', menuNm: 'N1' } };

interface Sent { method: string; path: string; headers: Record<string, string>; body: any }

function setup(opts: {
  tokens?: string[];
  tables?: Record<string, Record<string, unknown>[]>;
  fetchStatus?: (call: Sent, n: number) => number;
  offline?: boolean;
  pageOutcome?: unknown;
} = {}) {
  const sent: Sent[] = [];
  let hellos = 0;
  const tokens = opts.tokens ?? ['T1', 'T2'];
  let stored: ConnectionInfo | null = null;
  const tables = opts.tables ?? {};
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const u = new URL(url);
    const call: Sent = {
      method: init.method!, path: u.pathname + u.search, headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    };
    sent.push(call);
    if (opts.offline) throw new TypeError('fetch failed');
    const status = opts.fetchStatus?.(call, sent.length) ?? 200;
    if (status !== 200) return new Response(JSON.stringify({ error: 'E' }), { status });
    const table = /\/api\/tables\/(\w+)\/records/.exec(u.pathname)![1];
    if (call.method === 'GET') {
      const filter = JSON.parse(u.searchParams.get('filter') ?? '{}') as Record<string, string[]>;
      const matches = (r: Record<string, unknown>) =>
        Object.entries(filter).every(([k, v]) => v.includes(String(r[k])));
      const rows = (tables[table] ?? []).filter(matches);
      const records = rows.map((fields, i) => ({ id: i + 1, fields }));
      return new Response(JSON.stringify({ records, total: rows.length }));
    }
    if (table === 'g2b_capture') {
      const fields = {
        status: 'changed', record_id: 'R1', stage: 'bid', changed: ['keyA'], unknown_keys: 1, restored: true,
      };
      return new Response(JSON.stringify({ records: [{ id: 1, fields }] }));
    }
    return new Response(JSON.stringify({ records: call.body.records.map((_: unknown, i: number) => ({ id: i + 1 })) }));
  }) as unknown as typeof fetch;
  const host = {
    request: async () => {
      hellos++;
      if (opts.offline && hellos > 1) throw new Error('host down');
      return { port: 8765, token: tokens[Math.min(hellos - 1, tokens.length - 1)], schema_version: 1 };
    },
  };
  const pageCalls: [number, string, unknown[]][] = [];
  const connection = createConnection({
    host, fetchImpl,
    store: { get: async () => stored, set: async (v) => void (stored = v) },
  });
  const handlers = createHandlers({
    connection,
    extensionOrigin: ORIGIN,
    runInPage: async (tabId, method, args) => {
      pageCalls.push([tabId, method, args]);
      return (opts.pageOutcome ?? { ok: true, data: method === 'collect' ? collected : { ok: true } }) as any;
    },
  });
  return { handlers, sent, pageCalls, hellos: () => hellos };
}

const writes = (sent: Sent[]) => sent.filter((s) => s.method !== 'GET');

describe('screen auto-registration', () => {
  test('screen change sends PUT dict_screen with noupdate and site+menu_no require', async () => {
    const t = setup();
    const message = { kind: 'screen.changed', menuNo: 'M0009', scrnNo: 'S9', menuCangVal: 'C9', menuNm: 'N9' };
    const reply: any = await t.handlers.handle(message, TAB);
    expect(reply.ok).toBe(true);
    const put = t.sent.find((s) => s.method === 'PUT')!;
    expect(put.path).toBe('/api/tables/dict_screen/records?noupdate=true');
    expect(put.body.records).toEqual([{
      require: { site: 'g2b', menu_no: 'M0009' },
      fields: { scrn_no: 'S9', menu_cang_val: 'C9', name: 'N9' },
    }]);
  });
  test('a screen already in the dictionary is not reported as new', async () => {
    const t = setup({ tables: { dict_screen: [{ site: 'g2b', menu_no: 'M0009' }] } });
    const message = { kind: 'screen.changed', menuNo: 'M0009', scrnNo: 'S9', menuCangVal: 'C9', menuNm: 'N9' };
    expect(((await t.handlers.handle(message, TAB)) as any).data.registered).toBe(false);
  });
  test('opening the same screen again sends the same require, so the core keeps one row', async () => {
    const t = setup();
    const message = { kind: 'screen.changed', menuNo: 'M0009', scrnNo: 'S9', menuCangVal: 'C9', menuNm: 'N9' };
    await t.handlers.handle(message, TAB);
    await t.handlers.handle(message, TAB);
    const puts = t.sent.filter((s) => s.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(new Set(puts.map((p) => JSON.stringify(p.body.records[0].require))).size).toBe(1);
    expect(puts.every((p) => p.path.endsWith('noupdate=true'))).toBe(true);
  });
  test('screen change failure is not retried later', async () => {
    const t = setup({ offline: true });
    const first = { kind: 'screen.changed', menuNo: 'M0001', scrnNo: '', menuCangVal: '', menuNm: '' };
    const reply: any = await t.handlers.handle(first, TAB);
    expect(reply).toMatchObject({ ok: false, code: 'offline' });
    const before = t.sent.length;
    await t.handlers.handle({ kind: 'screen-info', menuNo: 'M0002' }, TAB);
    const later = t.sent.slice(before);
    expect(later.some((s) => s.body?.records?.[0]?.require?.menu_no === 'M0001')).toBe(false);
  });
});

describe('collect', () => {
  test('collect posts CaptureFields with the chosen mode and site g2b', async () => {
    const t = setup();
    await t.handlers.handle({ kind: 'collect', mode: 'hidden' }, TAB);
    const post = t.sent.find((s) => s.path === '/api/tables/g2b_capture/records')!;
    const fields = post.body.records[0].fields;
    expect(fields).toMatchObject({ site: 'g2b', menu_no: 'M0001', scrn_no: 'S0001', mode: 'hidden' });
    expect(fields.url).toBe('https://example.invalid/');
    expect(fields.raw).toEqual(rawCapture);
    expect(t.pageCalls).toEqual([[7, 'collect', ['hidden']]]);
  });
  test('result carries restored and the core unknown-key count into diagnostics', async () => {
    const t = setup();
    const reply: any = await t.handlers.handle({ kind: 'collect', mode: 'visible' }, TAB);
    expect(reply.data.result).toMatchObject({ status: 'changed', restored: true });
    expect(reply.data.diag.unknownKeys).toBe(1);
    expect(reply.data.diag.core).toBe('ok');
  });
  test('ten collections send the same body each time with a new request id', async () => {
    const t = setup();
    for (let i = 0; i < 10; i++) await t.handlers.handle({ kind: 'collect', mode: 'visible' }, TAB);
    const posts = t.sent.filter((s) => s.path.endsWith('g2b_capture/records'));
    expect(posts).toHaveLength(10);
    expect(new Set(posts.map((p) => JSON.stringify(p.body))).size).toBe(1);
  });
  test('401 triggers one new hello and one retry', async () => {
    const t = setup({ fetchStatus: (call, n) => (n === 1 ? 401 : 200) });
    const reply: any = await t.handlers.handle({ kind: 'collect', mode: 'visible' }, TAB);
    expect(reply.ok).toBe(true);
    expect(t.hellos()).toBe(2);
    const posts = t.sent.filter((s) => s.path.endsWith('g2b_capture/records'));
    expect(posts.map((p) => p.headers.Authorization)).toEqual(['Bearer T1', 'Bearer T2']);
  });
  test('a second 401 is reported, not looped', async () => {
    const t = setup({ fetchStatus: () => 401 });
    const reply: any = await t.handlers.handle({ kind: 'collect', mode: 'visible' }, TAB);
    expect(reply.ok).toBe(false);
    expect(t.hellos()).toBe(2);
  });
  test('offline core yields diag core offline and nothing is queued', async () => {
    const t = setup({ offline: true });
    const reply: any = await t.handlers.handle({ kind: 'collect', mode: 'visible' }, TAB);
    expect(reply).toMatchObject({ ok: false, code: 'offline' });
    expect(reply.diag.core).toBe('offline');
    const attempts = t.sent.length;
    await t.handlers.handle({ kind: 'screen-info', menuNo: 'M1' }, TAB);
    expect(t.sent.slice(attempts).some((s) => s.path.endsWith('g2b_capture/records'))).toBe(false);
  });
  test('page errors become coded replies', async () => {
    const t = setup({ pageOutcome: { ok: false, error: 'screen-changed' } });
    const reply: any = await t.handlers.handle({ kind: 'collect', mode: 'visible' }, TAB);
    expect(reply).toMatchObject({ ok: false, code: 'screen-changed' });
    expect(t.sent).toEqual([]);
  });
});

describe('snapshot', () => {
  const tables = {
    dict_key: [{ std_key: 'keyA', type: 'text' }],
    dict_alias: [],
    dict_label: [{ scope: 'system', scope_id: '', key: 'keyA', label: 'L-sys' }],
  };
  test('labels follow the dictionary and unknown keys are counted', async () => {
    const t = setup({ tables });
    const reply: any = await t.handlers.handle({ kind: 'snapshot', mode: 'visible' }, TAB);
    expect(reply.data.labels['dmA.keyA']).toBe('L-sys');
    expect(reply.data.labels['dmA.other']).toBe('L2');
    expect(reply.data.diag.unknownKeys).toBe(2); // dmA.other, colA
  });
  test('snapshot sends no write request', async () => {
    const t = setup({ tables });
    await t.handlers.handle({ kind: 'snapshot', mode: 'visible' }, TAB);
    expect(writes(t.sent)).toEqual([]);
  });
  test('offline core still shows the screen labels', async () => {
    const t = setup({ offline: true });
    const reply: any = await t.handlers.handle({ kind: 'snapshot', mode: 'visible' }, TAB);
    expect(reply.ok).toBe(true);
    expect(reply.data.diag.core).toBe('offline');
    expect(reply.data.labels['dmA.other']).toBe('L2');
  });
});

describe('other messages', () => {
  test('screen-info returns the dictionary row with stage normalised', async () => {
    const screen = { site: 'g2b', menu_no: 'M1', stage: '', key_fields: '["k1"]' };
    const t = setup({ tables: { dict_screen: [screen] } });
    const reply: any = await t.handlers.handle({ kind: 'screen-info', menuNo: 'M1' }, TAB);
    expect(reply.data).toMatchObject({ menu_no: 'M1', stage: null, key_fields: ['k1'] });
  });
  test('screen-info is null for an unknown screen', async () => {
    const reply: any = await setup().handlers.handle({ kind: 'screen-info', menuNo: 'M1' }, TAB);
    expect(reply.data).toBeNull();
  });
  test('core.connection answers only extension pages', async () => {
    const t = setup();
    const ok: any = await t.handlers.handle({ kind: 'core.connection' }, EXT_PAGE);
    expect(ok.data).toEqual({ baseUrl: 'http://127.0.0.1:8765', token: 'T1' });
    const denied: any = await t.handlers.handle({ kind: 'core.connection' }, TAB);
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe('forbidden');
  });
  test('remote actions run in the page of the sender tab', async () => {
    const t = setup();
    await t.handlers.handle({ kind: 'shift-year', delta: -1 }, TAB);
    await t.handlers.handle({ kind: 'row-count', n: 250 }, TAB);
    expect(t.pageCalls).toEqual([[7, 'shiftYear', [-1]], [7, 'applyRowCount', [250]]]);
  });
  test('page messages without a tab are refused', async () => {
    const reply: any = await setup().handlers.handle({ kind: 'collect', mode: 'visible' }, {});
    expect(reply).toMatchObject({ ok: false, code: 'forbidden' });
  });
  test('unknown kinds are refused', async () => {
    const reply: any = await setup().handlers.handle({ kind: 'nope' }, TAB);
    expect(reply.ok).toBe(false);
  });
});
