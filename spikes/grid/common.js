import { makeColumns, createSource, formatCell } from './data.js';

// 페이지마다 같은 모양의 window.__spike를 만든다. 측정 스크립트는 이 모양만 안다.
// mount(el, ctx) 가 돌려줘야 하는 것: { sel: {cell, header, vScroll, hScroll}, setType(colId, type) }
export function setup(lib, mount) {
  const query = new URLSearchParams(location.search);
  const rows = Number(query.get('rows') ?? 1000);
  const colCount = Number(query.get('cols') ?? 100);
  const probe = query.get('probe') === '1';
  const columns = makeColumns(colCount);
  const source = createSource(rows, columns);
  const handle = mount(document.getElementById('grid'), { columns, source, formatCell, probe });
  window.__spike = { lib, rows, columns, source, formatCell, ...handle };
}
