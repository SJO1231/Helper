// 시험용 확장: 뷰어 번들 + background 대역. 실제 확장은 S3가 만들고 여기서는 core.connection 답({ok,data})만 흉내 낸다.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;

export async function buildViewerBundle(outDir) {
  mkdirSync(outDir, { recursive: true });
  await build({
    entryPoints: { viewer: join(ROOT, 'viewer/main.ts') },
    bundle: true, minify: true, format: 'esm', platform: 'browser', outdir: outDir, legalComments: 'none',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  copyFileSync(join(ROOT, 'viewer/viewer.html'), join(outDir, 'viewer.html'));
}

export function writeBenchExtension(extensionDir, bundleDir, connection) {
  mkdirSync(extensionDir, { recursive: true });
  for (const name of ['viewer.html', 'viewer.js']) copyFileSync(join(bundleDir, name), join(extensionDir, name));
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
