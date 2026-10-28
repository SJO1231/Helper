// 시험용 확장: 뷰어 번들 + background 대역. 실제 확장은 S3가 만들고 여기서는 core.connection 답({ok,data})만 흉내 낸다.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { viewerBuildOptions } from '../viewer-build.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export async function buildViewerBundle(outDir) {
  mkdirSync(outDir, { recursive: true });
  await build(viewerBuildOptions(ROOT, outDir));
  copyFileSync(join(ROOT, 'viewer/viewer.html'), join(outDir, 'viewer.html'));
}

export function writeBenchExtension(extensionDir, bundleDir, connection) {
  mkdirSync(extensionDir, { recursive: true });
  // viewer.js와 나중에 읽는 조각(chunk-*.js)을 모두 옮긴다.
  const files = readdirSync(bundleDir).filter((name) => name === 'viewer.html' || name.endsWith('.js'));
  for (const name of files) copyFileSync(join(bundleDir, name), join(extensionDir, name));
  const manifest = {
    manifest_version: 3,
    name: 'helper-bench',
    version: '0.0.1',
    background: { service_worker: 'background.js' },
    host_permissions: ['http://127.0.0.1/*'],
  };
  writeFileSync(join(extensionDir, 'manifest.json'), JSON.stringify(manifest));
  const answer = JSON.stringify(connection);
  writeFileSync(join(extensionDir, 'background.js'), `chrome.runtime.onMessage.addListener((message, _s, reply) => {
  if (message?.kind === 'core.connection') reply({ ok: true, data: ${answer} });
});\n`);
}
