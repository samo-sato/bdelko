/**
 * AboutPage.tsx
 *
 * Basic information about the app: what it does, key runtime facts (version,
 * scan interval, mail status, uptime) and the project link. Read-only.
 */
import { useHealth } from '../api/hooks';
import { ExternalLinkIcon, LogoIcon } from '../components/icons';
import { formatDuration } from '../lib/format';

export function AboutPage() {
  const health = useHealth();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <LogoIcon className="h-10 w-10" />
        <div>
          <h1 className="text-xl font-semibold">bdelko</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {health.data ? `version ${health.data.version}` : ''}
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 font-semibold">What it does</h2>
        <p className="text-slate-600 dark:text-slate-300">
          bdelko is a self-hosted, single-admin server monitoring app. It watches your services and
          emails you when they go down and again when they come back up. Active watchdogs poll a URL
          every scan interval and check the HTTP status; passive watchdogs expect your jobs (cron,
          backup scripts) to ping a heartbeat URL - silence means down.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 font-semibold">Facts</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
          <dt className="text-slate-500 dark:text-slate-400">Scan interval</dt>
          <dd>60 seconds (fixed)</dd>
          <dt className="text-slate-500 dark:text-slate-400">Email notifications</dt>
          <dd>
            {health.data ? (health.data.mail.configured ? 'Configured' : 'Disabled') : '—'}
          </dd>
          <dt className="text-slate-500 dark:text-slate-400">Server uptime</dt>
          <dd>{health.data ? formatDuration(health.data.uptimeSeconds * 1000) : '—'}</dd>
          <dt className="text-slate-500 dark:text-slate-400">Scanner runs</dt>
          <dd>{health.data ? health.data.scanner.runCount : '—'}</dd>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 font-semibold">Project</h2>
        <a
          href="https://github.com/samo-sato/bdelko"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline dark:text-indigo-400"
        >
          <ExternalLinkIcon className="h-4 w-4" />
          github.com/samo-sato/bdelko
        </a>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Successor of JASMA. Express + SQLite backend, React web UI, one origin.
        </p>
      </section>
    </div>
  );
}
