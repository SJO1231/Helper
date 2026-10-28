export const median = (xs) => percentile(xs, 0.5);

export function percentile(xs, p) {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

export function frameStats(timestamps) {
  const gaps = timestamps.slice(1).map((t, i) => t - timestamps[i]);
  const share = (limit) => gaps.filter((g) => g <= limit).length / gaps.length;
  return { frames: gaps.length, p90Ms: percentile(gaps, 0.9), share16: share(16), share17: share(17) };
}
