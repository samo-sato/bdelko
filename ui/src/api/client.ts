/**
 * client.ts
 *
 * Single fetch wrapper for the API. Base is the RELATIVE "./api", so the same
 * build works on localhost and behind any domain/base path without CORS.
 * Every request has a 15 s AbortController timeout.
 *
 * Error model:
 *   - ApiError      - the server answered with the standard error envelope
 *   - NetworkError  - DNS/connection/timeout: "cannot reach the server"
 * A 401 anywhere clears the session through the handler registered by
 * AuthContext (setUnauthorizedHandler). The token is only ever sent in the
 * Authorization header - never in a URL, never logged.
 */
import { getToken } from '../auth/token';

export interface ApiErrorDetail {
  path?: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message = 'Cannot reach the server') {
    super(message);
    this.name = 'NetworkError';
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** AuthContext registers its logout here (avoids a module cycle). */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

export interface ApiFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /** Public endpoints (health, login's auth/check with a candidate token). */
  skipAuth?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuth, headers: extraHeaders, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const headers: Record<string, string> = { ...extraHeaders };
    if (!skipAuth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    if (init.body && !('Content-Type' in headers)) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`./api${path}`, { ...init, headers, signal: controller.signal });

    if (res.status === 401 && !skipAuth) {
      unauthorizedHandler?.();
    }
    if (res.status === 204) return undefined as T;

    const text = await res.text();
    const data: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const envelope = (data as { error?: { code?: string; message?: string; details?: ApiErrorDetail[] } })
        ?.error;
      throw new ApiError(
        res.status,
        envelope?.code ?? 'INTERNAL',
        envelope?.message ?? `Request failed with status ${res.status}`,
        envelope?.details,
      );
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new NetworkError('Cannot reach the server (request timed out)');
    }
    if (err instanceof TypeError) throw new NetworkError(); // fetch network failure
    if (err instanceof SyntaxError) throw new NetworkError('Server returned an invalid response');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Build a query string from list params, skipping empty values. */
export function toQueryString(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
