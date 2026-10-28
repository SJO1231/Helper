import ExcelJS from 'exceljs';
import { describe, expect, test } from 'vitest';
import type { CoreClient, RecordsQuery } from '../shared/core-client';
import type { ColumnInfo } from '../shared/types';
import { exportCsv, exportFileName, exportXlsx } from './export';

const cols: ColumnInfo[] = [
  { id: 'keyA', fields: { label: '라벨A', type: 'text', index: false } },
  { id: 'keyB', fields: { label: '라벨B', type: 'money', index: false } },
];

function clientWith(rows: Record<string, string>[]) {
  const calls: RecordsQuery[] = [];
  const client = {
    async getRecords(_table: string, q: RecordsQuery = {}) {
      calls.push(q);
      const offset = q.offset ?? 0;
      const slice = rows.slice(offset, offset + (q.limit ?? 500));
      return { records: slice.map((fields, i) => ({ id: offset + i, fields })), total: rows.length };
    },
  } as unknown as CoreClient;
  return { client, calls };
}

const textOf = (blob: Blob) => blob.text();

async function sheetOf(blob: Blob) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return workbook.worksheets[0];
}

describe('exportCsv', () => {
  test('csv first row equals column labels', async () => {
    const { client } = clientWith([{ keyA: 'V1', keyB: '1' }]);
    const text = await textOf(await exportCsv(client, 't', cols, {}));
    expect(text.replace(/^﻿/, '').split('\r\n')[0]).toBe('라벨A,라벨B');
  });

  test('csv starts with UTF-8 BOM', async () => {
    const { client } = clientWith([]);
    const bytes = new Uint8Array(await (await exportCsv(client, 't', cols, {})).arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  test('csv quotes commas, quotes and newlines', async () => {
    const { client } = clientWith([{ keyA: 'a,b', keyB: 'say "x"\nnext' }]);
    const text = await textOf(await exportCsv(client, 't', cols, {}));
    expect(text).toContain('"a,b","say ""x""\nnext"');
  });

  test('csv keeps original text such as 00 and false', async () => {
    const { client } = clientWith([{ keyA: '00', keyB: 'false' }]);
    const text = await textOf(await exportCsv(client, 't', cols, {}));
    expect(text).toContain('\r\n00,false');
  });

  test('a missing field becomes an empty cell', async () => {
    const { client } = clientWith([{ keyA: 'V1' }]);
    const text = await textOf(await exportCsv(client, 't', cols, {}));
    expect(text).toContain('\r\nV1,');
  });

  test('export pulls every page: 1,200 rows → 3 calls', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({ keyA: `V${i}`, keyB: '1' }));
    const { client, calls } = clientWith(rows);
    const text = await textOf(await exportCsv(client, 't', cols, {}));
    expect(calls.map((c) => c.offset)).toEqual([0, 500, 1000]);
    expect(text.trim().split('\r\n')).toHaveLength(1201);
  });

  test('current sort and filter go to every page request', async () => {
    const rows = Array.from({ length: 600 }, () => ({ keyA: 'V1', keyB: '1' }));
    const { client, calls } = clientWith(rows);
    await exportCsv(client, 't', cols, { sort: '-keyB', filter: { keyA: ['V1'] } });
    expect(calls.every((c) => c.sort === '-keyB' && c.filter?.keyA?.[0] === 'V1')).toBe(true);
  });
});

describe('exportXlsx', () => {
  test('xlsx first row equals column labels when read back', async () => {
    const { client } = clientWith([{ keyA: 'V1', keyB: '1' }]);
    const sheet = await sheetOf(await exportXlsx(client, 't', cols, {}));
    expect([sheet.getCell('A1').value, sheet.getCell('B1').value]).toEqual(['라벨A', '라벨B']);
  });

  test('xlsx keeps 00 as text', async () => {
    const { client } = clientWith([{ keyA: '00', keyB: '1,234' }]);
    const sheet = await sheetOf(await exportXlsx(client, 't', cols, {}));
    expect(sheet.getCell('A2').value).toBe('00');
    expect(sheet.getCell('B2').value).toBe('1,234');
  });

  test('xlsx has one row per record plus the header', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({ keyA: `V${i}`, keyB: '1' }));
    const { client } = clientWith(rows);
    const sheet = await sheetOf(await exportXlsx(client, 't', cols, {}));
    expect(sheet.rowCount).toBe(1201);
  });

  test('sheet name drops characters Excel rejects', async () => {
    const { client } = clientWith([]);
    const sheet = await sheetOf(await exportXlsx(client, 'a/b?c', cols, {}));
    expect(sheet.name).toBe('a_b_c');
  });
});

describe('exportFileName', () => {
  test('table, local date and time, extension', () => {
    expect(exportFileName('g2b_bid', new Date(2026, 9, 28, 14, 5), 'csv')).toBe('g2b_bid-20261028-1405.csv');
    expect(exportFileName('g2b_bid', new Date(2026, 0, 2, 3, 4), 'xlsx')).toBe('g2b_bid-20260102-0304.xlsx');
  });
});
