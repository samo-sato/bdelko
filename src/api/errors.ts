/**
 * errors.ts
 *
 * ApiError carries an HTTP status + machine readable code; the errorHandler
 * middleware converts every thrown error into the standard JSON shape:
 *   { "error": { "code": "...", "message": "...", "details"?: [...] } }
 * Zod validation failures map to 400 VALIDATION_ERROR, unexpected errors to
 * 500 INTERNAL (and are logged via winston - API 5xx logging requirement).
 */
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export type ApiErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'CONFLICT' | 'INTERNAL';

export interface ApiErrorDetail {
  path?: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static validation(message: string, details?: ApiErrorDetail[]): ApiError {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static notFound(message = 'Not found'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, 'CONFLICT', message);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, 'INTERNAL', message);
  }
}

/** Final error-handling middleware (registered last in app.ts). */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  if (err instanceof ZodError) {
    const details: ApiErrorDetail[] = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details },
    });
    return;
  }

  // Malformed JSON bodies land here (express.json SyntaxError).
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' },
    });
    return;
  }

  logger.error(`Unhandled API error on ${req.method} ${req.originalUrl}`, {
    error: err instanceof Error ? err.stack ?? err.message : String(err),
  });
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
