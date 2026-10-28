import { Window } from 'happy-dom';
import { describe, expect, test } from 'vitest';
import type { ColumnInfo } from '../shared/types';
import { renderColumnPicker } from './column-picker';

const cols: ColumnInfo[] = [
  { id: 'keyA', fields: { label: '라벨A', type: 'text', index: false } },
  { id: 'keyB', fields: { label: '라벨B', type: 'text', index: false } },
];

function setup(hidden: string[] = []) {
  const win = new Window() as any;
  const container = win.document.createElement('div');
  const shownIds = new Set(cols.map((c) => c.id).filter((id) => !hidden.includes(id)));
  const calls: [string, boolean][] = [];
  const grid = {
    visibleColumnIds: () => [...shownIds],
    setColumnVisible(id: string, visible: boolean) {
      calls.push([id, visible]);
      if (visible) shownIds.add(id);
      else shownIds.delete(id);
    },
  };
  const picker = renderColumnPicker(container, cols, grid);
  const boxes = () => Array.from(container.querySelectorAll('input[type="checkbox"]')) as any[];
  return { win, container, boxes, calls, picker, shownIds };
}

describe('column picker', () => {
  test('one checkbox per column with its label, checked when shown', () => {
    const t = setup(['keyB']);
    expect(t.boxes().map((b) => b.checked)).toEqual([true, false]);
    expect(t.container.textContent).toContain('라벨A');
    expect(t.container.textContent).toContain('라벨B');
  });
  test('toggling a checkbox hides or shows that column', () => {
    const t = setup();
    const box = t.boxes()[1];
    for (const checked of [false, true]) {
      box.checked = checked;
      box.dispatchEvent(new t.win.Event('change'));
    }
    expect(t.calls).toEqual([['keyB', false], ['keyB', true]]);
  });
  test('sync follows the grid after a reset', () => {
    const t = setup(['keyA']);
    t.shownIds.add('keyA');
    t.picker.sync();
    expect(t.boxes().map((b) => b.checked)).toEqual([true, true]);
  });
});
