// 확장 리모컨(Shadow DOM, #helper-remote)을 사람이 누르듯 누르고 읽는다.
const HOST = '#helper-remote';
const inShadow = (selector) => `${HOST} ${selector}`;

// 버튼이 든 탭을 먼저 연다. 다른 탭의 버튼은 숨겨져 있어 누를 수 없다.
async function showTabOf(pageObj, selector) {
  const name = await pageObj.locator(inShadow(selector)).evaluate((node) => {
    const pane = node.closest('[data-pane]');
    return pane?.hidden ? pane.dataset.pane : null;
  });
  // 이미 열려 있으면 누르지 않는다. 스냅샷 창이 떠 있으면 탭이 가려져 눌리지 않는다.
  if (name) await pageObj.locator(inShadow(`[data-tab="${name}"]`)).click();
}

export async function waitFor(check, timeoutMs, stepMs = 300) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > until) return null;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}

export async function waitRemoteIdle(page) {
  // 스냅샷 버튼은 일하는 동안만 꺼진다.
  await showTabOf(page, '[data-action="snapshot"]');
  await page.locator(inShadow('[data-action="snapshot"]')).and(page.locator(':enabled'))
    .waitFor({ timeout: 30000 });
}

export async function pressRemote(s, action) {
  await s.pace();
  await showTabOf(s.page, `[data-action="${action}"]`);
  await page(s).locator(inShadow(`[data-action="${action}"]`)).click();
  await waitRemoteIdle(page(s));
}

const page = (s) => s.page;

export function readShadowText(pageObj, role) {
  return pageObj.evaluate((r) => document.getElementById('helper-remote')?.shadowRoot
    ?.querySelector(`[data-role="${r}"]`)?.textContent ?? '', role);
}

export async function waitCollectEnabled(pageObj, timeoutMs = 20000) {
  await showTabOf(pageObj, '[data-action="collect"]');
  return pageObj.locator(inShadow('[data-action="collect"]')).and(pageObj.locator(':enabled'))
    .waitFor({ timeout: timeoutMs }).then(() => true, () => false);
}

// 스냅샷 창의 그리드 표마다 머리글 목록.
export function readSnapshotHeads(pageObj) {
  return pageObj.evaluate(() => {
    const root = document.getElementById('helper-remote')?.shadowRoot;
    const tables = root ? [...root.querySelectorAll('[data-role="snapshot"] table[data-kind="grid"]')] : [];
    return tables.map((t) => [...t.querySelectorAll('tr:first-child th')].map((th) => th.textContent));
  });
}

export async function closeSnapshot(s) {
  const button = s.page.locator(inShadow('[data-action="close-snapshot"]'));
  if (await button.count()) await button.click();
}

export async function chooseRowCount(s, value) {
  await s.pace();
  await showTabOf(s.page, '[data-role="row-count"]');
  await s.page.locator(inShadow('[data-role="row-count"]')).selectOption(value);
}

// 직링크 select에서 화면을 고른다. 그 값이 목록에 없으면 false.
export async function chooseScreen(s, menuNo) {
  await showTabOf(s.page, '[data-role="screen-select"]');
  const select = s.page.locator(inShadow('[data-role="screen-select"]'));
  const listed = await waitFor(() => select.locator(`option[value="${menuNo}"]`).count(), 10000);
  if (!listed) return false;
  await s.pace();
  await select.selectOption(menuNo);
  return true;
}

// 자동수집 스위치(수집 탭)를 켜고 끈다. 실제 체크박스를 눌러 remotePanel 저장까지 탄다.
export async function setAutoCollect(s, on) {
  await s.pace();
  await showTabOf(s.page, '[data-role="auto-collect"]');
  await s.page.locator(inShadow('[data-role="auto-collect"]')).setChecked(on);
}

// 리모컨 '수집' 버튼이 눌린 횟수를 세는 감시를 건다. 사람 또는 스크립트가 누르면 올라간다.
export function watchCollectPresses(pageObj) {
  return pageObj.evaluate(() => {
    const button = document.getElementById('helper-remote').shadowRoot.querySelector('[data-action="collect"]');
    window.__collectPresses = 0;
    button.addEventListener('click', () => void window.__collectPresses++, true);
  });
}

export const readCollectPresses = (pageObj) => pageObj.evaluate(() => window.__collectPresses ?? -1);

export async function readAutoCount(pageObj) {
  const text = await readShadowText(pageObj, 'diagnostics');
  const found = /자동수집 (\d+)회/.exec(text);
  return found ? Number(found[1]) : null;
}
