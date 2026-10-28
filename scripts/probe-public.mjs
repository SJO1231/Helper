// 0단계 가능성 시험(PLAN.md 2절 1~9번)과 상세 화면 확인을 공개 나라장터 화면에서 다시 돌리는 스크립트.
// 제품 코드가 아니다. 구조(개수·API 이름·화면 코드)만 출력하고 업무 값은 읽어도 내보내지 않는다.
//
// 준비(한 번):  npm i --no-save playwright-core
// 실행:         node scripts/probe-public.mjs [--channel msedge|chrome] [--headed] [--out 파일.json]
//
// 서버 예의: 우리가 일으키는 동작(이동·검색·탭·셀 클릭·뒤로) 사이는 1.5초 이상 띄운다. 로그인하지 않는다.
// 등록·제출·삭제·다운로드 버튼은 누르지 않는다. 누르는 것은 메뉴, 검색유형 라디오, 검색, 목록의 링크 셀뿐이다.

import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { probeScreen } from './probe/screen-probe.mjs';
import { themeTest } from './probe/theme-test.mjs';
import {
  ROOT, createSession, closePopups, openByMenuCangVal, openByMenuText, clickRadio, clickSearch,
  waitVisibleGridRows, openDetail, goBack,
} from './probe/browser-steps.mjs';

const BASE = 'https://www.g2b.go.kr/';
const BID_GRID = 'tacBidPbancLst_contents_tab2_body_gridView1';

// 발주계획·사전규격공개는 같은 발주목록 화면(PRCA001_04)의 검색유형 라디오로 갈린다.
// 입찰공고목록의 행은 연계기관 공고(연계 URL 있음)와 나라장터 공고로 나뉘고, 상세 화면이 다르다.
// 개찰결과는 공개 메뉴 "개찰결과분류조회"로 열고, 진행상태 칸의 링크로 개찰결과 화면에 간다.
const TARGETS = [
  {
    key: '발주계획', open: { menuCangVal: 'PRCA001_04' }, search: false,
    details: [{ key: '사업명', grid: 'gridView1', col: 'bizNm', pick: { first: true } }],
  },
  {
    key: '사전규격공개', open: { menuCangVal: 'PRCA001_04' }, radioIndex: 1, search: true,
    details: [{ key: '사업명', grid: 'gridView1', col: 'bizNm', pick: { first: true } }],
  },
  {
    key: '입찰공고목록', open: { menuCangVal: 'PNPE001_01' }, search: true,
    details: [
      { key: '공고명(첫 행)', grid: BID_GRID, col: 'bidPbancNm', pick: { first: true } },
      // 첫 행이 어느 종류인지는 그날 목록에 따라 바뀌므로 두 종류를 따로 고른다.
      {
        key: '공고명(연계 URL 있는 첫 행)', grid: BID_GRID, col: 'bidPbancNm',
        pick: { filledField: 'linkInstPbancLnkUrl' },
      },
      {
        key: '공고명(연계 URL 빈 첫 행)', grid: BID_GRID, col: 'bidPbancNm',
        pick: { emptyField: 'linkInstPbancLnkUrl' },
      },
    ],
  },
  {
    key: '개찰결과분류조회', open: { menuText: '개찰결과분류조회' }, search: true,
    details: [
      { key: '진행상태 개찰완료', grid: 'onbsRsltClsfInqyGrd', col: 'bidPgstCd', pick: { text: '개찰완료' } },
      { key: '진행상태 유찰', grid: 'onbsRsltClsfInqyGrd', col: 'bidPgstCd', pick: { text: '유찰' } },
    ],
  },
];

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i < 0 ? dflt : args[i + 1];
};
const channel = opt('--channel', 'msedge');
const headed = args.includes('--headed');
const outPath = opt('--out', null);

async function openTarget(s, t) {
  const opened = t.open.menuCangVal
    ? await openByMenuCangVal(s, t.open.menuCangVal)
    : await openByMenuText(s, t.open.menuText);
  opened.autoQueryOnOpen = await waitVisibleGridRows(s.page, 8000);
  await closePopups(s.page);
  return opened;
}

// 6. 탭 전환: 탭마다 눌러 보고 선택이 바뀌었는지, 서버 요청 수, 보이는 그리드 행 수를 센다.
async function switchTabs(s, tabs) {
  const out = [];
  const page = s.page;
  for (const tab of tabs.filter((x) => x.count > 1)) {
    for (let i = 0; i < tab.count; i++) {
      if (i === tab.selected) continue;
      await s.pace();
      const requests = await s.since(() => page.evaluate(([id, idx]) => window[id].setSelectedTabIndex(idx),
        [tab.fullId, i]));
      const selectedAfter = await page.evaluate((id) => window[id].getSelectedTabIndex(), tab.fullId);
      const rows = await page.evaluate((root) => [...document.getElementById(root).querySelectorAll('.w2grid[id]')]
        .filter((e) => e.getClientRects().length > 0 && window[e.id] && window[e.id].getAllJSON)
        .map((e) => window[e.id].getAllJSON().length), ROOT);
      out.push({ tab: tab.id, index: i, selectedAfter, requests, visibleGridRows: rows });
    }
    await s.pace();
    await page.evaluate(([id, idx]) => window[id].setSelectedTabIndex(idx), [tab.fullId, tab.selected]);
  }
  return out;
}

async function runTarget(s, t, current) {
  const r = {};
  if (current !== (t.open.menuCangVal || t.open.menuText)) r.open = await openTarget(s, t);
  if (t.radioIndex) r.radioRequests = await clickRadio(s, t.radioIndex);
  if (t.search) r.searchRequests = await clickSearch(s);
  r.probe = await s.page.evaluate(probeScreen, ROOT);
  r.tabSwitch = await switchTabs(s, r.probe.tabs);
  r.theme = await s.page.evaluate(themeTest, ROOT);
  r.details = [];
  for (const d of t.details) {
    const listState = r.probe.state.menuCangVal;
    const detail = { key: d.key, ...(await openDetail(s, d, probeScreen)) };
    if (detail.opened === 'same window') detail.back = await goBack(s, listState);
    r.details.push(detail);
  }
  return r;
}

async function main() {
  const browser = await chromium.launch({ channel, headless: !headed });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const s = createSession(page);
  const result = { at: new Date().toISOString(), channel, screens: {} };

  await s.pace();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window._gcm && window._gcm.Global.getMainLoaded
    && window._gcm.Global.getMainLoaded(), null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  result.popups = await closePopups(page); // 8. 팝업 닫기

  let current = '';
  for (const t of TARGETS) {
    result.screens[t.key] = await runTarget(s, t, current);
    current = t.open.menuCangVal || t.open.menuText;
  }

  await browser.close();
  const json = JSON.stringify(result, null, 2);
  if (outPath) writeFileSync(outPath, json);
  console.log(json);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
