// SPEC 8절: 스냅샷 표 열 머리가 6절 해석 순서의 라벨과 같고, 스냅샷 전후 모든 테이블 행 수가 같다.
// 진단 줄에 빈 ref 제외 수와 미등록 키 수가 숫자로 보인다.
// 기대 라벨은 페이지에서 직접 읽은 머리(화면 L)에, 시험이 넣은 dict_label(screen 범위)을 덮어 만든다.
import { ROOT } from '../probe/browser-steps.mjs';
import { readMenuNo, readVisibleGridHeads } from './page-reads.mjs';
import { closeSnapshot, pressRemote, readShadowText, readSnapshotHeads } from './remote-ui.mjs';

export const TEST_LABEL = '시험 라벨';
const sameCounts = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 화면의 첫 그리드 첫 열에 screen 범위 라벨을 하나 넣는다. 그 열 머리는 화면 L이 아니라 이 라벨이어야 한다.
export async function addScreenLabel(s, core) {
  const heads = await s.page.evaluate(readVisibleGridHeads, ROOT);
  const key = heads[0]?.[0]?.k;
  if (!key) throw new Error('라벨을 넣을 그리드 열이 없다');
  const menuNo = await s.page.evaluate(readMenuNo);
  await core.post('dict_label', [{ fields: { scope: 'screen', scope_id: menuNo, key, label: TEST_LABEL } }]);
  return { menuNo, key };
}

export async function snapshotOnce(s, core, label) {
  const menuNo = await s.page.evaluate(readMenuNo);
  const before = await core.rowCounts();
  await pressRemote(s, 'snapshot');
  const shown = await readSnapshotHeads(s.page);
  const pageHeads = await s.page.evaluate(readVisibleGridHeads, ROOT);
  const labelFor = (k, l) => (label && label.menuNo === menuNo && label.key === k ? TEST_LABEL : l);
  const expected = pageHeads.map((cols) => cols.map((c) => labelFor(c.k, c.l)));
  const diag = await readShadowText(s.page, 'diagnostics');
  await closeSnapshot(s);
  const after = await core.rowCounts();
  return {
    screen: menuNo,
    grids: shown.length,
    headsMatch: shown.length > 0 && JSON.stringify(shown) === JSON.stringify(expected),
    labelShown: !label || label.menuNo !== menuNo || shown.flat().includes(TEST_LABEL),
    dbSame: sameCounts(before, after),
    diagOk: /빈 ref 제외 \d+/.test(diag) && /미등록 키 \d+/.test(diag),
  };
}

export function judgeSnapshots(results) {
  const summary = results.map((r) => `${r.screen}:${r.grids}표`).join(',');
  return {
    snapshot: {
      pass: results.length === 3 && results.every((r) => r.headsMatch && r.labelShown && r.dbSame),
      화면: summary,
      머리_같음: results.filter((r) => r.headsMatch).length,
      시험라벨_보임: results.every((r) => r.labelShown),
      DB_행수_같음: results.filter((r) => r.dbSame).length,
    },
    diag: { pass: results.length === 3 && results.every((r) => r.diagOk), 맞음: results.filter((r) => r.diagOk).length },
  };
}
