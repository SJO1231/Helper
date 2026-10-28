// SPEC 8절: 입찰공고목록(01175)을 두 번 열면 dict_screen에 (g2b, 01175)가 1행이다.
import { closePopups, openByMenuCangVal, waitVisibleGridRows } from '../probe/browser-steps.mjs';
import { readMenuNo } from './page-reads.mjs';
import { waitFor } from './remote-ui.mjs';

export const BID_LIST = { menuCangVal: 'PNPE001_01', menuNo: '01175' };
export const ORDER_LIST = { menuCangVal: 'PRCA001_04', menuNo: '13713' };
const filterOf = (menuNo) => ({ site: ['g2b'], menu_no: [menuNo] });

export async function openList(s, core, list) {
  await openByMenuCangVal(s, list.menuCangVal);
  await waitVisibleGridRows(s.page, 8000);
  await closePopups(s.page);
  const menuNo = await s.page.evaluate(readMenuNo);
  if (menuNo !== list.menuNo) throw new Error(`열린 화면 코드가 ${list.menuNo}가 아니다`);
  // 리모컨이 자동 등록을 마칠 때까지 기다린다. 등록이 늦으면 뒤의 행 수 비교가 흔들린다.
  await waitFor(async () => (await core.total('dict_screen', filterOf(menuNo))) >= 1, 15000);
}

// 첫 열기 → 다른 화면(부르는 쪽이 이미 다녀옴) → 다시 열기. 첫 열기 전 행 수가 0이어야 "빈 상태"다.
export async function checkScreenRegister(s, core, { firstOpenTotal }) {
  await openList(s, core, BID_LIST);
  await s.page.waitForTimeout(3000);
  const total = await core.total('dict_screen', filterOf(BID_LIST.menuNo));
  return { pass: firstOpenTotal === 0 && total === 1, 처음_행수: firstOpenTotal, 행수: total };
}

export const countRegistered = (core, list) => core.total('dict_screen', filterOf(list.menuNo));
