import type { Diagnostics, RawCapture, RawTable, UnknownKey } from '../../shared/types';

export interface SnapshotData {
  raw: RawCapture;
  diag: Diagnostics;
  labels: Record<string, string>;
  unknownKeyList?: UnknownKey[];
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

function unknownKeyList(doc: Document, keys: UnknownKey[]): HTMLElement {
  const list = doc.createElement('ul');
  list.dataset.role = 'unknown-keys';
  for (const { k, l, source } of keys) {
    const item = doc.createElement('li');
    item.append(`${l} · ${k} `);
    const promote = doc.createElement('button');
    promote.type = 'button';
    promote.dataset.action = 'promote-key';
    promote.dataset.k = k;
    promote.dataset.l = l;
    if (source) promote.dataset.source = source;
    promote.textContent = '사전에 올리기';
    item.appendChild(promote);
    list.appendChild(item);
  }
  return list;
}

// 표는 읽기 전용이다. 편집 칸은 없고, 미등록 키 줄의 버튼만 사람이 눌러 사전에 올린다.
export function renderSnapshot(doc: Document, data: SnapshotData): HTMLElement {
  const root = doc.createElement('div');
  const unknown = data.unknownKeyList ?? [];
  if (unknown.length > 0) {
    root.appendChild(heading(doc, `미등록 키 ${unknown.length}개`));
    root.appendChild(unknownKeyList(doc, unknown));
  }
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
