/**
 * LogsPage.tsx
 *
 * Global monitoring log with server-side pagination. Every filter lives in
 * the hash query string (#/logs?watchdog=...&status=0&page=2) so views are
 * linkable and survive reloads. Changing a filter resets to page 1.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useLogs, useWatchdogs } from '../api/hooks';
import type { ListParams } from '../api/types';
import { RefetchErrorBanner } from '../components/Banner';
import { DateRangeInputs } from '../components/DateRangeInputs';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LogsTable } from '../components/LogsTable';
import { Pagination } from '../components/Pagination';
import { Spinner } from '../components/Spinner';
import { useSettings } from '../settings/SettingsContext';

const selectCls =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800';

const PAGE_SIZES = [25, 50, 100, 250, 500];

export function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useSettings();
  const watchdogs = useWatchdogs();

  // Hash query string is the single source of truth for filters.
  const params: ListParams = {
    watchdog: searchParams.get('watchdog') ?? undefined,
    status: (searchParams.get('status') as '0' | '1' | null) ?? undefined,
    from: searchParams.get('from') ? Number(searchParams.get('from')) : undefined,
    to: searchParams.get('to') ? Number(searchParams.get('to')) : undefined,
    page: Math.max(1, Number(searchParams.get('page') ?? '1') || 1),
    limit: Number(searchParams.get('limit') ?? '50') || 50,
    order: (searchParams.get('order') as 'asc' | 'desc' | null) ?? 'desc',
  };

  const logs = useLogs(params);

  /** Merge a patch into the hash query; any filter change resets the page. */
  const setParams = (patch: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (resetPage && !('page' in patch)) next.delete('page');
    setSearchParams(next, { replace: false });
  };

  // The filter has no "All" option: with none (or a deleted one) selected,
  // auto-select the first watchdog alphabetically and write it into the URL.
  useEffect(() => {
    const list = watchdogs.data;
    if (!list || list.length === 0) return;
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
    const valid = params.watchdog !== undefined && list.some((w) => w.id === params.watchdog);
    if (!valid) {
      setParams({ watchdog: sorted[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.watchdog, watchdogs.data]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Logs</h1>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-500 dark:text-slate-400">
          Watchdog{' '}
          <select
            value={params.watchdog ?? ''}
            onChange={(e) => setParams({ watchdog: e.target.value || undefined })}
            className={selectCls}
          >
            {[...(watchdogs.data ?? [])]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm text-slate-500 dark:text-slate-400">
          Status{' '}
          <select
            value={params.status ?? ''}
            onChange={(e) => setParams({ status: e.target.value || undefined })}
            className={selectCls}
          >
            <option value="">All</option>
            <option value="1">Ok</option>
            <option value="0">Not ok</option>
          </select>
        </label>
        <DateRangeInputs
          from={params.from}
          to={params.to}
          onChange={(patch) => {
            // patch carries exactly one key: the field that changed.
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

      <RefetchErrorBanner isRefetchError={logs.isRefetchError} dataUpdatedAt={logs.dataUpdatedAt} />

      {logs.isPending ? (
        <Spinner label="Loading logs" />
      ) : logs.isError && !logs.data ? (
        <ErrorState
          message={logs.error instanceof Error ? logs.error.message : 'Failed to load logs'}
          onRetry={() => void logs.refetch()}
        />
      ) : logs.data!.items.length === 0 ? (
        <EmptyState
          title="No log entries"
          body="Log entries appear after the scanner has checked your watchdogs."
        />
      ) : (
        <>
          <LogsTable items={logs.data!.items} timeZone={settings.timeZone} />
          <Pagination
            page={logs.data!.page}
            limit={logs.data!.limit}
            total={logs.data!.total}
            onPage={(p) => setParams({ page: String(p) }, false)}
          />
        </>
      )}
    </div>
  );
}
