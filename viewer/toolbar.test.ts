// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import type { ColumnInfo } from '../shared/types';
import type { GridHandle } from './grid-adapter';
import { wireToolbar } from './toolbar';

const cols: ColumnInfo[] = [
  { id: 'keyA', fields: { label: '라벨A', type: 'text', index: false } },
  { id: 'keyB', fields: { label: '라벨B', type: 'text', index: false } },
];

describe('column picker toggle', () => {
  test('opening 열 보기 shows the real column state, not a stale one', () => {
    document.body.innerHTML = `
      <select id="type-column"></select><select id="type-choice"></select><button id="type-apply"></button>
      <details id="column-picker"><summary>열 보기</summary><div id="column-list"></div></details>
      <button id="columns-reset"></button><button id="export-csv"></button><button id="export-xlsx"></button>`;
    let shown = ['keyA', 'keyB'];
    const grid = { visibleColumnIds: () => shown, setColumnVisible: () => undefined } as unknown as GridHandle;
    wireToolbar({
      client: {} as never, table: 'tbl', columns: cols, grid, currentQuery: () => ({}), showStatus: () => undefined,
    });
    const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>('#column-list input'));
    expect(boxes().map((b) => b.checked)).toEqual([true, true]);

    shown = ['keyB']; // 그리드 쪽에서 바뀐 상태(예: 복원)
    document.getElementById('column-picker')!.dispatchEvent(new Event('toggle'));
    expect(boxes().map((b) => b.checked)).toEqual([false, true]);
  });
});
