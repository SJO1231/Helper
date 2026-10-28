// 열 폭·순서·숨김을 테이블별로 localStorage에 둔다. 정렬·필터는 코어 요청이 정하므로 저장하지 않는다.
export interface SavedColumn { colId: string; width?: number | null; hide?: boolean | null }
export interface ColumnStateApi {
  getColumnState(): SavedColumn[];
  applyColumnState(params: { state: SavedColumn[]; applyOrder?: boolean }): unknown;
}
export type ColumnStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const columnStateKey = (table: string) => `viewer.columns.${table}`;

export function layoutOf(state: SavedColumn[]): SavedColumn[] {
  return state.map(({ colId, width, hide }) => ({ colId, width: width ?? undefined, hide: Boolean(hide) }));
}

function parseSaved(text: string | null): SavedColumn[] {
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.colId === 'string')
      .map((item) => ({
        colId: item.colId as string,
        width: typeof item.width === 'number' && item.width > 0 ? item.width : undefined,
        hide: item.hide === true,
      }));
  } catch {
    return [];
  }
}

export function createColumnMemory(api: ColumnStateApi, table: string, storage: ColumnStorage | undefined) {
  const key = columnStateKey(table);
  const defaults = layoutOf(api.getColumnState());
  // 저장소가 막혀 있어도(비공개 창 등) 뷰어는 저장 없이 돌아간다.
  const guarded = (work: () => void) => {
    try {
      work();
    } catch {
      /* 저장 실패는 화면을 막지 않는다 */
    }
  };

  return {
    restore() {
      let saved: SavedColumn[] = [];
      guarded(() => (saved = parseSaved(storage?.getItem(key) ?? null)));
      const known = new Set(defaults.map((c) => c.colId));
      const usable = saved.filter((c) => known.has(c.colId));
      if (usable.length > 0) api.applyColumnState({ state: usable, applyOrder: true });
    },
    save() {
      guarded(() => storage?.setItem(key, JSON.stringify(layoutOf(api.getColumnState()))));
    },
    reset() {
      guarded(() => storage?.removeItem(key));
      api.applyColumnState({ state: defaults, applyOrder: true });
    },
  };
}
