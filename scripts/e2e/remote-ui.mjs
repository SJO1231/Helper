// 확장 리모컨(Shadow DOM, #helper-remote)을 사람이 누르듯 누르고 읽는다.
const HOST = '#helper-remote';
const inShadow = (selector) => `${HOST} ${selector}`;

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
  await page.locator(inShadow('[data-action="snapshot"]')).and(page.locator(':enabled'))
    .waitFor({ timeout: 30000 });
}

export async function pressRemote(s, action) {
  await s.pace();
  await page(s).locator(inShadow(`[data-action="${action}"]`)).click();
  await waitRemoteIdle(page(s));
}

const page = (s) => s.page;

export function readShadowText(pageObj, role) {
  return pageObj.evaluate((r) => document.getElementById('helper-remote')?.shadowRoot
    ?.querySelector(`[data-role="${r}"]`)?.textContent ?? '', role);
}

export async function waitCollectEnabled(pageObj, timeoutMs = 20000) {
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
  await s.page.locator(inShadow('[data-role="row-count"]')).selectOption(value);
}
