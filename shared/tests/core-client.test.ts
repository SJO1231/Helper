import { describe, expect, test } from 'vitest';
import fixture from '../fixtures/capture-minimal.json';
import { CoreError, CoreOfflineError, createCoreClient } from '../core-client';
import type { CaptureFields } from '../types';

const fields = fixture as CaptureFields;

interface Seen { url: URL; method: string; headers: Record<string, string>; body: unknown }

function fakeFetch(replies: (Response | Error)[]) {
  const seen: Seen[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({
      url: new URL(String(input)),
      method: init?.method ?? 'GET',
      headers: init?.headers as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const reply = replies[Math.min(seen.length, replies.length) - 1];
    if (reply instanceof Error) throw reply;
    return reply.clone();
  }) as typeof fetch;
  return { seen, fetchImpl };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function clientFor(replies: (Response | Error)[]) {
  const { seen, fetchImpl } = fakeFetch(replies);
  let n = 0;
  const client = createCoreClient({
    baseUrl: 'http://127.0.0.1:8765', token: 'T', fetchImpl, newId: () => `id-${++n}`,
  });
  return { seen, client };
}

const newResult = { status: 'new', record_id: 'A|1', stage: 'bid', changed: [], unknown_keys: 0 };

describe('core client', () => {
  test('every request carries bearer token and schema version', async () => {
    const { seen, client } = clientFor([json({ tables: [] })]);
    await client.listTables();
    expect(seen[0].headers['Authorization']).toBe('Bearer T');
    expect(seen[0].headers['X-Schema-Version']).toBe('1');
    expect(seen[0].headers['X-Request-Id']).toBeUndefined();
  });

  test('writes carry X-Request-Id and retry keeps the same id', async () => {
    const { seen, client } = clientFor([new TypeError('network'), json({ records: [{ id: 1, fields: newResult }] })]);
    await client.postCapture(fields);
    expect(seen.map((r) => r.headers['X-Request-Id'])).toEqual(['id-1', 'id-1']);
  });

  test('two network failures after retry raise CoreOfflineError', async () => {
    const { seen, client } = clientFor([new TypeError('network')]);
    await expect(client.postCapture(fields)).rejects.toBeInstanceOf(CoreOfflineError);
    expect(seen).toHaveLength(3);
  });

  test('reads are not retried', async () => {
    const { seen, client } = clientFor([new TypeError('network')]);
    await expect(client.listTables()).rejects.toBeInstanceOf(CoreOfflineError);
    expect(seen).toHaveLength(1);
  });

  test('401 raises CoreError with status and server message and is not retried', async () => {
    const { seen, client } = clientFor([json({ error: 'bad token' }, 401)]);
    await expect(client.postCapture(fields)).rejects.toMatchObject({ status: 401, message: 'bad token' });
    await expect(client.postCapture(fields)).rejects.toBeInstanceOf(CoreError);
    expect(seen).toHaveLength(2);
  });

  test('getRecords encodes sort, filter, limit, offset', async () => {
    const { seen, client } = clientFor([json({ records: [], total: 0 })]);
    await client.getRecords('g2b_bid', { sort: 'a,-b', filter: { k: ['v'] } });
    const { url } = seen[0];
    expect(url.pathname).toBe('/api/tables/g2b_bid/records');
    expect(url.searchParams.get('sort')).toBe('a,-b');
    expect(JSON.parse(url.searchParams.get('filter')!)).toEqual({ k: ['v'] });
    expect(url.searchParams.get('limit')).toBe('500');
    expect(url.searchParams.get('offset')).toBe('0');
  });

  test('postCapture posts {records:[{fields}]} and returns records[0].fields', async () => {
    const { seen, client } = clientFor([json({ records: [{ id: 1, fields: newResult }] })]);
    const result = await client.postCapture(fields);
    expect(seen[0].method).toBe('POST');
    expect(seen[0].url.pathname).toBe('/api/tables/g2b_capture/records');
    expect(seen[0].body).toEqual({ records: [{ fields }] });
    expect(result.status).toBe('new');
  });

  test('putRecords with noupdate adds ?noupdate=true and returns ids', async () => {
    const { seen, client } = clientFor([json({ records: [{ id: 5 }] })]);
    const records = [{ require: { menu_no: 'M1' }, fields: {} }];
    const ids = await client.putRecords('dict_screen', records, { noupdate: true });
    expect(seen[0].method).toBe('PUT');
    expect(seen[0].url.searchParams.get('noupdate')).toBe('true');
    expect(ids).toEqual([5]);
  });

  test('putRecords without noupdate leaves the query empty', async () => {
    const { seen, client } = clientFor([json({ records: [{ id: 5 }] })]);
    await client.putRecords('dict_screen', [{ require: {}, fields: {} }]);
    expect(seen[0].url.searchParams.has('noupdate')).toBe(false);
  });

  test('patchRecords sends PATCH with a request id and returns ids', async () => {
    const { seen, client } = clientFor([json({ records: [{ id: 2 }] })]);
    const ids = await client.patchRecords('dict_key', [{ id: 2, fields: { label: 'L1' } }]);
    expect(seen[0].method).toBe('PATCH');
    expect(seen[0].headers['X-Request-Id']).toBe('id-1');
    expect(ids).toEqual([2]);
  });

  test('listColumns returns the columns array', async () => {
    const column = { id: 'keyA', fields: { label: 'L1', type: 'text', index: false } };
    const { seen, client } = clientFor([json({ columns: [column] })]);
    expect(await client.listColumns('g2b_bid')).toEqual([column]);
    expect(seen[0].url.pathname).toBe('/api/tables/g2b_bid/columns');
  });
});
