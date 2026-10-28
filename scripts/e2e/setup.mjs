// 빈 임시 DB로 코어를 띄우고, 빌드한 확장(dist/extension)을 Playwright Chromium에 올린다.
// 확장은 등록된 Native host(scripts/install-host.ps1)로 hello를 보내므로 그 호스트가 이 임시 코어를 찾게
// HELPER_HOME·HELPER_DB를 브라우저 환경에 넣는다(Chrome은 Native host에 자기 환경을 물려준다).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startCore } from '../bench/core-process.mjs';
import { createCoreHttp } from './core-http.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXTENSION_DIR = join(ROOT, 'dist/extension');
const BASE = 'https://www.g2b.go.kr/';

function buildExtension() {
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('확장 빌드 실패');
}

export async function startStack({ headed = false } = {}) {
  buildExtension();
  const workDir = mkdtempSync(join(tmpdir(), 'helper-e2e-'));
  const home = join(workDir, 'home');
  const db = join(workDir, 'helper.sqlite3');
  const core = await startCore(home, db);
  const context = await chromium.launchPersistentContext(join(workDir, 'profile'), {
    channel: 'chromium',
    headless: !headed,
    acceptDownloads: true,
    viewport: { width: 1400, height: 900 },
    env: { ...process.env, HELPER_HOME: home, HELPER_DB: db },
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = worker.url().split('/')[2];
  const fixedId = JSON.parse(readFileSync(join(ROOT, 'scripts/extension-key.json'), 'utf8')).id;
  if (extensionId !== fixedId) throw new Error('올라간 확장 ID가 고정 ID와 다르다');
  const page = context.pages()[0] ?? (await context.newPage());

  async function stop() {
    await context.close().catch(() => {});
    core.stop();
    // 코어가 DB 파일을 놓을 때까지 잠깐 기다렸다 지운다.
    await new Promise((resolve) => setTimeout(resolve, 500));
    rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
  return { page, context, extensionId, core: createCoreHttp(core.connection), stop };
}

export async function openSite(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window._gcm && window._gcm.Global.getMainLoaded
    && window._gcm.Global.getMainLoaded(), null, { timeout: 30000 });
  await page.waitForTimeout(3000);
}
