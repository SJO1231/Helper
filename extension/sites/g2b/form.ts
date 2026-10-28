import type { PointField } from '../../../shared/types';
import { componentOf, isGrid, isVisible } from './body';
import type { ElementFilter } from './body';

// null·undefined만 빈 글자로 바꾸고 나머지는 원문 글자 그대로('00'·0·false가 남는다).
export function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const DATA_PREFIX = 'data:';

function refOf(component: any): string {
  const ref = component.getRef ? component.getRef() : component.options?.ref;
  if (typeof ref !== 'string') return '';
  return ref.startsWith(DATA_PREFIX) ? ref.slice(DATA_PREFIX.length) : ref;
}

function cleanText(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function labelForId(el: Element): string {
  if (!el.id) return '';
  const doc = el.ownerDocument;
  for (const label of Array.from(doc.querySelectorAll('label[for]'))) {
    const target = label.getAttribute('for') ?? '';
    if (target === el.id || target.startsWith(el.id + '_input')) return cleanText(label);
  }
  return '';
}

function previousCellTh(el: Element): string {
  const previous = el.closest('td')?.previousElementSibling;
  return previous?.tagName === 'TH' ? cleanText(previous) : '';
}

function rowTh(el: Element): string {
  return cleanText(el.closest('tr')?.querySelector('th'));
}

export function findLabel(el: Element): string {
  const finders = [labelForId, previousCellTh, rowTh, (e: Element) => (e.getAttribute('title') ?? '').trim()];
  for (const find of finders) {
    const label = find(el);
    if (label) return label;
  }
  return '';
}

export interface FormReadResult { fields: PointField[]; droppedEmptyRef: number }

export function readForm(win: Window, filter: ElementFilter): FormReadResult {
  const fields: PointField[] = [];
  let droppedEmptyRef = 0;
  for (const el of Array.from(win.document.querySelectorAll('[id]'))) {
    try {
      const component = componentOf(win, el);
      if (!component || isGrid(component) || typeof component.getValue !== 'function') continue;
      if (!filter(el)) continue;
      const k = refOf(component);
      if (!k) {
        droppedEmptyRef++;
        continue;
      }
      fields.push({ k, v: toText(component.getValue()), l: findLabel(el), visible: isVisible(el) });
    } catch {
      // 읽을 수 없는 컴포넌트 하나가 화면 전체를 막지 않게 건너뛴다.
    }
  }
  return { fields, droppedEmptyRef };
}
