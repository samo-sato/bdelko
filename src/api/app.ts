/**
 * app.ts
 *
 * Express 5 app factory. Everything is mounted under `${basePath}/api`
 * (basePath from BDELKO_BASE_PATH, empty by default). Public routes
 * (heartbeat, health) are registered before the Bearer auth middleware;
 * all other routes require the API token. Unknown routes -> JSON 404.
 * Request logging is a single line per request at debug level only.
 */
import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import { logger } from '../utils/logger.js';
import { bearerAuth } from './auth.js';
import type { Context } from './context.js';
import { errorHandler } from './errors.js';
import { rateLimit } from './ratelimit.js';
import { authRoutes } from './routes/auth.js';
import { heartbeatRoutes } from './routes/heartbeat.js';
import { healthRoutes } from './routes/health.js';
import { logsRoutes } from './routes/logs.js';
import { mailRoutes } from './routes/mail.js';
import { notificationsRoutes } from './routes/notifications.js';
import { statusRoutes } from './routes/status.js';
import { watchdogsRoutes } from './routes/watchdogs.js';

export function createApp(ctx: Context): Express {
  const app = express();
  app.disable('x-powered-by');
  if (ctx.cfg.trustProxy) {
    // Behind a reverse proxy (nginx etc.): trust X-Forwarded-* headers.
    app.set('trust proxy', true);
  }
  app.use(express.json({ limit: '64kb' }));

  // Minimal one-line request log at debug level.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  const api = express.Router();

  // Public endpoints (no auth).
  api.use(heartbeatRoutes(ctx));
  api.use(healthRoutes(ctx));

  // Everything below requires Authorization: Bearer <BDELKO_API_TOKEN>.
  api.use(bearerAuth(ctx.cfg.apiToken));
  api.use(authRoutes());
  api.use(mailRoutes(ctx));
  api.use('/watchdogs', watchdogsRoutes(ctx));
  api.use('/logs', logsRoutes(ctx));
  api.use('/notifications', notificationsRoutes(ctx));
  api.use('/status', statusRoutes(ctx));

  const base = ctx.cfg.basePath ? '/' + ctx.cfg.basePath : '';
  const mountPath = `${base}/api`;
  // Per-IP rate limiting covers the whole API (heartbeat and health too).
  // Disabled when BDELKO_RATE_LIMIT_MAX=0.
  if (ctx.cfg.rateLimitMax > 0) {
    app.use(
      mountPath,
      rateLimit({ max: ctx.cfg.rateLimitMax, windowMs: ctx.cfg.rateLimitWindowMs }),
    );
  }
  app.use(mountPath, api);

  // --- Web UI (static hosting, one origin with the API) ---
  // The UI is a hash-routed SPA with relative asset URLs, so no SPA fallback
  // is needed: only ${base}/ serves index.html, assets come from express.static.
  if (ctx.cfg.serveUi) {
    const distPath = path.resolve(ctx.cfg.uiDistPath);
    const indexHtml = path.join(distPath, 'index.html');
    const uiBuilt = fs.existsSync(indexHtml);
    if (!uiBuilt) {
      logger.warn(`BDELKO_SERVE_UI is true but ${indexHtml} is missing - run: npm run ui:build`);
    }

    // The page must be reached with a trailing slash (relative ./api and
    // asset URLs resolve against it), so redirect ${base} -> ${base}/.
    // Express's non-strict routing makes this route match ${base}/ too, so
    // explicitly fall through when the trailing slash is already present.
    if (base !== '') {
      app.get(base, (req, res, next) => {
        if (req.path.endsWith('/')) return next();
        res.redirect(301, `${base}/`);
      });
    }

    // Fingerprinted files under assets/ are cached forever; everything else
    // (index.html, favicon) is revalidated on every load.
    app.use(
      `${base}/`,
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );

    app.get(`${base}/`, (_req, res) => {
      if (!uiBuilt) {
        res.status(503).type('text/plain').send('UI not built. Run: npm run ui:build');
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  // 404: JSON for unknown API routes; plain text for everything else when the
  // UI is being served (a browser mistyping a page URL should not get JSON).
  app.use((req, res) => {
    const isApiPath = req.path === mountPath || req.path.startsWith(mountPath + '/');
    if (isApiPath || !ctx.cfg.serveUi) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
      return;
    }
    res.status(404).type('text/plain').send('Not found');
  });

  // Central error handler (must be registered last).
  app.use(errorHandler);

  return app;
}
