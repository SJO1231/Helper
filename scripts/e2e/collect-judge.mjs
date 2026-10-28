// 상세 수집 판정. 행 수만 보면 2~10번째가 모두 거절이어도 참이 되므로 누를 때마다의 결과도 본다.
// 빈 DB에서 같은 화면을 10번 누르면 처음 한 번 new, 나머지 아홉 번 same이어야 한다.
const SCREENS = ['01033', '01196', '01141'];

export function judgeCollect(totals, perScreen) {
  const rowsOk = totals.receipt === 1 && totals.bid === 1 && totals.contract === 1 && totals.capture === 3;
  const pressesOk = SCREENS.every((code) => {
    const c = perScreen[code] ?? {};
    return c.new === 1 && c.same === 9 && c.changed === 0 && c.rejected === 0 && c.other === 0;
  });
  return rowsOk && pressesOk;
}
