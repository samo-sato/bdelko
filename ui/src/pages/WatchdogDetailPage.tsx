/**
 * WatchdogDetailPage.tsx
 *
 * Everything about one Watchdog: live status (from /status), config card,
 * heartbeat card (passive), stats cards, a 24h/7d uptime timeline built from
 * log rows, and its logs with filters. Actions: edit, enable/disable,
 * notifications on/off, regenerate secret, delete (type-the-name confirm).
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import {
  useDeleteWatchdog,
  useRegenerateSecret,
  useStats,
  useStatus,
  useUpdateWatchdog,
  useWatchdog,
  useWatchdogLogs,
} from '../api/hooks';
import { RefetchErrorBanner } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CopyButton } from '../components/CopyButton';
import { DateRangeInputs } from '../components/DateRangeInputs';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { ExternalLinkIcon, PencilIcon, TrashIcon } from '../components/icons';
import { LogsTable } from '../components/LogsTable';
import { ModeBadge } from '../components/ModeBadge';
import { Pagination } from '../components/Pagination';
import { SecretField } from '../components/SecretField';
import { Spinner } from '../components/Spinner';
import { StatsCards } from '../components/StatsCards';
import { StatusPill, type DisplayStatus } from '../components/StatusPill';
import { UptimeTimeline } from '../components/UptimeTimeline';
import { formatTs, rawTs } from '../lib/time';
import { useSettings } from '../settings/SettingsContext';

const DAY_MS = 24 * 60 * 60 * 1000;

const selectCls =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800';

export function WatchdogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();

  const watchdog = useWatchdog(id);
  const status = useStatus();
  const stats = useStats(id!);
  const update = useUpdateWatchdog(id!);
  const regenerate = useRegenerateSecret(id!);
  const del = useDeleteWatchdog();

  // Timeline: newest 500 log rows overlapping the selected window.
  const [timelineWindow, setTimelineWindow] = useState<'24h' | '7d'>('24h');
  const windowMs = timelineWindow === '24h' ? DAY_MS : 7 * DAY_MS;
  const timeline = useWatchdogLogs(id!, {
    from: Date.now() - windowMs,
    limit: 500,
    order: 'desc',
  });

  // Log section filters + pagination (local state; the Logs page uses the URL).
  const [logStatus, setLogStatus] = useState<'' | '0' | '1'>('');
  const [logFrom, setLogFrom] = useState<number | undefined>(undefined);
  const [logTo, setLogTo] = useState<number | undefined>(undefined);
  const [logPage, setLogPage] = useState(1);
  const logs = useWatchdogLogs(id!, {
    status: logStatus === '' ? undefined : (Number(logStatus) as 0 | 1),
    from: logFrom,
    to: logTo,
    page: logPage,
    limit: 25,
    order: 'desc',
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const statusItem = useMemo(
    () => status.data?.watchdogs.find((w) => w.id === id),
    [status.data, id],
  );

  if (watchdog.isPending) return <Spinner label="Loading watchdog" />;
  if (watchdog.isError || !watchdog.data) {
    const err = watchdog.error;
    if (err instanceof ApiError && err.status === 404) {
      return (
        <ErrorState
          title="Watchdog not found"
          message="It may have been deleted."
        />
      );
    }
    return (
      <ErrorState
        message={err instanceof Error ? err.message : 'Failed to load the watchdog'}
        onRetry={() => void watchdog.refetch()}
      />
    );
  }

  const wd = watchdog.data;
  const display: DisplayStatus = !wd.enabled
    ? 'disabled'
    : statusItem?.status == null
      ? 'pending'
      : statusItem.status === 1
        ? 'up'
        : 'down';

  const timelineRows = [...(timeline.data?.items ?? [])].reverse(); // oldest first for the strip

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{wd.name}</h1>
        <ModeBadge mode={wd.mode} />
        <StatusPill status={display} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            to={`/watchdogs/${wd.id}/edit`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <PencilIcon className="h-4 w-4" /> Edit
          </Link>
          <button
            type="button"
            onClick={() => update.mutate({ enabled: !wd.enabled })}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {wd.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            onClick={() => update.mutate({ notify: !wd.notify })}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Notifications {wd.notify ? 'off' : 'on'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
          >
            <TrashIcon className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <RefetchErrorBanner isRefetchError={status.isRefetchError} dataUpdatedAt={status.dataUpdatedAt} />

      {/* Current state */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-slate-500 dark:text-slate-400">In current state since</dt>
            <dd title={statusItem?.since ?? ''}>{statusItem?.since ? formatTs(statusItem.since, settings.timeZone) : '—'}</dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-slate-500 dark:text-slate-400">Last checked</dt>
            <dd title={statusItem?.last_checked_at ?? ''}>
              {statusItem?.last_checked_at ? formatTs(statusItem.last_checked_at, settings.timeZone) : '—'}
            </dd>
          </div>
        </dl>
        {statusItem?.note && (
          <p className="mt-2 border-t border-slate-100 pt-2 text-slate-600 dark:border-slate-800 dark:text-slate-300">
            {statusItem.note}
          </p>
        )}
        <p className="mt-2 text-xs">
          <Link
            to={`/notifications?watchdog=${wd.id}`}
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Notifications for this watchdog
          </Link>
        </p>
      </div>

      {/* Config card */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 font-semibold">Configuration</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {wd.mode === 'active' && (
            <>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">URL</dt>
                <dd className="flex items-center gap-1 break-all">
                  <span className="font-mono text-xs">{wd.url}</span>
                  <a
                    href={wd.url!}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Open ${wd.url} in a new tab`}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Expected status</dt>
                <dd className="font-mono text-xs">{wd.expected_status}</dd>
              </div>
            </>
          )}
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Alert threshold</dt>
            <dd>
              {wd.threshold_minutes} min{wd.threshold_minutes === 0 ? ' (alert immediately)' : ''}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Email notifications</dt>
            <dd>{wd.notify ? 'On' : 'Off'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Created</dt>
            <dd title={rawTs(wd.created_at)}>{formatTs(wd.created_at, settings.timeZone)}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Updated</dt>
            <dd title={rawTs(wd.updated_at)}>{formatTs(wd.updated_at, settings.timeZone)}</dd>
          </div>
        </dl>
      </section>

      {/* Heartbeat card (passive only) */}
      {wd.mode === 'passive' && (
        <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Heartbeat</h2>
          <div>
            <p className="mb-1 text-slate-500 dark:text-slate-400">Heartbeat URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-slate-100 px-2 py-1.5 font-mono text-xs break-all dark:bg-slate-800">
                {wd.heartbeat_url}
              </code>
              <CopyButton text={wd.heartbeat_url!} />
            </div>
          </div>
          <div>
            <p className="mb-1 text-slate-500 dark:text-slate-400">Secret</p>
            <SecretField value={wd.heartbeat_secret!} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-slate-500 dark:text-slate-400">
              Last heartbeat:{' '}
              <span className="text-slate-700 dark:text-slate-200" title={wd.last_heartbeat_at ?? ''}>
                {wd.last_heartbeat_at ? formatTs(wd.last_heartbeat_at, settings.timeZone) : 'never'}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setConfirmRegen(true)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Regenerate secret
            </button>
          </div>
        </section>
      )}

      {/* Stats */}
      <section>
        <h2 className="mb-2 font-semibold">Uptime</h2>
        {stats.data ? <StatsCards stats={stats.data} /> : stats.isPending ? <Spinner label="Loading stats" /> : null}
      </section>

      {/* Timeline */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Timeline</h2>
          <div className="flex gap-1" role="group" aria-label="Timeline window">
            {(['24h', '7d'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setTimelineWindow(w)}
                aria-pressed={timelineWindow === w}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  timelineWindow === w
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        {timeline.isPending ? (
          <Spinner label="Loading timeline" />
        ) : (
          <>
            <UptimeTimeline rows={timelineRows} windowMs={windowMs} timeZone={settings.timeZone} />
            {(timeline.data?.total ?? 0) > 500 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Showing the most recent 500 of {timeline.data!.total} entries.
              </p>
            )}
          </>
        )}
      </section>

      {/* Logs */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Logs</h2>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeInputs
              from={logFrom}
              to={logTo}
              onChange={(patch) => {
                // patch carries exactly one key: the field that changed.
                if ('from' in patch) setLogFrom(patch.from);
                if ('to' in patch) setLogTo(patch.to);
                setLogPage(1);
              }}
            />
            <label className="text-sm text-slate-500 dark:text-slate-400">
              Status{' '}
              <select
                value={logStatus}
                onChange={(e) => {
                  setLogStatus(e.target.value as typeof logStatus);
                  setLogPage(1);
                }}
                className={selectCls}
              >
                <option value="">All</option>
                <option value="1">Ok</option>
                <option value="0">Not ok</option>
              </select>
            </label>
          </div>
        </div>
        {logs.isPending ? (
          <Spinner label="Loading logs" />
        ) : (logs.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No log entries match" />
        ) : (
          <div className="flex flex-col gap-3">
            <LogsTable items={logs.data!.items} showWatchdog={false} timeZone={settings.timeZone} />
            <Pagination
              page={logs.data!.page}
              limit={logs.data!.limit}
              total={logs.data!.total}
              onPage={setLogPage}
            />
          </div>
        )}
      </section>

      {/* Dialogs */}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${wd.name}"?`}
        confirmLabel="Delete watchdog"
        requireText={wd.name}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          del.mutate(wd.id, { onSuccess: () => navigate('/') });
        }}
      >
        <p>
          This permanently deletes the watchdog together with its monitoring logs and notification
          history.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmRegen}
        title="Regenerate heartbeat secret?"
        confirmLabel="Regenerate"
        onCancel={() => setConfirmRegen(false)}
        onConfirm={() => {
          setConfirmRegen(false);
          regenerate.mutate();
        }}
      >
        <p>
          The old heartbeat URL stops working immediately. Update any cron jobs or scripts that use
          it.
        </p>
      </ConfirmDialog>
    </div>
  );
}
