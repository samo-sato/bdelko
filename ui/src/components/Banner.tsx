/**
 * Banner.tsx - page-level info/warning/error banners with an icon.
 */
import type { ReactNode } from 'react';
import { AlertTriangleIcon, InfoIcon, XCircleIcon } from './icons';

type Variant = 'info' | 'warning' | 'error';

const STYLES: Record<Variant, { className: string; Icon: typeof InfoIcon }> = {
  info: {
    className:
      'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100',
    Icon: InfoIcon,
  },
  warning: {
    className:
      'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
    Icon: AlertTriangleIcon,
  },
  error: {
    className:
      'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
    Icon: XCircleIcon,
  },
};

export function Banner({ variant, children }: { variant: Variant; children: ReactNode }) {
  const { className, Icon } = STYLES[variant];
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/**
 * Shown when a background refetch failed but stale data is still on screen
 * (React Query keeps the last good data; dataUpdatedAt marks its age).
 */
export function RefetchErrorBanner({ isRefetchError, dataUpdatedAt }: { isRefetchError: boolean; dataUpdatedAt: number }) {
  if (!isRefetchError || dataUpdatedAt === 0) return null;
  return (
    <Banner variant="warning">
      Connection problem. Showing data from {new Date(Math.min(dataUpdatedAt, Date.now())).toLocaleTimeString()}.
    </Banner>
  );
}
