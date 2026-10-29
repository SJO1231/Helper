import { createHandlers } from './background';
import { createConnection } from './connection';
import type { ConnectionInfo, Diagnostics } from '../../shared/types';

export const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/';
export const TAB = { tab: { id: 7, url: 'https://example.invalid/' }, url: 'https://example.invalid/' };
export const EXT_PAGE = { url: ORIGIN + 'viewer.html' };

export const baseDiag: Diagnostics = {
  forms: 1, grids: 1, droppedEmptyRef: 2, droppedSameDataList: 1, failedGrids: 0,
  droppedParam: 0, unknownKeys: 0, core: 'ok',
};
export const rawCapture = {
  state: { menuNo: 'M0001' },
  param: {},
  pointInfo: [
    { k: 'dmA.keyA', v: 'V1', l: 'L-screen', visible: true },
    { k: 'dmA.other', v: 'V2', l: 'L2', visible: true },
  ],
  tables: [{ id: 'g', dataList: 'dl', visible: true, columns: [{ k: 'colA', l: 'LA' }], rows: [{ colA: 'V' }] }],
};
const screen = { menuNo: 'M0001', scrnNo: 'S0001', menuNm: 'N1' };
export const collected = { raw: rawCapture, diag: baseDiag, screen };

export interface Sent { method: string; path: string; headers: Record<string, string>; body: any }

export function setup(opts: {
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
  const openedViewers: string[] = [];
  const connection = createConnection({
    host, fetchImpl,
    store: { get: async () => stored, set: async (v) => void (stored = v) },
  });
  const handlers = createHandlers({
    connection,
    extensionOrigin: ORIGIN,
    openViewer: async (table) => void openedViewers.push(table),
    runInPage: async (tabId, method, args) => {
      pageCalls.push([tabId, method, args]);
      return (opts.pageOutcome ?? { ok: true, data: method === 'collect' ? collected : { ok: true } }) as any;
    },
  });
  return { handlers, sent, pageCalls, openedViewers, hellos: () => hellos };
}

export const writes = (sent: Sent[]) => sent.filter((s) => s.method !== 'GET');
