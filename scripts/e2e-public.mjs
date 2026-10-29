// npm run e2e:public — SPEC 8절 e2e 문장을 공개 나라장터에서 하나씩 참/거짓으로 판정한다. CI에서는 돌리지 않는다.
// 판정은 코어 HTTP와 페이지 DOM에서 직접 읽는다. 확장이 낸 숫자를 그대로 믿지 않는다.
// 실행: npm run e2e:public [-- --headed]
import { clickRadio, clickSearch, closePopups, createSession } from './probe/browser-steps.mjs';
import { assignTestScreens } from './e2e/assign.mjs';
import { checkAutoCollect } from './e2e/check-auto-collect.mjs';
import { checkCollect } from './e2e/check-collect.mjs';
import { checkDictEdit } from './e2e/check-dict-edit.mjs';
import { checkExport } from './e2e/check-export.mjs';
import { checkRowCount, checkYearMinus } from './e2e/check-remote.mjs';
import {
  BID_LIST, ORDER_LIST, checkScreenRegister, countRegistered, openList,
} from './e2e/check-screen-register.mjs';
import { checkDirectLink } from './e2e/check-direct-link.mjs';
import { checkPromoteKey } from './e2e/check-promote-key.mjs';
import { addScreenLabel, judgeSnapshots, snapshotOnce } from './e2e/check-snapshot.mjs';
import { finish, judge } from './e2e/report.mjs';
import { openSite, startStack } from './e2e/setup.mjs';

const headed = process.argv.includes('--headed');

// 확장 페이지에서 background에 연결 정보를 묻는다. background는 등록된 Native host로 hello를 보낸다.
async function askConnectionThroughExtension({ context, extensionId }) {
  const page = await context.newPage();
  try {
    await page.goto(`chrome-extension://${extensionId}/viewer.html`);
    const reply = await page.evaluate(() => chrome.runtime.sendMessage({ kind: 'core.connection' }));
    return reply?.ok ? reply.data.baseUrl : `실패: ${reply?.error ?? '답 없음'}`;
  } finally {
    await page.close();
  }
}

async function trySnapshot(s, core, label) {
  try {
    return await snapshotOnce(s, core, label);
  } catch (error) {
    console.error(error);
    return { screen: '?', grids: 0, headsMatch: false, labelShown: false, dbSame: false, diagOk: false };
  }
}

// 입찰공고목록(첫 열기): 스냅샷·−1년·조회건수 → 발주목록 두 검색유형 스냅샷 → 입찰공고목록 다시 열기.
async function listScreens(s, core) {
  const firstOpenTotal = await countRegistered(core, BID_LIST);
  await openList(s, core, BID_LIST);
  const label = await addScreenLabel(s, core);
  const snaps = [await trySnapshot(s, core, label)];
  await judge('입찰공고목록 −1년: 기간 (해−1)년 1월 1일~12월 31일, 조회 요청 0건', () => checkYearMinus(s));
  await judge('입찰공고목록 조회건수 100: 보이는 그리드 쪽 크기 100', () => checkRowCount(s));
  await openList(s, core, ORDER_LIST);
  snaps.push(await trySnapshot(s, core, label));
  await clickRadio(s, 1);
  await clickSearch(s);
  snaps.push(await trySnapshot(s, core, label));
  const judged = judgeSnapshots(snaps);
  await judge('스냅샷 열 머리 = 6절 라벨, 전후 DB 행 수 같음(13713 두 유형·01175)', async () => judged.snapshot);
  await judge('진단 줄에 빈 ref 제외 수·미등록 키 수가 숫자', async () => judged.diag);
  await judge('입찰공고목록 두 번 열면 dict_screen (g2b, 01175) 1행',
    () => checkScreenRegister(s, core, { firstOpenTotal }));
  await judge('미등록 키 승격: 01175 첫 줄을 올리면 dict_key +1, 다음 스냅샷 미등록 수 −1',
    () => checkPromoteKey(s, core));
  await judge('직링크: 13713에서 01175 선택·이동 → 3초 안에 menuNo 01175, dict_screen 행 수 불변',
    () => checkDirectLink(s, core));
}

let stack;
try {
  stack = await startStack({ headed });
  const { core, page } = stack;
  await judge('코어 연결', async () => {
    const http = await core.status('/api/tables');
    const viaHost = await askConnectionThroughExtension(stack);
    return { pass: http === 200 && viaHost === core.baseUrl, http, 확장_Native_hello: viaHost === core.baseUrl };
  });
  await assignTestScreens(core);
  const s = createSession(page);
  await openSite(page);
  await closePopups(page);
  await listScreens(s, core);
  await judge('상세 3개 각 10번 수집 → 메인 각 1행, capture 3행', () => checkCollect(s, core));
  await judge('자동수집: 꺼짐=실제 클릭 뒤 capture 불변 / 켜짐=+1, 한 번 더=메인 행 불변(capture 0~1) / 수집 버튼 0회',
    () => checkAutoCollect(s, core));
  await judge('뷰어 CSV·xlsx 첫 행 = g2b_bid columns 라벨', () => checkExport(stack, core));
  await judge('뷰어 사전 편집: 칸 고치면 PATCH 1회·칸 반영, 깨진 JSON은 PATCH 0회, 기본키는 편집 불가',
    () => checkDictEdit(stack, core));
} catch (error) {
  console.error(error);
  await judge('e2e 진행', async () => ({ pass: false }));
} finally {
  await stack?.stop();
  finish();
}
