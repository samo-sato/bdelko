/**
 * logs.ts (scanner)
 *
 * Writes the results of one scan run into watchdog_log using merge-or-append:
 * a new row is appended only when the state actually changed -
 *   - there is no previous row, or
 *   - status or note differ from the latest row, or
 *   - there is a gap: now - latest.ended_at > interval + gap margin
 *     (the app was down or the run was skipped - visible as a break).
 * Otherwise the latest row is extended in place (ended_at = now, counter + 1).
 *
 * All writes of a run happen in a single transaction.
 */
import type { Config } from '../config.js';
import type { LogsRepo } from '../db/logs.repo.js';
import type { Db } from '../db/connection.js';
import type { WatchdogState } from './states.js';

export interface LogWriteStats {
  appended: number;
  updated: number;
}

export async function writeStates(
  db: Db,
  logs: LogsRepo,
  states: WatchdogState[],
  cfg: Config,
): Promise<LogWriteStats> {
  return db.transaction(async () => {
    let appended = 0;
    let updated = 0;
    for (const s of states) {
      const last = await logs.getLatest(s.watchdogId);
      const gap =
        last !== undefined &&
        s.checkedAt - last.ended_at > cfg.scanIntervalMs + cfg.gapMarginMs;

      if (!last || last.status !== s.status || last.note !== s.note || gap) {
        await logs.insert({
          watchdogId: s.watchdogId,
          status: s.status,
          note: s.note,
          startedAt: s.checkedAt,
          endedAt: s.checkedAt,
        });
        appended++;
      } else {
        await logs.extend(last.id, s.checkedAt);
        updated++;
      }
    }
    return { appended, updated };
  });
}
