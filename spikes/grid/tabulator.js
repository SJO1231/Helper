import {
  Tabulator, AjaxModule, PageModule, SortModule, FormatModule, EditModule, MenuModule, InteractionModule,
} from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import { setup } from './common.js';

Tabulator.registerModule([AjaxModule, PageModule, SortModule, FormatModule, EditModule, MenuModule, InteractionModule]);

const PAGE_SIZE = 500;

setup('tabulator', (el, { columns, source, formatCell, probe }) => {
  const types = Object.fromEntries(columns.map((c) => [c.id, c.type]));
  const formatterFor = (id) => (cell) => formatCell(cell.getValue() ?? '', types[id]);

  const table = new Tabulator(el, {
    height: '700px',
    rowHeight: 32,
    renderHorizontal: 'virtual',
    columns: columns.map((c) => ({
      title: c.label,
      field: c.id,
      width: 120,
      headerSort: true,
      headerSortStartingDir: 'asc',
      formatter: formatterFor(c.id),
      editor: probe ? 'input' : false,
    })),
    sortMode: 'remote',
    progressiveLoad: 'scroll',
    paginationSize: PAGE_SIZE,
    ajaxURL: 'spike',
    ajaxRequestFunc: async (_url, _config, params) => {
      const s = params.sort?.[0];
      const sort = s ? { colId: s.field, dir: s.dir } : null;
      const start = (params.page - 1) * PAGE_SIZE;
      const page = await source.getRows(start, start + PAGE_SIZE, sort);
      return { last_page: Math.ceil(page.total / PAGE_SIZE), data: page.rows };
    },
    rowContextMenu: probe ? [{ label: 'probe', action: () => {} }] : false,
  });

  return {
    sel: {
      cell: (row, colId) => `.tabulator-row:nth-child(${row + 1}) .tabulator-cell[tabulator-field="${colId}"]`,
      header: (colId) => `.tabulator-col[tabulator-field="${colId}"]`,
      vScroll: '.tabulator-tableholder',
      hScroll: '.tabulator-tableholder',
    },
    lastRowText(colId) {
      const rows = el.querySelectorAll('.tabulator-row');
      return rows[rows.length - 1]?.querySelector(`[tabulator-field="${colId}"]`)?.textContent ?? null;
    },
    async setType(colId, type) {
      types[colId] = type;
      await table.getColumn(colId).updateDefinition({ formatter: formatterFor(colId) });
    },
  };
});
