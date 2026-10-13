/**
 * DashboardPage.tsx
 *
 * Live overview fed by /api/status (+ /api/health for the mail banner):
 * summary counts, scanner timing with a live countdown, stalled-scanner and
 * mail-disabled banners, client-side search/mode/status filters, and the
 * watchdog table (cards on narrow screens). Rows open the detail page.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useHealth, useStatus } from '../api/hooks';
import type { StatusItem } from '../api/types';
import { Banner, RefetchErrorBanner } from '../components/Banner';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { BellIcon, BellOffIcon, PlusIcon, SearchIcon } from '../components/icons';
import { ModeBadge } from '../components/ModeBadge';
import { Spinner } from '../components/Spinner';
import { StatusPill, type DisplayStatus } from '../components/StatusPill';
import { formatRelative, formatTs, parseTs, useNow } from '../lib/time';
import { useSettings } from '../settings/SettingsContext';

function displayStatus(item: StatusItem): DisplayStatus {
  if (!item.enabled) return 'disabled';
  if (item.status === null) return 'pending';
  return item.status === 1 ? 'up' : 'down';
}

// Dashboard sort: Down first, then Pending, Up, Disabled; name A-Z inside.
const STATUS_RANK: Record<DisplayStatus, number> = { down: 0, pending: 1, up: 2, disabled: 3 };

function hostOf(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function DashboardPage() {
  const status = useStatus();
  const health = useHealth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const now = useNow();

  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'active' | 'passive'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DisplayStatus>('all');

  const items = status.data?.watchdogs;

  const counts = useMemo(() => {
    const c = { up: 0, down: 0, pending: 0, disabled: 0 };
    for (const w of items ?? []) c[displayStatus(w)]++;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? [])
      .filter((w) => (modeFilter === 'all' ? true : w.mode === modeFilter))
      .filter((w) => (statusFilter === 'all' ? true : displayStatus(w) === statusFilter))
      .filter((w) => (q === '' ? true : w.name.toLowerCase().includes(q)))
      .sort(
        (a, b) =>
          STATUS_RANK[displayStatus(a)] - STATUS_RANK[displayStatus(b)] ||
          a.name.localeCompare(b.name),
      );
  }, [items, search, modeFilter, statusFilter]);

  if (status.isPending) {
    return <Spinner label="Loading watchdogs" />;
  }
  if (status.isError && !status.data) {
    return (
      <ErrorState
        message={status.error instanceof Error ? status.error.message : 'Failed to load status'}
        onRetry={() => void status.refetch()}
      />
    );
  }

  const scanner = status.data?.scanner;
  const lastRunMs = parseTs(scanner?.lastRunAt ?? null);
  const nextRunMs = parseTs(scanner?.nextRunAt ?? null);
  const stalled = nextRunMs !== null && nextRunMs < now - 120_000;
  const mailConfigured = health.data?.mail.configured;

  const selectCls =
    'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800';

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="inline-flex items-center gap-1.5">
          <span className="font-semibold text-red-600 dark:text-red-400">{counts.down}</span> Down
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-semibold text-amber-600 dark:text-amber-400">{counts.pending}</span> Pending
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{counts.up}</span> Up
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-semibold text-slate-500 dark:text-slate-400">{counts.disabled}</span> Disabled
        </span>
        <span
          className="ml-auto text-slate-500 dark:text-slate-400"
          title={scanner?.lastRunAt ?? ''}
        >
          Last run at {lastRunMs !== null ? formatTs(scanner!.lastRunAt!, settings.timeZone) : 'never'}
        </span>
      </div>

      <RefetchErrorBanner isRefetchError={status.isRefetchError} dataUpdatedAt={status.dataUpdatedAt} />
      {stalled && (
        <Banner variant="warning">
          The scanner looks stalled: the next run was due {formatRelative(nextRunMs, now)}. Check the
          server process and logs.
        </Banner>
      )}
      {health.data && !mailConfigured && (
        <Banner variant="info">Email notifications are disabled on the server.</Banner>
      )}

      {/* Filters (client-side) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            aria-label="Search by name"
            className="w-52 rounded-md border border-slate-300 bg-white py-1.5 pr-2 pl-8 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <label className="text-sm text-slate-500 dark:text-slate-400">
          Mode{' '}
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}
            className={selectCls}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="passive">Passive</option>
          </select>
        </label>
        <label className="text-sm text-slate-500 dark:text-slate-400">
          Status{' '}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className={selectCls}
          >
            <option value="all">All</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
            <option value="pending">Pending</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 && (items ?? []).length === 0 ? (
        <EmptyState
          title="No watchdogs yet"
          body="Create your first watchdog to start monitoring."
          action={
            <Link
              to="/watchdogs/new"
              className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <PlusIcon className="h-4 w-4" />
              Create your first watchdog
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing matches these filters" />
      ) : (
        <>
          {/* Table layout (md and up) */}
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2">Name</th>
                  <th scope="col" className="px-3 py-2">Since</th>
                  <th scope="col" className="px-3 py-2">Note</th>
                  <th scope="col" className="px-3 py-2">Alerts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((w) => (
                  <DashboardRow key={w.id} w={w} now={now} timeZone={settings.timeZone} mailConfigured={!!mailConfigured} onOpen={() => navigate(`/watchdogs/${w.id}`)} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Card layout (below md) */}
          <ul className="flex flex-col gap-2 md:hidden">
            {filtered.map((w) => (
              <DashboardCard key={w.id} w={w} now={now} timeZone={settings.timeZone} mailConfigured={!!mailConfigured} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function alertPending(w: StatusItem, mailConfigured: boolean): boolean {
  return (
    w.enabled &&
    w.status === 0 &&
    w.notify &&
    w.down_since !== null &&
    !w.down_notified &&
    mailConfigured
  );
}

function rowCls(w: StatusItem): string {
  return w.status === 0 && w.enabled ? 'bg-red-50/60 dark:bg-red-950/20' : '';
}

function DashboardRow({
  w,
  now,
  timeZone,
  mailConfigured,
  onOpen,
}: {
  w: StatusItem;
  now: number;
  timeZone: 'browser' | 'server';
  mailConfigured: boolean;
  onOpen: () => void;
}) {
  const lastBeatMs = parseTs(w.last_heartbeat_at);
  return (
    <tr onClick={onOpen} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${rowCls(w)}`}>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1.5">
          <StatusPill status={displayStatus(w)} />
          {alertPending(w, mailConfigured) && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              alert pending
            </span>
          )}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 font-medium">
          {w.name}
          <ModeBadge mode={w.mode} />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {w.mode === 'active'
            ? hostOf(w.url)
            : `last heartbeat ${lastBeatMs !== null ? formatRelative(lastBeatMs, now) : 'never'}`}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300" title={w.since ?? ''}>
        {w.since ? formatTs(w.since, timeZone) : '—'}
      </td>
      <td className="max-w-48 truncate px-3 py-2 text-slate-600 lg:max-w-72 dark:text-slate-300" title={w.note ?? ''}>
        {w.note ?? '—'}
      </td>
      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1" title={w.notify ? `Alert after ${w.threshold_minutes} min down` : 'Alerts off'}>
          {w.notify ? <BellIcon className="h-4 w-4" /> : <BellOffIcon className="h-4 w-4 text-slate-400" />}
          <span className="text-xs">{w.notify ? `${w.threshold_minutes}m` : 'off'}</span>
        </span>
      </td>
    </tr>
  );
}

function DashboardCard({
  w,
  now,
  timeZone,
  mailConfigured,
}: {
  w: StatusItem;
  now: number;
  timeZone: 'browser' | 'server';
  mailConfigured: boolean;
}) {
  const lastBeatMs = parseTs(w.last_heartbeat_at);
  return (
    <li className={`rounded-lg border border-slate-200 p-3 dark:border-slate-800 ${w.status === 0 && w.enabled ? 'bg-red-50/60 dark:bg-red-950/20' : 'bg-white dark:bg-slate-900'}`}>
      <div className="flex items-center justify-between gap-2">
        <Link to={`/watchdogs/${w.id}`} className="flex items-center gap-2 font-medium text-indigo-600 dark:text-indigo-400">
          {w.name}
          <ModeBadge mode={w.mode} />
        </Link>
        <span className="inline-flex items-center gap-1.5">
          <StatusPill status={displayStatus(w)} />
          {alertPending(w, mailConfigured) && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              alert pending
            </span>
          )}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {w.mode === 'active'
          ? hostOf(w.url)
          : `last heartbeat ${lastBeatMs !== null ? formatRelative(lastBeatMs, now) : 'never'}`}
        {' · '}since {w.since ? formatTs(w.since, timeZone) : '—'}
      </p>
      {w.note && <p className="mt-1 text-sm break-words text-slate-600 dark:text-slate-300">{w.note}</p>}
    </li>
  );
}
