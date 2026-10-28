import { describe, expect, test } from 'vitest';
import type { CoreClient, RecordsQuery } from '../shared/core-client';
import { createPagedSource } from './paged-source';

const TOTAL = 1200;

function fakeClient() {
  const calls: { table: string; q: RecordsQuery }[] = [];
  let writes = 0;
  const countWrite = async () => {
    writes += 1;
    return [];
  };
  const client = {
    async getRecords(table: string, q: RecordsQuery = {}) {
      calls.push({ table, q });
      const offset = q.offset ?? 0;
      const limit = q.limit ?? 500;
      const count = Math.max(0, Math.min(limit, TOTAL - offset));
      const records = Array.from({ length: count }, (_, i) => ({
        id: offset + i,
        fields: { keyA: `V${offset + i}` },
      }));
      return { records, total: TOTAL };
    },
    postCapture: async () => {
      writes += 1;
      return {} as never;
    },
    putRecords: countWrite,
    patchRecords: countWrite,
  } as unknown as CoreClient;
  return { client, calls, writes: () => writes };
}

describe('createPagedSource', () => {
  test('rows 0..499 fetch one page with offset 0 limit 500', async () => {
    const { client, calls } = fakeClient();
    const { rows, total } = await createPagedSource(client, 't').getRows(0, 500);
    expect(calls.map((c) => [c.q.offset, c.q.limit])).toEqual([[0, 500]]);
    expect(rows).toHaveLength(500);
    expect(total).toBe(TOTAL);
  });

  test('rows 480..520 fetch two pages once each and cache them', async () => {
    const { client, calls } = fakeClient();
    const source = createPagedSource(client, 't');
    const first = await source.getRows(480, 520);
    await source.getRows(480, 520);
    expect(calls.map((c) => c.q.offset)).toEqual([0, 500]);
    expect(first.rows.map((r) => r.keyA)).toEqual(
      Array.from({ length: 40 }, (_, i) => `V${480 + i}`),
    );
  });

  test('a range past the end is cut at total', async () => {
    const { client } = fakeClient();
    const { rows } = await createPagedSource(client, 't').getRows(1000, 1500);
    expect(rows).toHaveLength(200);
  });

  test('two callers asking for the same page share one request', async () => {
    const { client, calls } = fakeClient();
    const source = createPagedSource(client, 't');
    await Promise.all([source.getRows(0, 100), source.getRows(100, 200)]);
    expect(calls).toHaveLength(1);
  });

  test('setSort clears cache and sends sort string to core', async () => {
    const { client, calls } = fakeClient();
    const source = createPagedSource(client, 't');
    await source.getRows(0, 10);
    source.setSort('-keyB');
    await source.getRows(0, 10);
    expect(calls).toHaveLength(2);
    expect(calls[1].q.sort).toBe('-keyB');
  });

  test('setSort with the same value keeps the cache', async () => {
    const { client, calls } = fakeClient();
    const source = createPagedSource(client, 't');
    source.setSort('keyB');
    await source.getRows(0, 10);
    source.setSort('keyB');
    await source.getRows(0, 10);
    expect(calls).toHaveLength(1);
  });

  test('setFilter sends filter object to core', async () => {
    const { client, calls } = fakeClient();
    const source = createPagedSource(client, 't');
    source.setFilter({ keyB: ['V1'] });
    await source.getRows(0, 10);
    expect(calls[0].q.filter).toEqual({ keyB: ['V1'] });
  });

  test('a page that arrives after setSort does not enter the new cache', async () => {
    const { client, calls } = fakeClient();
    const source = createPagedSource(client, 't');
    const stale = source.getRows(0, 10);
    source.setSort('keyA');
    await stale;
    await source.getRows(0, 10);
    expect(calls.map((c) => c.q.sort)).toEqual([undefined, 'keyA']);
  });

  test('page size is configurable', async () => {
    const { client, calls } = fakeClient();
    await createPagedSource(client, 't', 100).getRows(150, 160);
    expect(calls.map((c) => [c.q.offset, c.q.limit])).toEqual([[100, 100]]);
  });

  test('currentQuery reports the sort and filter in effect', () => {
    const source = createPagedSource(fakeClient().client, 't');
    expect(source.currentQuery()).toEqual({ sort: undefined, filter: undefined });
    source.setSort('-keyB');
    source.setFilter({ keyA: ['V1'] });
    expect(source.currentQuery()).toEqual({ sort: '-keyB', filter: { keyA: ['V1'] } });
  });

  test('no client write method is ever called', async () => {
    const { client, writes } = fakeClient();
    const source = createPagedSource(client, 't');
    source.setSort('keyA');
    source.setFilter({ keyA: ['V1'] });
    await source.getRows(0, 600);
    expect(writes()).toBe(0);
  });
});
