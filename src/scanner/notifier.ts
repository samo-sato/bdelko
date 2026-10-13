/**
 * notifier.ts
 *
 * Threshold-based DOWN/UP email notifications driven by the persisted
 * notification_state table (so thresholds survive restarts):
 *
 *   status 0, no streak yet            -> remember down_since
 *   status 0, streak >= threshold      -> send DOWN mail once (down_notified=1)
 *   status 1, DOWN was notified        -> send UP mail (with total downtime),
 *                                         then reset the streak
 *   status 1, DOWN was never notified  -> reset the streak silently (blip)
 *
 * A threshold of 0 minutes means "mail immediately on the first failure".
 * Every send attempt (ok or failed) is written to notification_log; mail
 * failures are logged via winston and never thrown. When the DOWN send fails,
 * down_notified stays 0 so the next run retries.
 *
 * The whole step is skipped when mail is not configured.
 */
import type { Config } from '../config.js';
import type { NotificationsRepo } from '../db/notifications.repo.js';
import type { Watchdog } from '../db/watchdogs.repo.js';
import type { Mailer } from '../mail/mailer.js';
import { buildDownMail, buildUpMail } from '../mail/templates.js';
import { logger } from '../utils/logger.js';
import type { WatchdogState } from './states.js';

export interface NotifyStats {
  sent: number;
  failed: number;
}

export async function processNotifications(
  notifications: NotificationsRepo,
  mailer: Mailer,
  states: WatchdogState[],
  watchdogsById: Map<string, Watchdog>,
  cfg: Config,
): Promise<NotifyStats> {
  const stats: NotifyStats = { sent: 0, failed: 0 };
  if (!mailer.isConfigured) return stats;

  // Housekeeping: drop streak state of Watchdogs that were disabled/deleted.
  const removed = await notifications.deleteStatesForDisabledOrMissing();
  if (removed > 0) {
    logger.debug(`Removed ${removed} stale notification_state row(s)`);
  }

  for (const s of states) {
    const wd = watchdogsById.get(s.watchdogId);
    if (!wd || !wd.notify) continue;

    const state = await notifications.getState(s.watchdogId);
    let downSince = state?.down_since ?? null;
    const downNotified = state?.down_notified === 1;

    if (s.status === 0) {
      if (downSince === null) {
        // First not-ok run of a new streak: remember when it began, then fall
        // through to the threshold check so threshold 0 mails immediately.
        await notifications.setDownSince(s.watchdogId, s.checkedAt);
        downSince = s.checkedAt;
      }
      const downForMs = s.checkedAt - downSince;
      if (!downNotified && downForMs >= wd.thresholdMinutes * 60_000) {
        const mail = buildDownMail(wd, {
          downSince,
          thresholdMinutes: wd.thresholdMinutes,
          note: s.note,
        });
        const res = await mailer.sendMail(mail.subject, mail.text);
        await notifications.insertNotificationLog({
          watchdogId: s.watchdogId,
          type: 'down',
          sentAt: Date.now(),
          success: res.success,
          error: res.error ?? null,
        });
        if (res.success) {
          stats.sent++;
          await notifications.markDownNotified(s.watchdogId);
          logger.info(`DOWN notification sent for "${wd.name}"`);
        } else {
          stats.failed++;
          // down_notified stays 0 -> retried on the next run.
          logger.error(`DOWN notification failed for "${wd.name}"`, { error: res.error });
        }
      }
    } else {
      // status ok
      if (downNotified && downSince !== null) {
        const mail = buildUpMail(wd, { downSince, upAt: s.checkedAt, note: s.note });
        const res = await mailer.sendMail(mail.subject, mail.text);
        await notifications.insertNotificationLog({
          watchdogId: s.watchdogId,
          type: 'up',
          sentAt: Date.now(),
          success: res.success,
          error: res.error ?? null,
        });
        if (res.success) {
          stats.sent++;
          await notifications.resetState(s.watchdogId);
          logger.info(`UP notification sent for "${wd.name}"`);
        } else {
          stats.failed++;
          // Streak state kept -> UP mail retried on the next run.
          logger.error(`UP notification failed for "${wd.name}"`, { error: res.error });
        }
      } else if (downSince !== null) {
        // Short blip below the threshold: reset silently, no mail.
        await notifications.resetState(s.watchdogId);
      }
    }
  }
  return stats;
}
