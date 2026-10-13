/**
 * watchdogs.repo.ts
 *
 * Data access for the `watchdog` table. Converts between snake_case DB rows
 * (integers for booleans, epoch ms for time) and the camelCase domain type.
 */
import type { Db } from './connection.js';
import { generateWatchdogId } from '../utils/ids.js';

export type WatchdogMode = 'active' | 'passive';

/** Raw row shape as stored in SQLite. */
export interface WatchdogRow {
  id: string;
  name: string;
  mode: WatchdogMode;
  url: string | null;
  expected_status: string | null;
  heartbeat_secret: string | null;
  last_heartbeat_at: number | null;
  enabled: number;
  notify: number;
  threshold_minutes: number;
  created_at: number;
  updated_at: number;
}

/** Domain type used across the app. */
export interface Watchdog {
  id: string;
  name: string;
  mode: WatchdogMode;
  url: string | null;
  expectedStatus: string | null;
  heartbeatSecret: string | null;
  lastHeartbeatAt: number | null;
  enabled: boolean;
  notify: boolean;
  thresholdMinutes: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWatchdogData {
  name: string;
  mode: WatchdogMode;
  url: string | null;
  expectedStatus: string | null;
  heartbeatSecret: string | null;
  enabled: boolean;
  notify: boolean;
  thresholdMinutes: number;
}

/** Fields that may change via PATCH (mode is immutable). */
export interface UpdateWatchdogData {
  name?: string;
  url?: string | null;
  expectedStatus?: string | null;
  enabled?: boolean;
  notify?: boolean;
  thresholdMinutes?: number;
}

export function rowToWatchdog(row: WatchdogRow): Watchdog {
  return {
    id: row.id,
    name: row.name,
    mode: row.mode,
    url: row.url,
    expectedStatus: row.expected_status,
    heartbeatSecret: row.heartbeat_secret,
    lastHeartbeatAt: row.last_heartbeat_at,
    enabled: row.enabled === 1,
    notify: row.notify === 1,
    thresholdMinutes: row.threshold_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class WatchdogsRepo {
  constructor(private readonly db: Db) {}

  /**
   * Insert a new Watchdog with a freshly generated 11-char ID.
   * Retries a few times in the extremely unlikely case of an ID collision.
   */
  async create(data: CreateWatchdogData): Promise<Watchdog> {
    const now = Date.now();
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = generateWatchdogId();
      try {
        await this.db.run(
          `INSERT INTO watchdog
             (id, name, mode, url, expected_status, heartbeat_secret, last_heartbeat_at,
              enabled, notify, threshold_minutes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
          [
            id,
            data.name,
            data.mode,
            data.url,
            data.expectedStatus,
            data.heartbeatSecret,
            data.enabled ? 1 : 0,
            data.notify ? 1 : 0,
            data.thresholdMinutes,
            now,
            now,
          ],
        );
        return (await this.findById(id))!;
      } catch (err) {
        lastError = err;
        // Retry only on primary key (id) collision; anything else is fatal.
        if (!(err instanceof Error) || !err.message.includes('watchdog.id')) throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to allocate watchdog id');
  }

  async findById(id: string): Promise<Watchdog | undefined> {
    const row = await this.db.get<WatchdogRow>('SELECT * FROM watchdog WHERE id = ?', [id]);
    return row ? rowToWatchdog(row) : undefined;
  }

  /** Case-insensitive name lookup (name column is COLLATE NOCASE). */
  async findByName(name: string): Promise<Watchdog | undefined> {
    const row = await this.db.get<WatchdogRow>('SELECT * FROM watchdog WHERE name = ?', [name]);
    return row ? rowToWatchdog(row) : undefined;
  }

  async listAll(): Promise<Watchdog[]> {
    const rows = await this.db.all<WatchdogRow>('SELECT * FROM watchdog ORDER BY created_at ASC, id ASC');
    return rows.map(rowToWatchdog);
  }

  async listEnabled(): Promise<Watchdog[]> {
    const rows = await this.db.all<WatchdogRow>('SELECT * FROM watchdog WHERE enabled = 1');
    return rows.map(rowToWatchdog);
  }

  /** Partial update; always bumps updated_at. Returns the updated Watchdog. */
  async update(id: string, data: UpdateWatchdogData): Promise<Watchdog | undefined> {
    const sets: string[] = [];
    const params: Array<string | number | null> = [];

    if (data.name !== undefined) {
      sets.push('name = ?');
      params.push(data.name);
    }
    if (data.url !== undefined) {
      sets.push('url = ?');
      params.push(data.url);
    }
    if (data.expectedStatus !== undefined) {
      sets.push('expected_status = ?');
      params.push(data.expectedStatus);
    }
    if (data.enabled !== undefined) {
      sets.push('enabled = ?');
      params.push(data.enabled ? 1 : 0);
    }
    if (data.notify !== undefined) {
      sets.push('notify = ?');
      params.push(data.notify ? 1 : 0);
    }
    if (data.thresholdMinutes !== undefined) {
      sets.push('threshold_minutes = ?');
      params.push(data.thresholdMinutes);
    }

    sets.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    await this.db.run(`UPDATE watchdog SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  /** DELETE; ON DELETE CASCADE removes its logs and notification rows. */
  async remove(id: string): Promise<boolean> {
    const res = await this.db.run('DELETE FROM watchdog WHERE id = ?', [id]);
    return res.changes > 0;
  }

  /** Persist a heartbeat hit (passive Watchdogs). */
  async touchHeartbeat(id: string, atMs: number): Promise<void> {
    await this.db.run('UPDATE watchdog SET last_heartbeat_at = ? WHERE id = ?', [atMs, id]);
  }

  /** Replace the heartbeat secret (regenerate-secret endpoint). */
  async setHeartbeatSecret(id: string, secret: string): Promise<void> {
    await this.db.run('UPDATE watchdog SET heartbeat_secret = ?, updated_at = ? WHERE id = ?', [
      secret,
      Date.now(),
      id,
    ]);
  }
}
