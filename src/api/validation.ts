/**
 * validation.ts
 *
 * Zod schemas for request bodies and query strings. Schemas are built from
 * Config because several limits (name/url length, default threshold) are
 * configurable via env vars.
 *
 * Mode-dependent rules are enforced here and in the routes:
 *   active  -> url required, expected_status defaults to "2xx"
 *   passive -> url and expected_status are forced to null (secret generated)
 * Mode itself is immutable after creation (PATCH with a different mode -> 400).
 */
import { z } from 'zod';
import type { Config } from '../config.js';
import { normalizeExpectedStatus } from '../utils/statusMatcher.js';
import { parseTimeToMs } from '../utils/time.js';
import { ApiError } from './errors.js';

export function makeSchemas(cfg: Config) {
  const nameSchema = z
    .string({ required_error: 'name is required', invalid_type_error: 'name must be a string' })
    .trim()
    .min(cfg.minWdNameLength, `name must be at least ${cfg.minWdNameLength} character(s)`)
    .max(cfg.maxWdNameLength, `name must be at most ${cfg.maxWdNameLength} characters`);

  const urlSchema = z
    .string({ invalid_type_error: 'url must be a string' })
    .trim()
    .max(cfg.maxWdUrlLength, `url must be at most ${cfg.maxWdUrlLength} characters`)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'url must be a valid http(s) URL');

  const expectedStatusSchema = z
    .string({ invalid_type_error: 'expected_status must be a string' })
    .trim()
    .transform((v, ctx) => {
      try {
        return normalizeExpectedStatus(v); // also validates
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : 'Invalid expected_status',
        });
        return z.NEVER;
      }
    });

  const thresholdSchema = z.coerce
    .number({ invalid_type_error: 'threshold_minutes must be a number' })
    .int('threshold_minutes must be an integer')
    .min(0, 'threshold_minutes must be between 0 and 1440')
    .max(1440, 'threshold_minutes must be between 0 and 1440');

  /** POST /api/watchdogs body. */
  const createWatchdogBody = z
    .object({
      name: nameSchema,
      mode: z.enum(['active', 'passive'], {
        errorMap: () => ({ message: 'mode must be "active" or "passive"' }),
      }),
      url: urlSchema.optional(),
      expected_status: expectedStatusSchema.optional(),
      enabled: z.boolean({ invalid_type_error: 'enabled must be a boolean' }).default(true),
      notify: z.boolean({ invalid_type_error: 'notify must be a boolean' }).default(true),
      threshold_minutes: thresholdSchema.default(cfg.defaultThresholdMinutes),
    })
    .strict()
    .superRefine((v, ctx) => {
      if (v.mode === 'active' && v.url === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['url'], message: 'url is required for active watchdogs' });
      }
    });

  /** PATCH /api/watchdogs/:id body - all fields optional, but at least one required. */
  const updateWatchdogBody = z
    .object({
      name: nameSchema.optional(),
      // Accepted so a mode-change attempt can be rejected with a clear 400.
      mode: z.enum(['active', 'passive']).optional(),
      url: urlSchema.nullable().optional(),
      expected_status: expectedStatusSchema.nullable().optional(),
      enabled: z.boolean({ invalid_type_error: 'enabled must be a boolean' }).optional(),
      notify: z.boolean({ invalid_type_error: 'notify must be a boolean' }).optional(),
      threshold_minutes: thresholdSchema.optional(),
    })
    .strict()
    .refine((v) => Object.values(v).some((val) => val !== undefined), {
      message: 'At least one field must be provided',
    });

  /** GET /api/logs (and /api/watchdogs/:id/logs) query string. */
  const logsQuery = z.object({
    watchdog: z.string().trim().min(1).optional(),
    status: z
      .preprocess(
        (v) => (v === undefined || v === '' ? undefined : Number(v)),
        z.union([z.literal(0), z.literal(1)], {
          errorMap: () => ({ message: 'status must be 0 or 1' }),
        }).optional(),
      ),
    from: z.string().trim().min(1).optional(),
    to: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().min(1, 'page must be >= 1').default(1),
    limit: z.coerce.number().int().min(1).max(500, 'limit must be <= 500').default(50),
    order: z.enum(['asc', 'desc']).default('desc'),
  });

  /** GET /api/notifications query string (same conventions as logsQuery). */
  const notificationsQuery = z.object({
    watchdog: z.string().trim().min(1).optional(),
    type: z.enum(['down', 'up']).optional(),
    success: z.preprocess(
      (v) => (v === undefined || v === '' ? undefined : Number(v)),
      z
        .union([z.literal(0), z.literal(1)], {
          errorMap: () => ({ message: 'success must be 0 or 1' }),
        })
        .optional(),
    ),
    from: z.string().trim().min(1).optional(),
    to: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().min(1, 'page must be >= 1').default(1),
    limit: z.coerce.number().int().min(1).max(500, 'limit must be <= 500').default(50),
    order: z.enum(['asc', 'desc']).default('desc'),
  });

  return { createWatchdogBody, updateWatchdogBody, logsQuery, notificationsQuery, nameSchema, urlSchema, expectedStatusSchema };
}

export type Schemas = ReturnType<typeof makeSchemas>;

/**
 * Parse a from/to query value (ISO 8601 or epoch ms) into epoch ms.
 * Throws a 400 ApiError when the value is present but unparseable.
 */
export function parseQueryTime(value: string | undefined, field: 'from' | 'to'): number | undefined {
  if (value === undefined) return undefined;
  const ms = parseTimeToMs(value);
  if (ms === null) {
    throw ApiError.validation(`Invalid "${field}" parameter: use ISO 8601 or epoch milliseconds`);
  }
  return ms;
}
