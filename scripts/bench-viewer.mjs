// npm run bench:viewer — SPEC 8절 뷰어 몫을 합성 자료 1,000행·10,000행 × 100열에서 코어 왕복 포함으로 잰다.
// 기준마다 JSON 한 줄을 표준 출력에 내고, 하나라도 거짓이면 종료 코드 1이다. 진행 기록은 표준 오류로 간다.
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildViewerBundle, writeBenchExtension } from './bench/build-extension.mjs';
import { coreGet, runSeed, startCore } from './bench/core-process.mjs';
import * as measure from './bench/measure.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const HELPERS = new URL('./bench/page-helpers.js', import.meta.url).pathname;
const SIZES = [1000, 10000];
const LIMITS = { firstPageMs: 1000, sortMs: 300, filterMs: 300, typeChangeMs: 500, frameShare: 0.9 };
const round = (n) => Math.round(n * 10) / 10;

function timeLine(criterion, size, samples, limit) {
  const { median, max } = measure.spread(samples);
  // 표본 전부가 한계 안이어야 참이다. 중앙값만 보지 않는다.
  return { 기준: criterion, 크기: size, 값: round(median), 최대: round(max), 한계: limit, 표본: samples.length, 참: max < limit };
}

function frameLine(criterion, size, result) {
  const share = Math.round(result.share * 1000) / 1000;
  return {
    기준: criterion, 크기: size, 값: share, 한계: LIMITS.frameShare, 프레임: result.frames,
    p90Ms: round(result.p90Ms), 엄격16_7: Math.round(result.strictShare * 1000) / 1000,
    참: result.share >= LIMITS.frameShare,
  };
}

async function benchOneSize(rows, bundleDir, workDir) {
  const size = `${rows}x100`;
  const problems = [];
  const dbPath = join(workDir, `h${rows}.sqlite3`);
  const seedInfo = await runSeed(dbPath, rows);
  const core = await startCore(join(workDir, `home${rows}`), dbPath);
  const extensionDir = join(workDir, `ext${rows}`);
  writeBenchExtension(extensionDir, bundleDir, core.connection);
  const context = await chromium.launchPersistentContext(join(workDir, `profile${rows}`), {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  try {
    await context.addInitScript({ path: HELPERS });
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const viewerUrl = `chrome-extension://${worker.url().split('/')[2]}/viewer.html?table=g2b_bid&bench=1`;
    const lines = [];

    const firstPage = await measure.measureFirstPage(context, viewerUrl, problems);
    lines.push(timeLine('첫 쪽 행이 그려질 때까지 ms', size, firstPage, LIMITS.firstPageMs));

    const page = await context.newPage();
    measure.watchProblems(page, problems);
    await page.goto(viewerUrl);
    await page.evaluate(() => window.__firstRowAt);
    const shown = await measure.countColumns(page);
    const fromCore = (await coreGet(core.connection, '/api/tables/g2b_bid/columns')).columns.length;
    lines.push({
      기준: '뷰어 열 수', 크기: size, 값: shown, 한계: seedInfo.expected_columns, 코어: fromCore,
      참: shown === seedInfo.expected_columns && fromCore === shown,
    });

    const { TEXT_COLUMN, MONEY_COLUMN } = measure;
    const sortTimes = [
      ...(await measure.measureSort(page, core.connection, TEXT_COLUMN, problems)),
      ...(await measure.measureSort(page, core.connection, MONEY_COLUMN, problems)),
    ];
    lines.push(timeLine('정렬 ms(글자 열·금액 열, 코어 왕복 포함)', size, sortTimes, LIMITS.sortMs));
    const filterTimes = [
      ...(await measure.measureFilter(page, core.connection, TEXT_COLUMN, rows, problems)),
      ...(await measure.measureFilter(page, core.connection, MONEY_COLUMN, rows, problems)),
    ];
    lines.push(timeLine('필터 ms(글자 열·금액 열, 코어 왕복 포함)', size, filterTimes, LIMITS.filterMs));
    const typeTimes = await measure.measureTypeChange(page, core.connection, problems);
    lines.push(timeLine('열 타입 변경 ms(코어 제외)', size, typeTimes, LIMITS.typeChangeMs));

    const wheel = await measure.measureWheel(page, rows, problems);
    lines.push(frameLine(`휠 세로 끝까지, 프레임 ≤${measure.FRAME_LIMIT_MS}ms 비율`, size, wheel.vertical));
    lines.push(frameLine(`휠 가로 끝까지, 프레임 ≤${measure.FRAME_LIMIT_MS}ms 비율`, size, wheel.horizontal));
    lines.push({ 기준: '시험 중 오류·불일치 없음', 크기: size, 값: problems.length, 한계: 0, 참: problems.length === 0 });
    if (problems.length > 0) console.error(`[${size}] ${[...new Set(problems)].join(' | ')}`);
    return lines;
  } finally {
    await context.close();
    core.stop();
  }
}

const workDir = mkdtempSync(join(tmpdir(), 'helper-bench-'));
let failed = false;
try {
  const bundleDir = join(workDir, 'bundle');
  await buildViewerBundle(bundleDir);
  const control = await measureControl();
  console.error(
    `대조군(빈 페이지 휠): ≤${measure.FRAME_LIMIT_MS}ms 비율 ${control.share.toFixed(3)}, `
    + `≤16.7ms 비율 ${control.strictShare.toFixed(3)}, p90 ${round(control.p90Ms)}ms`,
  );
  for (const rows of SIZES) {
    console.error(`${rows}행 시작`);
    for (const line of await benchOneSize(rows, bundleDir, workDir)) {
      console.log(JSON.stringify(line));
      if (!line.참) failed = true;
    }
  }
} catch (error) {
  console.error(error);
  failed = true;
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);

async function measureControl() {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    return await measure.measureBlankPage(context);
  } finally {
    await browser.close();
  }
}
