/**
 * time.ts
 *
 * Time helpers. The database stores epoch milliseconds (INTEGER) everywhere;
 * all API responses and logs present timestamps as ISO 8601 in the server's
 * local time with numeric offset, e.g. "2026-10-11T13:54:00.000+02:00".
 * Emails use the friendlier "2026-10-12 20:22:55" (toLocalTimestamp).
 */

/** Format epoch ms as ISO 8601 in server local time with offset. */
export function toLocalIso(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  // getTimezoneOffset() is minutes *west* of UTC, so invert the sign.
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** toLocalIso that preserves null/undefined (for nullable DB columns). */
export function toLocalIsoOrNull(ms: number | null | undefined): string | null {
  return ms === null || ms === undefined ? null : toLocalIso(ms);
}

/**
 * Format epoch ms as "YYYY-MM-DD HH:mm:ss" in server local time (no offset,
 * no milliseconds). Used in notification emails.
 */
export function toLocalTimestamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    ` ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/**
 * Parse a user-supplied time value: ISO 8601 string or epoch milliseconds
 * (number or numeric string). Returns epoch ms, or null when unparseable.
 */
export function parseTimeToMs(input: unknown): number | null {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'number' && Number.isFinite(input)) return Math.trunc(input);
  if (typeof input === 'string') {
    const s = input.trim();
    if (/^-?\d+$/.test(s)) return parseInt(s, 10); // epoch ms
    const t = Date.parse(s); // ISO 8601 and friends
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/**
 * Human readable duration, e.g. "1 day 2 hours", "3 minutes 12 seconds".
 * At most the two largest units are shown. Used in UP emails.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  let rem = Math.floor(ms / 1000);
  const units: Array<[label: string, seconds: number]> = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
    ['second', 1],
  ];
  const parts: string[] = [];
  for (const [label, secs] of units) {
    if (rem >= secs) {
      const n = Math.floor(rem / secs);
      rem -= n * secs;
      parts.push(`${n} ${label}${n === 1 ? '' : 's'}`);
    }
    if (parts.length === 2) break;
  }
  return parts.length > 0 ? parts.join(' ') : '0 seconds';
}
