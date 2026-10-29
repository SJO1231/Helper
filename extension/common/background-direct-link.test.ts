import { describe, expect, test } from 'vitest';
import { TAB, setup } from './background-test-kit';

describe('direct link', () => {
  const rows = [
    { site: 'g2b', menu_no: 'M1', menu_cang_val: 'C1', name: 'N1', stage: 'bid', link: null },
    { site: 'g2b', menu_no: 'M2', menu_cang_val: 'C2', name: '', stage: null, link: null },
    { site: 'g2b', menu_no: 'M3', menu_cang_val: '', name: 'N3', stage: null, link: null },
  ];
  test('screen-list is built from dict_screen rows only, with three fields each', async () => {
    const t = setup({ tables: { dict_screen: rows } });
    const reply: any = await t.handlers.handle({ kind: 'screen-list' }, TAB);
    expect(reply.data).toEqual([
      { menu_no: 'M1', menu_cang_val: 'C1', name: 'N1' },
      { menu_no: 'M2', menu_cang_val: 'C2', name: '' },
      { menu_no: 'M3', menu_cang_val: '', name: 'N3' },
    ]);
    expect(t.sent.map((s) => s.path.split('?')[0])).toEqual(['/api/tables/dict_screen/records']);
    expect(t.pageCalls).toEqual([]);
  });
  test('screen-list asks for name order and flags a list over the limit as truncated', async () => {
    const row = (i: number) => ({ site: 'g2b', menu_no: `M${i}`, menu_cang_val: 'C', name: 'N' });
    const many = Array.from({ length: 501 }, (_, i) => row(i));
    const t = setup({ tables: { dict_screen: many } });
    const reply: any = await t.handlers.handle({ kind: 'screen-list' }, TAB);
    expect(new URL('http://x' + t.sent[0].path).searchParams.get('sort')).toBe('name');
    expect(reply.truncated).toBe(true);
    const small: any = await setup({ tables: { dict_screen: rows } }).handlers.handle({ kind: 'screen-list' }, TAB);
    expect(small.truncated).toBeUndefined();
  });
  test('screen-list is empty when dict_screen has no rows', async () => {
    const reply: any = await setup().handlers.handle({ kind: 'screen-list' }, TAB);
    expect(reply).toEqual({ ok: true, data: [] });
  });
  test('open-screen runs openMenu in the page with the stored menu_cang_val', async () => {
    const t = setup({ tables: { dict_screen: rows }, pageOutcome: { ok: true, data: { ok: true } } });
    const reply: any = await t.handlers.handle({ kind: 'open-screen', menuNo: 'M1' }, TAB);
    expect(reply).toEqual({ ok: true, data: { ok: true } });
    expect(t.pageCalls).toEqual([[7, 'openMenu', ['C1']]]);
  });
  test('open-screen without a stored menu_cang_val or row does not touch the page', async () => {
    const t = setup({ tables: { dict_screen: rows } });
    const noCode: any = await t.handlers.handle({ kind: 'open-screen', menuNo: 'M3' }, TAB);
    const noRow: any = await t.handlers.handle({ kind: 'open-screen', menuNo: 'M9' }, TAB);
    expect(noCode.data.ok).toBe(false);
    expect(noRow.data.ok).toBe(false);
    expect(t.pageCalls).toEqual([]);
  });
});
