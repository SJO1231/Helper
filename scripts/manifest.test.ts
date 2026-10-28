import { describe, expect, test } from 'vitest';
// @ts-expect-error manifest.mjs is plain JS shared with build.mjs
import { buildManifest } from './manifest.mjs';
import identity from './extension-key.json';

const key = identity.key;
const m = buildManifest({ key, hasViewer: true });

describe('manifest', () => {
  test('asks only for g2b and loopback hosts', () => {
    expect(m.host_permissions).toEqual(['https://www.g2b.go.kr/*', 'http://127.0.0.1/*']);
  });
  test('permissions are nativeMessaging, scripting, storage only', () => {
    expect([...m.permissions].sort()).toEqual(['nativeMessaging', 'scripting', 'storage']);
  });
  test('carries the fixed key', () => expect(m.key).toBe(key));
  test('viewer page appears only when built', () => {
    expect(buildManifest({ key, hasViewer: false }).web_accessible_resources).toBeUndefined();
    expect(m.web_accessible_resources[0].resources).toContain('viewer.html');
  });
  test('page.js runs in MAIN world and remote.js in the isolated world', () => {
    const worlds = Object.fromEntries(m.content_scripts.map((c: any) => [c.js[0], c.world ?? 'ISOLATED']));
    expect(worlds).toEqual({ 'page.js': 'MAIN', 'remote.js': 'ISOLATED' });
  });
});
