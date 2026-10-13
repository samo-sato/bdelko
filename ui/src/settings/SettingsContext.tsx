/**
 * SettingsContext.tsx
 *
 * All user-facing UI settings, persisted in localStorage under the
 * "bdelko." prefix (see lib/storage.ts for the fallback behavior):
 *
 *   bdelko.theme           auto | light | dark   (default auto)
 *   bdelko.autoDarkFrom    HH:mm                 (default 19:00)
 *   bdelko.autoLightFrom   HH:mm                 (default 07:00)
 *   bdelko.timeZone        browser | server      (default browser)
 *   bdelko.refreshMs       0 | 10000 | 30000 | 60000  (default 15000; 0 = Off)
 *
 * The provider also runs the theme scheduler (auto mode re-evaluates every
 * 30 s and on tab visibility changes) and re-applies the theme immediately
 * when any theme setting changes.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { settingsStorage } from '../lib/storage';
import {
  DEFAULT_THEME,
  parseHHmm,
  startThemeScheduler,
  type ResolvedTheme,
  type ThemeSettings,
  resolveTheme,
} from './theme';

export type TimeZoneMode = 'browser' | 'server';

export interface Settings {
  theme: ThemeSettings;
  timeZone: TimeZoneMode;
  /** Auto-refresh interval; 0 = Off. */
  refreshMs: number;
}

const KEYS = {
  theme: 'bdelko.theme',
  autoDarkFrom: 'bdelko.autoDarkFrom',
  autoLightFrom: 'bdelko.autoLightFrom',
  timeZone: 'bdelko.timeZone',
  refreshMs: 'bdelko.refreshMs',
} as const;

const DEFAULT_REFRESH_MS = 15_000;

function loadSettings(): Settings {
  const mode = settingsStorage.get(KEYS.theme);
  const darkFrom = settingsStorage.get(KEYS.autoDarkFrom);
  const lightFrom = settingsStorage.get(KEYS.autoLightFrom);
  const timeZone = settingsStorage.get(KEYS.timeZone);
  const refresh = Number(settingsStorage.get(KEYS.refreshMs));
  return {
    theme: {
      mode: mode === 'light' || mode === 'dark' ? mode : 'auto',
      // Invalid stored times fall back to the defaults (theme.ts validates).
      autoDarkFrom: darkFrom && parseHHmm(darkFrom) !== null ? darkFrom : DEFAULT_THEME.autoDarkFrom,
      autoLightFrom: lightFrom && parseHHmm(lightFrom) !== null ? lightFrom : DEFAULT_THEME.autoLightFrom,
    },
    timeZone: timeZone === 'server' ? 'server' : 'browser',
    refreshMs: Number.isFinite(refresh) && refresh >= 0 && settingsStorage.get(KEYS.refreshMs) !== null
      ? refresh
      : DEFAULT_REFRESH_MS,
  };
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  updateTheme: (patch: Partial<ThemeSettings>) => void;
  /** The theme currently in effect (for the "Currently: ..." line). */
  resolvedTheme: ResolvedTheme;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  // Tick forces a re-render every 30 s so the resolved theme (and the
  // "Currently: ..." line) stay fresh in auto mode.
  const [, setTick] = useState(0);

  // Run the auto-theme scheduler; it applies immediately and on every tick.
  useEffect(() => {
    const stop = startThemeScheduler(() => settings.theme);
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, [settings.theme]);

  // Computed during render (pure function) so it is never stale.
  const resolvedTheme = resolveTheme(new Date(), settings.theme);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.timeZone !== undefined) settingsStorage.set(KEYS.timeZone, patch.timeZone);
      if (patch.refreshMs !== undefined) settingsStorage.set(KEYS.refreshMs, String(patch.refreshMs));
      return next;
    });
  }, []);

  const updateTheme = useCallback((patch: Partial<ThemeSettings>) => {
    setSettings((prev) => {
      const nextTheme = { ...prev.theme, ...patch };
      if (patch.mode !== undefined) settingsStorage.set(KEYS.theme, patch.mode);
      if (patch.autoDarkFrom !== undefined && parseHHmm(patch.autoDarkFrom) !== null) {
        settingsStorage.set(KEYS.autoDarkFrom, patch.autoDarkFrom);
      }
      if (patch.autoLightFrom !== undefined && parseHHmm(patch.autoLightFrom) !== null) {
        settingsStorage.set(KEYS.autoLightFrom, patch.autoLightFrom);
      }
      return { ...prev, theme: nextTheme };
    });
  }, []);

  const value = useMemo(
    () => ({ settings, update, updateTheme, resolvedTheme }),
    [settings, update, updateTheme, resolvedTheme],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}

/** React Query refetchInterval value from settings (false when Off). */
export function useRefreshInterval(): number | false {
  const { settings } = useSettings();
  return settings.refreshMs > 0 ? settings.refreshMs : false;
}
