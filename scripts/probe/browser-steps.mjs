// 공개 나라장터 화면을 조작하는 Node 쪽 단계들. 동작마다 pace()로 1.5초 이상 띄운다.
// 업무 값은 페이지 안에서만 쓰고(행 고르기) 밖으로 내보내지 않는다.

export const PACE_MS = 1500;
export const ROOT = 'mf_wfm_container';

export function createSession(page) {
  const s = { page, doCount: 0, lastAction: 0 };
  page.on('request', (r) => {
    if (/\.do$/.test(new URL(r.url()).pathname)) s.doCount++;
  });
  s.pace = async () => {
    const wait = s.lastAction + PACE_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    s.lastAction = Date.now();
  };
  // fn을 돌리고 PACE_MS 동안 생긴 .do 요청 수를 돌려준다.
  s.since = async (fn) => {
    const before = s.doCount;
    await fn();
    await page.waitForTimeout(PACE_MS);
    return s.doCount - before;
  };
  return s;
}

export async function closePopups(page) {
  return page.evaluate(() => {
    const before = ($p.getPopupList() || []).length;
    for (const p of $p.getPopupList() || []) {
      try { $p.closePopup(typeof p === 'string' ? p : p.id); } catch { /* 이미 닫힘 */ }
    }
    return { before, after: ($p.getPopupList() || []).length };
  });
}

export async function readMenuState(page) {
  return page.evaluate(() => {
    const d = (history.state && history.state.data) || {};
    return { scrnNo: d.scrnNo, menuNo: d.menuNo, menuCangVal: d.menuCangVal, hasParam: 'param' in d };
  });
}

async function waitMenu(page, menuCangVal) {
  await page.waitForFunction((v) => history.state && history.state.data && history.state.data.menuCangVal === v,
    menuCangVal, { timeout: 20000 });
}

// 보이는 그리드 중 하나라도 행이 생기면 true.
export async function waitVisibleGridRows(page, timeout) {
  return page.waitForFunction((root) => [...document.getElementById(root).querySelectorAll('.w2grid[id]')]
    .some((e) => e.getClientRects().length > 0 && window[e.id] && window[e.id].getAllJSON
      && window[e.id].getAllJSON().length > 0), ROOT, { timeout }).then(() => true, () => false);
}

// 8. 직링크: com.gfnOpenMenuMove(menuCangVal)
export async function openByMenuCangVal(s, menuCangVal) {
  await s.pace();
  const requests = await s.since(() => s.page.evaluate((v) => { com.gfnOpenMenuMove(v); }, menuCangVal));
  await waitMenu(s.page, menuCangVal);
  return { via: 'com.gfnOpenMenuMove', requests };
}

// 사람이 쓰는 길: 상단 메뉴(GNB)의 3단 메뉴 버튼을 trigger('onclick').
export async function openByMenuText(s, text) {
  const id = await s.page.evaluate((t) => {
    const a = [...document.querySelectorAll('a[id^=mf_wfm_gnb_wfm_gnbMenu_][id$=_btn_menuLvl3]')]
      .find((e) => e.textContent.trim() === t);
    return a && a.id;
  }, text);
  if (!id) throw new Error(`menu not found: ${text}`);
  await s.pace();
  const requests = await s.since(() => s.page.evaluate((i) => $p.getComponentById(i).trigger('onclick'), id));
  await s.page.waitForFunction((t) => history.state && history.state.data && history.state.data.menuNm === t,
    text, { timeout: 20000 });
  return { via: 'gnb menu trigger', requests };
}

export async function clickRadio(s, index) {
  await s.pace();
  return s.since(() => s.page.evaluate((i) => document.getElementById(`mf_wfm_container_radSrchTy_input_${i}`).click(),
    index));
}

export async function clickSearch(s) {
  await s.pace();
  const requests = await s.since(() => s.page.evaluate((root) => {
    const b = [...document.getElementById(root).querySelectorAll('input[type=button]')]
      .find((e) => e.value === '검색' && e.getClientRects().length > 0 && window[e.id]);
    window[b.id].trigger('onclick');
  }, ROOT));
  await waitVisibleGridRows(s.page, 10000);
  return requests;
}

// 보이는 그리드(id가 _<gridSuffix>로 끝남)에서 고를 행 번호를 찾는다.
// pick: { first: true } | { emptyField: '필드' } | { text: '셀 글자' }
async function pickRow(page, gridSuffix, colId, pick) {
  return page.evaluate(([root, suffix, col, p]) => {
    const el = [...document.getElementById(root).querySelectorAll('.w2grid[id]')]
      .find((e) => e.id.endsWith('_' + suffix) && e.getClientRects().length > 0);
    if (!el) return { error: 'grid not visible' };
    const cells = [...el.querySelectorAll(`tbody td[col_id="${col}"]`)];
    let index = -1;
    if (p.first) index = 0;
    if (p.emptyField) index = window[el.id].getAllJSON().findIndex((r) => !r[p.emptyField]);
    if (p.text) index = cells.findIndex((td) => td.textContent.trim() === p.text);
    if (index < 0 || !cells[index]) return { error: 'no matching row' };
    return { gridId: el.id, index };
  }, [ROOT, gridSuffix, colId, pick]);
}

// 목록 셀을 실제 마우스로 누르고 무엇이 열렸는지 본다: 같은 창 전환 / 새 탭 / 팝업.
export async function openDetail(s, detail, probeFn) {
  const { page } = s;
  const picked = await pickRow(page, detail.grid, detail.col, detail.pick);
  if (picked.error) return { error: picked.error };
  const before = await readMenuState(page);
  const pagesBefore = page.context().pages().length;
  const cell = page.locator(`#${picked.gridId} tbody td[col_id="${detail.col}"]`).nth(picked.index);
  await s.pace();
  const requests = await s.since(() => cell.locator(':scope > *').first().click());
  const changed = await page.waitForFunction((prev) => {
    const d = history.state && history.state.data;
    return (d && d.scrnNo !== prev) || ($p.getPopupList() || []).length > 0;
  }, before.scrnNo, { timeout: 15000 }).then(() => true, () => false);
  await page.waitForTimeout(3000);
  const after = await readMenuState(page);
  const popups = await page.evaluate(() => ($p.getPopupList() || []).length);
  const newPages = page.context().pages().length - pagesBefore;
  let opened = 'nothing';
  if (newPages > 0) opened = 'new tab';
  else if (popups > 0) opened = 'popup';
  else if (changed && after.scrnNo !== before.scrnNo) opened = 'same window';
  const probe = await page.evaluate(probeFn, ROOT);
  return { pickedRow: picked.index, opened, requests, popups, newPages, before, after, probe };
}

// 6. 돌아오기: 브라우저 뒤로가기. history.state.data와 검색 조건이 되돌아오는지 본다.
export async function goBack(s, expectMenuCangVal) {
  const { page } = s;
  await s.pace();
  const requests = await s.since(() => page.evaluate(() => history.back()));
  const restored = await waitMenu(page, expectMenuCangVal).then(() => true, () => false);
  await waitVisibleGridRows(page, 10000);
  const info = await page.evaluate((root) => {
    const radio = window[`${root}_radSrchTy`];
    const rows = [...document.getElementById(root).querySelectorAll('.w2grid[id]')]
      .filter((e) => e.getClientRects().length > 0 && window[e.id] && window[e.id].getAllJSON)
      .map((e) => window[e.id].getAllJSON().length);
    return { radio: radio ? radio.getValue() : null, visibleGridRows: rows };
  }, ROOT);
  return { requests, restored, state: await readMenuState(page), ...info };
}
