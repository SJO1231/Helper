// 0단계 가능성 시험(PLAN.md 2절 1~9번)을 공개 나라장터 화면 3종에서 다시 돌리는 스크립트.
// 제품 코드가 아니다. 구조(개수·API 이름·화면 코드)만 출력하고 업무 값은 읽어도 내보내지 않는다.
//
// 준비(한 번):  npm i --no-save playwright-core
// 실행:         node scripts/probe-public.mjs [--channel msedge|chrome] [--headed] [--out 파일.json]
//
// 서버 예의: 우리가 일으키는 동작(이동·검색·탭) 사이는 PACE_MS 이상 띄운다. 로그인하지 않는다.

import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = 'https://www.g2b.go.kr/';
const PACE_MS = 1500;
const ROOT = 'mf_wfm_container';

// 발주계획·사전규격공개는 같은 발주목록 화면(PRCA001_04)의 검색유형 라디오로 갈린다.
// 발주목록은 열면 바로 조회되고, 입찰공고목록은 검색 버튼을 눌러야 조회된다.
const TARGETS = [
  { key: '발주계획', menuCangVal: 'PRCA001_04', radioIndex: 0, search: false },
  { key: '사전규격공개', menuCangVal: 'PRCA001_04', radioIndex: 1, search: true },
  { key: '입찰공고목록', menuCangVal: 'PNPE001_01', radioIndex: null, search: true },
];

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i < 0 ? dflt : args[i + 1];
};
const channel = opt('--channel', 'msedge');
const headed = args.includes('--headed');
const outPath = opt('--out', null);

let lastAction = 0;
async function pace() {
  const wait = lastAction + PACE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastAction = Date.now();
}

// ---- 페이지 안에서 도는 함수들 (page.evaluate로 넘긴다) ----

function probePage(root) {
  const VAL = ['input', 'selectbox', 'radio', 'checkbox', 'calendar', 'inputCalendar', 'textarea',
    'autoComplete', 'multiselect', 'searchbox', 'spinner', 'editor'];
  const isVis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const plug = (c) => { try { return c.getPluginName(); } catch { return ''; } };
  const all = [];
  for (const el of document.querySelectorAll('[id]')) {
    const c = window[el.id];
    if (c && typeof c === 'object' && typeof c.getPluginName === 'function') all.push({ id: el.id, el, c, p: plug(c) });
  }
  const inRoot = all.filter((x) => x.id.startsWith(root + '_'));
  const refOf = (c) => { try { return (c.getRef && c.getRef()) || (c.options && c.options.ref) || ''; } catch { return ''; } };
  const valOf = (c) => { try { const v = c.getValue(); return v == null ? '' : String(v).trim(); } catch { return ''; } };

  // 1. 화면 식별
  const d = (history.state && history.state.data) || {};
  const state = {
    keys: Object.keys(d),
    scrnNo: d.scrnNo, menuNo: d.menuNo, menuCangVal: d.menuCangVal, menuNm: d.menuNm, menuLvl: d.menuLvl,
    upMenuNo: d.upMenuNo, scrnSrcePathNm: d.scrnSrcePathNm, menuCangSeCd: d.menuCangSeCd,
    hasAreaCd: 'areaCd' in d, hasDepth: 'depth' in d,
    path: location.pathname, hasQuery: !!location.search, hasHash: !!location.hash,
  };

  // 3. 불필요 요소
  const valAll = all.filter((x) => VAL.includes(x.p));
  const byPlugin = {};
  for (const x of inRoot) byPlugin[x.p] = (byPlugin[x.p] || 0) + 1;
  const comps = {
    total: all.length, withRef: all.filter((x) => refOf(x.c)).length, inRoot: inRoot.length, byPluginInRoot: byPlugin,
    valueTotal: valAll.length, valueEmptyRef: valAll.filter((x) => !refOf(x.c)).length,
  };

  // 2. 입력폼 K-V-L
  const labelFor = new Set([...document.querySelectorAll('label[for]')].map((l) => l.getAttribute('for')));
  const hasLabelFor = (id) => labelFor.has(id) || [...labelFor].some((f) => f.startsWith(id + '_input'));
  const form = valAll.filter((x) => x.id.startsWith(root + '_')).map((x) => ({
    p: x.p, ref: !!refOf(x.c), labelFor: hasLabelFor(x.id),
    th: !!(x.el.closest('tr') && x.el.closest('tr').querySelector('th')),
    title: !!((x.c.options && x.c.options.title) || x.el.getAttribute('title')),
    vis: isVis(x.el), hasVal: !!valOf(x.c),
  }));
  const cnt = (f) => form.filter(f).length;
  const formSum = {
    n: form.length, ref: cnt((r) => r.ref), labelFor: cnt((r) => r.labelFor), th: cnt((r) => r.th),
    title: cnt((r) => r.title), anyLabel: cnt((r) => r.labelFor || r.th || r.title), visible: cnt((r) => r.vis),
  };

  // 2. 그리드 K-V-L, 3. 반복 그리드
  const grids = inRoot.filter((x) => x.p === 'gridView').map((x) => {
    const g = x.c;
    const n = g.getColumnCount();
    const labeled = new Set();
    // getHeaderIDArr()는 빈 배열을 돌려준다. 헤더 칸을 getHeaderID(i)로 돌고 getColIdByHeaderId로 열에 붙인다.
    let hcount = n;
    try { hcount = g.getTotalHeaderCol() || n; } catch { /* 없음 */ }
    const hids = [];
    for (let i = 0; i < hcount; i++) { try { hids.push(g.getHeaderID(i)); } catch { /* 없음 */ } }
    for (const h of hids) {
      let col = ''; let v = '';
      try { col = g.getColIdByHeaderId(h); } catch { /* 없음 */ }
      try { v = String(g.getHeaderValue(h) ?? ''); } catch { /* 없음 */ }
      if (col && v !== 'false' && v.replace(/<[^>]*>/g, '').trim()) labeled.add(col);
    }
    let visCols = 0;
    for (let i = 0; i < n; i++) { try { if (g.getColumnVisible(i)) visCols++; } catch { /* 없음 */ } }
    let rows = -1;
    try { rows = g.getAllJSON().length; } catch { /* 없음 */ }
    return {
      id: x.id.slice(root.length + 1), vis: isVis(x.el), dataList: (g.options && g.options.dataList) || '',
      cols: n, labeled: labeled.size, visCols, rows,
    };
  });
  const dlUse = {};
  for (const g of grids) dlUse[g.dataList] = (dlUse[g.dataList] || 0) + 1;
  for (const g of grids) g.sharedDataList = dlUse[g.dataList] > 1;

  // 4. 숨은 값
  const hidden = {
    valueCompsHiddenWithValue: valAll.filter((x) => !isVis(x.el) && valOf(x.c)).length,
    valueCompsHiddenWithValueInRoot: form.filter((r) => !r.vis && r.hasVal).length,
    hiddenGridsWithRows: grids.filter((g) => !g.vis && g.rows > 0).length,
  };

  // 6. 탭, 5. 페이징
  const fnList = (c, names) => names.filter((f) => typeof c[f] === 'function');
  const tabs = inRoot.filter((x) => x.p === 'tabControl').map((x) => ({
    id: x.id.slice(root.length + 1), count: x.c.getTabCount(), selected: x.c.getSelectedTabIndex(), vis: isVis(x.el),
    // 비로그인 화면은 일부 탭 머리(li)를 숨긴다. 숨긴 탭은 setSelectedTabIndex가 무시된다.
    shownHeads: [...x.el.querySelectorAll('li.w2tabcontrol_li')].filter(isVis).length,
    api: fnList(x.c, ['setSelectedTabIndex', 'getSelectedTabIndex', 'getTabCount', 'getTabInfo']),
  }));
  const pageLists = inRoot.filter((x) => x.p === 'pageList').map((x) => ({
    id: x.id.slice(root.length + 1), api: fnList(x.c, ['getCount', 'setCount', 'getSelectedIndex', 'setSelectedIndex', 'getPageSize']),
  }));
  const sizeSelects = [...document.querySelectorAll(`select[id^=${root}_]`)]
    .map((s) => [...s.options].map((o) => o.value))
    .filter((v) => v.length && v.every((x) => /^\d+$/.test(x)));

  // 8. 팝업·직링크
  const nav = {
    globalGfnOpenMenu: typeof window.gfnOpenMenu,
    comGfnOpenMenu: typeof (window.com && window.com.gfnOpenMenu),
    comGfnOpenMenuMove: typeof (window.com && window.com.gfnOpenMenuMove),
    menuDataList: (() => { try { return window._gcm.Global.getMenuDataList().getAllJSON().length; } catch { return -1; } })(),
    getPopupList: typeof window.$p.getPopupList, closePopup: typeof window.$p.closePopup,
  };

  // 프레임
  const frames = [...document.querySelectorAll('iframe')].map((f) => {
    try { return f.contentWindow && f.contentWindow.$p ? 'websquare' : 'other'; } catch { return 'cross-origin'; }
  });

  return { state, comps, form: formSum, grids, hidden, tabs, pageLists, sizeSelects, nav, frames };
}

// 7. 테마: 주입 CSS를 하나씩 넣고 계산값이 바뀌는지 본 뒤 지운다.
async function themeTest(root) {
  const td = [...document.querySelectorAll(`.w2grid[id^=${root}_] tbody td.gridBodyDefault_data`)]
    .find((e) => e.getClientRects().length > 0);
  const lbl = document.querySelector(`label[for^=${root}_]`);
  if (!td || !lbl) return { skipped: 'no grid row or label' };
  const m = () => ({
    font: getComputedStyle(td).fontFamily.split(',')[0].replace(/"/g, ''),
    lblFont: getComputedStyle(lbl).fontFamily.split(',')[0].replace(/"/g, ''),
    size: getComputedStyle(td).fontSize,
    rowH: Math.round(td.closest('tr').getBoundingClientRect().height),
    bg: getComputedStyle(document.body).backgroundColor,
  });
  const tick = () => new Promise((r) => setTimeout(r, 300));
  const st = document.createElement('style');
  document.head.appendChild(st);
  const base = m();
  const cases = {
    'body *{font-family}': 'body, body *{font-family:"Courier New",monospace !important}',
    '.w2grid .gridBodyDefault{font-size}': '.w2grid .gridBodyDefault{font-size:12px !important}',
    '.w2grid .gridBodyDefault{height}': '.w2grid .gridBodyDefault{height:28px !important}',
    // 두 줄 셀이 있는 그리드는 height만으로는 내용 높이 밑으로 안 줄어든다.
    '.w2grid .gridBodyDefault{height+padding+font-size+line-height}': '.w2grid .gridBodyDefault{height:28px !important;'
      + 'padding-top:0 !important;padding-bottom:0 !important;font-size:12px !important;line-height:14px !important}'
      + '.w2grid .gridBodyDefault *{line-height:14px !important}',
    'body{background}': 'body{background-color:rgb(1, 2, 3) !important}',
  };
  const tds = [...td.closest('tbody').querySelectorAll('td.gridBodyDefault_data')];
  const out = { base, multiLineCells: tds.filter((t) => t.firstElementChild && t.firstElementChild.getBoundingClientRect().height > 24).length };
  for (const [name, css] of Object.entries(cases)) {
    st.textContent = css;
    await tick();
    const now = m();
    out[name] = Object.fromEntries(Object.keys(now).filter((k) => now[k] !== base[k]).map((k) => [k, now[k]]));
  }
  st.remove();
  await tick();
  out.restored = JSON.stringify(m()) === JSON.stringify(base);
  return out;
}

// ---- 진행 ----

async function main() {
  const browser = await chromium.launch({ channel, headless: !headed });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  let doCount = 0;
  page.on('request', (r) => { if (/\.do$/.test(new URL(r.url()).pathname)) doCount++; });
  const since = async (fn) => { const a = doCount; await fn(); await page.waitForTimeout(PACE_MS); return doCount - a; };

  const result = { at: new Date().toISOString(), channel, screens: {} };

  await pace();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window._gcm && window._gcm.Global.getMainLoaded && window._gcm.Global.getMainLoaded(), null, { timeout: 30000 });
  await page.waitForTimeout(3000);

  // 8. 팝업 닫기
  result.popups = await page.evaluate(() => {
    const before = ($p.getPopupList() || []).length;
    for (const p of $p.getPopupList() || []) { try { $p.closePopup(typeof p === 'string' ? p : p.id); } catch { /* 계속 */ } }
    return { before, after: ($p.getPopupList() || []).length };
  });

  let current = '';
  for (const t of TARGETS) {
    const s = { };
    if (current !== t.menuCangVal) {
      // 8. 직링크: com.gfnOpenMenuMove(menuCangVal)
      await pace();
      s.openRequests = await since(() => page.evaluate((v) => { com.gfnOpenMenuMove(v); }, t.menuCangVal));
      await page.waitForFunction((v) => history.state && history.state.data && history.state.data.menuCangVal === v,
        t.menuCangVal, { timeout: 20000 });
      await page.waitForFunction((root) => {
        const g = document.querySelector(`.w2grid[id^=${root}_]`);
        return g && window[g.id] && window[g.id].getAllJSON().length > 0;
      }, ROOT, { timeout: 8000 }).then(() => { s.autoQueryOnOpen = true; }, () => { s.autoQueryOnOpen = false; });
      s.directLink = 'com.gfnOpenMenuMove';
      current = t.menuCangVal;
      await page.evaluate(() => { for (const p of $p.getPopupList() || []) { try { $p.closePopup(typeof p === 'string' ? p : p.id); } catch { /* 계속 */ } } });
    }
    if (t.radioIndex) {
      // 검색유형 라디오만 바꾸면 요청이 없다.
      await pace();
      s.radioRequests = await since(() => page.evaluate((i) => document.getElementById(`mf_wfm_container_radSrchTy_input_${i}`).click(), t.radioIndex));
    }
    if (t.search) {
      await pace();
      s.searchRequests = await since(() => page.evaluate((root) => {
        const b = [...document.querySelectorAll(`input[id^=${root}_]`)]
          .find((e) => e.value === '검색' && e.getClientRects().length > 0 && window[e.id]);
        window[b.id].trigger('onclick');
      }, ROOT));
      await page.waitForTimeout(3000);
    }
    s.probe = await page.evaluate(probePage, ROOT);

    // 6. 탭 전환: 탭마다 눌러 보고 서버 요청 수와 그리드 행 수 변화를 센다.
    s.tabSwitch = [];
    for (const tab of s.probe.tabs.filter((x) => x.count > 1)) {
      for (let i = 0; i < tab.count; i++) {
        if (i === tab.selected) continue;
        await pace();
        const req = await since(() => page.evaluate(([id, idx]) => window[id].setSelectedTabIndex(idx), [`${ROOT}_${tab.id}`, i]));
        const selectedAfter = await page.evaluate((id) => window[id].getSelectedTabIndex(), `${ROOT}_${tab.id}`);
        const rows = await page.evaluate((root) => [...document.querySelectorAll(`.w2grid[id^=${root}_]`)]
          .filter((e) => e.getClientRects().length > 0).map((e) => window[e.id].getAllJSON().length), ROOT);
        s.tabSwitch.push({ tab: tab.id, index: i, selectedAfter, requests: req, visibleGridRows: rows });
      }
      await pace();
      await page.evaluate(([id, idx]) => window[id].setSelectedTabIndex(idx), [`${ROOT}_${tab.id}`, tab.selected]);
    }

    s.theme = await page.evaluate(themeTest, ROOT);
    result.screens[t.key] = s;
  }

  await browser.close();
  const json = JSON.stringify(result, null, 2);
  if (outPath) writeFileSync(outPath, json);
  console.log(json);
}

main().catch((e) => { console.error(e); process.exit(1); });
