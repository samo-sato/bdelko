/**
 * routes/notifications.ts  (protected)
 *
 * GET /api/notifications - history of attempted DOWN/UP emails from
 * notification_log (both sent and failed attempts). Filters: watchdog (id),
 * type, success, from/to (ISO or epoch ms, range filter on sent_at),
 * page/limit (max 500), order (desc default).
 */
import { Router } from 'express';
import type { Context } from '../context.js';
import { serializeNotificationItem } from '../serialize.js';
import { parseQueryTime } from '../validation.js';

export function notificationsRoutes(ctx: Context): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = ctx.schemas.notificationsQuery.parse(req.query);

    const result = await ctx.notifications.queryNotificationLog({
      watchdogId: q.watchdog,
      type: q.type,
      success: q.success,
      fromMs: parseQueryTime(q.from, 'from'),
      toMs: parseQueryTime(q.to, 'to'),
      page: q.page,
      limit: q.limit,
      order: q.order,
    });

    res.json({
      items: result.items.map(serializeNotificationItem),
      page: q.page,
      limit: q.limit,
      total: result.total,
    });
  });

  return router;
}
