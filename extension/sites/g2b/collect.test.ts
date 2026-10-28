import { afterEach, describe, expect, test, vi } from 'vitest';
import { collectScreen } from './collect';
import { framesWithWebSquare } from './frames';
import { readScreenState } from './identify';
import { waitUntilLoaded } from './loading';
import { makeWindow, setState } from './test-fixtures';

const STATE = { menuNo: 'M0001', scrnNo: 'S0001', menuCangVal: 'C0001', menuNm: 'N1', extra: 7, nested: { a: 1 } };

// 보임 2, 본문 안 숨김 1, 본문 밖 1, ref 빈 컴포넌트 본문 안 1
function modeFixture() {
  return makeWindow({
    state: STATE,
    forms: [
      { id: 'v1', ref: 'd.v1', value: 'V1' },
      { id: 'v2', ref: 'd.v2', value: 'V2' },
      { id: 'h1', ref: 'd.h1', value: 'V3', visible: false },
      { id: 'o1', ref: 'd.o1', value: 'V4', outside: true },
      { id: 'e1', value: 'V5' },
    ],
  });
}
const keysOf = (r: Awaited<ReturnType<typeof collectScreen>>) => r.raw.pointInfo.map((f) => f.k).sort();

afterEach(() => vi.useRealTimers());

describe('collectScreen modes', () => {
  test('visible mode reads body and visible only', async () => {
    const r = await collectScreen(modeFixture(), 'visible');
    expect(keysOf(r)).toEqual(['d.v1', 'd.v2']);
  });
  test('hidden mode reads whole body', async () => {
    const r = await collectScreen(modeFixture(), 'hidden');
    expect(keysOf(r)).toEqual(['d.h1', 'd.v1', 'd.v2']);
  });
  test('all mode reads whole document', async () => {
    const r = await collectScreen(modeFixture(), 'all');
    expect(keysOf(r)).toEqual(['d.h1', 'd.o1', 'd.v1', 'd.v2']);
  });
  test('empty-ref exclusion applies in all three modes', async () => {
    for (const mode of ['visible', 'hidden', 'all'] as const) {
      const r = await collectScreen(modeFixture(), mode);
      expect(r.raw.pointInfo.some((f) => f.v === 'V5')).toBe(false);
      expect(r.diag.droppedEmptyRef).toBe(1);
    }
  });
  test('the mode is kept next to diagnostics counts', async () => {
    const r = await collectScreen(modeFixture(), 'visible');
    expect(r.diag.forms).toBe(2);
    expect(r.diag.grids).toBe(0);
  });
});

describe('collectScreen frames', () => {
  const field = (win: any, id: string) => win[id].getValue();
  test('frames merge; on the same K the visible one wins', async () => {
    const child = makeWindow({ forms: [{ id: 'c', ref: 'd.k', value: 'CHILD' }, { id: 'c2', ref: 'd.only', value: 'X' }] });
    const top = makeWindow({
      state: STATE,
      forms: [{ id: 't', ref: 'd.k', value: 'TOP', visible: false }],
      frames: [child],
    });
    const r = await collectScreen(top, 'hidden');
    expect(r.raw.pointInfo.find((f) => f.k === 'd.k')?.v).toBe('CHILD');
    expect(r.raw.pointInfo.map((f) => f.k).sort()).toEqual(['d.k', 'd.only']);
    expect(field(top, 't')).toBe('TOP');
  });
  test('when both are alike the frame nearer the top wins', async () => {
    const child = makeWindow({ forms: [{ id: 'c', ref: 'd.k', value: 'CHILD' }] });
    const top = makeWindow({ state: STATE, forms: [{ id: 't', ref: 'd.k', value: 'TOP' }], frames: [child] });
    const r = await collectScreen(top, 'visible');
    expect(r.raw.pointInfo.map((f) => f.v)).toEqual(['TOP']);
  });
  test('frames without WebSquare are not read', () => {
    const plain = makeWindow({ withWebSquare: false });
    const child = makeWindow();
    const top = makeWindow({ frames: [plain, child] });
    expect(framesWithWebSquare(top)).toEqual([top, child]);
  });
  test('breadth first: top, then its frames, then theirs', () => {
    const grand = makeWindow();
    const childA = makeWindow({ frames: [grand] });
    const childB = makeWindow();
    const top = makeWindow({ frames: [childA, childB] });
    expect(framesWithWebSquare(top)).toEqual([top, childA, childB, grand]);
  });
  test('same dataList across frames keeps one table', async () => {
    const cols = [{ id: 'colA', label: 'L1' }];
    const child = makeWindow({ grids: [{ id: 'gc', dataList: 'dl', columns: cols, visible: false }] });
    const top = makeWindow({ state: STATE, grids: [{ id: 'gt', dataList: 'dl', columns: cols }], frames: [child] });
    const r = await collectScreen(top, 'hidden');
    expect(r.raw.tables.map((t) => t.id)).toEqual(['gt']);
  });
});

describe('waitUntilLoaded', () => {
  test('returns at once when there is no process bar', async () => {
    await expect(waitUntilLoaded(makeWindow())).resolves.toBeUndefined();
  });
  test('waits while the process bar is visible and gives up after 10s', async () => {
    vi.useFakeTimers();
    const p = waitUntilLoaded(makeWindow({ processBarVisible: true }));
    const settled = expect(p).rejects.toThrow('loading');
    vi.advanceTimersByTime(10_000);
    await settled;
  });
  test('resolves when the bar disappears before the limit', async () => {
    vi.useFakeTimers();
    const win = makeWindow({ processBarVisible: true });
    const bar = win.document.getElementById('__processbarIFrame') as any;
    const p = waitUntilLoaded(win);
    bar.getClientRects = () => [];
    vi.advanceTimersByTime(400);
    await expect(p).resolves.toBeUndefined();
  });
});

describe('collectScreen guards', () => {
  test('rejects with loading when the process bar never goes away', async () => {
    vi.useFakeTimers();
    const win = makeWindow({ state: STATE, processBarVisible: true });
    const settled = expect(collectScreen(win, 'visible')).rejects.toThrow('loading');
    vi.advanceTimersByTime(10_000);
    await settled;
  });
  test('no history state rejects with no-screen', async () => {
    await expect(collectScreen(makeWindow({ state: null }), 'visible')).rejects.toThrow('no-screen');
  });
  test('menuNo change between start and end rejects with screen-changed', async () => {
    const win = makeWindow({ state: STATE, forms: [{ id: 'f', ref: 'd.f', value: 'V' }] });
    const original = win.f.getValue;
    win.f.getValue = () => {
      setState(win, { ...STATE, menuNo: 'M0002' });
      return original();
    };
    await expect(collectScreen(win, 'visible')).rejects.toThrow('screen-changed');
  });
  test('raw carries state without param and param flattened', async () => {
    const withParam = { ...STATE, param: { k1: 'V', obj: { k2: 'V' }, deep: [1] } };
    const r = await collectScreen(makeWindow({ state: withParam }), 'visible');
    expect(r.raw.state).toEqual({ menuNo: 'M0001', scrnNo: 'S0001', menuCangVal: 'C0001', menuNm: 'N1', extra: '7' });
    expect(r.raw.param).toEqual({ 'param.k1': 'V', 'param.obj.k2': 'V' });
    expect(r.diag.droppedParam).toBe(1);
    expect(r.screen).toEqual({ menuNo: 'M0001', scrnNo: 'S0001', menuNm: 'N1' });
  });
});

describe('readScreenState', () => {
  test('reads identity fields and keeps scalars only', () => {
    const s = readScreenState(makeWindow({ state: STATE }))!;
    expect([s.menuNo, s.scrnNo, s.menuCangVal, s.menuNm]).toEqual(['M0001', 'S0001', 'C0001', 'N1']);
    expect(s.state).not.toHaveProperty('nested');
  });
  test('null without history state or menuNo', () => {
    expect(readScreenState(makeWindow({ state: null }))).toBeNull();
    expect(readScreenState(makeWindow({ state: { scrnNo: 'S' } }))).toBeNull();
  });
});
