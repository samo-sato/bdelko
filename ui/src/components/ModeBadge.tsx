/**
 * ModeBadge.tsx - small "Active" / "Passive" badge next to Watchdog names.
 */
import type { WatchdogMode } from '../api/types';

export function ModeBadge({ mode }: { mode: WatchdogMode }) {
  const cls =
    mode === 'active'
      ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200'
      : 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200';
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {mode === 'active' ? 'Active' : 'Passive'}
    </span>
  );
}
