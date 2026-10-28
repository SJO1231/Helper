import { describe, expect, test } from 'vitest';
import type { ColumnInfo, KeyType } from '../shared/types';
import { buildColumnDefs, createDatasource, filterModelToFilter, sortModelToString } from './grid-adapter';
import type { PagedSource, RowFilter } from './paged-source';

const cols: ColumnInfo[] = [
  { id: 'keyA', fields: { label: '라벨A', type: 'text', index: false } },
  { id: 'keyB', fields: { label: '라벨B', type: 'money', index: false } },
];

function fakeSource() {
  const sorts: (string | null)[] = [];
  const filters: (RowFilter | null)[] = [];
  const source: PagedSource = {
    async getRows(start, end) {
      return { rows: Array.from({ length: end - start }, () => ({ keyA: 'V1' })), total: 42 };
    },
    setSort: (s) => void sorts.push(s),
    setFilter: (f) => void filters.push(f),
    currentQuery: () => ({}),
  };
  return { source, sorts, filters };
}

function request(sortModel: object[] = [], filterModel: object = {}) {
  const outcome: { rows?: unknown[]; last?: number; failed?: boolean } = {};
  return {
    outcome,
    params: {
      startRow: 0,
      endRow: 500,
      sortModel,
      filterModel,
      successCallback: (rows: unknown[], last: number) => Object.assign(outcome, { rows, last }),
      failCallback: () => (outcome.failed = true),
    } as never,
  };
}

describe('sort and filter translation', () => {
  test('sortModel becomes the core sort string', () => {
    expect(sortModelToString([])).toBeNull();
    expect(sortModelToString([{ colId: 'keyA', sort: 'asc' }])).toBe('keyA');
    expect(sortModelToString([{ colId: 'keyA', sort: 'asc' }, { colId: 'keyB', sort: 'desc' }])).toBe('keyA,-keyB');
  });

  test('text filter models become value lists', () => {
    expect(filterModelToFilter({})).toBeNull();
    expect(filterModelToFilter({ keyB: { filterType: 'text', type: 'equals', filter: 'V1' } })).toEqual({
      keyB: ['V1'],
    });
  });

  test('an empty filter text is not sent', () => {
    expect(filterModelToFilter({ keyB: { filterType: 'text', type: 'equals', filter: '' } })).toBeNull();
  });
});

describe('datasource', () => {
  test('header click sorts through the source, not in the grid', async () => {
    const { source, sorts } = fakeSource();
    const { params } = request([{ colId: 'keyA', sort: 'asc' }]);
    await createDatasource(source).getRows(params);
    expect(sorts).toEqual(['keyA']);
  });

  test('filter model goes to the source as a core filter', async () => {
    const { source, filters } = fakeSource();
    const { params } = request([], { keyB: { filterType: 'text', type: 'equals', filter: 'V1' } });
    await createDatasource(source).getRows(params);
    expect(filters).toEqual([{ keyB: ['V1'] }]);
  });

  test('rows and total reach the grid', async () => {
    const { source } = fakeSource();
    const { params, outcome } = request();
    await createDatasource(source).getRows(params);
    expect(outcome.rows).toHaveLength(500);
    expect(outcome.last).toBe(42);
  });

  test('a failing source fails the block and reports the error', async () => {
    const { source } = fakeSource();
    source.getRows = async () => {
      throw new Error('코어 꺼짐');
    };
    const seen: string[] = [];
    const { params, outcome } = request();
    await createDatasource(source, { onError: (e) => seen.push(e.message) }).getRows(params);
    expect(outcome.failed).toBe(true);
    expect(seen).toEqual(['코어 꺼짐']);
  });
});

describe('buildColumnDefs', () => {
  test('one definition per column with its label', () => {
    const defs = buildColumnDefs(cols, { keyA: 'text', keyB: 'money' });
    expect(defs.map((d) => [d.field, d.headerName])).toEqual([['keyA', '라벨A'], ['keyB', '라벨B']]);
  });

  test('the formatter follows the type map, so a type change needs no new data', () => {
    const types: Record<string, KeyType> = { keyB: 'money' };
    const [, money] = buildColumnDefs(cols, types);
    const show = (v: string) => (money.valueFormatter as (p: { value: string }) => string)({ value: v });
    expect(show('1234')).toBe('1,234');
    types.keyB = 'text';
    expect(show('1234')).toBe('1234');
  });

  test('columns are never editable', () => {
    expect(buildColumnDefs(cols, {}).every((d) => d.editable === false)).toBe(true);
  });
});
