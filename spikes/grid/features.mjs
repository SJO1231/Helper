// 2단계 대비 기능 유무. 실제 화면에서 두 번 클릭·우클릭을 해 보고 DOM에 무엇이 생기는지 본다.
export async function probeFeatures(browser, base, lib) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript({ path: new URL('./page-helpers.js', import.meta.url).pathname });
  await page.goto(`${base}/${lib}.html?rows=1000&cols=100&probe=1`);
  await page.evaluate(() => window.__firstRowAt);
  const cell = (row) => page.evaluate((r) => window.__spike.sel.cell(r, 'c0'), row);

  await page.dblclick(await cell(0));
  await page.waitForTimeout(300);
  const editor = await page.evaluate(() => {
    const active = document.activeElement;
    const inGrid = !!active && !!active.closest('#grid') && /^(INPUT|TEXTAREA)$/.test(active.tagName);
    return { opened: inGrid, tag: inGrid ? active.tagName : null };
  });
  await page.keyboard.press('Escape');

  await page.evaluate(() => { window.__before = new Set(document.querySelectorAll('*')); });
  await page.click(await cell(1), { button: 'right' });
  await page.waitForTimeout(300);
  const menu = await page.evaluate(() => {
    const visible = (e) => e.getClientRects().length > 0;
    const menuLike = (e) => /menu|popup|context/i.test(`${e.getAttribute('role') ?? ''} ${e.className}`);
    const isNew = (e) => !window.__before.has(e);
    const added = [...document.querySelectorAll('*')].filter((e) => isNew(e) && visible(e) && menuLike(e));
    const describe = (e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`;
    return { appeared: added.length > 0, sample: added.slice(0, 3).map(describe) };
  });
  await page.close();
  return { editor, contextMenu: menu };
}
