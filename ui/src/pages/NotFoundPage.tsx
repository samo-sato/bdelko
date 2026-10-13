/**
 * NotFoundPage.tsx - catch-all for unknown hash routes.
 */
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The page you are looking for does not exist.
      </p>
      <Link
        to="/"
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
