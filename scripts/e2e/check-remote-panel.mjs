// SPEC 8절: 리모컨을 끌어 옮기고 접은 뒤 새로 고쳐도 접힌 버블이 옮긴 자리에 있다. 끝나면 다시 펼친다.
import { openSite } from './setup.mjs';
import { waitFor } from './remote-ui.mjs';

const TOLERANCE_PX = 8;
const DRAG_RIGHT = 120;
const DRAG_DOWN = 80;

// Shadow DOM 안의 요소는 CSS 선택자가 뚫고 들어가므로 host 밑 선택자로 부른다.
const part = (s, selector) => s.page.locator(`#helper-remote ${selector}`);

function readRect(page, selector) {
  return page.evaluate((sel) => {
    const node = document.getElementById('helper-remote')?.shadowRoot?.querySelector(sel);
    if (!node || node.hidden) return null;
    const { left, top } = node.getBoundingClientRect();
    return { left, top };
  }, selector);
}

const near = (a, b) => Math.abs(a.left - b.left) <= TOLERANCE_PX && Math.abs(a.top - b.top) <= TOLERANCE_PX;

// 패널은 기본으로 오른쪽 끝에 붙어 오른쪽으로 120px을 옮길 자리가 없다. 자리가 없으면 왼쪽으로 옮긴다.
async function dragTitle(s) {
  const bar = await readRect(s.page, '.bar');
  const title = await part(s, '.title > span').boundingBox();
  const width = await s.page.evaluate(() => window.innerWidth);
  const barWidth = (await part(s, '.bar').boundingBox()).width;
  const dx = bar.left + DRAG_RIGHT + barWidth <= width ? DRAG_RIGHT : -DRAG_RIGHT;
  const from = { x: title.x + title.width / 2, y: title.y + title.height / 2 };
  await s.pace();
  await s.page.mouse.move(from.x, from.y);
  await s.page.mouse.down();
  await s.page.mouse.move(from.x + dx / 2, from.y + DRAG_DOWN / 2, { steps: 5 });
  await s.page.mouse.move(from.x + dx, from.y + DRAG_DOWN, { steps: 5 });
  await s.page.mouse.up();
  return { before: bar, wanted: { left: bar.left + dx, top: bar.top + DRAG_DOWN }, dx };
}

async function reloadSite(s) {
  await s.pace();
  await openSite(s.page);
  await part(s, '.bar').waitFor({ state: 'attached', timeout: 15000 });
}

export async function checkPanelMemory(s) {
  const { wanted, dx } = await dragTitle(s);
  const dragged = await readRect(s.page, '.bar');
  const dragOk = Boolean(dragged) && near(dragged, wanted);
  await s.pace();
  await part(s, '[data-action="collapse"]').click();
  await reloadSite(s);
  const bubble = await waitFor(() => readRect(s.page, '.bubble'), 10000);
  const barHidden = (await readRect(s.page, '.bar')) === null;
  const placedOk = Boolean(bubble) && near(bubble, dragged);
  if (bubble) {
    await s.pace();
    await part(s, '.bubble').click();
  }
  const reopened = Boolean(await waitFor(() => readRect(s.page, '.bar'), 3000));
  return {
    pass: dragOk && Boolean(bubble) && barHidden && placedOk && reopened,
    끌기_맞음: dragOk, 가로_방향: dx > 0 ? '오른쪽' : '왼쪽', 버블로_접힘: Boolean(bubble) && barHidden,
    위치_유지: placedOk, 다시_펼침: reopened,
  };
}
