import type { Diagnostics, RawCapture, RawTable } from '../../shared/types';

export interface SnapshotData {
  raw: RawCapture;
  diag: Diagnostics;
  labels: Record<string, string>;
}

function cell(doc: Document, tag: 'th' | 'td', text: string): HTMLElement {
  const el = doc.createElement(tag);
  el.textContent = text; // textContent만 써서 화면 값이 마크업으로 해석되지 않게 한다
  return el;
}

function buildTable(doc: Document, kind: string, heads: string[], rows: string[][]): HTMLElement {
  const table = doc.createElement('table');
  table.dataset.kind = kind;
  const headRow = doc.createElement('tr');
  for (const head of heads) headRow.appendChild(cell(doc, 'th', head));
  table.appendChild(headRow);
  for (const row of rows) {
    const tr = doc.createElement('tr');
    for (const text of row) tr.appendChild(cell(doc, 'td', text));
    table.appendChild(tr);
  }
  return table;
}

function formTable(doc: Document, raw: RawCapture, labels: Record<string, string>): HTMLElement {
  const heads = raw.pointInfo.map((f) => labels[f.k] ?? f.l);
  return buildTable(doc, 'form', heads, [raw.pointInfo.map((f) => f.v)]);
}

function gridTable(doc: Document, table: RawTable, labels: Record<string, string>): HTMLElement {
  const heads = table.columns.map((c) => labels[c.k] ?? c.l);
  const rows = table.rows.map((row) => table.columns.map((c) => row[c.k] ?? ''));
  return buildTable(doc, 'grid', heads, rows);
}

function heading(doc: Document, text: string): HTMLElement {
  const el = doc.createElement('h3');
  el.textContent = text;
  return el;
}

// 읽기 전용 표 모음. 입력칸이나 편집 가능한 칸을 만들지 않는다.
export function renderSnapshot(doc: Document, data: SnapshotData): HTMLElement {
  const root = doc.createElement('div');
  if (data.raw.pointInfo.length > 0) {
    root.appendChild(heading(doc, `폼 ${data.raw.pointInfo.length}칸`));
    root.appendChild(formTable(doc, data.raw, data.labels));
  }
  for (const table of data.raw.tables) {
    root.appendChild(heading(doc, `${table.dataList || table.id} · ${table.rows.length}행`));
    root.appendChild(gridTable(doc, table, data.labels));
  }
  return root;
}
