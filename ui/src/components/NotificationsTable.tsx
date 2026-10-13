/**
 * NotificationsTable.tsx - history of attempted DOWN/UP emails.
 * Responsive: table from md up, cards below.
 */
import { Link } from 'react-router';
import type { NotificationItem } from '../api/types';
import type { TimeZoneMode } from '../settings/SettingsContext';
import { formatTs, rawTs } from '../lib/time';
import { CheckCircleIcon, XCircleIcon } from './icons';

function TypeBadge({ type }: { type: 'down' | 'up' }) {
  const cls =
    type === 'down'
      ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200';
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}>
      {type.toUpperCase()}
    </span>
  );
}

function Result({ success }: { success: boolean }) {
  return success ? (
    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
      <CheckCircleIcon className="h-4 w-4" /> Sent
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300">
      <XCircleIcon className="h-4 w-4" /> Failed
    </span>
  );
}

export function NotificationsTable({
  items,
  timeZone,
}: {
  items: NotificationItem[];
  timeZone: TimeZoneMode;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th scope="col" className="px-3 py-2">Time</th>
              <th scope="col" className="px-3 py-2">Watchdog</th>
              <th scope="col" className="px-3 py-2">Type</th>
              <th scope="col" className="px-3 py-2">Result</th>
              <th scope="col" className="px-3 py-2">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <tr key={item.id}>
                <td
                  className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300"
                  title={rawTs(item.sent_at)}
                >
                  {formatTs(item.sent_at, timeZone)}
                </td>
                <td className="px-3 py-2">
                  <Link
                    to={`/watchdogs/${item.watchdog_id}`}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {item.watchdog_name}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <TypeBadge type={item.type} />
                </td>
                <td className="px-3 py-2">
                  <Result success={item.success} />
                </td>
                <td className="max-w-56 truncate px-3 py-2 text-slate-500 lg:max-w-96 dark:text-slate-400" title={item.error ?? ''}>
                  {item.error ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <TypeBadge type={item.type} />
              <Result success={item.success} />
            </div>
            <p className="mt-1 text-sm">
              <Link to={`/watchdogs/${item.watchdog_id}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                {item.watchdog_name}
              </Link>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400" title={rawTs(item.sent_at)}>
              {formatTs(item.sent_at, timeZone)}
            </p>
            {item.error && (
              <p className="mt-1 text-xs break-words text-red-600 dark:text-red-300">{item.error}</p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
