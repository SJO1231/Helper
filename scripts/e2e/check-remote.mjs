// SPEC 8절: 입찰공고목록에서 −1년 → 첫 기간 칸 쌍이 (시작일의 해−1)년 1월 1일~12월 31일, 조회 요청 0건.
// 조회건수 100 → 보이는 그리드의 쪽 크기가 100. 기간 값은 출력하지 않는다.
import { ROOT } from '../probe/browser-steps.mjs';
import { findDatePairIds, readComponentValues, readPageSizeValue } from './page-reads.mjs';
import { chooseRowCount, pressRemote } from './remote-ui.mjs';

const WATCH_MS = 3000;

export async function checkYearMinus(s) {
  const ids = await s.page.evaluate(findDatePairIds, ROOT);
  if (!ids) return { pass: false, 이유: '보이는 기간 칸 쌍이 없음' };
  const [start] = await s.page.evaluate(readComponentValues, ids);
  const year = Number(start.slice(0, 4)) - 1;
  const requestsBefore = s.doCount;
  await pressRemote(s, 'year-minus');
  await s.page.waitForTimeout(WATCH_MS);
  const requests = s.doCount - requestsBefore;
  const [from, to] = await s.page.evaluate(readComponentValues, ids);
  const datesOk = from === `${year}0101` && to === `${year}1231`;
  return { pass: datesOk && requests === 0, 기간_맞음: datesOk, 조회요청: requests };
}

export async function checkRowCount(s) {
  await chooseRowCount(s, '100');
  await s.page.waitForTimeout(1500);
  const value = await s.page.evaluate(readPageSizeValue, ROOT);
  return { pass: value === '100', 쪽크기: value };
}
