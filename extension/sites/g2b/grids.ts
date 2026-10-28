import type { RawTable } from '../../../shared/types';
import { componentOf, isGrid, isVisible } from './body';
import type { ElementFilter } from './body';
import { toText } from './form';

interface GridCandidate { el: Element; component: any; dataList: string }

export interface GridReadResult { tables: RawTable[]; droppedSameDataList: number; failedGrids: number }

function collectCandidates(win: Window, filter: ElementFilter): GridCandidate[] {
  const found: GridCandidate[] = [];
  for (const el of Array.from(win.document.querySelectorAll('[id]'))) {
    try {
      const component = componentOf(win, el);
      if (!component || !isGrid(component) || !filter(el)) continue;
      found.push({ el, component, dataList: String(component.options?.dataList ?? '') });
    } catch {
      // 컴포넌트 하나를 못 읽어도 나머지는 읽는다.
    }
  }
  return found;
}

// 같은 dataList는 보이는 그리드 하나만, 모두 같으면 문서 순서 첫 것. dataList가 빈 그리드는 서로 같다고 보지 않는다.
function keepOnePerDataList(candidates: GridCandidate[]): { kept: GridCandidate[]; dropped: number } {
  const winners = new Map<string, GridCandidate>();
  for (const c of candidates) {
    if (!c.dataList) continue;
    const current = winners.get(c.dataList);
    if (!current || (!isVisible(current.el) && isVisible(c.el))) winners.set(c.dataList, c);
  }
  const kept = candidates.filter((c) => !c.dataList || winners.get(c.dataList) === c);
  return { kept, dropped: candidates.length - kept.length };
}

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

// 헤더 칸이 열보다 많을 수 있어(여러 줄 머리) 칸마다 열 ID를 찾아 붙인다.
function headerLabels(grid: any, columnCount: number): Map<string, string> {
  const labels = new Map<string, string>();
  const headerCount = Number(grid.getTotalHeaderCol?.() || columnCount);
  for (let i = 0; i < headerCount; i++) {
    try {
      const headerId = grid.getHeaderID(i);
      const column = grid.getColIdByHeaderId ? grid.getColIdByHeaderId(headerId) : grid.getColumnID(i);
      const raw = grid.getHeaderValue(headerId);
      // 체크박스 열의 머리 값은 false다. 라벨이 아니므로 비운다.
      const label = raw === false || raw === 'false' ? '' : stripTags(toText(raw));
      if (column && label && !labels.has(column)) labels.set(column, label);
    } catch {
      // 머리 칸 하나의 실패는 그 열의 라벨만 비운다.
    }
  }
  return labels;
}

function readRows(grid: any): Record<string, string>[] {
  let rows = grid.getAllJSON();
  if (typeof rows === 'string') rows = JSON.parse(rows);
  if (!Array.isArray(rows)) throw new Error('getAllJSON did not return an array');
  return rows.map((row: Record<string, unknown>) => {
    const line: Record<string, string> = {};
    for (const [key, value] of Object.entries(row ?? {})) line[key] = toText(value);
    return line;
  });
}

function readTable(c: GridCandidate): RawTable {
  const grid = c.component;
  const count = Number(grid.getColumnCount());
  const labels = headerLabels(grid, count);
  const columns = Array.from({ length: count }, (_, i) => {
    const k = String(grid.getColumnID(i));
    return { k, l: labels.get(k) ?? '' };
  });
  // getAllJSON이 먼저 실패해야 반쯤 만든 표가 남지 않는다.
  const rows = readRows(grid);
  return { id: String(grid.id || c.el.id), dataList: c.dataList, visible: isVisible(c.el), columns, rows };
}

export function readGrids(win: Window, filter: ElementFilter): GridReadResult {
  const { kept, dropped } = keepOnePerDataList(collectCandidates(win, filter));
  const tables: RawTable[] = [];
  let failedGrids = 0;
  for (const c of kept) {
    try {
      tables.push(readTable(c));
    } catch {
      failedGrids++;
    }
  }
  return { tables, droppedSameDataList: dropped, failedGrids };
}
