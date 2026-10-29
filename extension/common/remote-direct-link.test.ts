import { describe, expect, test } from 'vitest';
import type { Handler } from './remote-test-kit';
import { change, mount, routing, screenRow, settle } from './remote-test-kit';

describe('direct link row', () => {
  const list = [
    { menu_no: 'M0', menu_cang_val: 'C0', name: 'N0' },
    { menu_no: 'M1', menu_cang_val: 'C1', name: 'N1' },
    { menu_no: 'M2', menu_cang_val: 'C2', name: '' },
  ];
  const linking = (listReply: unknown): Handler => (m) => {
    if (m.kind === 'screen-list') return listReply;
    if (m.kind === 'open-screen') return { ok: true, data: { ok: true } };
    return routing('bid')(m);
  };
  const options = (t: ReturnType<typeof mount>) =>
    [...t.q('[data-role="screen-select"]').options].map((o: any) => [o.value, o.textContent]);

  test('select shows name (menu_no when name is empty) and keeps the current screen selected', async () => {
    const t = mount(linking({ ok: true, data: list }));
    await t.remote.handleScreenChange(change);
    expect(options(t)).toEqual([['M0', 'N0'], ['M1', 'N1'], ['M2', 'M2']]);
    expect(t.q('[data-role="screen-select"]').value).toBe('M1');
  });
  test('the list is read again on every screen change', async () => {
    const t = mount(linking({ ok: true, data: list }));
    await t.remote.handleScreenChange(change);
    await t.remote.handleScreenChange({ ...change, menuNo: 'M2' });
    expect(t.sent.filter((m) => m.kind === 'screen-list')).toHaveLength(2);
    expect(t.q('[data-role="screen-select"]').value).toBe('M2');
  });
  test('go button sends open-screen once with the chosen menuNo and toasts the name', async () => {
    const t = mount(linking({ ok: true, data: list }));
    await t.remote.handleScreenChange(change);
    t.q('[data-role="screen-select"]').value = 'M0';
    t.q('[data-action="open-screen"]').click();
    await settle();
    expect(t.sent.filter((m) => m.kind === 'open-screen')).toEqual([{ kind: 'open-screen', menuNo: 'M0' }]);
    expect(t.q('[data-role="toast"]').textContent).toBe('이동: N0');
  });
  test('a failed move shows its reason', async () => {
    const t = mount((m) => (m.kind === 'open-screen'
      ? { ok: true, data: { ok: false, reason: 'R-why' } } : linking({ ok: true, data: list })(m)));
    await t.remote.handleScreenChange(change);
    t.q('[data-action="open-screen"]').click();
    await settle();
    expect(t.q('[data-role="toast"]').textContent).toBe('R-why');
  });
  test('core offline: select is empty and disabled, so is the go button', async () => {
    const t = mount(linking({ ok: false, code: 'offline', error: '코어 꺼짐' }));
    await t.remote.handleScreenChange(change);
    expect(options(t)).toEqual([]);
    expect(t.q('[data-role="screen-select"]').disabled).toBe(true);
    expect(t.q('[data-action="open-screen"]').disabled).toBe(true);
  });
  test('a truncated screen list shows 직링크 목록 잘림 in the diagnostics line', async () => {
    const t = mount((m) => (m.kind === 'screen-list' ? { ok: true, data: [], truncated: true } : routing('bid')(m)));
    await t.remote.refreshScreenList();
    expect(t.q('[data-role="diagnostics"]').textContent).toContain('직링크 목록 잘림');
    const plain = mount(routing('bid'));
    await plain.remote.refreshScreenList();
    expect(plain.q('[data-role="diagnostics"]').textContent).not.toContain('잘림');
  });
});
