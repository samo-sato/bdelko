/**
 * routes/status.ts  (protected)
 *
 * GET /api/status - dashboard payload: for every Watchdog its current status
 * derived from the latest watchdog_log row plus the notification streak
 * state, along with scanner timing (last/next run).
 */
import { Router } from 'express';
import type { Context } from '../context.js';
import { heartbeatUrl } from '../serialize.js';
import { toLocalIsoOrNull } from '../../utils/time.js';

export function statusRoutes(ctx: Context): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const [all, latestLogs, states] = await Promise.all([
      ctx.watchdogs.listAll(),
      ctx.logs.getLatestPerWatchdog(),
      ctx.notifications.listStates(),
    ]);

    const watchdogs = all.map((wd) => {
      const log = latestLogs.get(wd.id);
      const state = states.get(wd.id);
      return {
        id: wd.id,
        name: wd.name,
        mode: wd.mode,
        enabled: wd.enabled,
        notify: wd.notify,
        threshold_minutes: wd.thresholdMinutes,
        url: wd.mode === 'active' ? wd.url : null,
        heartbeat_url: heartbeatUrl(ctx.cfg, wd),
        // Current status: null when the Watchdog was never checked.
        status: log ? (log.status as 0 | 1) : null,
        since: log ? toLocalIsoOrNull(log.started_at) : null,
        note: log ? log.note : null,
        last_checked_at: log ? toLocalIsoOrNull(log.ended_at) : null,
        last_heartbeat_at: toLocalIsoOrNull(wd.lastHeartbeatAt),
        down_since: toLocalIsoOrNull(state?.down_since ?? null),
        down_notified: state ? state.down_notified === 1 : false,
      };
    });

    const info = ctx.scanner.getInfo();
    res.json({
      watchdogs,
      scanner: {
        lastRunAt: toLocalIsoOrNull(info.lastRunAt),
        nextRunAt: toLocalIsoOrNull(info.nextRunAt),
      },
    });
  });

  return router;
}
