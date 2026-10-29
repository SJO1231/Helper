import { describe, expect, test } from 'vitest';
import { openMenu } from './open-menu';

type Fake = Record<string, any>;
const withCom = (calls: unknown[][]): Fake => ({ com: { gfnOpenMenuMove: (...args: unknown[]) => calls.push(args) } });
const plain = (frames: Fake[] = []): Fake => ({ frames: Object.assign([...frames], { length: frames.length }) });
const asWin = (fake: Fake) => fake as unknown as Window;

describe('openMenu', () => {
  test('calls gfnOpenMenuMove once on the top window with only the menuCangVal', () => {
    const calls: unknown[][] = [];
    const top = { ...plain(), ...withCom(calls) };
    expect(openMenu(asWin(top), 'C1')).toEqual({ ok: true });
    expect(calls).toEqual([['C1']]);
  });
  test('finds the function in a child frame and prefers the top window when both have it', () => {
    const childCalls: unknown[][] = [];
    const topCalls: unknown[][] = [];
    const child = { ...plain(), ...withCom(childCalls) };
    expect(openMenu(asWin(plain([child])), 'C2').ok).toBe(true);
    expect(childCalls).toEqual([['C2']]);
    const top = { ...plain([child]), ...withCom(topCalls) };
    openMenu(asWin(top), 'C3');
    expect([topCalls.length, childCalls.length]).toEqual([1, 1]);
  });
  test('no window has the function: ok false with a reason', () => {
    const result = openMenu(asWin(plain([plain()])), 'C1');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/gfnOpenMenuMove/);
  });
  test('a throwing mover is reported, not thrown', () => {
    const top = { ...plain(), com: { gfnOpenMenuMove: () => { throw new Error('boom'); } } };
    expect(openMenu(asWin(top), 'C1')).toEqual({ ok: false, reason: 'boom' });
  });
});
