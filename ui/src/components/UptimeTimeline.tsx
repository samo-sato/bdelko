/**
 * UptimeTimeline.tsx
 *
 * Pure-CSS uptime strip: one bar across the selected window built from log
 * rows - green where ok, red where not ok, hatched grey where no log covers
 * the time. The currently-running period (latest row) is extended to "now".
 * Each segment is focusable and carries a tooltip (period, runs, note).
 */
import type { LogItem } from '../api/types';
import type { TimeZoneMode } from '../settings/SettingsContext';
import { formatTs, parseTs, rawTs, useNow } from '../lib/time';

interface Segment {
  kind: 'ok' | 'down' | 'gap';
  from: number;
  to: number;
  row?: LogItem;
}

const GAP_STYLE = {
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(148,163,184,0.35) 0 4px, transparent 4px 8px)',
};

export function UptimeTimeline({
  rows,
  windowMs,
  timeZone,
}: {
  rows: LogItem[];
  windowMs: number;
  timeZone: TimeZoneMode;
}) {
  const now = useNow();
  const windowStart = now - windowMs;

  // Build segments left to right, clipping to the window and filling gaps.
  const sorted = [...rows].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const maxEnded = sorted.reduce<number>((m, r) => Math.max(m, parseTs(r.ended_at) ?? 0), 0);

  const segments: Segment[] = [];
  let cursor = windowStart;
  for (const row of sorted) {
    const from = Math.max(parseTs(row.started_at) ?? 0, windowStart);
    let to = Math.min(parseTs(row.ended_at) ?? 0, now);
    // The latest period is still running - stretch it to now.
    if ((parseTs(row.ended_at) ?? 0) === maxEnded) to = now;
    if (to <= from) continue;
    if (from > cursor) segments.push({ kind: 'gap', from: cursor, to: from });
    segments.push({ kind: row.status === 1 ? 'ok' : 'down', from, to, row });
    cursor = Math.max(cursor, to);
  }
  if (cursor < now) segments.push({ kind: 'gap', from: cursor, to: now });

  return (
    <div>
      <div
        className="flex h-6 w-full overflow-hidden rounded-md border border-slate-200 dark:border-slate-700"
        role="img"
        aria-label="Uptime timeline: green ok, red not ok, grey no data"
      >
        {segments.map((seg, i) => {
          const pct = ((seg.to - seg.from) / windowMs) * 100;
          const label =
            seg.kind === 'gap'
              ? `No data: ${formatTs(new Date(seg.from).toISOString(), timeZone)} → ${formatTs(new Date(seg.to).toISOString(), timeZone)}`
              : `${seg.kind === 'ok' ? 'Ok' : 'Not ok'}: ${formatTs(seg.row!.started_at, timeZone)} → ${formatTs(seg.row!.ended_at, timeZone)} · ${seg.row!.counter} ${seg.row!.counter === 1 ? 'run' : 'runs'} · ${seg.row!.note}`;
          return (
            <div
              key={i}
              tabIndex={0}
              title={seg.kind === 'gap' ? label : `${label}\n(raw: ${rawTs(seg.row!.started_at)} → ${rawTs(seg.row!.ended_at)})`}
              aria-label={label}
              className={
                seg.kind === 'ok'
                  ? 'bg-emerald-500'
                  : seg.kind === 'down'
                    ? 'bg-red-500'
                    : 'bg-transparent'
              }
              style={{ width: `${pct}%`, minWidth: '2px', ...(seg.kind === 'gap' ? GAP_STYLE : {}) }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" /> Ok
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" aria-hidden="true" /> Not ok
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-300 dark:border-slate-600" style={GAP_STYLE} aria-hidden="true" />
          No data
        </span>
        <span className="ml-auto">
          {formatTs(new Date(windowStart).toISOString(), timeZone)} → now
        </span>
      </div>
    </div>
  );
}
