/**
 * NotificationsPage.tsx
 *
 * History of attempted DOWN/UP emails (/api/notifications), filterable by
 * watchdog, type, result and date range. Filters live in the hash query
 * string like on the Logs page. The empty state points out when the server
 * has mail disabled.
 */
import { useSearchParams } from 'react-router';
import { useHealth, useNotifications, useWatchdogs } from '../api/hooks';
import type { ListParams } from '../api/types';
import { RefetchErrorBanner } from '../components/Banner';
import { DateRangeInputs } from '../components/DateRangeInputs';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { NotificationsTable } from '../components/NotificationsTable';
import { Pagination } from '../components/Pagination';
import { Spinner } from '../components/Spinner';
import { useSettings } from '../settings/SettingsContext';

const selectCls =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800';

const PAGE_SIZES = [25, 50, 100, 250, 500];

export function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useSettings();
  const watchdogs = useWatchdogs();
  const health = useHealth();

  const params: ListParams = {
    watchdog: searchParams.get('watchdog') ?? undefined,
    type: (searchParams.get('type') as 'down' | 'up' | null) ?? undefined,
    success: (searchParams.get('success') as '0' | '1' | null) ?? undefined,
    from: searchParams.get('from') ? Number(searchParams.get('from')) : undefined,
    to: searchParams.get('to') ? Number(searchParams.get('to')) : undefined,
    page: Math.max(1, Number(searchParams.get('page') ?? '1') || 1),
    limit: Number(searchParams.get('limit') ?? '50') || 50,
    order: (searchParams.get('order') as 'asc' | 'desc' | null) ?? 'desc',
  };

  const notifications = useNotifications(params);

  const setParams = (patch: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (resetPage && !('page' in patch)) next.delete('page');
    setSearchParams(next, { replace: false });
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Notifications</h1>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-500 dark:text-slate-400">
          Watchdog{' '}
          <select
            value={params.watchdog ?? ''}
            onChange={(e) => setParams({ watchdog: e.target.value || undefined })}
            className={selectCls}
          >
            <option value="">All</option>
            {(watchdogs.data ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-500 dark:text-slate-400">
          Type{' '}
          <select
            value={params.type ?? ''}
            onChange={(e) => setParams({ type: e.target.value || undefined })}
            className={selectCls}
          >
            <option value="">All</option>
            <option value="down">Down</option>
            <option value="up">Up</option>
          </select>
        </label>
        <label className="text-sm text-slate-500 dark:text-slate-400">
          Result{' '}
          <select
            value={params.success ?? ''}
            onChange={(e) => setParams({ success: e.target.value || undefined })}
            className={selectCls}
          >
            <option value="">All</option>
            <option value="1">Sent</option>
            <option value="0">Failed</option>
          </select>
        </label>
        <DateRangeInputs
          from={params.from}
          to={params.to}
          onChange={(patch) => {
            const out: Record<string, string | undefined> = {};
            if ('from' in patch) out.from = patch.from !== undefined ? String(patch.from) : undefined;
            if ('to' in patch) out.to = patch.to !== undefined ? String(patch.to) : undefined;
            setParams(out);
          }}
        />
        <label className="text-sm text-slate-500 dark:text-slate-400">
          Page size{' '}
          <select
            value={String(params.limit)}
            onChange={(e) => setParams({ limit: e.target.value })}
            className={selectCls}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-500 dark:text-slate-400">
          Order{' '}
          <select
            value={params.order}
            onChange={(e) => setParams({ order: e.target.value })}
            className={selectCls}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
      </div>

      <RefetchErrorBanner
        isRefetchError={notifications.isRefetchError}
        dataUpdatedAt={notifications.dataUpdatedAt}
      />

      {notifications.isPending ? (
        <Spinner label="Loading notifications" />
      ) : notifications.isError && !notifications.data ? (
        <ErrorState
          message={notifications.error instanceof Error ? notifications.error.message : 'Failed to load notifications'}
          onRetry={() => void notifications.refetch()}
        />
      ) : notifications.data!.items.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          body={
            health.data && !health.data.mail.configured
              ? 'Email notifications are disabled on the server (BDELKO_MAIL_HOST is not set), so nothing will be sent.'
              : 'DOWN and UP emails will appear here once they are sent.'
          }
        />
      ) : (
        <>
          <NotificationsTable items={notifications.data!.items} timeZone={settings.timeZone} />
          <Pagination
            page={notifications.data!.page}
            limit={notifications.data!.limit}
            total={notifications.data!.total}
            onPage={(p) => setParams({ page: String(p) }, false)}
          />
        </>
      )}
    </div>
  );
}
