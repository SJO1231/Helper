import { readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { checkSeed } from './check-seed';

const BAD = 'shared/seed/fixtures/bad';
const badNames = readdirSync(BAD);
const rulesFor = (name: string) => checkSeed(`${BAD}/${name}`).problems.map((p) => p.rule);

test('ok fixtures pass', () => expect(checkSeed('shared/seed/fixtures/ok')).toEqual({ ok: true, problems: [] }));

test.each(['notice-number', 'comma-amount', 'biz-number', 'phone', 'company-word', 'json', 'extra-field', 'public-stage', 'snake-key'])(
  'bad fixture %s is caught by its rule', (name) => expect(rulesFor(name)).toContain(name));

test('every bad fixture fails', () => {
  for (const name of badNames) expect(checkSeed(`${BAD}/${name}`).ok, name).toBe(false);
});

test('problems never carry the offending value', () => {
  const all = badNames.flatMap((name) => checkSeed(`${BAD}/${name}`).problems);
  expect(all.length).toBeGreaterThan(0);
  expect(JSON.stringify(all)).not.toMatch(/V-SECRET/);
});

test('a directory without seed files passes', () => {
  expect(checkSeed('shared/seed/fixtures/does-not-exist').ok).toBe(true);
});
