/**
 * StatusPill.tsx
 *
 * The four display states of a Watchdog, always icon + text (never colour
 * alone): Up / Down / Pending / Disabled.
 */
import { CheckCircleIcon, ClockIcon, PauseIcon, XCircleIcon } from './icons';

export type DisplayStatus = 'up' | 'down' | 'pending' | 'disabled';

const STYLES: Record<DisplayStatus, { label: string; className: string; Icon: typeof CheckCircleIcon }> = {
  up: {
    label: 'Up',
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    Icon: CheckCircleIcon,
  },
  down: {
    label: 'Down',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
    Icon: XCircleIcon,
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    Icon: ClockIcon,
  },
  disabled: {
    label: 'Disabled',
    className: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    Icon: PauseIcon,
  },
};

export function StatusPill({ status }: { status: DisplayStatus }) {
  const { label, className, Icon } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
