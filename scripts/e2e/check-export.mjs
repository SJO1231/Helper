// SPEC 8절: 뷰어에서 내보낸 xlsx·CSV의 첫 행이 그 테이블의 columns 라벨과 같다.
// 빌드한 실제 확장의 viewer.html을 열고(연결은 background → Native host), 버튼을 눌러 받은 파일을 읽는다.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const ExcelJS = createRequire(import.meta.url)('exceljs');
const TABLE = 'g2b_bid';

// RFC 4180 첫 줄만. 따옴표 안의 쉼표·줄바꿈·"" 를 푼다.
export function firstCsvRow(text) {
  const body = text.replace(/^﻿/, '');
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else if (ch === '\r' || ch === '\n') break;
    else cell += ch;
  }
  cells.push(cell);
  return cells;
}

async function firstXlsxRow(path) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const values = workbook.worksheets[0].getRow(1).values;
  return values.slice(1).map((v) => (v === undefined || v === null ? '' : String(v)));
}

async function download(page, buttonId) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.click(`#${buttonId}`)]);
  return file.path();
}

export async function checkExport({ context, extensionId }, core) {
  const page = await context.newPage();
  try {
    await page.goto(`chrome-extension://${extensionId}/viewer.html?table=${TABLE}`);
    await page.locator('#status').filter({ hasText: /행$/ }).waitFor({ timeout: 20000 });
    const labels = await core.columnLabels(TABLE);
    const csv = firstCsvRow(readFileSync(await download(page, 'export-csv'), 'utf8'));
    const xlsx = await firstXlsxRow(await download(page, 'export-xlsx'));
    const same = (row) => JSON.stringify(row) === JSON.stringify(labels);
    return { pass: labels.length > 0 && same(csv) && same(xlsx), 열수: labels.length, CSV: same(csv), Excel: same(xlsx) };
  } finally {
    await page.close();
  }
}
