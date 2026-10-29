import { describe, expect, test } from 'vitest';
import { CoreError, CoreOfflineError } from '../shared/core-client';
import type { CoreClient } from '../shared/core-client';
import { createCellEditHandler, ROW_ID_FIELD } from './dict-edit';

function setup(patch: CoreClient['patchRecords']) {
  const calls: { table: string; records: unknown[] }[] = [];
  const client = {
    patchRecords: async (table: string, records: unknown[]) => {
      calls.push({ table, records });
      return patch(table, records as never);
    },
  } as unknown as CoreClient;
  const statuses: [string, boolean][] = [];
  const updated: object[] = [];
  const handler = createCellEditHandler(client, 'dict_label', (text, isError = false) => {
    statuses.push([text, isError]);
  });
  const event = {
    data: { [ROW_ID_FIELD]: '7', label: '라벨A', other: 'x' },
    colDef: { field: 'label' },
    newValue: '라벨B',
    node: { updateData: (data: object) => void updated.push(data) },
  };
  return { handler, event, calls, statuses, updated };
}

describe('dict cell edit', () => {
  test('one PATCH with one record: the row id and the one edited column', async () => {
    const { handler, event, calls } = setup(async () => [7]);
    await handler(event);
    expect(calls).toEqual([{ table: 'dict_label', records: [{ id: 7, fields: { label: '라벨B' } }] }]);
  });

  test('success puts the new value in the cell and reports it saved', async () => {
    const { handler, event, statuses, updated } = setup(async () => [7]);
    await handler(event);
    expect(updated).toEqual([{ [ROW_ID_FIELD]: '7', label: '라벨B', other: 'x' }]);
    expect(statuses).toEqual([['저장됨', false]]);
  });

  test('a rejected PATCH leaves the old value and reports the reason', async () => {
    const { handler, event, statuses, updated } = setup(async () => {
      throw new CoreError('기본키 열은 고칠 수 없다', 400);
    });
    await handler(event);
    expect(updated).toEqual([]);
    expect(statuses).toEqual([['기본키 열은 고칠 수 없다', true]]);
  });

  test('an offline core is reported as such', async () => {
    const { handler, event, statuses, updated } = setup(async () => {
      throw new CoreOfflineError('x');
    });
    await handler(event);
    expect(updated).toEqual([]);
    expect(statuses).toEqual([['코어 꺼짐', true]]);
  });

  test('an unchanged value sends nothing', async () => {
    const { handler, event, calls } = setup(async () => [7]);
    await handler({ ...event, newValue: '라벨A' });
    expect(calls).toEqual([]);
  });
});
