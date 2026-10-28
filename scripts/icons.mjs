import { crc32, deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ICON_SIZES = [16, 32, 48, 128];
const BACKGROUND = [0x1f, 0x5f, 0xbf];
const SAMPLES = 4; // 가장자리를 매끈하게 하려고 한 픽셀을 4x4로 나눠 센다.

// 크기에 대한 비율로 그린다: 둥근 네모 + 흰 가로 막대 3개(표 모양).
function coverage(x, y, size) {
  const radius = size * 0.22;
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) return null;
  const inBar = [0.26, 0.46, 0.66].some((top) => y >= size * top && y < size * (top + 0.12));
  return inBar && x >= size * 0.2 && x < size * 0.8 ? 'bar' : 'background';
}

function pixelAt(px, py, size) {
  let alpha = 0;
  let white = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      const hit = coverage(px + (sx + 0.5) / SAMPLES, py + (sy + 0.5) / SAMPLES, size);
      if (hit) alpha++;
      if (hit === 'bar') white++;
    }
  }
  const total = SAMPLES * SAMPLES;
  if (alpha === 0) return [0, 0, 0, 0];
  const mix = white / alpha;
  return [...BACKGROUND.map((c) => Math.round(c + (255 - c) * mix)), Math.round((255 * alpha) / total)];
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

export function makeIconPng(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8비트 RGBA
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    for (let x = 0; x < size; x++) raw.set(pixelAt(x, y, size), rowStart + 1 + x * 4);
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))];
  return Buffer.concat([signature, ...parts]);
}

export async function writeIcons(directory) {
  await mkdir(directory, { recursive: true });
  for (const size of ICON_SIZES) await writeFile(path.join(directory, `icon-${size}.png`), makeIconPng(size));
}
