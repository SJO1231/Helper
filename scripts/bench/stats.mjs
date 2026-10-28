export function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

// SPEC 8절: 프레임 간격의 90% 이상이 limitMs 안이어야 한다.
export function frameShare(timestamps, limitMs) {
  const gaps = timestamps.slice(1).map((time, i) => time - timestamps[i]);
  if (gaps.length === 0) return { frames: 0, share: 0, p90Ms: Infinity };
  return {
    frames: gaps.length,
    share: gaps.filter((gap) => gap <= limitMs).length / gaps.length,
    p90Ms: percentile(gaps, 0.9),
  };
}
