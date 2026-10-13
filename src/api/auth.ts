/**
 * auth.ts
 *
 * Bearer token middleware for the protected API. The token from the
 * "Authorization: Bearer <token>" header is compared against
 * BDELKO_API_TOKEN with a timing-safe comparison to avoid leaking the token
 * through response-time differences. Failures get a uniform 401.
 */
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errors.js';

export function bearerAuth(expectedToken: string) {
  const expected = Buffer.from(expectedToken, 'utf8');
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization ?? '';
    const match = /^Bearer\s+(.+)$/.exec(header);
    if (!match) {
      next(ApiError.unauthorized('Missing or malformed Authorization header'));
      return;
    }
    const provided = Buffer.from(match[1], 'utf8');
    // timingSafeEqual throws on different lengths; the length check itself
    // only reveals the token length, not its content.
    const ok = provided.length === expected.length && timingSafeEqual(provided, expected);
    if (!ok) {
      next(ApiError.unauthorized('Invalid API token'));
      return;
    }
    next();
  };
}
