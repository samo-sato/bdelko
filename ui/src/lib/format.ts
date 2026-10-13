/**
 * format.ts
 *
 * Compact human formatting helpers used across the UI.
 */

/**
 * Duration as the two most significant units:
 * "45s", "12m 5s", "3h 20m", "2d 4h". Zero/negative -> "0s".
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  let rem = Math.floor(ms / 1000);
  const units: Array<[suffix: string, seconds: number]> = [
    ['d', 86_400],
    ['h', 3_600],
    ['m', 60],
    ['s', 1],
  ];
  const parts: string[] = [];
  for (const [suffix, secs] of units) {
    if (rem >= secs) {
      const n = Math.floor(rem / secs);
      rem -= n * secs;
      parts.push(`${n}${suffix}`);
    }
    if (parts.length === 2) break;
  }
  return parts.length > 0 ? parts.join(' ') : '0s';
}

/** Percentage with fixed decimals; null (nothing monitored) -> "n/a". */
export function formatPercent(value: number | null, digits = 1): string {
  return value === null ? 'n/a' : `${value.toFixed(digits)}%`;
}
