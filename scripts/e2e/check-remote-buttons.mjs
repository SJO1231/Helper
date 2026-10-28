// SPEC 8절: 입찰공고목록에서 리모컨 「조회」「엑셀」이 화면의 실제 버튼을 누르는지 본다.
// 화면 값은 읽지 않는다. 토스트 문구(확장이 정한 안내 글자)와 요청·다운로드 수만 남긴다.
import { closePopups } from '../probe/browser-steps.mjs';
import { report } from './report.mjs';
import { pressRemote, readShadowText, waitFor } from './remote-ui.mjs';

const REACT_MS = 2000;
const FAILURE_TOAST = /못함|끊김|꺼짐|실패/;
const EXCEL_NOT_FOUND = /엑셀 버튼을 찾지 못함/;

const readToast = (s) => readShadowText(s.page, 'toast');
const waitToast = (s) => waitFor(() => readToast(s), REACT_MS, 100);

export async function checkSearchButton(s) {
  const before = s.doCount;
  await pressRemote(s, 'search');
  const toast = await waitToast(s);
  const deadline = Date.now() + REACT_MS;
  while (s.doCount === before && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
  const requests = s.doCount - before;
  const toastOk = Boolean(toast) && !FAILURE_TOAST.test(toast);
  return { pass: requests >= 1 && toastOk, 조회요청: requests, 토스트: toast ?? '(없음)' };
}

// 다운로드가 시작되면 받지 않고 취소한다. 어느 쪽이었는지 기준 이름에 같이 적는다.
async function observeExcelOutcome(s) {
  const download = s.page.waitForEvent('download', { timeout: REACT_MS }).catch(() => null);
  await pressRemote(s, 'excel');
  const file = await download;
  if (file) {
    await file.cancel().catch(() => {});
    return { outcome: '다운로드 시작', toast: await readToast(s) };
  }
  const toast = await waitToast(s);
  if (toast && EXCEL_NOT_FOUND.test(toast)) return { outcome: '찾지 못함 알림', toast };
  return { outcome: '다운로드도 알림도 없음', toast: toast ?? '(없음)' };
}

// 사이트가 띄운 안내창(예: 검색 뒤 다시 누르라는 말)의 글자. 업무 값이 아니라 사이트 고정 문구다.
const readSiteAlert = (page) => page.evaluate(() => {
  const body = [...document.querySelectorAll('[id$="_body"][id*="alert"]')].find((e) => e.getClientRects().length > 0);
  return body ? body.innerText.replace(/\s+/g, ' ').slice(0, 80) : '(없음)';
});

export async function checkExcelButton(s) {
  try {
    const { outcome, toast } = await observeExcelOutcome(s);
    const alertText = await readSiteAlert(s.page);
    await closePopups(s.page);
    report(`엑셀 버튼: ${outcome}`, outcome !== '다운로드도 알림도 없음', { 토스트: toast, 사이트_안내창: alertText });
  } catch (error) {
    report('엑셀 버튼: 관측 실패', false, { 오류: String(error.message).split('\n')[0] });
  }
}
