import ExcelJS from 'exceljs';
import type { CoreClient } from '../shared/core-client';
import type { ColumnInfo } from '../shared/types';
import type { RowFilter } from './paged-source';

export interface ExportQuery { sort?: string; filter?: RowFilter }

const EXPORT_PAGE_SIZE = 500;
const BOM = '﻿';
const SHEET_NAME_FORBIDDEN = /[\\/?*[\]:]/g;
const SHEET_NAME_MAX = 31;

async function* eachRow(client: CoreClient, table: string, q: ExportQuery): AsyncGenerator<Record<string, string>> {
  for (let offset = 0, total = 1; offset < total; offset += EXPORT_PAGE_SIZE) {
    const page = await client.getRecords(table, { ...q, limit: EXPORT_PAGE_SIZE, offset });
    total = page.total;
    for (const record of page.records) yield record.fields;
  }
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function exportCsv(
  client: CoreClient,
  table: string,
  columns: ColumnInfo[],
  q: ExportQuery,
): Promise<Blob> {
  const lines = [columns.map((c) => csvCell(c.fields.label)).join(',')];
  for await (const row of eachRow(client, table, q)) {
    lines.push(columns.map((c) => csvCell(row[c.id] ?? '')).join(','));
  }
  return new Blob([BOM, lines.join('\r\n'), '\r\n'], { type: 'text/csv;charset=utf-8' });
}

export async function exportXlsx(
  client: CoreClient,
  table: string,
  columns: ColumnInfo[],
  q: ExportQuery,
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(table.replace(SHEET_NAME_FORBIDDEN, '_').slice(0, SHEET_NAME_MAX));
  sheet.addRow(columns.map((c) => c.fields.label));
  // 값은 모두 글자 셀로 쓴다. 숫자로 바뀌면 '00' 같은 원문이 사라진다.
  for await (const row of eachRow(client, table, q)) {
    sheet.addRow(columns.map((c) => row[c.id] ?? ''));
  }
  const bytes = await workbook.xlsx.writeBuffer();
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportFileName(table: string, now: Date, extension: 'csv' | 'xlsx'): string {
  const two = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`;
  return `${table}-${day}-${two(now.getHours())}${two(now.getMinutes())}.${extension}`;
}
