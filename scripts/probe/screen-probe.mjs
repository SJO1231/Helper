// 화면 한 장의 구조를 센다. page.evaluate로 넘기므로 이 함수는 바깥 변수를 쓰지 않는다.
// 본문 판정은 id 접두어가 아니라 DOM 포함 관계로 한다.
// 첨부파일 그리드(wq_uuid_N_grdFile)는 본문 안에 있지만 id가 본문 접두어로 시작하지 않는다.

export function probeScreen(rootId) {
  const VAL = ['input', 'selectbox', 'radio', 'checkbox', 'calendar', 'inputCalendar', 'textarea',
    'autoComplete', 'multiselect', 'searchbox', 'spinner', 'editor'];
  const rootEl = document.getElementById(rootId);
  const isVis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const short = (id) => id.replace(rootId + '_', '').replace(/wq_uuid_\d+/g, 'wq_uuid_N');
  const plug = (c) => {
    try { return c.getPluginName(); } catch { return ''; }
  };
  const refOf = (c) => {
    try { return (c.getRef && c.getRef()) || (c.options && c.options.ref) || ''; } catch { return ''; }
  };
  const valOf = (c) => {
    try {
      const v = c.getValue();
      return v == null ? '' : String(v).trim();
    } catch { return ''; }
  };

  const all = [];
  for (const el of document.querySelectorAll('[id]')) {
    const c = window[el.id];
    if (c && typeof c === 'object' && typeof c.getPluginName === 'function') {
      all.push({ id: el.id, el, c, p: plug(c) });
    }
  }
  const inRoot = all.filter((x) => rootEl && rootEl.contains(x.el));

  // 1. 화면 식별
  const d = (history.state && history.state.data) || {};
  const state = {
    keys: Object.keys(d),
    scrnNo: d.scrnNo, menuNo: d.menuNo, menuCangVal: d.menuCangVal, menuNm: d.menuNm, menuLvl: d.menuLvl,
    upMenuNo: d.upMenuNo, scrnSrcePathNm: d.scrnSrcePathNm, menuCangSeCd: d.menuCangSeCd,
    hasAreaCd: 'areaCd' in d, hasDepth: 'depth' in d,
    // 상세 화면은 누른 행의 인자를 param에 싣는다. 값은 업무 값이라 키 이름만 적는다.
    paramKeys: d.param && typeof d.param === 'object' ? Object.keys(d.param) : null,
    path: location.pathname, hasQuery: !!location.search, hasHash: !!location.hash,
  };

  // 3. 불필요 요소
  const valAll = all.filter((x) => VAL.includes(x.p));
  const byPlugin = {};
  for (const x of inRoot) byPlugin[x.p] = (byPlugin[x.p] || 0) + 1;
  const comps = {
    total: all.length,
    withRef: all.filter((x) => refOf(x.c)).length,
    inRoot: inRoot.length,
    byPluginInRoot: byPlugin,
    valueTotal: valAll.length,
    valueEmptyRef: valAll.filter((x) => !refOf(x.c)).length,
  };

  // 2. 입력폼 K-V-L (목록 화면의 검색 폼: 입력류 컴포넌트)
  const labelFor = new Set([...document.querySelectorAll('label[for]')].map((l) => l.getAttribute('for')));
  const hasLabelFor = (id) => labelFor.has(id) || [...labelFor].some((f) => f.startsWith(id + '_input'));
  const thInRow = (el) => !!(el.closest('tr') && el.closest('tr').querySelector('th'));
  const titleOf = (x) => !!((x.c.options && x.c.options.title) || x.el.getAttribute('title'));
  const form = valAll.filter((x) => rootEl && rootEl.contains(x.el)).map((x) => ({
    ref: !!refOf(x.c), labelFor: hasLabelFor(x.id), th: thInRow(x.el), title: titleOf(x),
    vis: isVis(x.el), hasVal: !!valOf(x.c),
  }));
  const cnt = (rows, f) => rows.filter(f).length;
  const formSum = {
    n: form.length, ref: cnt(form, (r) => r.ref), labelFor: cnt(form, (r) => r.labelFor),
    th: cnt(form, (r) => r.th), title: cnt(form, (r) => r.title),
    anyLabel: cnt(form, (r) => r.labelFor || r.th || r.title), visible: cnt(form, (r) => r.vis),
  };

  // 2·5. 상세 폼 K-V-L: 그리드 밖에서 ref를 가진 모든 컴포넌트(읽기 전용 textbox·span 포함).
  // 상세 표는 th|td|th|td 배치라 "같은 행에 th가 있다"는 늘 참이다. 바로 앞 칸이 th인지를 센다.
  const adjTh = (el) => {
    const td = el.closest('td');
    const prev = td && td.previousElementSibling;
    return !!(prev && prev.tagName === 'TH' && prev.textContent.trim());
  };
  const refComps = inRoot.filter((x) => refOf(x.c) && !x.el.closest('.w2grid')).map((x) => ({
    labelFor: hasLabelFor(x.id), adjTh: adjTh(x.el), title: titleOf(x), vis: isVis(x.el),
  }));
  const refForm = {
    n: refComps.length, visible: cnt(refComps, (r) => r.vis),
    labelFor: cnt(refComps, (r) => r.labelFor), adjTh: cnt(refComps, (r) => r.adjTh),
    title: cnt(refComps, (r) => r.title), anyLabel: cnt(refComps, (r) => r.labelFor || r.adjTh || r.title),
  };

  // 2. 그리드 K-V-L, 3. 반복 그리드
  const grids = inRoot.filter((x) => x.p === 'gridView').map((x) => {
    const g = x.c;
    let n = -1;
    let rows = -1;
    let visCols = 0;
    const labeled = new Set();
    try {
      n = g.getColumnCount();
      // getHeaderIDArr()는 빈 배열을 돌려준다. 헤더 칸을 getHeaderID(i)로 돌고 getColIdByHeaderId로 열에 붙인다.
      const hcount = g.getTotalHeaderCol() || n;
      for (let i = 0; i < hcount; i++) {
        try {
          const h = g.getHeaderID(i);
          const col = g.getColIdByHeaderId(h);
          const v = String(g.getHeaderValue(h) ?? '');
          if (col && v !== 'false' && v.replace(/<[^>]*>/g, '').trim()) labeled.add(col);
        } catch { /* 헤더 칸 하나 실패는 건너뛴다 */ }
      }
      for (let i = 0; i < n; i++) if (g.getColumnVisible(i)) visCols++;
    } catch { /* 열 정보 없음 */ }
    // dataList가 묶이지 않은 그리드는 getAllJSON이 없다.
    try { rows = g.getAllJSON().length; } catch { /* -1로 둔다 */ }
    return {
      id: short(x.id), vis: isVis(x.el), dataList: (g.options && g.options.dataList) || '',
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
    id: short(x.id), fullId: x.id, count: x.c.getTabCount(), selected: x.c.getSelectedTabIndex(), vis: isVis(x.el),
    // 비로그인 화면은 일부 탭 머리(li)를 숨긴다. 숨긴 탭은 setSelectedTabIndex가 무시된다.
    shownHeads: [...x.el.querySelectorAll('li.w2tabcontrol_li')].filter(isVis).length,
    api: fnList(x.c, ['setSelectedTabIndex', 'getSelectedTabIndex', 'getTabCount', 'getTabInfo']),
  }));
  const pageApi = ['getCount', 'setCount', 'getSelectedIndex', 'setSelectedIndex', 'getPageSize'];
  const pageLists = inRoot.filter((x) => x.p === 'pageList')
    .map((x) => ({ id: short(x.id), api: fnList(x.c, pageApi) }));
  const sizeSelects = [...(rootEl ? rootEl.querySelectorAll('select') : [])]
    .map((s) => [...s.options].map((o) => o.value))
    .filter((v) => v.length && v.every((x) => /^\d+$/.test(x)));

  // 8. 팝업·직링크
  const menuCount = () => {
    try { return window._gcm.Global.getMenuDataList().getAllJSON().length; } catch { return -1; }
  };
  const nav = {
    globalGfnOpenMenu: typeof window.gfnOpenMenu,
    comGfnOpenMenu: typeof (window.com && window.com.gfnOpenMenu),
    comGfnOpenMenuMove: typeof (window.com && window.com.gfnOpenMenuMove),
    menuDataList: menuCount(),
    getPopupList: typeof window.$p.getPopupList,
    closePopup: typeof window.$p.closePopup,
    openPopups: (window.$p.getPopupList() || []).length,
  };

  const frames = [...document.querySelectorAll('iframe')].map((f) => {
    try { return f.contentWindow && f.contentWindow.$p ? 'websquare' : 'other'; } catch { return 'cross-origin'; }
  });
  const wframes = inRoot.filter((x) => x.p === 'wframe').length;

  return { state, comps, form: formSum, refForm, grids, hidden, tabs, pageLists, sizeSelects, nav, frames, wframes };
}
