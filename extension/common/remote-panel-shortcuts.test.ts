import { describe, expect, test } from 'vitest';
import { mount } from './remote-panel-test-kit';

describe('remote panel shortcuts', () => {
  const press = (t: any, init: Record<string, unknown>, target?: any) => {
    const event = new t.win.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    (target ?? t.win.document.body).dispatchEvent(event);
    return event;
  };
  const altG = { key: 'g', code: 'KeyG', altKey: true };

  test('Alt+G folds and unfolds the panel', async () => {
    const t = await mount();
    expect(press(t, altG).defaultPrevented).toBe(true);
    expect(t.q('.bar').hidden).toBe(true);
    expect(t.saved.at(-1)).toMatchObject({ collapsed: true });
    press(t, altG);
    expect(t.q('.bar').hidden).toBe(false);
  });
  test('Alt+G works while an input has focus', async () => {
    const t = await mount();
    const input = t.win.document.createElement('input');
    t.win.document.body.appendChild(input);
    input.focus();
    expect(press(t, altG, input).defaultPrevented).toBe(true);
    expect(t.q('.bar').hidden).toBe(true);
  });
  test('Alt+G is received in the capture phase even if the page stops propagation', async () => {
    const t = await mount();
    t.win.document.body.addEventListener('keydown', (e: any) => e.stopPropagation());
    press(t, altG);
    expect(t.q('.bar').hidden).toBe(true);
  });
  test('a held Alt+G (repeat) toggles and saves only once', async () => {
    const t = await mount();
    press(t, altG);
    const count = t.saved.length;
    press(t, { ...altG, repeat: true });
    expect(t.q('.bar').hidden).toBe(true);
    expect(t.saved.length).toBe(count);
  });
  test('the close button tells how to bring the panel back', async () => {
    const t = await mount();
    expect(t.q('[data-action="close"]').title).toBe('종료 (Alt+G로 다시 열기)');
  });
  test('folding blurs a focused element inside the panel', async () => {
    const t = await mount();
    const button = t.q('[data-action="collapse"]');
    button.focus();
    expect(t.remote.root.activeElement).toBe(button);
    press(t, altG);
    expect(t.remote.root.activeElement).toBeNull();
  });
  test('keys other than Alt+G are left alone', async () => {
    const t = await mount();
    const others = [{ key: 'g', code: 'KeyG' }, { ...altG, ctrlKey: true }, { key: 'h', code: 'KeyH', altKey: true }];
    for (const init of others) {
      expect(press(t, init).defaultPrevented).toBe(false);
    }
    expect(t.q('.bar').hidden).toBe(false);
  });
  test('Alt+G after closing attaches the panel again, and only one handler runs', async () => {
    const t = await mount();
    t.q('[data-action="close"]').click();
    press(t, altG);
    expect(t.win.document.getElementById('helper-remote')).not.toBeNull();
    expect(t.q('.bar').hidden).toBe(false);
    press(t, altG);
    expect(t.q('.bar').hidden).toBe(true);
  });
  test('Alt+Shift+G puts the panel back to the default place and saves it', async () => {
    const t = await mount();
    t.fire(t.q('.title'), 'pointerdown', 10, 10);
    t.fire(t.win.document, 'pointermove', 110, 60);
    t.fire(t.win.document, 'pointerup', 110, 60);
    expect(press(t, { ...altG, shiftKey: true, key: 'G' }).defaultPrevented).toBe(true);
    for (const node of [t.q('.bar'), t.q('.bubble')]) {
      expect(node.style.left).toBe('');
      expect(node.style.top).toBe('');
    }
    expect(t.saved.at(-1)).toEqual({ collapsed: false });
    expect(t.q('.bar').hidden).toBe(false);
  });
});

describe('auto collect switch storage', () => {
  test('toggling saves autoCollect and a saved true is restored', async () => {
    const t = await mount();
    const box = t.q('[data-role="auto-collect"]');
    expect(box.checked).toBe(false);
    box.checked = true;
    box.dispatchEvent(new t.win.Event('change'));
    expect(t.saved.at(-1)).toMatchObject({ autoCollect: true });
    const again = await mount({ collapsed: false, autoCollect: true });
    expect(again.q('[data-role="auto-collect"]').checked).toBe(true);
  });
});
