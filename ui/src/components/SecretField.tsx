/**
 * SecretField.tsx - shows a secret masked by default with a reveal toggle;
 * the adjacent CopyButton always copies the real value.
 */
import { useState } from 'react';
import { CopyButton } from './CopyButton';
import { EyeIcon, EyeOffIcon } from './icons';

export function SecretField({ value, label }: { value: string; label?: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>}
      <code className="rounded bg-slate-100 px-2 py-1 font-mono text-xs break-all dark:bg-slate-800">
        {revealed ? value : '••••••••••••••••••••••••'}
      </code>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="rounded-md border border-slate-300 p-1 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label={revealed ? 'Hide secret' : 'Reveal secret'}
        aria-pressed={revealed}
      >
        {revealed ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
      <CopyButton text={value} />
    </div>
  );
}
