// 2단계 ③: 스냅샷 창의 미등록 키 첫 줄을 "사전에 올리기"로 올린다.
// dict_key 행 수 +1, 다음 스냅샷의 진단 줄 미등록 키 수 −1. 미등록 키가 0개면 대상 없음이라 거짓이다.
import { closeSnapshot, pressRemote, readShadowText } from './remote-ui.mjs';

const unknownCount = (diag) => Number(/미등록 키 (\d+)/.exec(diag)?.[1] ?? NaN);

async function openSnapshotAndRead(s) {
  await pressRemote(s, 'snapshot');
  return unknownCount(await readShadowText(s.page, 'diagnostics'));
}

export async function checkPromoteKey(s, core) {
  const before = await openSnapshotAndRead(s);
  const buttons = s.page.locator('#helper-remote [data-role="snapshot"] [data-action="promote-key"]');
  const listed = await buttons.count();
  if (!(before >= 1) || listed < 1) {
    await closeSnapshot(s);
    return { pass: false, 사유: '대상 없음', 미등록_전: before, 목록_줄: listed };
  }
  const keysBefore = await core.total('dict_key');
  await s.pace();
  await buttons.first().click();
  await s.pace();
  const keysAfter = await core.total('dict_key');
  await closeSnapshot(s);
  const after = await openSnapshotAndRead(s);
  await closeSnapshot(s);
  return {
    pass: keysAfter === keysBefore + 1 && after === before - 1,
    dict_key_전: keysBefore, dict_key_후: keysAfter, 미등록_전: before, 미등록_후: after,
  };
}
