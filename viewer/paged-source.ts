import type { CoreClient } from '../shared/core-client';

export type RowFilter = Record<string, string[]>;
export interface RowsReply { rows: Record<string, string>[]; total: number }

export interface PagedSource {
  getRows(start: number, end: number): Promise<RowsReply>;
  setSort(sort: string | null): void;
  setFilter(filter: RowFilter | null): void;
  // 내보내기가 화면과 같은 정렬·필터로 요청하게 현재 상태를 돌려준다.
  currentQuery(): { sort?: string; filter?: RowFilter };
}

interface Page { rows: Record<string, string>[]; total: number }

export function createPagedSource(client: CoreClient, table: string, pageSize = 500): PagedSource {
  let sort: string | null = null;
  let filter: RowFilter | null = null;
  let pages = new Map<number, Promise<Page>>();
  // 정렬·필터가 바뀐 뒤에 도착한 옛 쪽이 새 캐시에 들어가지 않게 세대를 센다.
  let generation = 0;

  function fetchPage(index: number): Promise<Page> {
    const mine = generation;
    const request = client
      .getRecords(table, {
        sort: sort ?? undefined,
        filter: filter ?? undefined,
        limit: pageSize,
        offset: index * pageSize,
      })
      .then((reply) => ({ rows: reply.records.map((r) => r.fields), total: reply.total }));
    request.catch(() => {
      if (mine === generation) pages.delete(index);
    });
    return request;
  }

  function page(index: number): Promise<Page> {
    let cached = pages.get(index);
    if (!cached) {
      cached = fetchPage(index);
      pages.set(index, cached);
    }
    return cached;
  }

  function reset() {
    generation += 1;
    pages = new Map();
  }

  return {
    async getRows(start, end) {
      const first = Math.floor(start / pageSize);
      const last = Math.floor(Math.max(start, end - 1) / pageSize);
      const wanted = [];
      for (let index = first; index <= last; index++) wanted.push(page(index));
      const loaded = await Promise.all(wanted);
      const total = loaded[0].total;
      const rows: Record<string, string>[] = [];
      for (let row = start; row < Math.min(end, total); row++) {
        const found = loaded[Math.floor(row / pageSize) - first].rows[row % pageSize];
        if (found) rows.push(found);
      }
      return { rows, total };
    },
    currentQuery: () => ({ sort: sort ?? undefined, filter: filter ?? undefined }),
    setSort(next) {
      if (next === sort) return;
      sort = next;
      reset();
    },
    setFilter(next) {
      if (JSON.stringify(next) === JSON.stringify(filter)) return;
      filter = next;
      reset();
    },
  };
}
