// SPEC 8절: 입찰공고목록에서 리모컨 「조회」「엑셀」이 화면의 실제 버튼을 누르는지 본다.
// 화면 값은 읽지 않는다. 토스트 문구(확장이 정한 안내 글자)와 요청·다운로드 수만 남긴다.
import { closePopups } from '../probe/browser-steps.mjs';
import { observeExcelPress } from './excel-observe.mjs';
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
const NAME = '엑셀 버튼: 엑셀 요청(…Excel.do)이 나가고 사이트 안내창 없음';

// 조회를 누르고 조회 응답이 와서 그리드가 다시 그려질 때까지 기다린다. 응답이 없으면 false.
async function searchAndWaitRedraw(s) {
  const paths = [];
  const onRequest = (r) => {
    if (r.resourceType() === 'xhr' || r.resourceType() === 'fetch') paths.push(new URL(r.url()).pathname.split('/').pop());
  };
  s.page.on('request', onRequest);
  const answered = s.page.waitForResponse((r) => /\.do$/.test(new URL(r.url()).pathname), { timeout: SEARCH_WAIT_MS })
    .then(() => true, () => false);
  await pressRemote(s, 'search');
  const ok = await answered;
  s.page.off('request', onRequest);
  console.log(JSON.stringify({ 진단: '엑셀 앞 조회', 응답: ok, 요청_파일명: paths.slice(0, 8), 안내창: await readSiteAlert(s.page) }));
  if (!ok) return false;
  await s.page.waitForLoadState('networkidle', { timeout: SEARCH_WAIT_MS }).catch(() => {});
  await s.page.waitForTimeout(REDRAW_MS);
  return true;
}

// 조회가 끝나기 전에 엑셀을 누르면 사이트가 재검색 안내창으로 막는다(화면 규칙). 그래서 조회 뒤에 누른다.
// 기준: 엑셀 요청이 나가고 사이트 안내창이 없다. 공개 화면의 엑셀은 확인창 없이 바로 받으며, 파일 응답은 15초를 넘길 수 있어 기록만 한다.
function judgeExcel(observed, alertText) {
  return observed.excelRequests.length > 0 && alertText === '(없음)';
}

export async function checkExcelButton(s) {
  try {
    const searched = await searchAndWaitRedraw(s);
    const { observed } = await observeExcelPress(s, () => pressRemote(s, 'excel'));
    console.log(JSON.stringify({ 진단: '엑셀 관측', ...observed }));
    const toast = (await readToast(s)) || '(없음)';
    const alertText = await readSiteAlert(s.page);
    await closePopups(s.page);
    report(NAME, searched && judgeExcel(observed, alertText), {
      조회_응답: searched,
      엑셀_요청: observed.excelRequests,
      확인창: observed.dialogs.map((d) => `${d.종류}: ${d.문구}`),
      다운로드_초: observed.downloadAt === null ? '(없음)' : observed.downloadAt / 1000,
      토스트: toast,
      사이트_안내창: alertText,
    });
  } catch (error) {
    report(NAME, false, { 오류: String(error.message).split('\n')[0] });
  }
}
