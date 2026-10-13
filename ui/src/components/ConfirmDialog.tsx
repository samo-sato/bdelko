/**
 * ConfirmDialog.tsx
 *
 * Confirmation modal built on the native <dialog> element (focus trap, Esc
 * handling and backdrop come for free). When `requireText` is set, the
 * confirm button stays disabled until the user types exactly that string
 * (used for watchdog deletion: type the name to confirm).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  requireText,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');

  // Sync the native dialog with the `open` prop; reset any typed text.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) setTyped('');
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onNativeCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };
    dialog.addEventListener('cancel', onNativeCancel);
    return () => dialog.removeEventListener('cancel', onNativeCancel);
  }, [onCancel]);

  const confirmed = requireText === undefined || typed === requireText;

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl backdrop:bg-black/40 dark:border-slate-700 dark:bg-slate-900"
      aria-label={title}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{children}</div>}
      {requireText !== undefined && (
        <div className="mt-3">
          <label htmlFor="confirm-text" className="mb-1 block text-sm font-medium">
            Type <span className="font-mono font-semibold">{requireText}</span> to confirm
          </label>
          <input
            id="confirm-text"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!confirmed}
          onClick={onConfirm}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
