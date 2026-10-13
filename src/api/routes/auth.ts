/**
 * routes/auth.ts  (protected)
 *
 * GET /api/auth/check - side-effect-free token validation used by the web
 * UI's login screen. Mounted after the Bearer middleware, so reaching the
 * handler at all means the token is valid.
 */
import { Router } from 'express';

export function authRoutes(): Router {
  const router = Router();

  router.get('/auth/check', (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}
