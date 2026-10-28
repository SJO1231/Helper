import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dictScreen from '../../shared/schema/dict-screen.schema.json';
import seedSchema from '../../shared/schema/seed.schema.json';
import { validateSeedFile, type SeedTable } from '../../shared/schema/validate';
import { tableRules, valueRules } from './seed-rules';

export interface SeedProblem { file: string; row: number; rule: string }
export interface SeedCheck { ok: boolean; problems: SeedProblem[] }

const TABLES: SeedTable[] = ['dict_key', 'dict_alias', 'dict_label', 'dict_code', 'dict_screen', 'dict_child'];

function allowedFields(table: SeedTable): string[] {
  const def = seedSchema.$defs[table] as { properties?: object };
  if (table === 'dict_screen') return dictScreen.required; // link and options are required but not listed in properties
  return Object.keys(def.properties ?? {});
}

// row is 1-based; 0 means the file as a whole.
function checkRow(table: SeedTable, row: Record<string, unknown>): string[] {
  const allowed = allowedFields(table);
  const hasExtra = Object.keys(row).some((k) => !allowed.includes(k));
  const schemaOk = validateSeedFile(table, { rows: [row] });
  const structure = hasExtra ? ['extra-field'] : schemaOk ? [] : ['schema'];
  return [...structure, ...valueRules(row), ...tableRules(table, row)];
}

function checkFile(dir: string, table: SeedTable): SeedProblem[] {
  const file = `${table}.json`;
  const path = join(dir, file);
  if (!existsSync(path)) return [];
  let data: { rows?: unknown };
  try {
    data = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return [{ file, row: 0, rule: 'json' }];
  }
  if (!Array.isArray(data?.rows)) return [{ file, row: 0, rule: 'schema' }];
  return data.rows.flatMap((row: unknown, i: number) => {
    if (!row || typeof row !== 'object') return [{ file, row: i + 1, rule: 'schema' }];
    return checkRow(table, row as Record<string, unknown>).map((rule) => ({ file, row: i + 1, rule }));
  });
}

export function checkSeed(dir: string): SeedCheck {
  const problems = TABLES.flatMap((table) => checkFile(dir, table));
  return { ok: problems.length === 0, problems };
}

function main(): void {
  const { ok, problems } = checkSeed(process.argv[2] ?? 'shared/seed');
  if (ok) return;
  console.error(`seed 문제 ${problems.length}건`);
  for (const p of problems) console.error(`${p.file}:${p.row} ${p.rule}`);
  process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
