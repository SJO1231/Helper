// SPEC2 ②: 뷰어에서 사전 칸을 고치면 코어에 PATCH가 한 번만 가고 그 칸이 바뀐 값을 보인다.
// 형 변환도 본다: 0/1 칸에 글자, JSON 칸에 깨진 글자는 PATCH 0회·상태줄 오류. 기본키 칸은 편집기가 안 뜬다.
const TABLE = 'dict_screen';
const SETTLE_MS = 800;

async function editCell(page, col, text) {
  const cell = page.locator(`.ag-row[row-index="0"] .ag-cell[col-id="${col}"]`).first();
  await cell.dblclick();
  const input = page.locator('.ag-cell-inline-editing input').first();
  if (!(await input.isVisible().catch(() => false))) return { editor: false };
  await input.fill(text);
  await input.press('Enter');
  await page.waitForTimeout(SETTLE_MS);
  return { editor: true, status: await page.locator('#status').innerText(), cell: await cell.innerText() };
}

export async function checkDictEdit({ context, extensionId }, core) {
  const page = await context.newPage();
  let patches = 0;
  page.on('request', (r) => { if (r.method() === 'PATCH') patches++; });
  try {
    await page.goto(`chrome-extension://${extensionId}/viewer.html?table=${TABLE}`);
    await page.locator('#status').filter({ hasText: /행$/ }).waitFor({ timeout: 20000 });
    await page.waitForTimeout(1000);
    const menuNo = await page.locator('.ag-row[row-index="0"] .ag-cell[col-id="menu_no"]').first().innerText();
    const read = async () => (await core.get(`/api/tables/${TABLE}/records?limit=1&filter=${
      encodeURIComponent(JSON.stringify({ site: ['g2b'], menu_no: [menuNo] }))}`)).records[0].fields;
    const before = (await read()).name;
    const name = await editCell(page, 'name', `${before}·e2e`);
    await page.waitForTimeout(3000); // 되풀이 PATCH가 있으면 여기서 쌓인다
    const afterName = (await read()).name;
    const patchesAfterOne = patches;
    const badJson = await editCell(page, 'key_fields', '[not json');
    const patchesAfterBad = patches;
    const primary = await editCell(page, 'menu_no', 'zz');
    const pass = name.editor && afterName === `${before}·e2e` && name.cell === afterName && patchesAfterOne === 1
      && badJson.editor && patchesAfterBad === 1 && /JSON/.test(badJson.status ?? '') && primary.editor === false;
    return { pass, 코어_반영: afterName === `${before}·e2e`, 칸_반영: name.cell === afterName, PATCH_1회: patchesAfterOne,
      깨진JSON_PATCH: patchesAfterBad - patchesAfterOne, 깨진JSON_상태: badJson.status, 기본키_편집기: primary.editor };
  } finally {
    await page.close();
  }
}
