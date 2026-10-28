// SPEC 8절: 입찰공고목록에서 리모컨 「조회」「엑셀」이 화면의 실제 버튼을 누르는지 본다.
// 화면 값은 읽지 않는다. 토스트 문구(확장이 정한 안내 글자)와 요청·다운로드 수만 남긴다.
import { closePopups } from '../probe/browser-steps.mjs';
import { report } from './report.mjs';
import { pressRemote, readShadowText, waitFor } from './remote-ui.mjs';

const REACT_MS = 2000;
const FAILURE_TOAST = /못함|끊김|꺼짐|실패/;

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

// 사이트가 띄운 안내창(예: 검색 뒤 다시 누르라는 말)의 글자. 업무 값이 아니라 사이트 고정 문구다.
const readSiteAlert = (page) => page.evaluate(() => {
  const body = [...document.querySelectorAll('[id$="_body"][id*="alert"]')].find((e) => e.getClientRects().length > 0);
  return body ? body.innerText.replace(/\s+/g, ' ').slice(0, 80) : '(없음)';
});

const SEARCH_WAIT_MS = 10000;
const REDRAW_MS = 1000;
const NAME = '엑셀 버튼: 조회 뒤 다운로드 시작';

// 조회를 누르고 조회 응답이 와서 그리드가 다시 그려질 때까지 기다린다. 응답이 없으면 false.
async function searchAndWaitRedraw(s) {
  const answered = s.page.waitForResponse((r) => /\.do$/.test(new URL(r.url()).pathname), { timeout: SEARCH_WAIT_MS })
    .then(() => true, () => false);
  await pressRemote(s, 'search');
  if (!(await answered)) return false;
  await s.page.waitForLoadState('networkidle', { timeout: SEARCH_WAIT_MS }).catch(() => {});
  await s.page.waitForTimeout(REDRAW_MS);
  return true;
}

// 조회가 끝나기 전에 엑셀을 누르면 사이트가 재검색 안내창으로 막는다(화면 규칙). 그래서 조회 뒤에 누른다.
// pressRemote가 누르기 전에 pace로 쉬므로, 2초는 누른 때(s.lastAction)부터 잰다.
async function pressExcelExpectDownload(s) {
  let startedAt = null;
  const onDownload = (file) => {
    startedAt ??= Date.now();
    file.cancel().catch(() => {});
  };
  s.page.on('download', onDownload);
  try {
    await pressRemote(s, 'excel');
    await waitFor(() => startedAt, REACT_MS, 100);
  } finally {
    s.page.off('download', onDownload);
  }
  return startedAt !== null && startedAt - s.lastAction <= REACT_MS + 500;
}

export async function checkExcelButton(s) {
  try {
    const searched = await searchAndWaitRedraw(s);
    const started = await pressExcelExpectDownload(s);
    const toast = (await readToast(s)) || '(없음)';
    const alertText = await readSiteAlert(s.page);
    await closePopups(s.page);
    report(NAME, searched && started, { 조회_응답: searched, 토스트: toast, 사이트_안내창: alertText });
  } catch (error) {
    report(NAME, false, { 오류: String(error.message).split('\n')[0] });
  }
}
