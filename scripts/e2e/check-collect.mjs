// SPEC 8절: 상세 3개를 각각 10번 수집하면 g2b_receipt·g2b_bid·g2b_contract가 각 1행, g2b_capture가 3행이다.
// 목록 셀을 실제로 눌러 상세로 가고, 리모컨 "수집"을 사람처럼 누른다. 판정은 코어 행 수와 누를 때마다의 결과로 한다.
import { clickRadio, clickSearch, openDetail, waitVisibleGridRows } from '../probe/browser-steps.mjs';
import { judgeCollect } from './collect-judge.mjs';
import { BID_LIST, ORDER_LIST, openList } from './check-screen-register.mjs';
import { readMenuNo } from './page-reads.mjs';
import { pressRemote, readShadowText, waitCollectEnabled } from './remote-ui.mjs';

const TIMES = 10;
const BID_GRID = 'tacBidPbancLst_contents_tab2_body_gridView1';
const DETAILS = [
  {
    menuNo: '01033', list: ORDER_LIST, radio: 0,
    detail: { grid: 'gridView1', col: 'bizNm', pick: { first: true } },
  },
  {
    menuNo: '01196', list: BID_LIST, radio: null,
    // 연계기관 공고(연계 URL 있음)는 다른 상세로 가므로 연계 URL이 빈 첫 행을 고른다.
    detail: { grid: BID_GRID, col: 'bidPbancNm', pick: { emptyField: 'linkInstPbancLnkUrl' } },
  },
  {
    menuNo: '01141', list: ORDER_LIST, radio: 1,
    detail: { grid: 'gridView1', col: 'bizNm', pick: { first: true } },
  },
];

function statusOf(toast) {
  if (toast.startsWith('새로 저장함')) return 'new';
  if (toast.startsWith('바뀐 것 없음')) return 'same';
  if (toast.startsWith('바뀐 칸')) return 'changed';
  if (toast.startsWith('거절')) return 'rejected';
  return 'other';
}

async function openDetailScreen(s, core, target) {
  await openList(s, core, target.list);
  if (target.radio) {
    await clickRadio(s, target.radio);
    await clickSearch(s);
  } else if (!(await waitVisibleGridRows(s.page, 3000))) {
    await clickSearch(s);
  }
  const opened = await openDetail(s, target.detail, () => null);
  if (opened.error) throw new Error(`${target.menuNo} 상세로 가지 못함: ${opened.error}`);
  return s.page.evaluate(readMenuNo);
}

async function collectTimes(s) {
  const counts = { new: 0, same: 0, changed: 0, rejected: 0, other: 0 };
  for (let i = 0; i < TIMES; i++) {
    await pressRemote(s, 'collect');
    counts[statusOf(await readShadowText(s.page, 'toast'))]++;
  }
  return counts;
}

export async function checkCollect(s, core) {
  const perScreen = {};
  for (const target of DETAILS) {
    const menuNo = await openDetailScreen(s, core, target);
    if (menuNo !== target.menuNo) {
      perScreen[target.menuNo] = { 열린화면: menuNo };
      continue;
    }
    const ready = await waitCollectEnabled(s.page);
    perScreen[target.menuNo] = ready ? await collectTimes(s) : { 수집버튼: '꺼짐' };
  }
  const totals = {
    receipt: await core.total('g2b_receipt'),
    bid: await core.total('g2b_bid'),
    contract: await core.total('g2b_contract'),
    capture: await core.total('g2b_capture'),
  };
  return { pass: judgeCollect(totals, perScreen), ...totals, 상태분포: perScreen };
}
