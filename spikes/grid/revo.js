import { defineCustomElement } from '@revolist/revogrid/standalone/revo-grid.js';
import { setup } from './common.js';

defineCustomElement();

const PAGE_SIZE = 500;

setup('revo', (el, { columns, source, formatCell, probe }) => {
  const types = Object.fromEntries(columns.map((c) => [c.id, c.type]));

  const indexOf = (colId) => columns.findIndex((c) => c.id === colId);
  const columnDefs = () => columns.map((c) => ({
    prop: c.id,
    name: c.label,
    size: 120,
    sortable: true,
    cellTemplate: (h, { value }) => h('span', {}, formatCell(value ?? '', types[c.id])),
  }));

  // 서버 행 모델이 Pro라서, 코어 대신 쪽을 모두 받아 한 번에 넣는다.
  async function loadAll(sort) {
    const rows = [];
    for (let start = 0; start < source.total; start += PAGE_SIZE) {
      rows.push(...(await source.getRows(start, start + PAGE_SIZE, sort)).rows);
    }
    return rows;
  }

  const grid = document.createElement('revo-grid');
  grid.readonly = !probe;
  grid.columns = columnDefs();
  grid.rowSize = 32;
  el.appendChild(grid);
  loadAll(null).then((rows) => { grid.source = rows; });

  // 라이브러리 안 정렬 대신 코어(여기선 source)가 정렬한 행을 다시 넣는다.
  grid.addEventListener('beforesorting', async (e) => {
    e.preventDefault();
    const { column, order } = e.detail;
    grid.source = await loadAll(order ? { colId: column.prop, dir: order } : null);
  });

  return {
    sel: {
      cell: (row, colId) => `revo-grid .rgRow[data-rgrow="${row}"] .rgCell[data-rgcol="${indexOf(colId)}"]`,
      header: (colId) => `revo-grid .rgHeaderCell[data-rgcol="${indexOf(colId)}"]`,
      vScroll: 'revogr-scroll-virtual.vertical',
      hScroll: 'revogr-scroll-virtual.horizontal',
    },
    setType(colId, type) {
      types[colId] = type;
      grid.columns = columnDefs();
    },
  };
});
