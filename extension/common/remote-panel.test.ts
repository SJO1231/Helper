import { Window } from 'happy-dom';
import { describe, expect, test } from 'vitest';
import { createRemote } from './remote';
import type { PanelState, PanelStore } from './remote-panel';
import { clampPosition } from './remote-panel';

const SIZE = { width: 260, height: 100 };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function memoryStore(initial?: Partial<PanelState>) {
  const saved: PanelState[] = [];
  const store: PanelStore = {
    load: async () => initial,
    save: (state) => void saved.push(state),
  };
  return { store, saved };
}

async function mount(initial?: Partial<PanelState>, slowLoad = false) {
  const win = new Window({ url: 'https://example.invalid/', width: 1000, height: 700 }) as any;
  const { store, saved } = memoryStore(initial);
  let finishLoad: () => void = () => undefined;
  if (slowLoad) {
    store.load = () => new Promise((resolve) => (finishLoad = () => resolve(initial)));
  }
  const send = async () => ({ ok: true, data: null }) as any;
  const remote = createRemote({ doc: win.document, send, panelStore: store });
  const q = (selector: string) => remote.root.querySelector(selector) as any;
  // happy-dom은 배치를 계산하지 않아 크기와 위치를 style에서 읽어 주는 가짜 상자를 붙인다.
  for (const node of [q('.bar'), q('.bubble')]) {
    node.getBoundingClientRect = () => ({
      left: parseFloat(node.style.left) || 0, top: parseFloat(node.style.top) || 0, ...SIZE,
    });
  }
  await settle();
  const fire = (target: any, type: string, x: number, y: number) =>
    target.dispatchEvent(new win.MouseEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y }));
  return { win, remote, q, saved, fire, finishLoad: () => finishLoad() };
}

describe('clampPosition', () => {
  test('keeps the box inside the view', () => {
    const view = { width: 1000, height: 700 };
    expect(clampPosition({ left: -20, top: -5 }, SIZE, view)).toEqual({ left: 0, top: 0 });
    expect(clampPosition({ left: 5000, top: 5000 }, SIZE, view)).toEqual({ left: 740, top: 600 });
    expect(clampPosition({ left: 10, top: 20 }, SIZE, view)).toEqual({ left: 10, top: 20 });
  });
});

describe('remote panel motion', () => {
  test('dragging the title moves the panel and saves the position', async () => {
    const t = await mount();
    t.fire(t.q('.title'), 'pointerdown', 10, 10);
    t.fire(t.win.document, 'pointermove', 110, 60);
    t.fire(t.win.document, 'pointerup', 110, 60);
    expect(t.q('.bar').style.left).toBe('100px');
    expect(t.q('.bar').style.top).toBe('50px');
    expect(t.saved.at(-1)).toEqual({ left: 100, top: 50, collapsed: false });
  });
  test('the panel cannot be dragged out of the screen', async () => {
    const t = await mount();
    t.fire(t.q('.title'), 'pointerdown', 10, 10);
    t.fire(t.win.document, 'pointermove', -900, -900);
    expect(t.q('.bar').style.left).toBe('0px');
    expect(t.q('.bar').style.top).toBe('0px');
    t.fire(t.win.document, 'pointermove', 9000, 9000);
    t.fire(t.win.document, 'pointerup', 9000, 9000);
    expect(t.q('.bar').style.left).toBe('740px');
    expect(t.q('.bar').style.top).toBe('600px');
  });
  test('moving the pointer without pressing the title does nothing', async () => {
    const t = await mount();
    t.fire(t.win.document, 'pointermove', 300, 300);
    expect(t.q('.bar').style.left).toBe('');
  });
  test('the collapse button turns the panel into a bubble and the bubble restores it', async () => {
    const t = await mount();
    expect(t.q('.bubble').hidden).toBe(true);
    t.q('[data-action="collapse"]').click();
    expect(t.q('.bar').hidden).toBe(true);
    expect(t.q('.bubble').hidden).toBe(false);
    expect(t.q('.bubble').textContent).toBe('G2B');
    expect(t.saved.at(-1)).toMatchObject({ collapsed: true });
    t.q('.bubble').click();
    expect(t.q('.bar').hidden).toBe(false);
    expect(t.q('.bubble').hidden).toBe(true);
    expect(t.saved.at(-1)).toMatchObject({ collapsed: false });
  });
  test('pressing the collapse button does not start a drag', async () => {
    const t = await mount();
    t.fire(t.q('[data-action="collapse"]'), 'pointerdown', 5, 5);
    t.fire(t.win.document, 'pointermove', 200, 200);
    expect(t.q('.bar').style.left).toBe('');
  });
  test('the bubble can be dragged, and a drag does not restore the panel', async () => {
    const t = await mount();
    t.q('[data-action="collapse"]').click();
    t.fire(t.q('.bubble'), 'pointerdown', 5, 5);
    t.fire(t.win.document, 'pointermove', 205, 105);
    t.fire(t.win.document, 'pointerup', 205, 105);
    t.q('.bubble').click();
    expect(t.q('.bubble').style.left).toBe('200px');
    expect(t.q('.bubble').hidden).toBe(false);
    t.q('.bubble').click();
    expect(t.q('.bubble').hidden).toBe(true);
    expect(t.q('.bar').style.left).toBe('200px');
  });
  test('a saved position and collapsed state come back when the panel attaches again', async () => {
    const t = await mount({ left: 120, top: 80, collapsed: true });
    expect(t.q('.bubble').hidden).toBe(false);
    expect(t.q('.bar').hidden).toBe(true);
    expect(t.q('.bubble').style.left).toBe('120px');
    expect(t.q('.bar').style.top).toBe('80px');
  });
  test('a saved position is clamped to the current screen', async () => {
    const t = await mount({ left: 9000, top: 9000, collapsed: false });
    expect(t.q('.bar').style.left).toBe('740px');
  });
  test('pointercancel ends the drag and saves the position', async () => {
    const t = await mount();
    t.fire(t.q('.title'), 'pointerdown', 10, 10);
    t.fire(t.win.document, 'pointermove', 110, 60);
    t.fire(t.win.document, 'pointercancel', 110, 60);
    t.fire(t.win.document, 'pointermove', 400, 400);
    expect(t.q('.bar').style.left).toBe('100px');
    expect(t.saved.at(-1)).toEqual({ left: 100, top: 50, collapsed: false });
  });
  test('the drag captures the pointer when the browser supports it', async () => {
    const t = await mount();
    const captured: number[] = [];
    t.q('.title').setPointerCapture = (id: number) => captured.push(id);
    const down = new t.win.MouseEvent('pointerdown', { bubbles: true, composed: true, clientX: 10, clientY: 10 });
    Object.defineProperty(down, 'pointerId', { value: 7 });
    t.q('.title').dispatchEvent(down);
    expect(captured).toEqual([7]);
  });
  test('a saved position that loads after the user started dragging is ignored', async () => {
    const t = await mount({ left: 500, top: 300, collapsed: true }, true);
    t.fire(t.q('.title'), 'pointerdown', 10, 10);
    t.fire(t.win.document, 'pointermove', 110, 60);
    t.fire(t.win.document, 'pointerup', 110, 60);
    t.finishLoad();
    await settle();
    expect(t.q('.bar').style.left).toBe('100px');
    expect(t.q('.bar').hidden).toBe(false);
  });
  test('resizing the window clamps the panel back inside', async () => {
    const t = await mount({ left: 700, top: 50, collapsed: false });
    expect(t.q('.bar').style.left).toBe('700px');
    t.win.innerWidth = 600;
    t.win.dispatchEvent(new t.win.Event('resize'));
    expect(t.q('.bar').style.left).toBe('340px');
  });
  test('garbage in storage is ignored', async () => {
    const t = await mount({ left: 'x' as any, collapsed: 'yes' as any });
    expect(t.q('.bar').hidden).toBe(false);
    expect(t.q('.bar').style.left).toBe('');
  });
  test('the panel works without a store', () => {
    const win = new Window({ url: 'https://example.invalid/' }) as any;
    const send = async () => ({ ok: true, data: null }) as any;
    const remote = createRemote({ doc: win.document, send });
    (remote.root.querySelector('[data-action="collapse"]') as any).click();
    expect((remote.root.querySelector('.bubble') as any).hidden).toBe(false);
  });
});

const paneHidden = (t: any, name: string) => t.q(`[data-pane="${name}"]`).hidden;

describe('remote panel tabs', () => {
  test('the work tab is shown first and the other panes are hidden', async () => {
    const t = await mount();
    expect(paneHidden(t, 'work')).toBe(false);
    expect(paneHidden(t, 'collect')).toBe(true);
    expect(paneHidden(t, 'viewer')).toBe(true);
    expect(t.q('[data-tab="work"]').getAttribute('aria-selected')).toBe('true');
  });
  test('groups the buttons into the three tabs', async () => {
    const t = await mount();
    const inPane = (pane: string, action: string) => t.q(`[data-pane="${pane}"] [data-action="${action}"]`);
    for (const action of ['year-minus', 'year-plus', 'search', 'excel', 'row-count-apply']) {
      expect(inPane('work', action)).not.toBeNull();
    }
    for (const action of ['collect', 'snapshot']) expect(inPane('collect', action)).not.toBeNull();
    expect(t.q('[data-pane="collect"] [data-role="mode"]')).not.toBeNull();
    expect(inPane('viewer', 'open-viewer')).not.toBeNull();
    expect(t.q('[data-pane="viewer"] [data-role="core-status"]')).not.toBeNull();
    expect(t.q('.bar > [data-role="diagnostics"]')).not.toBeNull();
    expect(t.q('.bar > [data-role="toast"]')).not.toBeNull();
  });
  test('clicking a tab switches the pane and saves it in the same object', async () => {
    const t = await mount({ left: 5, top: 6, collapsed: false });
    t.q('[data-tab="collect"]').click();
    expect(paneHidden(t, 'collect')).toBe(false);
    expect(paneHidden(t, 'work')).toBe(true);
    expect(t.saved.at(-1)).toEqual({ left: 5, top: 6, collapsed: false, tab: 'collect' });
  });
  test('the saved tab comes back, and a bad one is ignored', async () => {
    const t = await mount({ tab: 'viewer' });
    expect(paneHidden(t, 'viewer')).toBe(false);
    const bad = await mount({ tab: 'nope' as any });
    expect(paneHidden(bad, 'work')).toBe(false);
  });
});

describe('remote panel close', () => {
  const hostOf = (t: any) => t.win.document.getElementById('helper-remote');
  test('the close button detaches the panel and keeps the saved position', async () => {
    const t = await mount({ left: 5, top: 6, collapsed: true });
    t.q('[data-action="close"]').click();
    expect(hostOf(t)).toBeNull();
    expect(t.saved).toEqual([]);
  });
  test('the panel is not attached again when the page redraws', async () => {
    const t = await mount();
    t.q('[data-action="close"]').click();
    t.win.document.body.appendChild(t.win.document.createElement('div'));
    await settle();
    expect(hostOf(t)).toBeNull();
  });
  test('without closing, a redraw still attaches the panel again', async () => {
    const t = await mount();
    hostOf(t).remove();
    t.win.document.body.appendChild(t.win.document.createElement('div'));
    await settle();
    expect(hostOf(t)).not.toBeNull();
  });
});

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
