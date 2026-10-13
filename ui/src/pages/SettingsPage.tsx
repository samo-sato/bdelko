/**
 * SettingsPage.tsx
 *
 * UI preferences (all stored in localStorage under the "bdelko." prefix):
 * theme mode + auto-theme times, time display zone, auto-refresh interval;
 * a read-only server box fed by /health; and Log out.
 */
import { useHealth, useSendTestMail } from '../api/hooks';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatDuration } from '../lib/format';
import { formatTs } from '../lib/time';
import { parseHHmm } from '../settings/theme';
import { useSettings } from '../settings/SettingsContext';

export function SettingsPage() {
  const { settings, update, updateTheme, resolvedTheme } = useSettings();
  const { logout } = useAuth();
  const health = useHealth();
  const testMail = useSendTestMail();

  const { theme } = settings;
  const auto = theme.mode === 'auto';
  // Human sentence: "Currently: Dark (auto, switches to light at 07:00)".
  const currently =
    theme.mode === 'auto'
      ? `Currently: ${resolvedTheme === 'dark' ? 'Dark' : 'Light'} (auto, switches to ${
          resolvedTheme === 'dark' ? `light at ${theme.autoLightFrom}` : `dark at ${theme.autoDarkFrom}`
        })`
      : `Currently: ${resolvedTheme === 'dark' ? 'Dark' : 'Light'} (set manually)`;

  const radioCls = 'h-4 w-4 border-slate-300';
  const timeInputCls = `rounded-md border px-2 py-1.5 text-sm dark:bg-slate-800 ${
    auto
      ? 'border-indigo-400 dark:border-indigo-600'
      : 'border-slate-300 text-slate-400 dark:border-slate-700 dark:text-slate-500'
  }`;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* Theme */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 font-semibold">Theme</h2>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Theme mode">
          {(['auto', 'light', 'dark'] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="theme"
                value={m}
                checked={theme.mode === m}
                onChange={() => updateTheme({ mode: m })}
                className={radioCls}
              />
              {m === 'auto' ? 'Auto (by time of day)' : m === 'light' ? 'Light' : 'Dark'}
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className={`text-sm ${auto ? '' : 'text-slate-400 dark:text-slate-500'}`}>
            Dark from{' '}
            <input
              type="time"
              value={theme.autoDarkFrom}
              onChange={(e) => {
                // Only persist syntactically valid HH:mm values.
                if (parseHHmm(e.target.value) !== null) updateTheme({ autoDarkFrom: e.target.value });
                else if (e.target.value === '') updateTheme({ autoDarkFrom: '19:00' });
              }}
              className={timeInputCls}
            />
          </label>
          <label className={`text-sm ${auto ? '' : 'text-slate-400 dark:text-slate-500'}`}>
            Light from{' '}
            <input
              type="time"
              value={theme.autoLightFrom}
              onChange={(e) => {
                if (parseHHmm(e.target.value) !== null) updateTheme({ autoLightFrom: e.target.value });
                else if (e.target.value === '') updateTheme({ autoLightFrom: '07:00' });
              }}
              className={timeInputCls}
            />
          </label>
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{currently}</p>
      </section>

      {/* Time display + refresh */}
      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Display</h2>
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Show times in{' '}
          <select
            value={settings.timeZone}
            onChange={(e) => update({ timeZone: e.target.value as 'browser' | 'server' })}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="browser">Browser time zone</option>
            <option value="server">Server time (as received)</option>
          </select>
        </label>
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Auto-refresh{' '}
          <select
            value={String(settings.refreshMs)}
            onChange={(e) => update({ refreshMs: Number(e.target.value) })}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="0">Off</option>
            <option value="10000">Every 10 s</option>
            <option value="15000">Every 15 s</option>
            <option value="30000">Every 30 s</option>
            <option value="60000">Every 60 s</option>
          </select>
        </label>
      </section>

      {/* Server info (read-only) */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 font-semibold">Server</h2>
        {health.data ? (
          <>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Stats valid as of {formatTs(health.data.time, settings.timeZone)}
            </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">Uptime</dt>
            <dd>{formatDuration(health.data.uptimeSeconds * 1000)}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Scanner runs</dt>
            <dd>{health.data.scanner.runCount}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Last run duration</dt>
            <dd>{health.data.scanner.lastRunDurationMs ?? '—'} ms</dd>
            <dt className="text-slate-500 dark:text-slate-400">Last run at</dt>
            <dd>{formatTs(health.data.scanner.lastRunAt, settings.timeZone)}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Email notifications</dt>
            <dd>{health.data.mail.configured ? 'Configured' : 'Disabled'}</dd>
          </dl>
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">Server info unavailable.</p>
        )}
      </section>

      {/* Test email - only offered when mailing AND a recipient are configured */}
      {health.data?.mail.configured && health.data.mail.recipientSet && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 font-semibold">Email notifications</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Send a test email to the configured notification address to verify SMTP delivery.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => testMail.mutate()}
              disabled={testMail.isPending}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testMail.isPending ? 'Sending...' : 'Send test email'}
            </button>
            {testMail.isSuccess && (
              <span className="text-sm text-green-700 dark:text-green-300">
                Test email sent - check the inbox.
              </span>
            )}
            {testMail.isError && (
              <span className="text-sm text-red-600 dark:text-red-400">
                {testMail.error instanceof ApiError || testMail.error instanceof Error
                  ? testMail.error.message
                  : 'Failed to send test email.'}
              </span>
            )}
          </div>
        </section>
      )}

      <div>
        <button
          type="button"
          onClick={logout}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
