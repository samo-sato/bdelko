/**
 * active.ts
 *
 * Performs the HTTP check of one active Watchdog using Node's native fetch
 * with an AbortController-based timeout. The response status code is matched
 * against the Watchdog's expected_status spec (see utils/statusMatcher.ts).
 *
 * The note wording is FIXED - the scanner merges consecutive log rows only
 * when status AND note are identical, so any wording change would fragment
 * the monitoring log.
 */
import type { Config } from '../config.js';
import type { Watchdog } from '../db/watchdogs.repo.js';
import { matchesExpectedStatus } from '../utils/statusMatcher.js';

export interface CheckResult {
  status: 0 | 1;
  note: string;
}

/** Run one active HTTP check. Never throws - errors become status 0 + note. */
export async function checkActive(wd: Watchdog, cfg: Config): Promise<CheckResult> {
  const url = wd.url ?? '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.requestTimeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': cfg.userAgent },
    });
    const ok = matchesExpectedStatus(wd.expectedStatus ?? '2xx', res.status);
    return ok
      ? { status: 1, note: `Ok. Endpoint "${url}" responded with status code: ${res.status}` }
      : { status: 0, note: `Not ok. Endpoint "${url}" responded with status code: ${res.status}` };
  } catch (err) {
    return { status: 0, note: `Error. Failed to request "${url}": ${errorReason(err)}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Map a fetch failure to a short reason: the undici error cause code
 * (ENOTFOUND, ECONNREFUSED, ...), "Request timed out" for our abort, or
 * "Unknown error" as the last resort.
 */
function errorReason(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return 'Request timed out';
    }
    const causeCode = (err as { cause?: { code?: unknown } }).cause?.code;
    if (typeof causeCode === 'string' && causeCode !== '') return causeCode;
    const ownCode = (err as { code?: unknown }).code;
    if (typeof ownCode === 'string' && ownCode !== '') return ownCode;
  }
  return 'Unknown error';
}
