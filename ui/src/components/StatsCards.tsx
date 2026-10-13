/**
 * StatsCards.tsx - uptime statistics for the 24h / 7d / 30d windows.
 * uptimePercent comes from the server already rounded; null means "nothing
 * monitored in this window" and renders as n/a. Coverage tells how much of
 * the window any log data covers at all.
 */
import type { Stats } from '../api/types';
import { formatDuration, formatPercent } from '../lib/format';

const WINDOW_LABELS: Array<{ key: keyof Stats['windows']; label: string }> = [
  { key: '24h', label: 'Last 24 hours' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
];

export function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {WINDOW_LABELS.map(({ key, label }) => {
        const w = stats.windows[key];
        const coverage = w.windowMs > 0 ? (w.monitoredMs / w.windowMs) * 100 : null;
        return (
          <div
            key={key}
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold">{formatPercent(w.uptimePercent)}</p>
            <dl className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex justify-between">
                <dt>Ok</dt>
                <dd>{formatDuration(w.okMs)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Not ok</dt>
                <dd>{formatDuration(w.notOkMs)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Incidents</dt>
                <dd>{w.incidents}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Coverage</dt>
                <dd>{formatPercent(coverage, 0)} monitored</dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}
