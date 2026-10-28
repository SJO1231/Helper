import { describe, expect, test } from 'vitest';
// @ts-expect-error bench 도구는 .mjs라 타입 선언이 없다
import { frameShare, percentile } from './stats.mjs';

describe('frameShare', () => {
  test('counts gaps within the limit', () => {
    const times = [0, 16, 32, 80, 96]; // 간격 16, 16, 48, 16
    expect(frameShare(times, 16.7).share).toBe(0.75);
    expect(frameShare(times, 16.7).frames).toBe(4);
  });

  test('fewer than two frames is never a pass', () => {
    expect(frameShare([5], 16.7).share).toBe(0);
    expect(frameShare([], 16.7).frames).toBe(0);
  });

  test('p90 picks the slow end', () => {
    const times = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 190]; // 간격 열 개 중 하나가 100
    expect(frameShare(times, 16.7).p90Ms).toBe(100);
  });
});

describe('percentile', () => {
  test('median of an odd list', () => expect(percentile([3, 1, 2], 0.5)).toBe(2));
});
