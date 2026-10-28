import { describe, expect, test } from 'vitest';
// @ts-expect-error collect-judge.mjs is plain JS used by the e2e
import { judgeCollect } from './collect-judge.mjs';

const totals = { receipt: 1, bid: 1, contract: 1, capture: 3 };
const tenOk = { new: 1, same: 9, changed: 0, rejected: 0, other: 0 };
const allOk = { '01033': tenOk, '01196': tenOk, '01141': tenOk };

describe('judgeCollect', () => {
  test('one new and nine same on each screen with 1/1/1/3 rows is true', () => {
    expect(judgeCollect(totals, allOk)).toBe(true);
  });
  test('rows alone are not enough: rejected presses make it false', () => {
    const rejected = { new: 1, same: 0, changed: 0, rejected: 9, other: 0 };
    expect(judgeCollect(totals, { ...allOk, '01196': rejected })).toBe(false);
  });
  test('a screen that never collected is false', () => {
    expect(judgeCollect(totals, { ...allOk, '01141': { 수집버튼: '꺼짐' } })).toBe(false);
  });
  test('wrong row counts are false', () => {
    expect(judgeCollect({ ...totals, capture: 4 }, allOk)).toBe(false);
  });
});
