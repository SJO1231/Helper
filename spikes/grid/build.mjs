import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const LIBS = ['ag', 'revo', 'tabulator'];
const HTML = (lib, css) => `<!doctype html><meta charset="utf-8"><title>${lib}</title>
<style>html,body{margin:0}#grid{width:1200px;height:700px}</style>
${css ? `<link rel="stylesheet" href="${lib}.css">` : ''}
<div id="grid"></div><script type="module" src="${lib}.js"></script>`;

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
const sizes = {};

for (const lib of LIBS) {
  await build({
    entryPoints: { [lib]: `${lib}.js` },
    bundle: true, minify: true, format: 'esm', outdir: 'dist', legalComments: 'none',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const files = readdirSync('dist').filter((f) => f.startsWith(`${lib}.`) && !f.endsWith('.html'));
  const bytes = (f) => readFileSync(`dist/${f}`);
  sizes[lib] = {
    files: files.length,
    rawKB: files.reduce((n, f) => n + bytes(f).length, 0) / 1024,
    gzipKB: files.reduce((n, f) => n + gzipSync(bytes(f)).length, 0) / 1024,
  };
  writeFileSync(`dist/${lib}.html`, HTML(lib, files.some((f) => f.endsWith('.css'))));
}
writeFileSync('dist/base.html', '<!doctype html><meta charset="utf-8"><title>base</title><div id="grid"></div>');
writeFileSync('dist/sizes.json', JSON.stringify(sizes, null, 1));
console.log(JSON.stringify(sizes, null, 1));
