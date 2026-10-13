/**
 * types.ts
 *
 * Shapes of the bdelko API as the UI consumes them. Timestamps arrive as
 * ISO 8601 strings in server local time (parse via lib/time.ts parseTs).
 */

export type WatchdogMode = 'active' | 'passive';

export interface Watchdog {
  id: string;
  name: string;
  mode: WatchdogMode;
  url: string | null;
  expected_status: string | null;
  enabled: boolean;
  notify: boolean;
  threshold_minutes: number;
  heartbeat_secret: string | null;
  heartbeat_url: string | null;
  last_heartbeat_at: string | null;
  created_at: string;
  updated_at: string;
}

/** One row of the /status dashboard payload. */
export interface StatusItem {
  id: string;
  name: string;
  mode: WatchdogMode;
  enabled: boolean;
  notify: boolean;
  threshold_minutes: number;
  url: string | null;
  heartbeat_url: string | null;
  status: 0 | 1 | null;
  since: string | null;
  note: string | null;
  last_checked_at: string | null;
  last_heartbeat_at: string | null;
  down_since: string | null;
  down_notified: boolean;
}

export interface StatusResponse {
  watchdogs: StatusItem[];
  scanner: { lastRunAt: string | null; nextRunAt: string | null };
}

/** One merged period of identical state (never one row per run). */
export interface LogItem {
  id: number;
  watchdog_id: string;
  watchdog_name: string;
  status: 0 | 1;
  note: string;
  started_at: string;
  ended_at: string;
  counter: number;
  duration_ms: number;
}

export interface NotificationItem {
  id: number;
  watchdog_id: string;
  watchdog_name: string;
  type: 'down' | 'up';
  sent_at: string;
  success: boolean;
  error: string | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface StatsWindow {
  uptimePercent: number | null;
  okMs: number;
  notOkMs: number;
  monitoredMs: number;
  windowMs: number;
  incidents: number;
}

export interface Stats {
  windows: Record<'24h' | '7d' | '30d', StatsWindow>;
}

export interface Health {
  status: string;
  /** App version from package.json (exposed for the About page). */
  version: string;
  time: string;
  uptimeSeconds: number;
  scanner: {
    running: boolean;
    lastRunAt: string | null;
    lastRunDurationMs: number | null;
    runCount: number;
  };
  mail: {
    configured: boolean;
    /** true when BDELKO_NOTIFY_EMAIL is set (address itself is never exposed). */
    recipientSet: boolean;
  };
}

/** Create body; mode-specific rules enforced server-side. */
export interface CreateWatchdogInput {
  name: string;
  mode: WatchdogMode;
  url?: string;
  expected_status?: string;
  enabled?: boolean;
  notify?: boolean;
  threshold_minutes?: number;
}

export interface UpdateWatchdogInput {
  name?: string;
  url?: string;
  expected_status?: string | null;
  enabled?: boolean;
  notify?: boolean;
  threshold_minutes?: number;
}

/**
 * Logs/notifications list params; from/to are sent as epoch ms.
 * status/success accept their string form too (they come from the URL query).
 */
export interface ListParams {
  watchdog?: string;
  status?: 0 | 1 | '0' | '1';
  type?: 'down' | 'up';
  success?: 0 | 1 | '0' | '1';
  from?: number;
  to?: number;
  page?: number;
  limit?: number;
  order?: 'asc' | 'desc';
}
