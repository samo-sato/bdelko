/**
 * DateRangeInputs.tsx
 *
 * Shared from/to filter controls (native datetime-local inputs, values are
 * epoch ms or undefined). Used by the Logs page, the Notifications page and
 * the watchdog detail log section.
 */

/** Epoch ms -> value of a datetime-local input ("YYYY-MM-DDTHH:mm"). */
export function toInputValue(ms: number | undefined): string {
  if (ms === undefined) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local input value -> epoch ms (undefined when empty/invalid). */
export function fromInputValue(value: string): number | undefined {
  if (!value) return undefined;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? undefined : t;
}

const inputCls =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800';

export function DateRangeInputs({
  from,
  to,
  onChange,
}: {
  from: number | undefined;
  to: number | undefined;
  onChange: (patch: { from?: number; to?: number }) => void;
}) {
  return (
    <>
      <label className="text-sm text-slate-500 dark:text-slate-400">
        From{' '}
        <input
          type="datetime-local"
          value={toInputValue(from)}
          onChange={(e) => onChange({ from: fromInputValue(e.target.value) })}
          className={inputCls}
        />
      </label>
      <label className="text-sm text-slate-500 dark:text-slate-400">
        To{' '}
        <input
          type="datetime-local"
          value={toInputValue(to)}
          onChange={(e) => onChange({ to: fromInputValue(e.target.value) })}
          className={inputCls}
        />
      </label>
    </>
  );
}
