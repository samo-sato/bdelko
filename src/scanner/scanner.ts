/**
 * scanner.ts
 *
 * The monitoring run loop. A run happens every BDELKO_SCAN_INTERVAL_MS via
 * setInterval, with the first run immediately on startup. An isRunning guard
 * skips ticks that fire while the previous run is still in progress. Any
 * failure inside a run is caught and logged - the loop must never die.
 *
 * One run:
 *   1. connectivity check (optional, DNS) - skip the run when we are offline
 *   2. load enabled Watchdogs
 *   3./4. build states (active HTTP checks in parallel + passive freshness)
 *   5. merge-or-append into watchdog_log (single transaction)
 *   6. threshold notifications (DOWN/UP mails)
 *   7. colored console summary (BDELKO_CONSOLE_RUNS)
 */
import type { Config } from '../config.js';
import type { Db } from '../db/connection.js';
import type { LogsRepo } from '../db/logs.repo.js';
import type { NotificationsRepo } from '../db/notifications.repo.js';
import type { WatchdogsRepo } from '../db/watchdogs.repo.js';
import type { Mailer } from '../mail/mailer.js';
import { logger, runLine } from '../utils/logger.js';
import { toLocalIso } from '../utils/time.js';
import { hasConnectivity } from './connectivity.js';
import { buildStates } from './states.js';
import { writeStates } from './logs.js';
import { processNotifications } from './notifier.js';

export interface ScannerDeps {
  cfg: Config;
  db: Db;
  watchdogs: WatchdogsRepo;
  logs: LogsRepo;
  notifications: NotificationsRepo;
  mailer: Mailer;
}

/** Runtime info exposed via /api/health and /api/status. */
export interface ScannerInfo {
  running: boolean;
  lastRunAt: number | null;
  lastRunDurationMs: number | null;
  runCount: number;
  nextRunAt: number | null;
}

export class Scanner {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private stopped = false;
  private runCount = 0;
  private lastRunAt: number | null = null;
  private lastRunDurationMs: number | null = null;
  private nextRunAt: number | null = null;

  constructor(private readonly deps: ScannerDeps) {}

  /** Start the loop: first run immediately, then every scan interval. */
  start(): void {
    this.stopped = false;
    this.nextRunAt = Date.now();
    void this.tick();
    this.timer = setInterval(() => {
      this.nextRunAt = Date.now() + this.deps.cfg.scanIntervalMs;
      void this.tick();
    }, this.deps.cfg.scanIntervalMs);
    // Do not keep the process alive just because of the scanner timer.
    this.timer.unref?.();
  }

  /** Stop scheduling new runs (graceful shutdown). */
  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getInfo(): ScannerInfo {
    return {
      running: this.isRunning,
      lastRunAt: this.lastRunAt,
      lastRunDurationMs: this.lastRunDurationMs,
      runCount: this.runCount,
      nextRunAt: this.nextRunAt,
    };
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    if (this.isRunning) {
      logger.warn('Previous scan run still in progress; skipping this tick');
      return;
    }
    this.isRunning = true;
    const startedAt = Date.now();
    this.runCount++;
    const runNo = this.runCount;
    try {
      await this.runOnce(runNo, startedAt);
    } catch (err) {
      // The loop must survive any failure; log and continue next tick.
      logger.error(`Scan run #${runNo} failed`, {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.lastRunAt = startedAt;
      this.lastRunDurationMs = Date.now() - startedAt;
      this.isRunning = false;
    }
  }

  private async runOnce(runNo: number, startedAt: number): Promise<void> {
    const { cfg, watchdogs, logs, notifications, mailer, db } = this.deps;
    runLine(`Run #${runNo} starts (${toLocalIso(startedAt)})`, 'cyan');

    // 1. Connectivity: skip the run when this host is offline.
    if (cfg.connectivityCheck) {
      const online = await hasConnectivity();
      if (!online) {
        logger.warn(`Run #${runNo}: no internet connectivity, skipping run`);
        runLine(`  No internet connectivity - run skipped`, 'yellow');
        return;
      }
    }

    // 2. Load enabled Watchdogs.
    const enabled = await watchdogs.listEnabled();
    const activeCount = enabled.filter((w) => w.mode === 'active').length;
    runLine(
      `  Loaded ${enabled.length} enabled watchdog(s) (${activeCount} active, ${enabled.length - activeCount} passive)`,
    );

    if (enabled.length === 0) {
      runLine(`  Nothing to monitor - run finished`, 'gray');
      return;
    }

    // 3./4. Build states (active in parallel, passive synchronous).
    const states = await buildStates(enabled, cfg);
    const okCount = states.filter((s) => s.status === 1).length;
    const notOkCount = states.length - okCount;
    runLine(`  Checks: ${okCount} ok, ${notOkCount} not ok`, notOkCount > 0 ? 'yellow' : 'green');
    for (const s of states.filter((s) => s.status === 0)) {
      const wd = enabled.find((w) => w.id === s.watchdogId);
      runLine(`    - ${wd?.name ?? s.watchdogId}: ${s.note}`, 'red');
    }

    // 5. Merge-or-append into watchdog_log (single transaction per run).
    const logStats = await writeStates(db, logs, states, cfg);
    runLine(`  Logs: ${logStats.appended} appended, ${logStats.updated} updated`);

    // 6. DOWN/UP notifications (skipped entirely when mail is unconfigured).
    const notifyStats = await processNotifications(
      notifications,
      mailer,
      states,
      new Map(enabled.map((w) => [w.id, w])),
      cfg,
    );
    if (mailer.isConfigured) {
      runLine(
        `  Notifications: ${notifyStats.sent} sent, ${notifyStats.failed} failed`,
        notifyStats.failed > 0 ? 'red' : undefined,
      );
    }

    // 7. Summary line.
    runLine(`Run #${runNo} finished in ${Date.now() - startedAt} ms`, 'cyan');
  }
}
