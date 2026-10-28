// 한 크기(행 수)에서 SPEC 8절 뷰어 몫을 잰다. 시각은 page-helpers.js가 페이지 안에서 잰다.
import { coreGet } from './core-process.mjs';
import { frameShare, percentile } from './stats.mjs';

const TABLE = 'g2b_bid';
const TEXT_COLUMN = 'key00';
const MONEY_COLUMN = 'key01';
const DATE_COLUMN = 'key02';
const REPS = Number(process.env.BENCH_REPS ?? 5);
const SETTLE_MS = 250;
// SPEC의 16.7ms는 60Hz 한 프레임이다. 프레임 시각이 0.1ms 단위로 16.5~16.8 사이를 흔들려 빈 페이지도 글자 그대로의
// 16.7을 못 넘는다(대조군으로 확인). 그래서 S4(docs/grid-choice.md)와 같이 17ms 이하를 제때 그려진 프레임으로 본다.
const FRAME_LIMIT_MS = 17;
const NOMINAL_FRAME_MS = 16.7;

export const spread = (values) => ({ median: percentile(values, 0.5), max: Math.max(...values) });
const settle = (page) => page.waitForTimeout(SETTLE_MS);
const recordsPath = (query) => `/api/tables/${TABLE}/records?${query}`;
const noCommas = (text) => (text ?? '').replace(/,/g, '');

async function firstRecord(connection, query) {
  const reply = await coreGet(connection, recordsPath(`${query}&limit=1`));
  return reply.records[0].fields;
}

export async function measureFirstPage(context, viewerUrl, problems) {
  const times = [];
  for (let rep = 0; rep < REPS; rep++) {
    const page = await context.newPage();
    watchProblems(page, problems);
    await page.goto(viewerUrl, { waitUntil: 'commit' });
    const at = await page.evaluate(() => window.__firstRowAt);
    if (at === null) problems.push('첫 쪽 행이 20초 안에 그려지지 않았다');
    else times.push(at);
    await page.close();
  }
  return times;
}

export function watchProblems(page, problems) {
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message.slice(0, 200)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 200)}`);
  });
}

export async function countColumns(page) {
  return page.evaluate(() => window.__bench.columnCount());
}

// 머리글을 눌러 오름 → 내림 → 해제를 두 번 돈다. 매번 코어가 돌려준 첫 행이 그려질 때까지 잰다.
export async function measureSort(page, connection, columnId, problems) {
  const sorts = [columnId, `-${columnId}`, ''];
  const headerSelector = await page.evaluate((id) => window.__h.SEL.header(id), columnId);
  const times = [];
  for (let cycle = 0; cycle < 2; cycle++) {
    for (const sort of sorts) {
      const expected = (await firstRecord(connection, sort ? `sort=${sort}` : 'offset=0'))[columnId];
      const before = noCommas(await page.evaluate((id) => window.__h.cellText(0, id), columnId));
      if (before === noCommas(expected)) problems.push(`정렬 전후 첫 행이 같아 잴 수 없다(${columnId})`);
      const timed = page.evaluate(async ([id, want]) => {
        const h = window.__h;
        let t0 = null;
        const mark = () => { t0 = performance.now(); };
        document.addEventListener('mousedown', mark, { capture: true, once: true });
        const t1 = await h.waitFor(() => h.cellText(0, id)?.replace(/,/g, '') === want);
        return t1 - t0;
      }, [columnId, noCommas(expected)]);
      await page.click(`${headerSelector} .ag-header-cell-label`);
      times.push(await timed);
      await settle(page);
    }
  }
  return times;
}

// 같음 필터를 쓴다. 칸에 값을 넣어 두고(시간에 안 들어감) Enter를 누른 때부터 필터된 행이 그려질 때까지 잰다.
export async function measureFilter(page, connection, columnId, total, problems) {
  const times = [];
  const input = await page.evaluate((id) => window.__h.SEL.floatingInput(id), columnId);
  for (let rep = 0; rep < REPS; rep++) {
    const offset = Math.floor((total * (rep + 1)) / (REPS + 1));
    const value = noCommas((await firstRecordAt(connection, offset))[columnId]);
    const before = noCommas(await page.evaluate((id) => window.__h.cellText(0, id), columnId));
    if (before === value) problems.push(`필터 전후 첫 행이 같아 잴 수 없다(${columnId})`);
    await page.fill(input, value);
    const timed = page.evaluate(async ([id, want]) => {
      const h = window.__h;
      let t0 = null;
      const mark = () => { t0 = performance.now(); };
      document.addEventListener('keydown', mark, { capture: true, once: true });
      const t1 = await h.waitFor(() => h.cellText(0, id)?.replace(/,/g, '') === want);
      return t1 - t0;
    }, [columnId, value]);
    await page.press(input, 'Enter');
    times.push(await timed);
    await settle(page);
    await page.fill(input, '');
    await page.press(input, 'Enter');
    await settle(page);
  }
  return times;
}

async function firstRecordAt(connection, offset) {
  const reply = await coreGet(connection, recordsPath(`limit=1&offset=${offset}`));
  return reply.records[0].fields;
}

// 날짜 열을 글자로 바꿨다 되돌린다. 코어 요청이 하나라도 나가면 실패로 센다(저장 안 함·코어 제외).
export async function measureTypeChange(page, connection, problems) {
  const raw = (await firstRecordAt(connection, 0))[DATE_COLUMN];
  const shown = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  let coreRequests = 0;
  page.on('request', (request) => {
    if (request.url().startsWith(connection.baseUrl)) coreRequests += 1;
  });
  const flip = (type, want) => page.evaluate(async ([id, nextType, text]) => {
    const h = window.__h;
    const t0 = performance.now();
    const drawn = h.waitFor(() => h.cellText(0, id) === text);
    await window.__bench.setColumnType(id, nextType);
    return (await drawn) - t0;
  }, [DATE_COLUMN, type, want]);
  const times = [];
  for (let rep = 0; rep < REPS; rep++) {
    times.push(await flip('text', raw));
    await settle(page);
    times.push(await flip('date', shown));
    await settle(page);
  }
  if (coreRequests > 0) problems.push(`열 타입 변경 중 코어 요청 ${coreRequests}건`);
  return times;
}

async function sweep(page, axis, lastRowIndex, problems) {
  await page.mouse.move(640, 400);
  await page.evaluate(() => window.__h.startFrames());
  const selector = await page.evaluate((a) => window.__h.SEL[a === 'v' ? 'vScroll' : 'hScroll'], axis);
  let atEndChecks = 0;
  for (let step = 1; step < 4000 && atEndChecks < 3; step++) {
    await page.mouse.wheel(axis === 'h' ? 800 : 0, axis === 'v' ? 800 : 0);
    await page.waitForTimeout(12);
    if (step % 8 === 0) {
      const done = await page.evaluate(([s, a]) => window.__h.atEnd(s, a), [selector, axis]);
      atEndChecks = done ? atEndChecks + 1 : 0;
    }
  }
  await page.waitForTimeout(400);
  const frames = await page.evaluate(() => window.__h.stopFrames());
  if (atEndChecks < 3) problems.push(`휠 훑기가 끝까지 가지 못했다(${axis})`);
  const shown = axis === 'v'
    ? await page.evaluate((last) => window.__h.cellText(last, 'key00'), lastRowIndex)
    : await page.evaluate(() => !!document.querySelector(window.__h.SEL.header('key99')));
  if (!shown) problems.push(`끝까지 간 뒤 마지막 ${axis === 'v' ? '행' : '열'}이 그려지지 않았다`);
  return { ...frameShare(frames, FRAME_LIMIT_MS), strictShare: frameShare(frames, NOMINAL_FRAME_MS).share };
}

export async function measureWheel(page, rows, problems) {
  const vertical = await sweep(page, 'v', rows - 1, problems);
  await page.evaluate(() => document.querySelector(window.__h.SEL.vScroll).scrollTo(0, 0));
  const horizontal = await sweep(page, 'h', rows - 1, problems);
  return { vertical, horizontal };
}

// 대조군: 빈 페이지가 이 컨테이너에서 같은 기준을 넘는지. 못 넘으면 뷰어를 탓할 수 없다.
export async function measureBlankPage(context) {
  const page = await context.newPage();
  await page.goto('about:blank');
  await page.addScriptTag({ content: 'document.body.style.height="100000px"' });
  await page.evaluate(() => {
    const frames = [];
    const tick = (time) => {
      frames.push(time);
      if (frames.length < 400) requestAnimationFrame(tick);
      else window.__blank = frames;
    };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(640, 400);
  for (let i = 0; i < 200; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(12);
  }
  await page.waitForFunction(() => window.__blank);
  const frames = await page.evaluate(() => window.__blank);
  const result = { ...frameShare(frames, FRAME_LIMIT_MS), strictShare: frameShare(frames, NOMINAL_FRAME_MS).share };
  await page.close();
  return result;
}

export { TEXT_COLUMN, MONEY_COLUMN, FRAME_LIMIT_MS, REPS };
