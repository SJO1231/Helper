import { describe, expect, test } from 'vitest';
import { TAB, setup, writes } from './background-test-kit';

describe('promote-key', () => {
  const promote = { kind: 'promote-key', k: 'dmA.other', l: 'L2', menuNo: 'M1' };
  test('PUTs one dict_key row with noupdate, tail name, text type, as_column 0', async () => {
    const t = setup({ tables: { dict_screen: [{ site: 'g2b', menu_no: 'M1', stage: 'bid', key_fields: '[]' }] } });
    const reply: any = await t.handlers.handle(promote, TAB);
    expect(reply.ok).toBe(true);
    const puts = writes(t.sent);
    expect(puts).toHaveLength(1);
    expect(puts[0].method).toBe('PUT');
    expect(puts[0].path).toBe('/api/tables/dict_key/records?noupdate=true');
    expect(puts[0].body.records).toEqual([{
      require: { std_key: 'other' },
      fields: { std_key: 'other', label: 'L2', stages: ['bid'], type: 'text', as_column: 0 },
    }]);
  });
  test('a screen without a stage gives empty stages', async () => {
    const t = setup({ tables: { dict_screen: [{ site: 'g2b', menu_no: 'M1', stage: '', key_fields: '[]' }] } });
    await t.handlers.handle(promote, TAB);
    expect(writes(t.sent)[0].body.records[0].fields.stages).toEqual([]);
  });
  test('a key from a grid column sends empty stages even on a staged screen', async () => {
    const t = setup({ tables: { dict_screen: [{ site: 'g2b', menu_no: 'M1', stage: 'bid', key_fields: '[]' }] } });
    await t.handlers.handle({ ...promote, k: 'colA', source: 'grid' }, TAB);
    expect(writes(t.sent)[0].body.records[0].fields.stages).toEqual([]);
  });
  test('a form key keeps the screen stage', async () => {
    const t = setup({ tables: { dict_screen: [{ site: 'g2b', menu_no: 'M1', stage: 'bid', key_fields: '[]' }] } });
    await t.handlers.handle({ ...promote, source: 'form' }, TAB);
    expect(writes(t.sent)[0].body.records[0].fields.stages).toEqual(['bid']);
  });
  test('a core refusal comes back as a failure with its reason', async () => {
    const t = setup({ fetchStatus: (call) => (call.method === 'PUT' ? 400 : 200) });
    const reply: any = await t.handlers.handle(promote, TAB);
    expect(reply).toMatchObject({ ok: false, code: 'core', error: 'E' });
  });
});
