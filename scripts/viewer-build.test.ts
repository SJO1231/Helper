import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
// @ts-expect-error viewer-build.mjs is plain JS shared with build.mjs and the bench
import { viewerBuildOptions } from './viewer-build.mjs';

const root = path.resolve(__dirname, '..');
const outdir = mkdtempSync(path.join(tmpdir(), 'viewer-build-'));
afterAll(() => rmSync(outdir, { recursive: true, force: true }));

describe('viewer bundle', () => {
  test('exceljs stays out of the start-up file and loads only for Excel export', async () => {
    const result = await build({ ...viewerBuildOptions(root, outdir), write: false, metafile: true });
    const outputs = Object.entries(result.metafile!.outputs);
    const entry = outputs.find(([, o]) => o.entryPoint === 'viewer/main.ts');
    expect(entry).toBeDefined();
    const entryInputs = Object.keys(entry![1].inputs);
    expect(entryInputs.some((name) => name.includes('node_modules/exceljs'))).toBe(false);
    expect(entryInputs.some((name) => name.includes('node_modules/ag-grid-community'))).toBe(true);
    const withExcel = outputs.filter(([, o]) => Object.keys(o.inputs).some((n) => n.includes('node_modules/exceljs')));
    expect(withExcel.length).toBeGreaterThan(0);
    expect(path.basename(entry![0])).toBe('viewer.js');
  }, 60_000);
});
