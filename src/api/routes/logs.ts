/**
 * routes/logs.ts  (protected)
 *
 * GET /api/logs - paginated monitoring log. Filters: watchdog (id), status,
 * from/to (ISO or epoch ms, matched by overlap with [started_at, ended_at]),
 * page/limit (max 500), order (desc default).
 */
import { Router } from 'express';
import type { Context } from '../context.js';
import { serializeLogItem } from '../serialize.js';
import { parseQueryTime } from '../validation.js';

export function logsRoutes(ctx: Context): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = ctx.schemas.logsQuery.parse(req.query);
    const fromMs = parseQueryTime(q.from, 'from');
    const toMs = parseQueryTime(q.to, 'to');

    const result = await ctx.logs.query({
      watchdogId: q.watchdog,
      status: q.status,
      fromMs,
      toMs,
      page: q.page,
      limit: q.limit,
      order: q.order,
    });

    res.json({
      items: result.items.map(serializeLogItem),
      page: q.page,
      limit: q.limit,
      total: result.total,
    });
  });

  return router;
}
