import { inflateSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
// @ts-expect-error icons.mjs is plain JS shared with build.mjs
import { ICON_SIZES, makeIconPng } from './icons.mjs';
// @ts-expect-error manifest.mjs is plain JS shared with build.mjs
import { buildManifest } from './manifest.mjs';

describe('extension icons', () => {
  test.each(ICON_SIZES as number[])('%ipx PNG has the signature and matching IHDR size', (size) => {
    const png: Buffer = makeIconPng(size);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.subarray(12, 16).toString('latin1')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  });
  test('the picture has the blue background and white bars', () => {
    const png: Buffer = makeIconPng(32);
    const idat = png.indexOf('IDAT', 33, 'latin1');
    const raw = inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)));
    const pixel = (x: number, y: number) => [...raw.subarray(y * (1 + 32 * 4) + 1 + x * 4).subarray(0, 4)];
    expect(pixel(0, 0)[3]).toBe(0); // 둥근 모서리 바깥은 투명
    expect(pixel(16, 2)).toEqual([0x1f, 0x5f, 0xbf, 255]);
    expect(raw.length).toBe(32 * (1 + 32 * 4));
    const whites = Array.from({ length: 32 }, (_, y) => pixel(16, y)).filter((p) => p[0] === 255 && p[3] === 255);
    expect(whites.length).toBeGreaterThan(0);
  });
  test('manifest lists every icon size', () => {
    const m = buildManifest({ key: 'k', hasViewer: false });
    const expected = Object.fromEntries((ICON_SIZES as number[]).map((s) => [s, `icons/icon-${s}.png`]));
    expect(m.icons).toEqual(expected);
    expect(m.action.default_icon).toEqual(expected);
  });
});
