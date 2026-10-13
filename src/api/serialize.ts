/**
 * serialize.ts
 *
 * Converts internal domain objects into their public JSON shapes:
 * booleans as real JSON booleans, epoch ms as local-time ISO 8601 strings,
 * and nulls for non-applicable fields (e.g. url on a passive Watchdog).
 */
import type { Config } from '../config.js';
import type { LogRow } from '../db/logs.repo.js';
import type { NotificationLogRow } from '../db/notifications.repo.js';
import type { Watchdog } from '../db/watchdogs.repo.js';
import { toLocalIso, toLocalIsoOrNull } from '../utils/time.js';

/** Build the public heartbeat URL of a passive Watchdog. */
export function heartbeatUrl(cfg: Config, wd: Watchdog): string | null {
  if (wd.mode !== 'passive' || !wd.heartbeatSecret) return null;
  return `${cfg.publicBaseUrl}/api/heartbeat/${wd.id}/${wd.heartbeatSecret}`;
}

/** The standard Watchdog JSON shape used by all API responses. */
export function serializeWatchdog(cfg: Config, wd: Watchdog) {
  return {
    id: wd.id,
    name: wd.name,
    mode: wd.mode,
    url: wd.mode === 'active' ? wd.url : null,
    expected_status: wd.mode === 'active' ? wd.expectedStatus : null,
    enabled: wd.enabled,
    notify: wd.notify,
    threshold_minutes: wd.thresholdMinutes,
    heartbeat_secret: wd.mode === 'passive' ? wd.heartbeatSecret : null,
    heartbeat_url: heartbeatUrl(cfg, wd),
    last_heartbeat_at: toLocalIsoOrNull(wd.lastHeartbeatAt),
    created_at: toLocalIso(wd.createdAt),
    updated_at: toLocalIso(wd.updatedAt),
  };
}

/** One item of the /api/logs response. */
export function serializeLogItem(row: LogRow & { watchdog_name: string }) {
  return {
    id: row.id,
    watchdog_id: row.watchdog_id,
    watchdog_name: row.watchdog_name,
    status: row.status,
    note: row.note,
    started_at: toLocalIso(row.started_at),
    ended_at: toLocalIso(row.ended_at),
    counter: row.counter,
    duration_ms: row.ended_at - row.started_at,
  };
}

/** One item of the /api/notifications response. */
export function serializeNotificationItem(row: NotificationLogRow & { watchdog_name: string }) {
  return {
    id: row.id,
    watchdog_id: row.watchdog_id,
    watchdog_name: row.watchdog_name,
    type: row.type,
    sent_at: toLocalIso(row.sent_at),
    success: row.success === 1,
    error: row.error,
  };
}
