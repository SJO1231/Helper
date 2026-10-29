import { Window } from 'happy-dom';
import { describe, expect, test } from 'vitest';
import { installActionWatch } from './action-watch';

const FAST = { graceMs: 80, pollMs: 10, loadedIntervalMs: 10 };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mount() {
  const win = new Window({ url: 'https://example.invalid/' }) as any;
  win.document.body.innerHTML = `
    <button id="b"><span id="inner">go</span></button>
    <input id="i" type="submit"><div id="plain">x</div>
    <div id="helper-remote"><button id="remote-b">r</button></div>
    <iframe id="__processbarIFrame"></iframe>`;
  const bar = win.document.getElementById('__processbarIFrame');
  let shown = false;
  bar.getClientRects = () => (shown ? [{}] : []);
  let settled = 0;
  const watch = installActionWatch(win, () => void settled++, FAST);
  watch.setEnabled(true);
  const click = (id: string, trusted: boolean) => {
    const event = new win.MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'isTrusted', { value: trusted });
    win.document.getElementById(id).dispatchEvent(event);
  };
  return { watch, click, show: (v: boolean) => (shown = v), settled: () => settled, win };
}

describe('action watch', () => {
  test('trusted button click, loading shows then ends → notifies once', async () => {
    const t = mount();
    t.click('inner', true);
    await wait(20);
    t.show(true);
    await wait(40);
    expect(t.settled()).toBe(0);
    t.show(false);
    await wait(120);
    expect(t.settled()).toBe(1);
  });
  test('no loading indicator after the click → nothing', async () => {
    const t = mount();
    t.click('b', true);
    await wait(200);
    expect(t.settled()).toBe(0);
  });
  test('untrusted (synthetic / trigger) click → nothing', async () => {
    const t = mount();
    t.click('b', false);
    t.show(true);
    await wait(30);
    t.show(false);
    await wait(150);
    expect(t.settled()).toBe(0);
  });
  test('click inside the remote host → nothing', async () => {
    const t = mount();
    t.click('remote-b', true);
    t.show(true);
    await wait(30);
    t.show(false);
    await wait(150);
    expect(t.settled()).toBe(0);
  });
  test('click on a non-button element → nothing', async () => {
    const t = mount();
    t.click('plain', true);
    t.show(true);
    await wait(30);
    t.show(false);
    await wait(150);
    expect(t.settled()).toBe(0);
  });
  test('disabled → nothing; submit input counts as a button', async () => {
    const t = mount();
    t.watch.setEnabled(false);
    t.click('i', true);
    t.show(true);
    await wait(30);
    t.show(false);
    await wait(150);
    expect(t.settled()).toBe(0);
    t.watch.setEnabled(true);
    t.click('i', true);
    t.show(true);
    await wait(30);
    t.show(false);
    await wait(150);
    expect(t.settled()).toBe(1);
  });
});
