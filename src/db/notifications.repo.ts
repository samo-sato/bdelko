/**
 * notifications.repo.ts
 *
 * Data access for notification persistence:
 *  - notification_state: one row per Watchdog tracking the current downtime
 *    streak (down_since) and whether the DOWN mail was already sent
 *    (down_notified). Persisted so thresholds survive restarts.
 *  - notification_log: history of every attempted DOWN/UP email.
 */
import type { Db, SqlValue } from './connection.js';

export interface NotificationStateRow {
  watchdog_id: string;
  down_since: number | null;
  down_notified: number; // 0 | 1
}

export type NotificationType = 'down' | 'up';

export interface NotificationLogRow {
  id: number;
  watchdog_id: string;
  type: NotificationType;
  sent_at: number;
  success: number; // 0 | 1
  error: string | null;
}

export interface NotificationLogFilter {
  watchdogId?: string;
  type?: NotificationType;
  success?: 0 | 1;
  /** Range filter on sent_at. */
  fromMs?: number;
  /** Range filter on sent_at. */
  toMs?: number;
  page: number;
  limit: number;
  order: 'asc' | 'desc';
}

export class NotificationsRepo {
  constructor(private readonly db: Db) {}

  async getState(watchdogId: string): Promise<NotificationStateRow | undefined> {
    return this.db.get<NotificationStateRow>(
      'SELECT * FROM notification_state WHERE watchdog_id = ?',
      [watchdogId],
    );
  }

  async listStates(): Promise<Map<string, NotificationStateRow>> {
    const rows = await this.db.all<NotificationStateRow>('SELECT * FROM notification_state');
    return new Map(rows.map((r) => [r.watchdog_id, r]));
  }

  /** Mark the beginning of a downtime streak (keeps down_notified as-is). */
  async setDownSince(watchdogId: string, downSinceMs: number): Promise<void> {
    await this.db.run(
      `INSERT INTO notification_state (watchdog_id, down_since, down_notified)
       VALUES (?, ?, 0)
       ON CONFLICT(watchdog_id) DO UPDATE SET down_since = excluded.down_since`,
      [watchdogId, downSinceMs],
    );
  }

  /** Remember that the DOWN mail for the current streak was sent. */
  async markDownNotified(watchdogId: string): Promise<void> {
    await this.db.run(
      `INSERT INTO notification_state (watchdog_id, down_since, down_notified)
       VALUES (?, NULL, 1)
       ON CONFLICT(watchdog_id) DO UPDATE SET down_notified = 1`,
      [watchdogId],
    );
  }

  /** Clear the streak: Watchdog is ok again (or was disabled / notify off). */
  async resetState(watchdogId: string): Promise<void> {
    await this.db.run(
      `INSERT INTO notification_state (watchdog_id, down_since, down_notified)
       VALUES (?, NULL, 0)
       ON CONFLICT(watchdog_id) DO UPDATE SET down_since = NULL, down_notified = 0`,
      [watchdogId],
    );
  }

  /** Remove the state row entirely (Watchdog deleted or disabled). */
  async deleteState(watchdogId: string): Promise<void> {
    await this.db.run('DELETE FROM notification_state WHERE watchdog_id = ?', [watchdogId]);
  }

  /** Housekeeping: drop state rows of Watchdogs that are gone or disabled. */
  async deleteStatesForDisabledOrMissing(): Promise<number> {
    const res = await this.db.run(
      `DELETE FROM notification_state
       WHERE watchdog_id NOT IN (SELECT id FROM watchdog WHERE enabled = 1)`,
    );
    return res.changes;
  }

  /** Record one attempted notification email (success or failure). */
  async insertNotificationLog(entry: {
    watchdogId: string;
    type: NotificationType;
    sentAt: number;
    success: boolean;
    error: string | null;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO notification_log (watchdog_id, type, sent_at, success, error)
       VALUES (?, ?, ?, ?, ?)`,
      [entry.watchdogId, entry.type, entry.sentAt, entry.success ? 1 : 0, entry.error],
    );
  }

  /** Paginated notification history (joins in the Watchdog name). */
  async queryNotificationLog(
    filter: NotificationLogFilter,
  ): Promise<{ items: Array<NotificationLogRow & { watchdog_name: string }>; total: number }> {
    const where: string[] = [];
    const params: SqlValue[] = [];

    if (filter.watchdogId !== undefined) {
      where.push('nl.watchdog_id = ?');
      params.push(filter.watchdogId);
    }
    if (filter.type !== undefined) {
      where.push('nl.type = ?');
      params.push(filter.type);
    }
    if (filter.success !== undefined) {
      where.push('nl.success = ?');
      params.push(filter.success);
    }
    if (filter.fromMs !== undefined) {
      where.push('nl.sent_at >= ?');
      params.push(filter.fromMs);
    }
    if (filter.toMs !== undefined) {
      where.push('nl.sent_at <= ?');
      params.push(filter.toMs);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const dir = filter.order === 'asc' ? 'ASC' : 'DESC';
    const offset = (filter.page - 1) * filter.limit;

    const totalRow = await this.db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM notification_log nl ${whereSql}`,
      params,
    );
    const items = await this.db.all<NotificationLogRow & { watchdog_name: string }>(
      `SELECT nl.*, w.name AS watchdog_name
       FROM notification_log nl
       JOIN watchdog w ON w.id = nl.watchdog_id
       ${whereSql}
       ORDER BY nl.sent_at ${dir}, nl.id ${dir}
       LIMIT ? OFFSET ?`,
      [...params, filter.limit, offset],
    );
    return { items, total: totalRow?.n ?? 0 };
  }
}
