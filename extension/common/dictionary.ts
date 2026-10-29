import type { DictAlias, DictKey, DictLabel, KeyType } from '../../shared/types';

// SPEC 6절 해석 순서: K → dict_alias(그 화면 > 전체) → K 또는 마지막 '.' 뒤 이름
// → 라벨(user>screen>site>system>화면 L) → type.

const DEFAULT_SITE = 'g2b';

export function resolveStdKey(
  k: string,
  screenCode: string,
  aliases: DictAlias[],
  stdKeys: Set<string>,
): string | null {
  const matches = aliases.filter((a) => a.source_key === k);
  const fromScreen = matches.find((a) => a.screen_code === screenCode);
  const fromAnyScreen = matches.find((a) => !a.screen_code);
  const alias = fromScreen ?? fromAnyScreen;
  if (alias) return alias.std_key;
  if (stdKeys.has(k)) return k;
  const tail = k.slice(k.lastIndexOf('.') + 1);
  return stdKeys.has(tail) ? tail : null;
}

export function resolveLabel(
  key: string,
  screenCode: string,
  screenL: string,
  labels: DictLabel[],
  site: string = DEFAULT_SITE,
): string {
  const forKey = labels.filter((l) => l.key === key && l.label !== '');
  const tiers = [
    forKey.find((l) => l.scope === 'user'),
    forKey.find((l) => l.scope === 'screen' && l.scope_id === screenCode),
    forKey.find((l) => l.scope === 'site' && l.scope_id === site),
    forKey.find((l) => l.scope === 'system'),
  ];
  return tiers.find((l) => l !== undefined)?.label ?? screenL;
}

export function listUnknownKeys(
  ks: string[],
  screenCode: string,
  aliases: DictAlias[],
  stdKeys: Set<string>,
): string[] {
  const unknown = ks.filter((k) => resolveStdKey(k, screenCode, aliases, stdKeys) === null);
  return [...new Set(unknown)];
}

export function resolveType(stdKey: string | null, dictKeys: DictKey[]): KeyType {
  if (stdKey === null) return 'text';
  return dictKeys.find((d) => d.std_key === stdKey)?.type ?? 'text';
}

export interface DictionaryView {
  aliases: DictAlias[];
  labels: DictLabel[];
  stdKeys: Set<string>;
  dictKeys: DictKey[];
}

export function makeDictionaryView(aliases: DictAlias[], dictKeys: DictKey[], labels: DictLabel[]): DictionaryView {
  return { aliases, labels, dictKeys, stdKeys: new Set(dictKeys.map((d) => d.std_key)) };
}

export interface ResolvedColumn { k: string; stdKey: string | null; label: string; type: KeyType }

export function resolveColumn(k: string, screenCode: string, screenL: string, view: DictionaryView): ResolvedColumn {
  const stdKey = resolveStdKey(k, screenCode, view.aliases, view.stdKeys);
  const label = resolveLabel(stdKey ?? k, screenCode, screenL, view.labels);
  return { k, stdKey, label, type: resolveType(stdKey, view.dictKeys) };
}
