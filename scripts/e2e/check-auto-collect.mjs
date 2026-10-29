// 2단계 ⑤: 스위치 꺼짐에서는 사이트 버튼을 실제로 눌러도 수집되지 않고, 켜면 로딩이 끝난 뒤 1회 수집된다.
// 클릭은 Playwright의 실제 마우스(isTrusted 참)다. 리모컨 '수집' 버튼은 누르지 않는다(감시로 센다).
import { ROOT } from '../probe/browser-steps.mjs';
import { ORDER_LIST, openList } from './check-screen-register.mjs';
import { readMenuNo } from './page-reads.mjs';
import {
  readAutoCount, readCollectPresses, readShadowText, setAutoCollect, waitFor, watchCollectPresses,
} from './remote-ui.mjs';

const SETTLE_MS = 5000;
const SEARCH_TEXTS = ['조회', '검색'];
// 상세 화면에는 로딩을 일으키는 조회 버튼이 없어, 조회 버튼이 있는 발주 목록(13713)에 시험용 단계를 잠시 배정한다.
// 업무키는 검색유형 폼 값(표준키 srchTy, 마지막 이름으로 풀림)이라 목록을 수집하면 capture 1행이 생긴다.
const LIST_SCREEN = { menuNo: '13713', stage: 'receipt', keyFields: ['srchTy'] };

async function assignListScreen(core) {
  await core.put('dict_key', [{
    require: { std_key: 'srchTy' },
    fields: { module: 'e2e', stages: [LIST_SCREEN.stage], type: 'text', label: 'srchTy', as_column: 1 },
  }]);
  await core.put('dict_screen', [{
    require: { site: 'g2b', menu_no: LIST_SCREEN.menuNo },
    fields: { stage: LIST_SCREEN.stage, key_fields: LIST_SCREEN.keyFields },
  }]);
}

// 보이는 조회·검색 버튼의 id. 글자는 밖으로 내보내지 않는다.
function findSearchButtonId([root, texts]) {
  const candidates = [...document.getElementById(root).querySelectorAll('input[type=button],button,a')];
  const hit = candidates.find((e) => e.id && e.getClientRects().length > 0
    && texts.includes((e.value || e.textContent || '').trim()));
  return hit ? hit.id : null;
}

async function clickSiteSearch(s, id) {
  await s.pace();
  await s.page.locator(`[id="${id}"]`).click();
}

export async function checkAutoCollect(s, core) {
  await assignListScreen(core);
  await openList(s, core, ORDER_LIST);
  await s.page.waitForTimeout(2000);
  const menuNo = await s.page.evaluate(readMenuNo);
  const buttonId = await s.page.evaluate(findSearchButtonId, [ROOT, SEARCH_TEXTS]);
  if (!buttonId) return { pass: false, 이유: '시험 화면에 보이는 조회 버튼이 없음', 화면: menuNo };
  await watchCollectPresses(s.page);
  await setAutoCollect(s, false);

  const base = await core.total('g2b_capture');
  const autoBase = (await readAutoCount(s.page)) ?? 0;
  await clickSiteSearch(s, buttonId);
  await s.page.waitForTimeout(SETTLE_MS);
  const offDelta = (await core.total('g2b_capture')) - base;
  const offAuto = ((await readAutoCount(s.page)) ?? 0) - autoBase;

  await setAutoCollect(s, true);
  const beforeOn = await core.total('g2b_capture');
  await clickSiteSearch(s, buttonId);
  const firstRan = await waitFor(async () => ((await readAutoCount(s.page)) ?? 0) > autoBase, SETTLE_MS * 2, 500);
  const firstToast = await readShadowText(s.page, 'toast');
  const onDelta = (await core.total('g2b_capture')) - beforeOn;

  const afterFirst = await core.total('g2b_capture');
  const autoAfterFirst = (await readAutoCount(s.page)) ?? 0;
  await clickSiteSearch(s, buttonId);
  const autoNow = async () => (await readAutoCount(s.page)) ?? 0;
  const secondRan = await waitFor(async () => (await autoNow()) > autoAfterFirst, SETTLE_MS * 2, 500);
  const secondDelta = (await core.total('g2b_capture')) - afterFirst;
  await setAutoCollect(s, false);

  const presses = await readCollectPresses(s.page);
  const pass = offDelta === 0 && offAuto === 0 && Boolean(firstRan) && firstToast.startsWith('자동 ')
    && onDelta === 1 && Boolean(secondRan) && secondDelta === 0 && presses === 0;
  return {
    pass, 화면: menuNo, 꺼짐_capture변화: offDelta, 꺼짐_자동수집: offAuto, 켜짐_자동수집됨: Boolean(firstRan),
    켜짐_capture변화: onDelta, 한번더_자동수집됨: Boolean(secondRan), 한번더_capture변화: secondDelta,
    수집버튼_누른횟수: presses,
  };
}
