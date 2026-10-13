/**
 * Pagination.tsx - server-side pagination controls: prev/next, page X of Y,
 * total count. Buttons disable at the edges; everything keyboard-operable.
 */
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const btn =
    'inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <nav className="flex items-center justify-between gap-2" aria-label="Pagination">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Page {page} of {totalPages} · {total} {total === 1 ? 'item' : 'items'}
      </p>
      <div className="flex gap-2">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeftIcon className="h-4 w-4" />
          Previous
        </button>
        <button
          type="button"
          className={btn}
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
