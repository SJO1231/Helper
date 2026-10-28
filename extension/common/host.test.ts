import { describe, expect, test } from 'vitest';
import { createNativeClient } from './host';
import { installScreenWatch } from './screen-watch';

describe('screen watch', () => {
  function fakeWindow(menuNo: string | null) {
    const listeners: Record<string, () => void> = {};
    const history = {
      state: menuNo ? { data: { menuNo } } : null,
      pushState: (state: any) => void (history.state = state),
      replaceState: (state: any) => void (history.state = state),
    };
    const win = { history, addEventListener: (name: string, fn: () => void) => void (listeners[name] = fn) };
    return { win: win as unknown as Window, history, listeners };
  }
  const read = (win: Window) => {
    const data = (win.history.state as any)?.data;
    return data ? { menuNo: data.menuNo, scrnNo: '', menuCangVal: '', menuNm: '' } : null;
  };
  test('reports a menuNo change once, on pushState and popstate', () => {
    const { win, history, listeners } = fakeWindow('M1');
    const seen: string[] = [];
    installScreenWatch(win, read, (c) => seen.push(c.menuNo));
    history.pushState({ data: { menuNo: 'M1' } });
    history.pushState({ data: { menuNo: 'M2' } });
    history.state = { data: { menuNo: 'M3' } } as any;
    listeners.popstate();
    expect(seen).toEqual(['M1', 'M2', 'M3']);
  });
});

describe('native host client', () => {
  function fakePort() {
    let deliver: (m: unknown) => void = () => {};
    const posted: any[] = [];
    const port = {
      onMessage: { addListener: (fn: (m: unknown) => void) => void (deliver = fn) },
      onDisconnect: { addListener: () => {} },
      postMessage: (m: unknown) => void posted.push(m),
      disconnect: () => {},
    };
    return { runtime: { connectNative: () => port as any }, posted, deliver: (m: unknown) => deliver(m) };
  }
  test('sends the message with its requestId and takes a plain reply', async () => {
    const p = fakePort();
    const client = createNativeClient(p.runtime, () => 'R1');
    const reply = client.request({ type: 'hello' });
    expect(p.posted).toEqual([{ type: 'hello', requestId: 'R1' }]);
    p.deliver({ port: 8765, token: 'T', schema_version: 1 });
    await expect(reply).resolves.toEqual({ port: 8765, token: 'T', schema_version: 1 });
  });
  test('chunk frames are joined by requestId whatever their order', async () => {
    const p = fakePort();
    const client = createNativeClient(p.runtime, () => 'R1');
    const reply = client.request({ type: 'request' });
    const text = JSON.stringify({ status: 200, body: { a: 'V' } });
    const frame = (index: number, part: string) =>
      ({ protocolVersion: 1, requestId: 'R1', chunk: { index, total: 2, text: part } });
    p.deliver(frame(1, text.slice(10)));
    p.deliver({ protocolVersion: 1, requestId: 'OTHER', chunk: { index: 0, total: 1, text: '{}' } });
    p.deliver(frame(0, text.slice(0, 10)));
    await expect(reply).resolves.toEqual({ status: 200, body: { a: 'V' } });
  });
  test('an error message rejects the request', async () => {
    const p = fakePort();
    const reply = createNativeClient(p.runtime, () => 'R1').request({ type: 'hello' });
    p.deliver({ error: 'down' });
    await expect(reply).rejects.toThrow('down');
  });
});
