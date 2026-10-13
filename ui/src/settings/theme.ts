/**
 * theme.ts
 *
 * Light / Dark / Auto theme. Auto switches by the BROWSER's local clock (the
 * OS dark-mode preference is deliberately ignored): dark from `autoDarkFrom`
 * (inclusive) until `autoLightFrom` (exclusive), correctly wrapping past
 * midnight. `resolveTheme` is a pure function (unit-tested).
 *
 * The inline script in index.html mirrors resolveTheme/applyTheme to set the
 * class before first paint - keep them in sync.
 */

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeSettings {
  mode: ThemeMode;
  /** HH:mm - dark starts here (inclusive). */
  autoDarkFrom: string;
  /** HH:mm - light resumes here (exclusive). */
  autoLightFrom: string;
}

export const DEFAULT_THEME: ThemeSettings = {
  mode: 'auto',
  autoDarkFrom: '19:00',
  autoLightFrom: '07:00',
};

/** Parse "HH:mm" to minutes since midnight; null when invalid. */
export function parseHHmm(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function minutesOrDefault(value: string, fallback: string): number {
  return parseHHmm(value) ?? parseHHmm(fallback)!;
}

/** Pure resolution of the effective theme for a given moment. */
export function resolveTheme(now: Date, settings: ThemeSettings): ResolvedTheme {
  if (settings.mode === 'dark') return 'dark';
  if (settings.mode === 'light') return 'light';

  const darkFrom = minutesOrDefault(settings.autoDarkFrom, DEFAULT_THEME.autoDarkFrom);
  const lightFrom = minutesOrDefault(settings.autoLightFrom, DEFAULT_THEME.autoLightFrom);
  if (darkFrom === lightFrom) return 'light'; // degenerate window: stay light

  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (darkFrom < lightFrom) {
    // Dark window inside one day, e.g. 08:00-17:00.
    return nowMin >= darkFrom && nowMin < lightFrom ? 'dark' : 'light';
  }
  // Window wraps past midnight, e.g. 19:00-07:00.
  return nowMin >= darkFrom || nowMin < lightFrom ? 'dark' : 'light';
}

/** Toggle the `dark` class on <html> and set color-scheme accordingly. */
export function applyTheme(resolved: ResolvedTheme): void {
  const el = document.documentElement;
  el.classList.toggle('dark', resolved === 'dark');
  el.style.colorScheme = resolved;
}

/**
 * Keep the theme applied in auto mode: re-evaluate every 30 s, whenever the
 * tab becomes visible, and return a stop function. Manual modes just apply
 * once (changes re-run this through the settings effect).
 */
export function startThemeScheduler(getSettings: () => ThemeSettings): () => void {
  const apply = () => applyTheme(resolveTheme(new Date(), getSettings()));
  apply();
  const timer = setInterval(apply, 30_000);
  const onVisibility = () => {
    if (!document.hidden) apply();
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
