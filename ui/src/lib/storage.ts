/**
 * storage.ts
 *
 * Safe wrappers around localStorage/sessionStorage. Every UI setting lives
 * under the "bdelko." key prefix. Storage can be unavailable (private mode,
 * disabled cookies); in that case we silently fall back to a memory map so
 * the UI keeps working for the session.
 */

const memoryFallback = new Map<string, string>();

function safeGet(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return memoryFallback.get(`${store === sessionStorage ? 's' : 'l'}:${key}`) ?? null;
  }
}

function safeSet(store: Storage, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    memoryFallback.set(`${store === sessionStorage ? 's' : 'l'}:${key}`, value);
  }
}

function safeRemove(store: Storage, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    memoryFallback.delete(`${store === sessionStorage ? 's' : 'l'}:${key}`);
  }
}

/** Persistent UI setting (localStorage). */
export const settingsStorage = {
  get: (key: string) => safeGet(localStorage, key),
  set: (key: string, value: string) => safeSet(localStorage, key, value),
  remove: (key: string) => safeRemove(localStorage, key),
};

/** Session-only value (sessionStorage). */
export const sessionStore = {
  get: (key: string) => safeGet(sessionStorage, key),
  set: (key: string, value: string) => safeSet(sessionStorage, key, value),
  remove: (key: string) => safeRemove(sessionStorage, key),
};
