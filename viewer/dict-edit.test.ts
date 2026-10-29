import { describe, expect, test } from 'vitest';
import { CoreError, CoreOfflineError } from '../shared/core-client';
import type { CoreClient } from '../shared/core-client';
import { createCellEditHandler, ROW_ID_FIELD } from './dict-edit';

function setup(patch: CoreClient['patchRecords'], kinds: Record<string, string> = {}) {
  const calls: { table: string; records: unknown[] }[] = [];
  const client = {
    patchRecords: async (table: string, records: unknown[]) => {
      calls.push({ table, records });
      return patch(table, records as never);
    },
  } as unknown as CoreClient;
  const statuses: [string, boolean][] = [];
  const updated: [string, string][] = [];
  const handler = createCellEditHandler(client, 'dict_label', (text, isError = false) => {
    statuses.push([text, isError]);
  }, kinds);
  const event = {
    data: { [ROW_ID_FIELD]: '7', label: '라벨A', other: 'x' },
    colDef: { field: 'label' },
    newValue: '라벨B',
    node: { setDataValue: (field: string, value: string) => void updated.push([field, value]) },
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
    expect(updated).toEqual([['label', '라벨B']]);
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

  test('a flag column sends 0/1 as a number', async () => {
    const { handler, event, calls } = setup(async () => [7], { as_column: 'flag' });
    await handler({ ...event, colDef: { field: 'as_column' }, newValue: '1' });
    expect(calls[0].records).toEqual([{ id: 7, fields: { as_column: 1 } }]);
  });

  test('a flag column refuses anything but 0 or 1 without a PATCH', async () => {
    const { handler, event, calls, statuses } = setup(async () => [7], { as_column: 'flag' });
    await handler({ ...event, colDef: { field: 'as_column' }, newValue: '2' });
    expect(calls).toEqual([]);
    expect(statuses).toEqual([['0 또는 1만 쓸 수 있다', true]]);
  });

  test('a json column sends the parsed value', async () => {
    const { handler, event, calls, updated } = setup(async () => [7], { stages: 'json' });
    await handler({ ...event, colDef: { field: 'stages' }, newValue: '["bid"]' });
    expect(calls[0].records).toEqual([{ id: 7, fields: { stages: ['bid'] } }]);
    expect(updated).toEqual([['stages', '["bid"]']]);
  });

  test('broken json sends nothing and reports it', async () => {
    const { handler, event, calls, statuses } = setup(async () => [7], { stages: 'json' });
    await handler({ ...event, colDef: { field: 'stages' }, newValue: '[bid' });
    expect(calls).toEqual([]);
    expect(statuses).toEqual([['JSON 형식이 아니다', true]]);
  });

  test('an emptied cell sends null', async () => {
    const { handler, event, calls } = setup(async () => [7]);
    await handler({ ...event, newValue: '' });
    expect(calls[0].records).toEqual([{ id: 7, fields: { label: null } }]);
  });
});
