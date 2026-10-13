/**
 * ratelimit.ts
 *
 * Basic per-client-IP fixed-window rate limiting for the whole API (including
 * the public health and heartbeat endpoints). Scope is a single-admin app:
 * the defaults are generous enough that normal UI usage (a few polling
 * requests per minute plus page-load bursts) never trips them; they exist to
 * stop hammering and brute-force loops. Tuned via BDELKO_RATE_LIMIT_MAX /
 * BDELKO_RATE_LIMIT_WINDOW_MS; MAX=0 disables the limiter entirely (see
 * app.ts). State is in-memory: one Map entry per client IP, reset at the end
 * of each window. Requires TRUST_PROXY=true behind a reverse proxy, otherwise
 * every client shares the proxy's IP.
 */
import type { NextFunction, Request, Response } from 'express';

interface WindowEntry {
  count: number;
  /** Epoch ms at which the current window ends and the entry may be dropped. */
  resetAt: number;
}

export function rateLimit(options: { max: number; windowMs: number }) {
  const hits = new Map<string, WindowEntry>();

  // Periodic sweep so one-off IPs cannot grow the map without bound.
  const sweeper = setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of hits) {
        if (entry.resetAt <= now) hits.delete(key);
      }
    },
    Math.max(options.windowMs * 5, 60_000),
  );
  sweeper.unref(); // never keep the process alive just for the sweeper

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (entry === undefined || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > options.max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down.' },
      });
      return;
    }
    next();
  };
}
