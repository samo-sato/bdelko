/**
 * time.ts
 *
 * Time parsing/formatting for the API's timestamps, which arrive as ISO 8601
 * strings in the SERVER's local time with offset. Two display zones:
 *   - browser: convert to the browser's time zone (default)
 *   - server:  render the wall-clock part of the server's ISO string as-is
 * Relative times are always computed from real instants. `useNow()` is a
 * shared ticking clock so relative labels re-render together.
 */
import { useSyncExternalStore } from 'react';

export type TimeZoneMode = 'browser' | 'server';

/** Absolute-time formatter for the browser zone: "2026-10-12 14:05:49". */
const browserFmt = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Parse an API timestamp (ISO 8601 string or epoch-ms number) to epoch ms. */
export function parseTs(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/**
 * Absolute time for display. In server mode the wall-clock part of the
 * original ISO string is shown verbatim (no conversion); epoch numbers fall
 * back to browser rendering because they carry no server wall time.
 */
export function formatTs(value: string | number | null | undefined, zone: TimeZoneMode): string {
  if (value === null || value === undefined) return 'never';
  if (zone === 'server' && typeof value === 'string') {
    return value.slice(0, 19).replace('T', ' ');
  }
  const ms = parseTs(value);
  return ms === null ? 'never' : browserFmt.format(new Date(ms));
}

/** The original server string, for tooltips ("verbatim"). */
export function rawTs(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'never';
  return String(value);
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "3 minutes ago" / "in 5 minutes" / "just now", computed from real instants. */
export function formatRelative(targetMs: number | null, nowMs: number): string {
  if (targetMs === null) return 'never';
  const diffSec = Math.round((targetMs - nowMs) / 1000);
  const abs = Math.abs(diffSec);
  // Round-toward-zero ambiguity ("Updated just now", never "Updated soon").
  if (abs < 10) return targetMs > nowMs ? 'soon' : 'just now';
  if (abs < 60) return rtf.format(diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffHours = Math.round(diffMin / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  return rtf.format(Math.round(diffHours / 24), 'day');
}

// ---------------------------------------------------------------------------
// useNow: one shared interval drives every relative timestamp on the page.
// ---------------------------------------------------------------------------

const TICK_MS = 10_000;
let currentNow = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (timer === null) {
    timer = setInterval(() => {
      currentNow = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Current epoch ms, re-rendering every 10 s (shared interval). */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => currentNow);
}
