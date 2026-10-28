import { ICON_SIZES } from './icons.mjs';

const G2B = 'https://www.g2b.go.kr/*';
const LOOPBACK = 'http://127.0.0.1/*';

const ICON_FILES = Object.fromEntries(ICON_SIZES.map((size) => [size, `icons/icon-${size}.png`]));

export function buildManifest({ key, hasViewer }) {
  const manifest = {
    manifest_version: 3,
    name: 'Helper',
    version: '0.1.0',
    minimum_chrome_version: '120',
    // 고정 키가 확장 ID를 늘 같게 해서 Native host 허용 목록이 어긋나지 않는다.
    key,
    description: '업무 화면을 읽어 로컬에 모으고 엑셀처럼 본다',
    permissions: ['nativeMessaging', 'scripting', 'storage'],
    icons: ICON_FILES,
    action: { default_icon: ICON_FILES },
    host_permissions: [G2B, LOOPBACK],
    background: { service_worker: 'background.js', type: 'module' },
    content_scripts: [
      { matches: [G2B], js: ['page.js'], world: 'MAIN', run_at: 'document_start' },
      { matches: [G2B], js: ['remote.js'], run_at: 'document_idle' },
    ],
    content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
  };
  if (hasViewer) {
    manifest.web_accessible_resources = [{ resources: ['viewer.html', 'viewer.js'], matches: [G2B] }];
  }
  return manifest;
}
