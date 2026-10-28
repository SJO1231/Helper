import { build } from 'esbuild';
import { createHash, createPublicKey } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from './manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist/extension');
const viewerHtml = path.join(root, 'viewer/viewer.html');
const hasViewer = existsSync(viewerHtml);

async function checkIdentity() {
  const identity = JSON.parse(await readFile(path.join(root, 'scripts/extension-key.json'), 'utf8'));
  const publicKey = Buffer.from(identity.key, 'base64');
  if (createPublicKey({ key: publicKey, type: 'spki', format: 'der' }).asymmetricKeyType !== 'rsa') {
    throw new Error('The fixed extension key must be an RSA public key.');
  }
  // 확장 ID는 공개 키 SHA-256 앞 32자를 a-p로 바꾼 것이다.
  const id = createHash('sha256').update(publicKey).digest('hex').slice(0, 32)
    .replace(/[0-9a-f]/g, (digit) => String.fromCharCode(97 + parseInt(digit, 16)));
  if (id !== identity.id) throw new Error('Fixed extension ID and public key disagree.');
  return identity;
}

function bundle(entry, outfile, format) {
  return build({
    absWorkingDir: root,
    entryPoints: [entry],
    outfile: path.join(output, outfile),
    bundle: true,
    format,
    target: 'chrome120',
    platform: 'browser',
    minify: true,
  });
}

await mkdir(output, { recursive: true });
const identity = await checkIdentity();
await bundle('extension/common/background.ts', 'background.js', 'esm');
// MAIN world와 content script는 module을 못 쓰므로 iife로 묶는다.
await bundle('extension/sites/g2b/page.ts', 'page.js', 'iife');
await bundle('extension/common/remote.ts', 'remote.js', 'iife');
if (hasViewer) {
  await bundle('viewer/main.ts', 'viewer.js', 'iife');
  await copyFile(viewerHtml, path.join(output, 'viewer.html'));
}
const manifest = buildManifest({ key: identity.key, hasViewer });
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`Built extension: dist/extension (viewer: ${hasViewer})`);
