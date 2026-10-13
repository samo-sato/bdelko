/**
 * HealthChip.tsx
 *
 * Small header chip fed by /api/health (polled every 30 s): a scanner dot
 * (green = a run happened within the last 2 minutes, red = stalled) plus a
 * hover/focus tooltip with last run, run duration, run count and server
 * uptime. Icon + tooltip text carry the information, not colour alone.
 */
import { useHealth } from '../api/hooks';
import { formatDuration } from '../lib/format';
import { formatRelative, parseTs, useNow } from '../lib/time';

export function HealthChip() {
  const { data } = useHealth();
  const now = useNow();

  const lastRunMs = parseTs(data?.scanner.lastRunAt ?? null);
  // Same 2-minute freshness rule the dashboard's "scanner stalled" banner uses.
  const fresh = lastRunMs !== null && now - lastRunMs < 120_000;

  const tooltip = data
    ? [
        `Last run: ${lastRunMs !== null ? formatRelative(lastRunMs, now) : 'never'}`,
        `Duration: ${data.scanner.lastRunDurationMs ?? 0} ms`,
        `Run count: ${data.scanner.runCount}`,
        `Server uptime: ${formatDuration(data.uptimeSeconds * 1000)}`,
      ].join('\n')
    : 'Server health unknown';

  return (
    <span
      className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
      title={tooltip}
      tabIndex={0}
      aria-label={tooltip.replace(/\n/g, ', ')}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${fresh ? 'bg-emerald-500' : 'bg-red-500'}`}
        aria-hidden="true"
      />
      scanner
    </span>
  );
}
