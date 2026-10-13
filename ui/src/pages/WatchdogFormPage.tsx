/**
 * WatchdogFormPage.tsx
 *
 * Create and edit forms for Watchdogs (one page, two modes).
 * - Client validation: name non-empty, URL via new URL() (http/https),
 *   expected_status via the copied statusMatcher (normalized on blur).
 *   Length limits are NOT hard-coded - they come from server env config, so
 *   server validation messages are mapped to fields from error.details.
 * - Edit sends a PATCH with only the changed fields; mode is immutable and
 *   shown read-only.
 * - Creating a passive watchdog shows a success screen with the heartbeat
 *   URL, secret and a ready-made cron line; creating an active one navigates
 *   to its detail page.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useCreateWatchdog, useUpdateWatchdog, useWatchdog } from '../api/hooks';
import type { Watchdog, WatchdogMode } from '../api/types';
import { Banner } from '../components/Banner';
import { CopyButton } from '../components/CopyButton';
import { ErrorState } from '../components/ErrorState';
import { SecretField } from '../components/SecretField';
import { Spinner } from '../components/Spinner';
import { isValidExpectedStatus, normalizeExpectedStatus } from '../lib/statusMatcher';

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800';
const labelCls = 'mb-1 block text-sm font-medium';
const helpCls = 'mt-1 text-xs text-slate-500 dark:text-slate-400';
const errCls = 'mt-1 text-xs text-red-600 dark:text-red-400';

interface FormState {
  name: string;
  mode: WatchdogMode;
  url: string;
  expectedStatus: string;
  enabled: boolean;
  notify: boolean;
  threshold: string;
}

type FieldErrors = Partial<Record<'name' | 'url' | 'expectedStatus' | 'threshold', string>>;

export function WatchdogFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams<{ id: string }>();
  // Query is disabled in create mode (no id -> no request).
  const existing = useWatchdog(mode === 'edit' ? id : undefined);

  if (mode === 'edit') {
    if (existing.isPending) return <Spinner label="Loading watchdog" />;
    if (existing.isError) {
      const err = existing.error;
      if (err instanceof ApiError && err.status === 404) {
        return (
          <ErrorState
            title="Watchdog not found"
            message="It may have been deleted."
          />
        );
      }
      return <ErrorState message={err instanceof Error ? err.message : undefined} onRetry={() => void existing.refetch()} />;
    }
  }

  return (
    <FormInner
      mode={mode}
      key={existing.data?.id ?? 'new'}
      existing={mode === 'edit' ? existing.data : undefined}
    />
  );
}

function FormInner({ mode, existing }: { mode: 'create' | 'edit'; existing?: Watchdog }) {
  const navigate = useNavigate();
  const create = useCreateWatchdog({ toastOnError: false });
  const update = useUpdateWatchdog(existing?.id ?? '', { toastOnError: false });

  const [form, setForm] = useState<FormState>(() => ({
    name: existing?.name ?? '',
    mode: existing?.mode ?? 'active',
    url: existing?.url ?? '',
    // Matches the server-side default for active watchdogs.
    expectedStatus: existing?.expected_status ?? '2xx',
    enabled: existing?.enabled ?? true,
    notify: existing?.notify ?? true,
    threshold: String(existing?.threshold_minutes ?? 3),
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<Watchdog | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const busy = create.isPending || update.isPending;

  /** Live client-side validation; returns false when something is off. */
  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (form.name.trim() === '') errs.name = 'Name is required';
    if (form.mode === 'active') {
      try {
        const u = new URL(form.url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
      } catch {
        errs.url = 'Enter a valid http(s) URL';
      }
      if (!isValidExpectedStatus(form.expectedStatus)) {
        errs.expectedStatus = 'Invalid spec - examples: 200, 2xx, 200,301, 200-299,304';
      }
    }
    const t = Number(form.threshold);
    if (!Number.isInteger(t) || t < 0 || t > 1440) errs.threshold = 'Whole minutes, 0-1440';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    try {
      if (mode === 'create') {
        const input = {
          name: form.name.trim(),
          mode: form.mode,
          ...(form.mode === 'active'
            ? {
                url: form.url.trim(),
                expected_status: normalizeExpectedStatus(form.expectedStatus),
              }
            : {}),
          enabled: form.enabled,
          notify: form.notify,
          threshold_minutes: Number(form.threshold),
        };
        const wd = await create.mutateAsync(input);
        if (wd.mode === 'passive') setCreated(wd); // success screen with the heartbeat URL
        else navigate(`/watchdogs/${wd.id}`);
        return;
      }

      // Edit: PATCH only the fields that actually changed.
      const patch: Record<string, unknown> = {};
      if (form.name.trim() !== existing!.name) patch.name = form.name.trim();
      if (form.enabled !== existing!.enabled) patch.enabled = form.enabled;
      if (form.notify !== existing!.notify) patch.notify = form.notify;
      if (Number(form.threshold) !== existing!.threshold_minutes) {
        patch.threshold_minutes = Number(form.threshold);
      }
      if (existing!.mode === 'active') {
        if (form.url.trim() !== (existing!.url ?? '')) patch.url = form.url.trim();
        const norm = normalizeExpectedStatus(form.expectedStatus);
        if (norm !== (existing!.expected_status ?? '2xx')) patch.expected_status = norm;
      }
      if (Object.keys(patch).length === 0) {
        navigate(`/watchdogs/${existing!.id}`);
        return;
      }
      const wd = await update.mutateAsync(patch);
      navigate(`/watchdogs/${wd.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setFieldErrors({ name: 'A watchdog with this name already exists' });
          return;
        }
        // Map server validation details onto fields when paths are known.
        const mapped: FieldErrors = {};
        for (const d of err.details ?? []) {
          if (d.path === 'name') mapped.name = d.message;
          else if (d.path === 'url') mapped.url = d.message;
          else if (d.path === 'expected_status') mapped.expectedStatus = d.message;
          else if (d.path === 'threshold_minutes') mapped.threshold = d.message;
        }
        if (Object.keys(mapped).length > 0) setFieldErrors((prev) => ({ ...prev, ...mapped }));
        else setFormError(err.message);
        return;
      }
      setFormError('Something went wrong');
    }
  };

  // Success screen after creating a passive watchdog.
  if (created) {
    const cron = `* * * * * curl -fsS ${created.heartbeat_url} > /dev/null`;
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <h1 className="text-xl font-semibold">Watchdog "{created.name}" created</h1>
        <Banner variant="info">
          This is a passive watchdog: your job pings the heartbeat URL below. If no ping arrives
          within one scan interval, the watchdog goes down.
        </Banner>
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className={labelCls}>Heartbeat URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-slate-100 px-2 py-1.5 font-mono text-xs break-all dark:bg-slate-800">
                {created.heartbeat_url}
              </code>
              <CopyButton text={created.heartbeat_url!} />
            </div>
          </div>
          <div>
            <p className={labelCls}>Heartbeat secret</p>
            <SecretField value={created.heartbeat_secret!} />
          </div>
          <div>
            <p className={labelCls}>Cron example</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-slate-100 px-2 py-1.5 font-mono text-xs break-all dark:bg-slate-800">
                {cron}
              </code>
              <CopyButton text={cron} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/watchdogs/${created.id}`}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            View watchdog
          </Link>
          <Link
            to="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-semibold">
        {mode === 'create' ? 'New watchdog' : `Edit "${existing!.name}"`}
      </h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label htmlFor="wd-name" className={labelCls}>Name</label>
          <input
            id="wd-name"
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputCls}
            autoFocus={mode === 'create'}
          />
          {fieldErrors.name && <p className={errCls}>{fieldErrors.name}</p>}
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-medium">Mode</legend>
          {mode === 'edit' ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {existing!.mode === 'active'
                ? 'Active - bdelko polls the URL below.'
                : 'Passive - your job pings a heartbeat URL.'}{' '}
              Mode cannot be changed after creation.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="mode"
                  value="active"
                  checked={form.mode === 'active'}
                  onChange={() => set('mode', 'active')}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Active</span> - bdelko sends an HTTP request to your
                  URL every scan interval and checks the status code.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="mode"
                  value="passive"
                  checked={form.mode === 'passive'}
                  onChange={() => set('mode', 'passive')}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Passive</span> - your job (cron, backup script)
                  pings a heartbeat URL; silence means down.
                </span>
              </label>
            </div>
          )}
        </fieldset>

        {form.mode === 'active' && (
          <>
            <div>
              <label htmlFor="wd-url" className={labelCls}>URL</label>
              <input
                id="wd-url"
                type="url"
                value={form.url}
                onChange={(e) => set('url', e.target.value)}
                placeholder="https://example.com/health"
                className={inputCls}
              />
              {fieldErrors.url && <p className={errCls}>{fieldErrors.url}</p>}
            </div>
            <div>
              <label htmlFor="wd-expected" className={labelCls}>Expected status</label>
              <input
                id="wd-expected"
                type="text"
                value={form.expectedStatus}
                onChange={(e) => set('expectedStatus', e.target.value)}
                onBlur={() => {
                  // Normalize on blur when valid (strip spaces, lowercase x).
                  if (isValidExpectedStatus(form.expectedStatus)) {
                    set('expectedStatus', normalizeExpectedStatus(form.expectedStatus));
                  }
                }}
                placeholder="2xx"
                className={inputCls}
              />
              {fieldErrors.expectedStatus ? (
                <p className={errCls}>{fieldErrors.expectedStatus}</p>
              ) : (
                <p className={helpCls}>Examples: 200 · 200,301 · 2xx · 200-299,304</p>
              )}
            </div>
          </>
        )}

        <div>
          <label htmlFor="wd-threshold" className={labelCls}>Alert threshold (minutes)</label>
          <input
            id="wd-threshold"
            type="number"
            min={0}
            max={1440}
            step={1}
            value={form.threshold}
            onChange={(e) => set('threshold', e.target.value)}
            className={inputCls}
          />
          {fieldErrors.threshold ? (
            <p className={errCls}>{fieldErrors.threshold}</p>
          ) : (
            <p className={helpCls}>Continuous downtime before a DOWN email is sent. 0 = alert immediately.</p>
          )}
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.notify}
              onChange={(e) => set('notify', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Email notifications
          </label>
        </div>

        {formError && <Banner variant="error">{formError}</Banner>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Saving...' : mode === 'create' ? 'Create watchdog' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
