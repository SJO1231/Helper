// AG Grid Community를 아는 유일한 파일. 라이브러리를 바꿀 때 이 파일만 고친다.
import {
  ColumnApiModule,
  InfiniteRowModelModule,
  ModuleRegistry,
  TextFilterModule,
  createGrid,
  type ColDef,
  type IDatasource,
  type IGetRowsParams,
} from 'ag-grid-community';
import type { ColumnInfo, KeyType } from '../shared/types';
import { formatCell } from './format';
import type { PagedSource, RowFilter } from './paged-source';

ModuleRegistry.registerModules([ColumnApiModule, InfiniteRowModelModule, TextFilterModule]);

const PAGE_SIZE = 500;
const ROW_HEIGHT = 32;
const COLUMN_WIDTH = 120;
// 세로 휠 훑기에서 프레임이 제때 그려지는 비율을 높이려는 값이다(bench:viewer 10,000행 기준 약 0.92 → 0.98).
// 읽기 전용이라 행 강조는 필요 없고, 한 번에 새로 그리는 행 수는 적을수록 가볍다.
const ROW_BUFFER = 3;

export interface GridHandle {
  setColumnType(id: string, type: KeyType): Promise<void>;
  columnCount(): number;
  destroy(): void;
}

export interface GridHooks {
  onError?(error: Error): void;
  onTotal?(total: number): void;
}

interface SortItem { colId: string; sort: string }
type FilterModel = Record<string, { filterType?: string; type?: string; filter?: string } | undefined>;

export function sortModelToString(model: SortItem[]): string | null {
  if (model.length === 0) return null;
  return model.map((item) => (item.sort === 'desc' ? `-${item.colId}` : item.colId)).join(',');
}

// 코어 filter는 "값 중 하나와 같음"뿐이라 열마다 같음 한 값만 보낸다.
export function filterModelToFilter(model: FilterModel): RowFilter | null {
  const filter: RowFilter = {};
  for (const [column, item] of Object.entries(model)) {
    if (item?.filter) filter[column] = [item.filter];
  }
  return Object.keys(filter).length > 0 ? filter : null;
}

export function createDatasource(source: PagedSource, hooks: GridHooks = {}): IDatasource {
  return {
    async getRows(params: IGetRowsParams) {
      // 라이브러리 안 정렬·필터는 쓰지 않는다. 정렬 상태만 코어 요청으로 옮긴다.
      source.setSort(sortModelToString(params.sortModel as SortItem[]));
      source.setFilter(filterModelToFilter(params.filterModel as FilterModel));
      try {
        const { rows, total } = await source.getRows(params.startRow, params.endRow);
        params.successCallback(rows, total);
        hooks.onTotal?.(total);
      } catch (error) {
        params.failCallback();
        hooks.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
  };
}

export function buildColumnDefs(columns: ColumnInfo[], types: Record<string, KeyType>): ColDef[] {
  return columns.map((column) => ({
    field: column.id,
    headerName: column.fields.label,
    width: COLUMN_WIDTH,
    editable: false,
    filter: 'agTextColumnFilter',
    floatingFilter: true,
    filterParams: { filterOptions: ['equals'], maxNumConditions: 1, buttons: ['apply'], closeOnApply: true },
    valueFormatter: (params) => formatCell(params.value ?? '', types[column.id]),
  }));
}

export function mountGrid(
  element: HTMLElement,
  columns: ColumnInfo[],
  source: PagedSource,
  hooks: GridHooks = {},
): GridHandle {
  const types: Record<string, KeyType> = Object.fromEntries(columns.map((c) => [c.id, c.fields.type]));
  const api = createGrid(element, {
    columnDefs: buildColumnDefs(columns, types),
    rowHeight: ROW_HEIGHT,
    rowModelType: 'infinite',
    cacheBlockSize: PAGE_SIZE,
    rowBuffer: ROW_BUFFER,
    suppressRowHoverHighlight: true,
    datasource: createDatasource(source, hooks),
  });
  return {
    async setColumnType(id, type) {
      types[id] = type;
      // 같은 목록 객체로 열 정의만 갈아 끼운다. 자료 공급(코어)은 다시 부르지 않는다.
      api.setGridOption('columnDefs', buildColumnDefs(columns, types));
    },
    columnCount: () => api.getColumns()?.length ?? 0,
    destroy: () => api.destroy(),
  };
}
