import type { ColumnInfo } from '../shared/types';

// AG Grid Community에는 열 숨기기 화면이 없어(컬럼 메뉴·도구 패널은 Enterprise) 체크 목록을 둔다.
export interface PickerGrid {
  visibleColumnIds(): string[];
  setColumnVisible(id: string, visible: boolean): void;
}

export function renderColumnPicker(container: HTMLElement, columns: ColumnInfo[], grid: PickerGrid) {
  const doc = container.ownerDocument;
  const boxes = new Map<string, HTMLInputElement>();
  for (const column of columns) {
    const box = doc.createElement('input');
    box.type = 'checkbox';
    box.addEventListener('change', () => grid.setColumnVisible(column.id, box.checked));
    const label = doc.createElement('label');
    label.append(box, doc.createTextNode(column.fields.label));
    container.appendChild(label);
    boxes.set(column.id, box);
  }
  function sync(): void {
    const shown = new Set(grid.visibleColumnIds());
    for (const [id, box] of boxes) box.checked = shown.has(id);
  }
  sync();
  return { sync };
}
