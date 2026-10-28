import { componentOf, inBody, isVisible } from './body';

// MAIN world 함수라 전역 Node에 기대지 않고 compareDocumentPosition 비트값을 적어 둔다.
const POSITION_PRECEDING = 2;
const POSITION_FOLLOWING = 4;

export const ROW_COUNT_CHOICES = [10, 30, 50, 100, 250, 500, 1000];

export interface ActionResult { ok: boolean; reason?: string }

function visibleBodyComponents(
  win: Window,
  wanted: (component: any) => boolean,
): { el: Element; component: any }[] {
  const found: { el: Element; component: any }[] = [];
  for (const el of Array.from(win.document.querySelectorAll('[id]'))) {
    const component = componentOf(win, el);
    if (component && wanted(component) && inBody(el, win.document) && isVisible(el)) found.push({ el, component });
  }
  return found;
}

const pluginIs = (name: string) => (component: any) => component.getPluginName() === name;

// 실제 화면의 기간 칸은 inputCalendar가 아니라 YYYYMMDD 값을 든 input이다(공개 화면 실측).
const DATE_VALUE = /^(19|20)\d{6}$/;
function isDateField(component: any): boolean {
  const plugin = component.getPluginName();
  if (!['inputCalendar', 'calendar', 'input'].includes(plugin)) return false;
  return typeof component.setValue === 'function' && DATE_VALUE.test(String(component.getValue?.() ?? ''));
}

// 시작·끝 칸은 같은 표 행의 첫 둘, 없으면 문서 순서로 이웃한 둘.
function findDatePair(win: Window): any[] | null {
  const calendars = visibleBodyComponents(win, isDateField);
  const rows = new Map<Element, any[]>();
  for (const { el, component } of calendars) {
    const row = el.closest('tr');
    if (row) rows.set(row, [...(rows.get(row) ?? []), component]);
  }
  const sameRow = Array.from(rows.values()).find((group) => group.length >= 2);
  if (sameRow) return sameRow.slice(0, 2);
  return calendars.length >= 2 ? calendars.slice(0, 2).map((c) => c.component) : null;
}

// 조회 버튼은 건드리지 않는다. 사용자가 날짜를 보고 직접 누른다.
export function shiftYear(win: Window, delta: -1 | 1): ActionResult & { year?: number } {
  const pair = findDatePair(win);
  if (!pair) return { ok: false, reason: '보이는 기간 칸 쌍을 찾지 못함' };
  const startYear = /^\d{4}/.exec(String(pair[0].getValue() ?? ''))?.[0];
  if (!startYear) return { ok: false, reason: '시작일에서 해를 읽지 못함' };
  const year = Number(startYear) + delta;
  pair[0].setValue(`${year}0101`);
  pair[1].setValue(`${year}1231`);
  return { ok: true, year };
}

const isNumericSelect = (el: Element): boolean => {
  const options = Array.from((el as HTMLSelectElement).options);
  return options.length > 0 && options.every((o) => /^\d+$/.test(o.value));
};

// 보이는 첫 그리드 뒤에서 가장 가까운 쪽 크기 select, 없으면 앞에서 가장 가까운 것.
function findPageSizeSelect(win: Window, grid: Element): HTMLSelectElement | null {
  const selects = Array.from(win.document.querySelectorAll('select')).filter(
    (s) => inBody(s, win.document) && isNumericSelect(s),
  );
  const after = selects.find((s) => grid.compareDocumentPosition(s) & POSITION_FOLLOWING);
  const before = selects.filter((s) => grid.compareDocumentPosition(s) & POSITION_PRECEDING).pop();
  return after ?? before ?? null;
}

// select 요소 자신이나 감싼 요소 중 setValue가 있는 컴포넌트가 화면의 진짜 선택 상자다.
function componentAround(win: Window, el: Element): any | null {
  for (let node: Element | null = el, depth = 0; node && depth < 4; node = node.parentElement, depth++) {
    const component = (win as any)[node.id];
    if (component && typeof component.setValue === 'function') return component;
  }
  return null;
}

// 가장 가까운 쪽 목록(pageList). 그리드 뒤에 있는 것을 먼저, 없으면 앞에 있는 것.
function findPageList(win: Window, grid: Element): any | null {
  const lists = visibleBodyComponents(win, pluginIs('pageList'));
  const after = lists.find((l) => grid.compareDocumentPosition(l.el) & POSITION_FOLLOWING);
  const before = lists.filter((l) => grid.compareDocumentPosition(l.el) & POSITION_PRECEDING).pop();
  return (after ?? before)?.component ?? null;
}

// 실측: setValue·addItem은 글자 값만 받고(숫자는 무시됨), 쪽 크기는 pageList.setPageSize로 바로 바뀐다(요청 0건).
export function applyRowCount(win: Window, n: number): ActionResult {
  if (!Number.isInteger(n) || n < 1) return { ok: false, reason: '쪽 크기는 1 이상의 정수여야 함' };
  const grid = visibleBodyComponents(win, pluginIs('gridView'))[0];
  if (!grid) return { ok: false, reason: '보이는 그리드가 없음' };
  const select = findPageSizeSelect(win, grid.el);
  if (!select) return { ok: false, reason: '쪽 크기 선택 상자를 찾지 못함' };
  const component = componentAround(win, select);
  if (!component) return { ok: false, reason: '쪽 크기 컴포넌트를 찾지 못함' };

  const text = String(n);
  const listed = Array.from(select.options).some((o) => o.value === text);
  if (!listed) {
    const option = win.document.createElement('option');
    option.value = text;
    option.textContent = text;
    select.appendChild(option);
    // 컴포넌트가 옵션을 모르면 setValue가 무시된다(v4.2 applyRowCount 방식).
    component.addItem?.(text, text);
  }
  component.setValue(text);
  findPageList(win, grid.el)?.setPageSize(n);
  return { ok: true };
}
