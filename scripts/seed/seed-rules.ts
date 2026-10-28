// Value rules that catch real data leaking into seed rows. Each returns rule names only, never the matched text.
const NOTICE_PATTERNS = [/[A-Za-z]{2}\d{10,}/, /\d{6,}-\d{2,}/];
const COMMA_AMOUNT = /\d{1,3}(,\d{3})+/;
const BIZ_NUMBER = /\d{3}-\d{2}-\d{5}/;
const PHONE = /0\d{1,2}-\d{3,4}-\d{4}/;
const COMPANY_WORDS = ['㈜', '(주)', '주식회사', '시청', '군청', '구청', '공사', '공단'];
const COMPANY_CHECKED_FIELDS = ['label', 'meaning'];
const PUBLIC_TEST_MENUS = ['13713', '01175', '01033', '01141', '01196'];
const FIELD_ID = /^[a-z][A-Za-z0-9]*$/;

type Row = Record<string, unknown>;

function stringLeaves(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringLeaves);
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringLeaves);
  return [];
}

export function valueRules(row: Row): string[] {
  const texts = stringLeaves(row);
  const found: string[] = [];
  if (texts.some((t) => NOTICE_PATTERNS.some((p) => p.test(t)))) found.push('notice-number');
  if (texts.some((t) => COMMA_AMOUNT.test(t))) found.push('comma-amount');
  if (texts.some((t) => BIZ_NUMBER.test(t))) found.push('biz-number');
  if (texts.some((t) => PHONE.test(t))) found.push('phone');
  const named = COMPANY_CHECKED_FIELDS.flatMap((f) => stringLeaves(row[f]));
  if (named.some((t) => COMPANY_WORDS.some((w) => t.includes(w)))) found.push('company-word');
  return found;
}

export function tableRules(table: string, row: Row): string[] {
  const found: string[] = [];
  if (table === 'dict_screen' && row.stage && PUBLIC_TEST_MENUS.includes(String(row.menu_no))) {
    found.push('public-stage');
  }
  if (table === 'dict_key' && typeof row.std_key === 'string' && !FIELD_ID.test(row.std_key)) {
    const source = (row.display as { source?: unknown } | undefined)?.source;
    if (!Array.isArray(source) || !source.includes('ours')) found.push('snake-key');
  }
  return found;
}
