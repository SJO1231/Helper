import { describe, expect, test } from 'vitest';
import type { ColumnInfo } from '../shared/types';
import { loadCodeMeanings } from './code-labels';
import { buildColumnDefs } from './grid-adapter';

const column = (id: string, type: ColumnInfo['fields']['type']): ColumnInfo => ({
  id, fields: { label: id, type, index: false },
});
const cols = [column('textKey', 'text'), column('codeKeyA', 'code'), column('codeKeyB', 'code')];

function fakeClient(records: { std_key: string; code: string; meaning: string }[] | Error) {
  const queries: unknown[] = [];
  return {
    queries,
    client: {
      async getRecords(table: string, q?: unknown) {
        queries.push([table, q]);
        if (records instanceof Error) throw records;
        return { records: records.map((fields, id) => ({ id, fields })), total: records.length } as never;
      },
    },
  };
}

describe('loadCodeMeanings', () => {
  test('asks dict_code once for the code-typed columns only', async () => {
    const { client, queries } = fakeClient([]);
    await loadCodeMeanings(client, cols);
    expect(queries).toEqual([['dict_code', { filter: { std_key: ['codeKeyA', 'codeKeyB'] }, limit: 5000 }]]);
  });
  test('groups meanings by column and code', async () => {
    const { client } = fakeClient([
      { std_key: 'codeKeyA', code: 'C1', meaning: 'M1' },
      { std_key: 'codeKeyA', code: 'C2', meaning: 'M2' },
      { std_key: 'codeKeyB', code: 'C1', meaning: 'M3' },
    ]);
    expect(await loadCodeMeanings(client, cols)).toEqual({
      codeKeyA: { C1: 'M1', C2: 'M2' }, codeKeyB: { C1: 'M3' },
    });
  });
  test('the first meaning of a repeated code wins', async () => {
    const { client } = fakeClient([
      { std_key: 'codeKeyA', code: 'C1', meaning: 'first' },
      { std_key: 'codeKeyA', code: 'C1', meaning: 'second' },
    ]);
    expect((await loadCodeMeanings(client, cols)).codeKeyA.C1).toBe('first');
  });
  test('no code column means no request', async () => {
    const { client, queries } = fakeClient([]);
    expect(await loadCodeMeanings(client, [cols[0]])).toEqual({});
    expect(queries).toEqual([]);
  });
  test('a failing request leaves the raw codes showing', async () => {
    const { client } = fakeClient(new Error('HTTP 405'));
    expect(await loadCodeMeanings(client, cols)).toEqual({});
  });
});

describe('code column display', () => {
  const show = (def: { valueFormatter?: unknown }, value: string) =>
    (def.valueFormatter as (p: { value: string }) => string)({ value });

  test('shows only the meaning, and the raw code when there is none', () => {
    const defs = buildColumnDefs(cols, { codeKeyA: 'code' }, { codeKeyA: { C1: 'M1' } });
    expect(show(defs[1], 'C1')).toBe('M1');
    expect(show(defs[1], 'C9')).toBe('C9');
    expect(show(defs[1], '')).toBe('');
  });
  test('other columns are untouched', () => {
    const defs = buildColumnDefs(cols, {}, { textKey: { C1: 'M1' } });
    expect(show(defs[0], 'C1')).toBe('C1');
  });
  test('only a column typed code uses the meanings', () => {
    const defs = buildColumnDefs(cols, { codeKeyA: 'text' }, { codeKeyA: { C1: 'M1' } });
    expect(show(defs[1], 'C1')).toBe('C1');
  });
  test('the cell value itself stays the raw code', () => {
    const defs = buildColumnDefs(cols, { codeKeyA: 'code' }, { codeKeyA: { C1: 'M1' } });
    expect(defs[1].field).toBe('codeKeyA');
  });
});
