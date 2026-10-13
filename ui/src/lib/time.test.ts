import { describe, expect, it } from 'vitest';
import { formatRelative, formatTs, parseTs } from './time';

const ISO = '2026-10-12T14:05:49.130+02:00'; // server string with offset
const MS = Date.parse(ISO);

describe('parseTs', () => {
  it('parses ISO strings and epoch numbers', () => {
    expect(parseTs(ISO)).toBe(MS);
    expect(parseTs(MS)).toBe(MS);
  });
  it('returns null for null/undefined/garbage', () => {
    expect(parseTs(null)).toBeNull();
    expect(parseTs(undefined)).toBeNull();
    expect(parseTs('not a date')).toBeNull();
  });
});

describe('formatTs', () => {
  it('server mode renders the wall-clock part verbatim', () => {
    expect(formatTs(ISO, 'server')).toBe('2026-10-12 14:05:49');
  });
  it('browser mode renders a full timestamp', () => {
    // Instant-based; just check shape, not the zone-dependent digits.
    expect(formatTs(ISO, 'browser')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
  it('handles null', () => {
    expect(formatTs(null, 'browser')).toBe('never');
    expect(formatTs(null, 'server')).toBe('never');
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-10-12T14:00:00Z');
  it('past and future', () => {
    expect(formatRelative(now - 3 * 60_000, now)).toBe('3 minutes ago');
    expect(formatRelative(now + 45_000, now)).toBe('in 45 seconds');
    expect(formatRelative(now - 2 * 3_600_000, now)).toBe('2 hours ago');
  });
  it('just now / soon for tiny deltas, never for null', () => {
    expect(formatRelative(now - 3_000, now)).toBe('just now');
    expect(formatRelative(now + 3_000, now)).toBe('soon');
    expect(formatRelative(null, now)).toBe('never');
  });
});
