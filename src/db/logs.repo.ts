/**
 * logs.repo.ts
 *
 * Data access for the `watchdog_log` table - the monitoring log.
 * One row represents a continuous period of identical state (same status +
 * same note, no gap); the scanner either extends the latest row
 * (ended_at/counter) or appends a new one. See scanner/logs.ts.
 */
import type { Db, SqlValue } from './connection.js';

export interface LogRow {
  id: number;
  watchdog_id: string;
  status: number; // 1 ok, 0 not ok
  note: string;
  started_at: number;
  ended_at: number;
  counter: number;
}

export interface LogQueryFilter {
  watchdogId?: string;
  status?: 0 | 1;
  /** Overlap filter: rows with ended_at >= fromMs. */
  fromMs?: number;
  /** Overlap filter: rows with started_at <= toMs. */
  toMs?: number;
  page: number;
  limit: number;
  order: 'asc' | 'desc';
}

export interface LogQueryResult {
  items: Array<LogRow & { watchdog_name: string }>;
  total: number;
}

export class LogsRepo {
  constructor(private readonly db: Db) {}

  /** The most recent log row of a Watchdog (by ended_at), if any. */
  async getLatest(watchdogId: string): Promise<LogRow | undefined> {
    return this.db.get<LogRow>(
      'SELECT * FROM watchdog_log WHERE watchdog_id = ? ORDER BY ended_at DESC, id DESC LIMIT 1',
      [watchdogId],
    );
  }

  /** The most recent log row per watchdog, for a set of watchdogs (dashboard). */
  async getLatestPerWatchdog(): Promise<Map<string, LogRow>> {
    const rows = await this.db.all<LogRow>(
      `SELECT wl.*
       FROM watchdog_log wl
       JOIN (
         SELECT watchdog_id, MAX(ended_at) AS max_ended
         FROM watchdog_log GROUP BY watchdog_id
       ) latest ON latest.watchdog_id = wl.watchdog_id AND latest.max_ended = wl.ended_at
       GROUP BY wl.watchdog_id`,
    );
    return new Map(rows.map((r) => [r.watchdog_id, r]));
  }

  async insert(row: {
    watchdogId: string;
    status: 0 | 1;
    note: string;
    startedAt: number;
    endedAt: number;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO watchdog_log (watchdog_id, status, note, started_at, ended_at, counter)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [row.watchdogId, row.status, row.note, row.startedAt, row.endedAt],
    );
  }

  /** Extend an existing period: move ended_at forward and bump the run counter. */
  async extend(id: number, endedAt: number): Promise<void> {
    await this.db.run('UPDATE watchdog_log SET ended_at = ?, counter = counter + 1 WHERE id = ?', [
      endedAt,
      id,
    ]);
  }

  /** Paginated query with optional overlap filter on [started_at, ended_at]. */
  async query(filter: LogQueryFilter): Promise<LogQueryResult> {
    const where: string[] = [];
    const params: SqlValue[] = [];

    if (filter.watchdogId !== undefined) {
      where.push('wl.watchdog_id = ?');
      params.push(filter.watchdogId);
    }
    if (filter.status !== undefined) {
      where.push('wl.status = ?');
      params.push(filter.status);
    }
    if (filter.fromMs !== undefined) {
      where.push('wl.ended_at >= ?');
      params.push(filter.fromMs);
    }
    if (filter.toMs !== undefined) {
      where.push('wl.started_at <= ?');
      params.push(filter.toMs);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const dir = filter.order === 'asc' ? 'ASC' : 'DESC';
    const offset = (filter.page - 1) * filter.limit;

    const totalRow = await this.db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM watchdog_log wl ${whereSql}`,
      params,
    );
    const items = await this.db.all<LogRow & { watchdog_name: string }>(
      `SELECT wl.*, w.name AS watchdog_name
       FROM watchdog_log wl
       JOIN watchdog w ON w.id = wl.watchdog_id
       ${whereSql}
       ORDER BY wl.started_at ${dir}, wl.id ${dir}
       LIMIT ? OFFSET ?`,
      [...params, filter.limit, offset],
    );
    return { items, total: totalRow?.n ?? 0 };
  }

  /**
   * All log rows of one Watchdog overlapping [fromMs, toMs].
   * A row's coverage extends to ended_at + intervalMs (the next expected run),
   * which the caller needs for uptime statistics.
   */
  async listOverlapping(watchdogId: string, fromMs: number, toMs: number, intervalMs: number): Promise<LogRow[]> {
    return this.db.all<LogRow>(
      `SELECT * FROM watchdog_log
       WHERE watchdog_id = ? AND started_at < ? AND (ended_at + ?) > ?
       ORDER BY started_at ASC, id ASC`,
      [watchdogId, toMs, intervalMs, fromMs],
    );
  }
}
