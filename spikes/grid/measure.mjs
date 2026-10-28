import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { serveDist } from './serve.mjs';
import { createSource, makeColumns, formatCell, rawValue } from './data.js';
import { probeFeatures } from './features.mjs';
import { frameStats, median } from './stats.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const REPS = Number(process.env.REPS ?? 5);
const SWEEP_REPS = Number(process.env.SWEEP_REPS ?? 3);
const LIBS = ['ag', 'revo', 'tabulator'];
const SIZES = [1000, 10000];
const HELPERS = new URL('./page-helpers.js', import.meta.url).pathname;

function expectations(rows) {
  const columns = makeColumns(100);
  const source = createSource(rows, columns);
  return {
    firstC0: rawValue(0, 0, 'text'),
    moneyRaw: rawValue(0, 1, 'money'),
    moneyShown: formatCell(rawValue(0, 1, 'money'), 'money'),
    // 정렬한 뒤의 끝 행이다. 정렬은 휠 훑기 앞에서 한다.
    sortedLastC0: async () => (await source.getRows(rows - 1, rows, { colId: 'c1', dir: 'asc' })).rows[0].c0,
    sortedFirst: async () => {
      const first = (await source.getRows(0, 1, { colId: 'c1', dir: 'asc' })).rows[0];
      return formatCell(first.c1, 'money');
    },
  };
}

async function sweep(page, axis) {
  await page.mouse.move(640, 400);
  await page.evaluate(() => window.__h.startFrames());
  const selector = await page.evaluate((a) => window.__spike.sel[a === 'v' ? 'vScroll' : 'hScroll'], axis);
  let atEndChecks = 0;
  for (let step = 1; step < 4000 && atEndChecks < 3; step++) {
    await page.mouse.wheel(axis === 'h' ? 800 : 0, axis === 'v' ? 800 : 0);
    await page.waitForTimeout(12);
    if (step % 8 === 0) {
      const done = await page.evaluate(([s, a]) => window.__h.atEnd(s, a), [selector, axis]);
      atEndChecks = done ? atEndChecks + 1 : 0;
    }
  }
  await page.waitForTimeout(200);
  return { stats: frameStats(await page.evaluate(() => window.__h.stopFrames())), reachedEnd: atEndChecks >= 3 };
}

async function runOnce(browser, base, lib, rows, withSweep) {
  const want = expectations(rows);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const problems = [];
  page.on('pageerror', (e) => problems.push(e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 200)); });
  await page.addInitScript({ path: HELPERS });
  await page.goto(`${base}/${lib}.html?rows=${rows}&cols=100`);

  const firstRowMs = await page.evaluate(() => window.__firstRowAt);
  const firstText = await page.evaluate(() => window.__h.cellText(0, 'c0'));
  if (firstText !== want.firstC0) problems.push(`첫 칸 ${firstText} != ${want.firstC0}`);
  const pagesAtFirstScreen = await page.evaluate(() => window.__spike.source.calls.length);
  await page.waitForTimeout(500);

  const typeChange = async (type, expected) => page.evaluate(async ([t, text]) => {
    const t0 = performance.now();
    const drawn = window.__h.waitFor(() => window.__h.cellText(0, 'c1') === text);
    await window.__spike.setType('c1', t);
    return (await drawn) - t0;
  }, [type, expected]);
  const toText = await typeChange('text', want.moneyRaw);
  const toMoney = await typeChange('money', want.moneyShown);
  await page.waitForTimeout(300);

  const header = await page.evaluate(() => window.__spike.sel.header('c1'));
  const sortedFirst = await want.sortedFirst();
  const armed = page.evaluate(async (expected) => {
    let t0 = null;
    document.addEventListener('mousedown', () => { t0 = performance.now(); }, { capture: true, once: true });
    const t1 = await window.__h.waitFor(() => window.__h.cellText(0, 'c1') === expected);
    return t1 - t0;
  }, sortedFirst);
  await page.click(header);
  const sortMs = await armed;

  const result = { firstRowMs, pagesAtFirstScreen, typeChangeMs: [toText, toMoney], sortMs, problems };
  if (withSweep) {
    const vertical = await sweep(page, 'v');
    const lastShown = await page.evaluate(
      (l) => window.__spike.lastRowText?.('c0') ?? window.__h.cellText(l, 'c0'),
      rows - 1,
    );
    const wantLast = await want.sortedLastC0();
    if (lastShown !== wantLast) problems.push(`끝 행 ${lastShown} != ${wantLast}`);
    const horizontal = await sweep(page, 'h');
    const lastHeader = await page.evaluate(() => !!document.querySelector(window.__spike.sel.header('c99')));
    if (!lastHeader) problems.push('끝 열 머리글이 안 보임');
    Object.assign(result, { vertical, horizontal });
  }
  await page.close();
  return result;
}

async function baseline(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript({ path: HELPERS });
  await page.goto(`${base}/base.html`);
  await page.mouse.move(640, 400);
  await page.evaluate(() => window.__h.startFrames());
  for (let i = 0; i < 250; i++) { await page.mouse.wheel(0, 800); await page.waitForTimeout(12); }
  const stats = frameStats(await page.evaluate(() => window.__h.stopFrames()));
  await page.close();
  return stats;
}

function summarize(runs) {
  const col = (pick) => runs.map(pick).filter((v) => v != null);
  const spread = (values) => ({ median: median(values), max: Math.max(...values) });
  const sweepOf = (axis) => {
    const stats = runs.filter((r) => r[axis]).map((r) => r[axis].stats);
    const smallest = (key) => Math.min(...stats.map((s) => s[key]));
    return {
      share16Min: smallest('share16'),
      share17Min: smallest('share17'),
      p90Max: Math.max(...stats.map((s) => s.p90Ms)),
      reachedEnd: runs.filter((r) => r[axis]).every((r) => r[axis].reachedEnd),
    };
  };
  return {
    reps: runs.length,
    firstRowMs: spread(col((r) => r.firstRowMs)),
    sortMs: spread(col((r) => r.sortMs)),
    typeChangeMs: spread(runs.flatMap((r) => r.typeChangeMs)),
    pagesAtFirstScreen: runs[0].pagesAtFirstScreen,
    vertical: sweepOf('vertical'),
    horizontal: sweepOf('horizontal'),
    problems: [...new Set(runs.flatMap((r) => r.problems))],
  };
}

const server = await serveDist(new URL('./dist', import.meta.url).pathname);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const results = {
  chromium: browser.version(), reps: REPS, sweepReps: SWEEP_REPS, baseline: [], libs: {}, features: {},
};

for (let i = 0; i < SWEEP_REPS; i++) results.baseline.push(await baseline(browser, base));
for (const lib of LIBS) {
  results.libs[lib] = {};
  for (const rows of SIZES) {
    const runs = [];
    for (let i = 0; i < REPS; i++) runs.push(await runOnce(browser, base, lib, rows, i < SWEEP_REPS));
    results.libs[lib][rows] = summarize(runs);
    console.error(`${lib} ${rows} done`);
  }
  results.features[lib] = await probeFeatures(browser, base, lib);
}
await browser.close();
server.close();
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
