/**
 * states.ts
 *
 * Builds one WatchdogState per enabled Watchdog for the current run:
 *   - active Watchdogs: HTTP check (active.ts), all in parallel
 *   - passive Watchdogs: heartbeat freshness (passive.ts), synchronous
 * Every state carries the same checkedAt timestamp (the run start), which
 * keeps gap detection in the log merger consistent.
 */
import type { Config } from '../config.js';
import type { Watchdog } from '../db/watchdogs.repo.js';
import { checkActive, type CheckResult } from './active.js';
import { checkPassive } from './passive.js';

export interface WatchdogState {
  watchdogId: string;
  status: 0 | 1;
  note: string;
  checkedAt: number;
}

export async function buildStates(watchdogs: Watchdog[], cfg: Config): Promise<WatchdogState[]> {
  const now = Date.now();

  const settled = await Promise.allSettled(
    watchdogs.map((wd): Promise<CheckResult> =>
      wd.mode === 'active'
        ? checkActive(wd, cfg)
        : Promise.resolve(checkPassive(wd, now, cfg.scanIntervalMs, cfg.gapMarginMs)),
    ),
  );

  return watchdogs.map((wd, i) => {
    const r = settled[i];
    // Promise.allSettled never rejects; a rejected entry would mean a bug in
    // the check itself. Guard anyway so one broken check cannot kill the run.
    const result: CheckResult =
      r.status === 'fulfilled'
        ? r.value
        : { status: 0, note: 'Error. Internal check failure.' };
    return { watchdogId: wd.id, status: result.status, note: result.note, checkedAt: now };
  });
}
