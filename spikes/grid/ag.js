import { ModuleRegistry, createGrid, InfiniteRowModelModule, TextEditorModule } from 'ag-grid-community';
import { setup } from './common.js';

// 필요한 모듈만 등록한다(AllCommunityModule은 번들만 키운다).
ModuleRegistry.registerModules([InfiniteRowModelModule, TextEditorModule]);

setup('ag', (el, { columns, source, formatCell, probe }) => {
  const types = Object.fromEntries(columns.map((c) => [c.id, c.type]));

  const defs = () => columns.map((c) => ({
    field: c.id,
    headerName: c.label,
    width: 120,
    sortable: true,
    sortingOrder: ['asc', 'desc'],
    editable: probe,
    valueFormatter: (p) => formatCell(p.value ?? '', types[c.id]),
  }));

  const api = createGrid(el, {
    columnDefs: defs(),
    rowHeight: 32,
    rowModelType: 'infinite',
    cacheBlockSize: 500,
    datasource: {
      async getRows(params) {
        const s = params.sortModel[0];
        const sort = s ? { colId: s.colId, dir: s.sort } : null;
        const page = await source.getRows(params.startRow, params.endRow, sort);
        params.successCallback(page.rows, page.total);
      },
    },
  });

  return {
    sel: {
      cell: (row, colId) => `.ag-row[row-index="${row}"] .ag-cell[col-id="${colId}"]`,
      header: (colId) => `.ag-header-cell[col-id="${colId}"]`,
      vScroll: '.ag-body-vertical-scroll-viewport',
      hScroll: '.ag-body-horizontal-scroll-viewport',
    },
    setType(colId, type) {
      types[colId] = type;
      api.setGridOption('columnDefs', defs());
    },
  };
});
