import { describe, expect, it } from 'vitest';
import { formatDuration, formatPercent } from './format';

describe('formatDuration', () => {
  it('shows the two most significant units', () => {
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(12 * 60_000 + 5_000)).toBe('12m 5s');
    expect(formatDuration(3 * 3_600_000 + 20 * 60_000)).toBe('3h 20m');
    expect(formatDuration(2 * 86_400_000 + 4 * 3_600_000)).toBe('2d 4h');
  });
  it('handles edge cases', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(-5)).toBe('0s');
    expect(formatDuration(59_999)).toBe('59s');
    expect(formatDuration(60_000)).toBe('1m'); // trailing zero units are omitted
  });
});

describe('formatPercent', () => {
  it('formats with one decimal and handles null', () => {
    expect(formatPercent(99.956)).toBe('100.0%');
    expect(formatPercent(85.25)).toBe('85.3%');
    expect(formatPercent(null)).toBe('n/a');
  });
});
