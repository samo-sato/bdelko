/**
 * LogsTable.tsx
 *
 * Shared monitoring-log table (Logs page and watchdog detail). One row is one
 * merged period of identical state. Responsive: a real table from `md` up,
 * stacked cards below. Not-ok rows get a subtle tint. Full note text and the
 * verbatim server timestamp live in tooltips.
 */
import { Link } from 'react-router';
import type { LogItem } from '../api/types';
import type { TimeZoneMode } from '../settings/SettingsContext';
import { formatDuration } from '../lib/format';
import { parseTs, rawTs } from '../lib/time';
import { AlertTriangleIcon } from './icons';
import { StatusPill } from './StatusPill';

/**
 * A gap wider than this between two consecutive rows means the scanner was
 * not running (the backend itself breaks rows on interval + gap margin).
 * 60 s scan interval (hardcoded) + 15 s gap margin (backend default).
 */
const GAP_THRESHOLD_MS = 75_000;
const GAP_NOTE = 'Unknown status. Scanner possibly down.';

/** A synthesized "scanner was down" row, inserted between two real rows. */
interface GapRow {
  kind: 'gap';
  id: string;
  watchdog_id: string;
  watchdog_name: string;
  from: string; // ISO string of the older row's end
  to: string; // ISO string of the newer row's start
  gapMs: number;
}

type TableRow = LogItem | GapRow;

function isGap(row: TableRow): row is GapRow {
  return (row as GapRow).kind === 'gap';
}

/**
 * Insert N/A rows wherever the gap between two consecutive real rows exceeds
 * the threshold. Order-agnostic (works for newest-first and oldest-first).
 * Note: only gaps visible on the current page get a row - a gap spanning a
 * page boundary cannot be detected client-side.
 */
export function withGapRows(items: LogItem[]): TableRow[] {
  const out: TableRow[] = [];
  for (let i = 0; i < items.length; i++) {
    out.push(items[i]);
    const other = items[i + 1];
    if (!other) break;
    const aStart = parseTs(items[i].started_at) ?? 0;
    const bStart = parseTs(other.started_at) ?? 0;
    const [newer, older] = aStart >= bStart ? [items[i], other] : [other, items[i]];
    const gapMs = (parseTs(newer.started_at) ?? 0) - (parseTs(older.ended_at) ?? 0);
    if (gapMs > GAP_THRESHOLD_MS) {
      out.push({
        kind: 'gap',
        id: `gap-${older.id}-${newer.id}`,
        watchdog_id: newer.watchdog_id,
        watchdog_name: newer.watchdog_name,
        from: older.ended_at,
        to: newer.started_at,
        gapMs,
      });
    }
  }
  return out;
}

/** Orange "N/A" pill for scanner-downtime rows (icon + text, not colour alone). */
function NaPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/50 dark:text-orange-200">
      <AlertTriangleIcon className="h-3.5 w-3.5" />
      N/A
    </span>
  );
}

// Split formatters: ISO-like and zone-independent in shape.
const dateFmt = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

function splitTs(value: string, zone: TimeZoneMode): { date: string; time: string } {
  if (zone === 'server') {
    // Wall-clock part of the server's ISO string, no conversion.
    return { date: value.slice(0, 10), time: value.slice(11, 19) };
  }
  const ms = parseTs(value);
  if (ms === null) return { date: '-', time: '-' };
  const d = new Date(ms);
  return { date: dateFmt.format(d), time: timeFmt.format(d) };
}

/** "2026-10-12 14:03:21 → 14:05:49" (date once when both ends share the day). */
function formatPeriodParts(fromIso: string, toIso: string, zone: TimeZoneMode): string {
  const start = splitTs(fromIso, zone);
  const end = splitTs(toIso, zone);
  if (start.date === end.date) return `${start.date} ${start.time} → ${end.time}`;
  return `${start.date} ${start.time} → ${end.date} ${end.time}`;
}

function formatPeriod(item: LogItem, zone: TimeZoneMode): string {
  return formatPeriodParts(item.started_at, item.ended_at, zone);
}

export function LogsTable({
  items,
  showWatchdog = true,
  timeZone,
}: {
  items: LogItem[];
  showWatchdog?: boolean;
  timeZone: TimeZoneMode;
}) {
  // Real rows interleaved with synthesized N/A rows for scanner downtime.
  const rows = withGapRows(items);

  const gapTint = 'bg-orange-50/60 dark:bg-orange-950/20';

  return (
    <>
      {/* Table layout (md and up) */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th scope="col" className="px-3 py-2">Status</th>
              {showWatchdog && <th scope="col" className="px-3 py-2">Watchdog</th>}
              <th scope="col" className="px-3 py-2">Period</th>
              <th scope="col" className="px-3 py-2">Runs</th>
              <th scope="col" className="px-3 py-2">Duration</th>
              <th scope="col" className="px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) =>
              isGap(row) ? (
                <tr key={row.id} className={gapTint}>
                  <td className="px-3 py-2">
                    <NaPill />
                  </td>
                  {showWatchdog && (
                    <td className="px-3 py-2">
                      <Link
                        to={`/watchdogs/${row.watchdog_id}`}
                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {row.watchdog_name}
                      </Link>
                    </td>
                  )}
                  <td
                    className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300"
                    title={`${rawTs(row.from)} → ${rawTs(row.to)}`}
                  >
                    {formatPeriodParts(row.from, row.to, timeZone)}
                  </td>
                  <td className="px-3 py-2 text-slate-400">—</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {formatDuration(row.gapMs)}
                  </td>
                  <td className="max-w-56 truncate px-3 py-2 text-slate-600 lg:max-w-96 dark:text-slate-300" title={GAP_NOTE}>
                    {GAP_NOTE}
                  </td>
                </tr>
              ) : (
                <tr
                  key={row.id}
                  className={row.status === 0 ? 'bg-red-50/60 dark:bg-red-950/20' : undefined}
                >
                  <td className="px-3 py-2">
                    <StatusPill status={row.status === 1 ? 'up' : 'down'} />
                  </td>
                  {showWatchdog && (
                    <td className="px-3 py-2">
                      <Link
                        to={`/watchdogs/${row.watchdog_id}`}
                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {row.watchdog_name}
                      </Link>
                    </td>
                  )}
                  <td
                    className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300"
                    title={`${rawTs(row.started_at)} → ${rawTs(row.ended_at)}`}
                  >
                    {formatPeriod(row, timeZone)}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.counter}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {row.counter > 1 ? formatDuration(row.duration_ms) : '1 run'}
                  </td>
                  <td
                    className="max-w-56 truncate px-3 py-2 text-slate-600 lg:max-w-96 dark:text-slate-300"
                    title={row.note}
                  >
                    {row.note}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {/* Card layout (below md) */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) =>
          isGap(row) ? (
            <li
              key={row.id}
              className={`rounded-lg border border-slate-200 p-3 dark:border-slate-800 ${gapTint}`}
            >
              <div className="flex items-center justify-between gap-2">
                <NaPill />
                {showWatchdog && (
                  <Link
                    to={`/watchdogs/${row.watchdog_id}`}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {row.watchdog_name}
                  </Link>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatPeriodParts(row.from, row.to, timeZone)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatDuration(row.gapMs)}
              </p>
              <p className="mt-1 text-sm break-words text-slate-600 dark:text-slate-300">{GAP_NOTE}</p>
            </li>
          ) : (
            <li
              key={row.id}
              className={`rounded-lg border border-slate-200 p-3 dark:border-slate-800 ${
                row.status === 0 ? 'bg-red-50/60 dark:bg-red-950/20' : 'bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <StatusPill status={row.status === 1 ? 'up' : 'down'} />
                {showWatchdog && (
                  <Link
                    to={`/watchdogs/${row.watchdog_id}`}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {row.watchdog_name}
                  </Link>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatPeriod(row, timeZone)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {row.counter} {row.counter === 1 ? 'run' : 'runs'}
                {row.counter > 1 ? ` · ${formatDuration(row.duration_ms)}` : ''}
              </p>
              <p className="mt-1 text-sm break-words text-slate-600 dark:text-slate-300">{row.note}</p>
            </li>
          ),
        )}
      </ul>
    </>
  );
}
