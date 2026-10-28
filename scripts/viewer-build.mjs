// 뷰어 번들 설정 한 곳. 제품 빌드(build.mjs)와 bench가 같은 번들을 잰다.
// esm + splitting이라 Excel 내보내기용 exceljs는 따로 떨어진 조각이 되어 처음 열 때 읽지 않는다
// (exceljs를 처음부터 읽으면 첫 열기가 1초를 넘었다. DECISIONS 2026-10-29).
export function viewerBuildOptions(root, outdir) {
  return {
    absWorkingDir: root,
    entryPoints: { viewer: 'viewer/main.ts' },
    outdir,
    bundle: true,
    splitting: true,
    format: 'esm',
    target: 'chrome120',
    platform: 'browser',
    minify: true,
    legalComments: 'none',
    chunkNames: 'chunk-[hash]',
    define: { 'process.env.NODE_ENV': '"production"' },
  };
}
