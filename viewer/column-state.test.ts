import { describe, expect, test } from 'vitest';
import { columnStateKey, createColumnMemory } from './column-state';
import type { ColumnStateApi, SavedColumn } from './column-state';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
}

const DEFAULT: SavedColumn[] = [
  { colId: 'keyA', width: 120, hide: false },
  { colId: 'keyB', width: 120, hide: false },
  { colId: 'keyC', width: 120, hide: false },
];

// 순서 인자를 지키는 가짜 그리드. 가진 열에만 적용하고 모르는 열은 건너뛴다.
function fakeApi(start: SavedColumn[] = DEFAULT) {
  let state = start.map((c) => ({ ...c }));
  const applied: unknown[] = [];
  const api: ColumnStateApi = {
    getColumnState: () => state.map((c) => ({ ...c, sort: null })),
    applyColumnState({ state: next, applyOrder }) {
      applied.push({ next, applyOrder });
      const byId = new Map(state.map((c) => [c.colId, c]));
      const ordered = next.filter((c) => byId.has(c.colId)).map((c) => Object.assign(byId.get(c.colId)!, c));
      state = applyOrder ? [...ordered, ...state.filter((c) => !ordered.includes(c))] : state;
      return true;
    },
  };
  return { api, applied, current: () => state };
}

describe('column memory', () => {
  test('the key carries the table name', () => {
    expect(columnStateKey('g2b_bid')).toBe('viewer.columns.g2b_bid');
  });

  test('save keeps only width, order and hide', () => {
    const storage = fakeStorage();
    const { api } = fakeApi();
    createColumnMemory(api, 'tbl', storage).save();
    expect(JSON.parse(storage.data['viewer.columns.tbl'])).toEqual(DEFAULT);
  });

  test('restore applies the saved width, hide and order', () => {
    const saved: SavedColumn[] = [
      { colId: 'keyC', width: 300, hide: false },
      { colId: 'keyA', width: 80, hide: true },
      { colId: 'keyB', width: 120, hide: false },
    ];
    const storage = fakeStorage({ 'viewer.columns.tbl': JSON.stringify(saved) });
    const fake = fakeApi();
    createColumnMemory(fake.api, 'tbl', storage).restore();
    expect(fake.current().map((c) => [c.colId, c.width, c.hide])).toEqual([
      ['keyC', 300, false], ['keyA', 80, true], ['keyB', 120, false],
    ]);
  });

  test('restore skips columns the table no longer has', () => {
    const saved = [{ colId: 'gone', width: 50 }, { colId: 'keyB', width: 77 }];
    const storage = fakeStorage({ 'viewer.columns.tbl': JSON.stringify(saved) });
    const fake = fakeApi();
    createColumnMemory(fake.api, 'tbl', storage).restore();
    expect(fake.current().find((c) => c.colId === 'keyB')?.width).toBe(77);
    expect(JSON.stringify(fake.applied)).not.toContain('gone');
  });

  test('restore ignores broken storage', () => {
    for (const bad of ['{not json', '{"a":1}', '[1,"x",{"width":5}]']) {
      const fake = fakeApi();
      createColumnMemory(fake.api, 'tbl', fakeStorage({ 'viewer.columns.tbl': bad })).restore();
      expect(fake.current()).toEqual(DEFAULT);
    }
  });

  test('reset clears the saved state and brings back the defaults', () => {
    const storage = fakeStorage();
    const fake = fakeApi();
    const memory = createColumnMemory(fake.api, 'tbl', storage);
    fake.api.applyColumnState({ state: [{ colId: 'keyB', width: 500, hide: true }], applyOrder: true });
    memory.save();
    memory.reset();
    expect(storage.data['viewer.columns.tbl']).toBeUndefined();
    expect(fake.current()).toEqual(DEFAULT);
  });

  test('tables keep separate states', () => {
    const storage = fakeStorage();
    createColumnMemory(fakeApi().api, 'one', storage).save();
    expect(Object.keys(storage.data)).toEqual(['viewer.columns.one']);
  });

  test('without a storage nothing breaks', () => {
    const memory = createColumnMemory(fakeApi().api, 'tbl', undefined);
    memory.save();
    memory.restore();
    memory.reset();
  });

  test('a storage that throws is tolerated', () => {
    const storage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    const memory = createColumnMemory(fakeApi().api, 'tbl', storage);
    memory.save();
    memory.restore();
    memory.reset();
  });
});
