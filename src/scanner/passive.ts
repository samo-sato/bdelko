/**
 * passive.ts
 *
 * Freshness check for passive (heartbeat) Watchdogs. A passive Watchdog is ok
 * iff a heartbeat was recorded within the last (scan interval + gap margin).
 * The gap margin (BDELKO_GAP_MARGIN_MS) absorbs cron jitter on the caller
 * side and scan scheduling jitter on our side.
 */
import type { Watchdog } from '../db/watchdogs.repo.js';
import type { CheckResult } from './active.js';

export function checkPassive(
  wd: Watchdog,
  now: number,
  intervalMs: number,
  gapMarginMs: number,
): CheckResult {
  const fresh =
    wd.lastHeartbeatAt !== null && now - wd.lastHeartbeatAt < intervalMs + gapMarginMs;
  return fresh
    ? { status: 1, note: 'Ok. Heartbeat received in given time period.' }
    : { status: 0, note: 'Not ok. No heartbeat received in given time period.' };
}
