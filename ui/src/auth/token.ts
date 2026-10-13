/**
 * token.ts
 *
 * API token storage. Session-only by default (sessionStorage); persisted in
 * localStorage when the user ticks "Remember on this device" at login.
 * The token is never put in a URL and never logged.
 */
import { sessionStore, settingsStorage } from '../lib/storage';

const KEY = 'bdelko.apiToken';

export function getToken(): string | null {
  return sessionStore.get(KEY) ?? settingsStorage.get(KEY);
}

export function setToken(token: string, remember: boolean): void {
  clearToken();
  if (remember) settingsStorage.set(KEY, token);
  else sessionStore.set(KEY, token);
}

export function clearToken(): void {
  sessionStore.remove(KEY);
  settingsStorage.remove(KEY);
}
