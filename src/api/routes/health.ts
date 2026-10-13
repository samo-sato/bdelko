/**
 * routes/health.ts  (PUBLIC - no auth)
 *
 * GET /api/health - liveness/readiness payload for load balancers and
 * uptime tools: server time, process uptime, scanner and mail status.
 */
import { Router } from 'express';
import type { Context } from '../context.js';
import { toLocalIso, toLocalIsoOrNull } from '../../utils/time.js';
import { VERSION } from '../../utils/version.js';

export function healthRoutes(ctx: Context): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const info = ctx.scanner.getInfo();
    res.json({
      status: 'ok',
      version: VERSION,
      time: toLocalIso(Date.now()),
      uptimeSeconds: Math.floor(process.uptime()),
      scanner: {
        running: info.running,
        lastRunAt: toLocalIsoOrNull(info.lastRunAt),
        lastRunDurationMs: info.lastRunDurationMs,
        runCount: info.runCount,
      },
      mail: {
        configured: ctx.mailer.isConfigured,
        // Lets the UI offer the test-email button without ever exposing the
        // address itself.
        recipientSet: ctx.cfg.mail.notifyEmail !== null,
      },
    });
  });

  return router;
}
