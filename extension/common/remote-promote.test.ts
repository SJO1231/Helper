import { Window } from 'happy-dom';
import { describe, expect, test } from 'vitest';
import type { Handler } from './remote-test-kit';
import { change, diag, labels, mount, raw, routing, screenRow, settle } from './remote-test-kit';
import { renderSnapshot } from './snapshot-view';

describe('promote unknown keys', () => {
  const list = [{ k: 'dm.k1', l: '라벨A' }, { k: 'k2', l: '라벨B' }];
  const withList = (reply: unknown): Handler => (m) => {
    if (m.kind === 'snapshot') return { ok: true, data: { raw, diag, labels, unknownKeyList: list } };
    if (m.kind === 'promote-key') return reply;
    return routing('bid')(m);
  };
  test('renderSnapshot draws the list with a button per key; none when empty', () => {
    const doc = new Window().document as any;
    const view = renderSnapshot(doc, { raw, diag, labels, unknownKeyList: list });
    expect(view.querySelector('h3')!.textContent).toBe('미등록 키 2개');
    const buttons = Array.from(view.querySelectorAll('[data-action="promote-key"]')) as any[];
    expect(buttons.map((b) => b.dataset.k)).toEqual(['dm.k1', 'k2']);
    expect(buttons[0].textContent).toBe('사전에 올리기');
    const none = renderSnapshot(doc, { raw, diag, labels, unknownKeyList: [] });
    expect(none.querySelector('[data-action="promote-key"]')).toBeNull();
  });
  test('pressing the button sends promote-key, marks the row and lowers the count', async () => {
    const t = mount(withList({ ok: true, data: { stdKey: 'k1' } }));
    await t.remote.handleScreenChange(change);
    t.q('[data-action="snapshot"]').click();
    await settle();
    t.q('[data-action="promote-key"]').click();
    await settle();
    expect(t.sent.find((m) => m.kind === 'promote-key')).toEqual({
      kind: 'promote-key', k: 'dm.k1', l: '라벨A', menuNo: 'M1',
    });
    expect(t.q('[data-role="snapshot"] li').textContent).toContain('올림');
    expect(t.q('[data-role="diagnostics"]').textContent).toMatch(/미등록 키 3/);
  });
  test('the button carries the key source (form or grid) to promote-key', async () => {
    const t = mount((m) => (m.kind === 'snapshot'
      ? { ok: true, data: { raw, diag, labels, unknownKeyList: [{ k: 'g1', l: 'LG', source: 'grid' }] } }
      : routing('bid')(m)));
    await t.remote.handleScreenChange(change);
    t.q('[data-action="snapshot"]').click();
    await settle();
    t.q('[data-action="promote-key"]').click();
    await settle();
    expect(t.sent.find((m) => m.kind === 'promote-key')).toMatchObject({ k: 'g1', source: 'grid' });
  });
  test('a refusal shows the reason in the toast and keeps the count', async () => {
    const t = mount(withList({ ok: false, code: 'core', error: '표준키 이름으로 쓸 수 없다' }));
    t.q('[data-action="snapshot"]').click();
    await settle();
    t.q('[data-action="promote-key"]').click();
    await settle();
    expect(t.q('[data-role="toast"]').textContent).toBe('표준키 이름으로 쓸 수 없다');
    expect(t.q('[data-role="diagnostics"]').textContent).toMatch(/미등록 키 4/);
    expect(t.q('[data-role="snapshot"] li').textContent).not.toContain('올림');
  });
});
