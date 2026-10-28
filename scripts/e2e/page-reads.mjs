// 페이지 안에서 직접 읽는 함수들. 확장 코드를 쓰지 않고 WebSquare API로 따로 읽어 확장 결과와 견준다.
// page.evaluate로 직렬화되어 가므로 바깥 변수를 쓰지 않는다. 업무 값은 돌려주지 않는다.

// 본문 안 보이는 그리드마다 [{k, l}]. 같은 dataList는 처음 것만, getAllJSON이 실패하는 그리드는 뺀다.
export function readVisibleGridHeads(rootId) {
  const strip = (text) => String(text ?? '').replace(/<[^>]*>/g, '').trim();
  const out = [];
  const seen = new Set();
  for (const el of document.getElementById(rootId).querySelectorAll('[id]')) {
    const grid = window[el.id];
    if (!grid || typeof grid.getPluginName !== 'function' || grid.getPluginName() !== 'gridView') continue;
    if (el.getClientRects().length === 0) continue;
    const dataList = String(grid.options?.dataList ?? '');
    if (dataList && seen.has(dataList)) continue;
    try {
      grid.getAllJSON();
    } catch {
      continue;
    }
    if (dataList) seen.add(dataList);
    const count = Number(grid.getColumnCount());
    const labels = new Map();
    const headerCount = Number(grid.getTotalHeaderCol?.() || count);
    for (let i = 0; i < headerCount; i++) {
      try {
        const headerId = grid.getHeaderID(i);
        const column = grid.getColIdByHeaderId ? grid.getColIdByHeaderId(headerId) : grid.getColumnID(i);
        const raw = grid.getHeaderValue(headerId);
        const label = raw === false || raw === 'false' ? '' : strip(raw);
        if (column && label && !labels.has(column)) labels.set(column, label);
      } catch {
        // 머리 칸 하나를 못 읽으면 그 열 라벨은 빈 글자다.
      }
    }
    out.push(Array.from({ length: count }, (_, i) => {
      const k = String(grid.getColumnID(i));
      return { k, l: labels.get(k) ?? '' };
    }));
  }
  return out;
}

// 보이는 기간 칸(값이 YYYYMMDD인 input류) 첫 쌍의 컴포넌트 id. 같은 표 행 둘을 먼저, 없으면 문서 순서 둘.
export function findDatePairIds(rootId) {
  const dates = [];
  for (const el of document.getElementById(rootId).querySelectorAll('[id]')) {
    const c = window[el.id];
    if (!c || typeof c.getPluginName !== 'function' || el.getClientRects().length === 0) continue;
    if (!['inputCalendar', 'calendar', 'input'].includes(c.getPluginName())) continue;
    if (/^(19|20)\d{6}$/.test(String(c.getValue?.() ?? ''))) dates.push(el);
  }
  const rows = new Map();
  for (const el of dates) {
    const row = el.closest('tr');
    if (row) rows.set(row, [...(rows.get(row) ?? []), el.id]);
  }
  const sameRow = [...rows.values()].find((ids) => ids.length >= 2);
  if (sameRow) return sameRow.slice(0, 2);
  return dates.length >= 2 ? [dates[0].id, dates[1].id] : null;
}

export function readComponentValues(ids) {
  return ids.map((id) => String(window[id].getValue()));
}

// 보이는 첫 그리드 뒤(없으면 앞)의 가장 가까운 숫자 select 값 = 쪽 크기.
export function readPageSizeValue(rootId) {
  const root = document.getElementById(rootId);
  const grid = [...root.querySelectorAll('[id]')].find((el) => {
    const c = window[el.id];
    return c && typeof c.getPluginName === 'function' && c.getPluginName() === 'gridView'
      && el.getClientRects().length > 0;
  });
  if (!grid) return null;
  const numeric = [...root.querySelectorAll('select')]
    .filter((s) => s.options.length > 0 && [...s.options].every((o) => /^\d+$/.test(o.value)));
  const after = numeric.find((s) => grid.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
  const before = numeric.filter((s) => grid.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_PRECEDING).pop();
  return (after ?? before)?.value ?? null;
}

export function readMenuNo() {
  return String(history.state?.data?.menuNo ?? '');
}
