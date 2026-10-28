import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const html = readFileSync(new URL('./viewer.html', import.meta.url), 'utf8');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
// 선택자가 줄 맨 앞에서 시작하는 규칙의 본문을 돌려준다.
const rule = (selector: string) => {
  const start = css.split(/\r?\n/).findIndex((line) => line.trim().startsWith(`${selector} {`));
  if (start < 0) return '';
  const rest = css.split(/\r?\n/).slice(start).join('\n');
  return rest.slice(rest.indexOf('{'), rest.indexOf('}'));
};

describe('viewer window layout', () => {
  test('the page itself never scrolls', () => {
    expect(rule('html, body')).toMatch(/overflow:\s*hidden/);
  });
  test('toolbar stays on top and status stays at the bottom', () => {
    expect(rule('#toolbar')).toMatch(/flex:\s*none/);
    expect(rule('#status')).toMatch(/position:\s*fixed/);
    expect(rule('#status')).toMatch(/bottom:\s*0/);
  });
  test('the grid takes the remaining height and scrolls inside', () => {
    expect(rule('#grid')).toMatch(/flex:\s*1/);
    expect(rule('#grid')).toMatch(/min-height:\s*0/);
  });
  test('the column list floats over the grid', () => {
    expect(rule('#column-picker')).toMatch(/position:\s*relative/);
    expect(rule('#column-list')).toMatch(/position:\s*absolute/);
  });
});
