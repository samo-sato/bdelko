/**
 * routes/heartbeat.ts  (PUBLIC - no auth)
 *
 * Passive "snooze" endpoint: GET|POST|HEAD /api/heartbeat/:id/:secret
 * records last_heartbeat_at = now for the Watchdog. The secret is compared
 * timing-safe; unknown ids and wrong secrets both get the same 404 so the
 * endpoint does not reveal valid Watchdog ids. Disabled Watchdogs still
 * record heartbeats (DECISION) - their state is simply not evaluated.
 * Responses are text/plain ("OK" / "Not found") with Cache-Control: no-store.
 */
import { timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Context } from '../context.js';

export function heartbeatRoutes(ctx: Context): Router {
  const router = Router();

  const handler = async (req: Request, res: Response): Promise<void> => {
    // Route params are always plain strings here (no wildcards in this route).
    const id = String(req.params.id);
    const secret = String(req.params.secret);
    const wd = await ctx.watchdogs.findById(id);

    const notFound = (): void => {
      res.status(404).set('Cache-Control', 'no-store').type('text/plain').send('Not found');
    };

    if (!wd || wd.mode !== 'passive' || !wd.heartbeatSecret) {
      notFound();
      return;
    }
    const provided = Buffer.from(secret, 'utf8');
    const expected = Buffer.from(wd.heartbeatSecret, 'utf8');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      notFound();
      return;
    }

    await ctx.watchdogs.touchHeartbeat(wd.id, Date.now());
    res.status(200).set('Cache-Control', 'no-store').type('text/plain').send('OK');
  };

  router
    .route('/heartbeat/:id/:secret')
    .get(handler)
    .post(handler)
    .head(handler);

  return router;
}
