/**
 * Footer.tsx
 *
 * Shown under the main content of every page: a live "Server time" clock.
 * The server instant is anchored on each /api/health response (polled every
 * 30 s) and ticked locally once per second in between, so no extra requests
 * are needed. Rendered as the server's WALL time ("YYYY-MM-DD HH:mm:ss")
 * regardless of the Browser/Server display setting: the UTC offset is parsed
 * out of the health payload's ISO string and applied via UTC getters.
 */
import { useEffect, useState } from 'react';
import { useHealth } from '../api/hooks';
import { parseTs } from '../lib/time';

/** "+02:00" -> 120, "-05:30" -> -330; falls back to the browser zone. */
function parseOffsetMinutes(iso: string): number {
  const m = /([+-])(\d{2}):(\d{2})$/.exec(iso);
  if (!m) return -new Date().getTimezoneOffset();
  const v = parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
  return m[1] === '+' ? v : -v;
}

function formatServerWall(instantMs: number, offsetMin: number): string {
  // Shift the instant into the server's zone, then read UTC components.
  const d = new Date(instantMs + offsetMin * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

export function Footer() {
  const { data, dataUpdatedAt } = useHealth();
  // Local 1 s ticker; the anchor below compensates for browser/server skew.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  let text = '—';
  const anchorMs = parseTs(data?.time ?? null);
  if (data && anchorMs !== null) {
    // Estimated current server instant: what the server reported plus the
    // time elapsed since that response arrived (dataUpdatedAt is local).
    const serverNow = anchorMs + (now - dataUpdatedAt);
    text = formatServerWall(serverNow, parseOffsetMinutes(data.time));
  }

  return (
    <footer className="border-t border-slate-200 py-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
      Server time: <span className="font-mono tabular-nums">{text}</span>
    </footer>
  );
}
