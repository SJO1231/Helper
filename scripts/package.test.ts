import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// icons.mjs가 node:zlib의 crc32를 쓴다(20.15에서 추가).
test('node engine is pinned to the version that has zlib.crc32', () => {
  expect(pkg.engines).toEqual({ node: '>=20.15' });
});
