/**
 * ThemeButton.tsx - header button cycling Auto -> Light -> Dark.
 * Shows the currently resolved theme via the icon (auto shows a half circle).
 */
import { useSettings } from '../settings/SettingsContext';
import { AutoThemeIcon, MoonIcon, SunIcon } from './icons';

const NEXT = { auto: 'light', light: 'dark', dark: 'auto' } as const;
const LABEL = { auto: 'Auto', light: 'Light', dark: 'Dark' } as const;

export function ThemeButton() {
  const { settings, updateTheme } = useSettings();
  const mode = settings.theme.mode;
  const Icon = mode === 'auto' ? AutoThemeIcon : mode === 'dark' ? MoonIcon : SunIcon;
  return (
    <button
      type="button"
      onClick={() => updateTheme({ mode: NEXT[mode] })}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      aria-label={`Theme: ${LABEL[mode]}. Activate to switch to ${LABEL[NEXT[mode]]}.`}
      title={`Theme: ${LABEL[mode]}`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{LABEL[mode]}</span>
    </button>
  );
}
