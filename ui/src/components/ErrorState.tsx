/**
 * ErrorState.tsx - full-block error with an optional retry button.
 */
import { AlertTriangleIcon } from './icons';

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900 dark:bg-red-950/40">
      <AlertTriangleIcon className="h-6 w-6 text-red-500" />
      <p className="font-medium text-red-800 dark:text-red-200">{title}</p>
      {message && <p className="text-sm text-red-600 dark:text-red-300">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
