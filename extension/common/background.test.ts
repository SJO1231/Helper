import { describe, expect, test } from 'vitest';
import { EXT_PAGE, TAB, rawCapture, setup, writes } from './background-test-kit';
import { formatFailure } from './diagnostics';

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
  test.each(['not-ready', 'no-result'])('page error %s gets its own code and a Korean text', async (error) => {
    const t = setup({ pageOutcome: { ok: false, error } });
    const reply: any = await t.handlers.handle({ kind: 'collect', mode: 'visible' }, TAB);
    expect(reply).toMatchObject({ ok: false, code: error });
    expect(formatFailure(reply.code, reply.error)).toMatch(/[가-힣]/);
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
  test('unknownKeyList matches the unknown keys with their screen labels', async () => {
    const t = setup({ tables });
    const reply: any = await t.handlers.handle({ kind: 'snapshot', mode: 'visible' }, TAB);
    expect(reply.data.unknownKeyList).toEqual([
      { k: 'dmA.other', l: 'L2', source: 'form' },
      { k: 'colA', l: 'LA', source: 'grid' },
    ]);
    expect(reply.data.unknownKeyList.length).toBe(reply.data.diag.unknownKeys);
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
    await t.handlers.handle({ kind: 'click-search' }, TAB);
    await t.handlers.handle({ kind: 'row-count', n: 250 }, TAB);
    await t.handlers.handle({ kind: 'click-excel' }, TAB);
    expect(t.pageCalls).toEqual([
      [7, 'shiftYear', [-1]], [7, 'clickSearch', []], [7, 'applyRowCount', [250]], [7, 'clickExcel', []],
    ]);
  });
  test('open-viewer opens the viewer page without calling the core', async () => {
    const t = setup();
    const reply: any = await t.handlers.handle({ kind: 'open-viewer' }, TAB);
    expect(reply.ok).toBe(true);
    expect(t.openedViewers).toEqual(['']);
    expect(t.sent).toEqual([]);
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
