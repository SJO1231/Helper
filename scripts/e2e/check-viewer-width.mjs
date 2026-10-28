// SPEC 8절: 뷰어에서 첫 열 폭을 끌어 넓히고 새로 고쳐도 폭이 유지된다(열 폭은 localStorage에 테이블별로 저장).
const TABLE = 'g2b_bid';
const WIDEN_PX = 60;
const TOLERANCE_PX = 4;
const FIRST_HEADER = '.ag-header-cell';

async function openViewer(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/viewer.html?table=${TABLE}`);
  await page.locator('#status').filter({ hasText: /행$/ }).waitFor({ timeout: 20000 });
  await page.locator(FIRST_HEADER).first().waitFor({ timeout: 10000 });
  return page;
}

const firstColumnWidth = async (page) => (await page.locator(FIRST_HEADER).first().boundingBox()).width;

async function dragFirstResizeHandle(page) {
  const handle = await page.locator(`${FIRST_HEADER} .ag-header-cell-resize`).first().boundingBox();
  const from = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + WIDEN_PX / 2, from.y, { steps: 5 });
  await page.mouse.move(from.x + WIDEN_PX, from.y, { steps: 5 });
  await page.mouse.up();
  // AG Grid가 열 폭 변경 이벤트를 내고 뷰어가 저장할 시간.
  await page.waitForTimeout(500);
}

export async function checkViewerColumnWidth({ context, extensionId }) {
  const page = await openViewer(context, extensionId);
  try {
    const before = await firstColumnWidth(page);
    await dragFirstResizeHandle(page);
    const dragged = await firstColumnWidth(page);
    await page.reload();
    await page.locator('#status').filter({ hasText: /행$/ }).waitFor({ timeout: 20000 });
    await page.locator(FIRST_HEADER).first().waitFor({ timeout: 10000 });
    const restored = await firstColumnWidth(page);
    const widened = Math.abs(dragged - before - WIDEN_PX) <= TOLERANCE_PX;
    const kept = Math.abs(restored - dragged) <= TOLERANCE_PX;
    return {
      pass: widened && kept, 넓어짐: widened, 유지됨: kept,
      폭_px: { 전: Math.round(before), 끈_뒤: Math.round(dragged), 새로고침_뒤: Math.round(restored) },
    };
  } finally {
    await page.close();
  }
}
