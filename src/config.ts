/**
 * config.ts
 *
 * Loads .env, validates every BDELKO_* environment variable with zod and
 * exports a single typed, immutable Config object used across the app.
 *
 * Startup fails fast (process.exit(1)) with a readable list of every
 * missing/invalid variable, so misconfiguration is never discovered late.
 */
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/** Preprocess helper: empty / unset env strings become `undefined` so defaults apply. */
const emptyToUndefined = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? undefined : v;

/** Boolean env var: "true"/"1"/"yes"/"on" (case-insensitive) count as true, everything else false. */
const boolEnv = (def: boolean) =>
  z.preprocess((v) => {
    const val = emptyToUndefined(v);
    if (val === undefined) return undefined;
    if (typeof val === 'boolean') return val;
    return ['true', '1', 'yes', 'on'].includes(String(val).trim().toLowerCase());
  }, z.boolean().default(def));

/** Optional string that collapses "" to undefined (=> null in the final config). */
const optString = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

/** Optional TCP/UDP-style port. */
const optPort = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).max(65535).optional(),
);

/** Optional non-negative integer with a default. */
const intEnv = (def: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  z.preprocess(
    (v) => (emptyToUndefined(v) === undefined ? undefined : Number(v)),
    z.number().int().min(min).max(max).default(def),
  );

/** Required port with friendly error messages. */
const requiredPort = z.preprocess(
  (v) => (emptyToUndefined(v) === undefined ? undefined : Number(v)),
  z
    .number({ required_error: 'Required', invalid_type_error: 'Must be a number' })
    .int()
    .min(1)
    .max(65535),
);

const envSchema = z.object({
  // --- Server ---
  BDELKO_HOST: z.preprocess(emptyToUndefined, z.string().trim().min(1).default('127.0.0.1')),
  BDELKO_PORT: requiredPort,
  BDELKO_TRUST_PROXY: boolEnv(false),

  // --- Public URL building blocks ---
  BDELKO_SECURE: boolEnv(false),
  BDELKO_SUBDOMAIN: optString,
  BDELKO_DOMAIN: z.string({ required_error: 'Required' }).trim().min(1, 'Required'),
  BDELKO_PUBLIC_PORT: optPort,
  BDELKO_BASE_PATH: z.preprocess(
    (v) => {
      const val = emptyToUndefined(v);
      // Base path is stored without any leading/trailing slashes.
      return typeof val === 'string' ? val.replace(/^\/+|\/+$/g, '') || undefined : val;
    },
    z.string().min(1).optional(),
  ),

  // --- Auth ---
  BDELKO_API_TOKEN: z
    .string({ required_error: 'Required' })
    .trim()
    .min(16, 'Must be at least 16 characters (use: npm run gen:token)'),

  // --- Rate limiting ---
  BDELKO_RATE_LIMIT_MAX: intEnv(300, 0),
  BDELKO_RATE_LIMIT_WINDOW_MS: intEnv(60_000, 1_000),

  // --- Monitoring ---
  // (The scan interval is intentionally NOT an env var: fixed at 60 s below.)
  BDELKO_REQUEST_TIMEOUT_MS: z.preprocess(
    (v) => (emptyToUndefined(v) === undefined ? undefined : Number(v)),
    z.number().int().min(100).optional(),
  ),
  BDELKO_GAP_MARGIN_MS: intEnv(15_000),
  BDELKO_CONNECTIVITY_CHECK: boolEnv(true),
  BDELKO_DEFAULT_THRESHOLD_MINUTES: intEnv(3, 0, 1440),
  BDELKO_MIN_WD_NAME_LENGTH: intEnv(1, 1, 200),
  BDELKO_MAX_WD_NAME_LENGTH: intEnv(40, 1, 200),
  BDELKO_MAX_WD_URL_LENGTH: intEnv(2000, 10, 10000),
  BDELKO_USER_AGENT: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).default('bdelko-monitor/1.0'),
  ),

  // --- Web UI ---
  BDELKO_SERVE_UI: boolEnv(true),
  BDELKO_UI_DIST_PATH: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).default('./ui/dist'),
  ),

  // --- Storage & logging ---
  BDELKO_DB_PATH: z.preprocess(emptyToUndefined, z.string().trim().min(1).default('./data/bdelko.db')),
  BDELKO_LOG_DIR: z.preprocess(emptyToUndefined, z.string().trim().min(1).default('./logs')),
  BDELKO_LOG_LEVEL: z.preprocess(
    emptyToUndefined,
    z
      .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
      .default('info'),
  ),
  BDELKO_LOG_MAX_SIZE_MB: intEnv(10, 1),
  BDELKO_LOG_MAX_FILES: intEnv(5, 1),
  BDELKO_CONSOLE_RUNS: boolEnv(true),

  // --- Email (all optional; empty host disables mailing) ---
  BDELKO_NOTIFY_EMAIL: optString,
  BDELKO_MAIL_HOST: optString,
  BDELKO_MAIL_PORT: optPort,
  BDELKO_MAIL_SECURE: boolEnv(false),
  BDELKO_MAIL_USER: optString,
  BDELKO_MAIL_PASS: z.preprocess(emptyToUndefined, z.string().optional()), // not trimmed: passwords may contain significant spaces
  BDELKO_MAIL_FROM_ADDRESS: optString,
  BDELKO_MAIL_FROM_NAME: z.preprocess(emptyToUndefined, z.string().trim().min(1).default('bdelko')),
  BDELKO_MAIL_TLS_REJECT_UNAUTHORIZED: boolEnv(true),
  BDELKO_MAIL_DKIM_DOMAIN: optString,
  BDELKO_MAIL_DKIM_SELECTOR: optString,
  BDELKO_MAIL_DKIM_PRIVKEY: z.preprocess(emptyToUndefined, z.string().optional()),
});

export interface DkimConfig {
  domain: string;
  selector: string;
  privateKey: string;
}

export interface MailConfig {
  /** true when BDELKO_MAIL_HOST is set; otherwise mailing is disabled. */
  enabled: boolean;
  notifyEmail: string | null;
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  fromAddress: string | null;
  fromName: string;
  tlsRejectUnauthorized: boolean;
  dkim: DkimConfig | null;
  /** true when some but not all DKIM vars are set (startup warning). */
  dkimPartial: boolean;
}

export interface Config {
  host: string;
  port: number;
  trustProxy: boolean;
  secure: boolean;
  subdomain: string | null;
  domain: string;
  publicPort: number | null;
  /** Base path without slashes, e.g. "bdelko". null when none. */
  basePath: string | null;
  /** Fully computed public base URL, e.g. "https://bdelko.example.com/bdelko". */
  publicBaseUrl: string;
  apiToken: string;
  /** Per-IP API rate limit: max requests per window (0 = disabled). */
  rateLimitMax: number;
  /** Per-IP API rate limit: window length in ms. */
  rateLimitWindowMs: number;
  scanIntervalMs: number;
  requestTimeoutMs: number;
  gapMarginMs: number;
  connectivityCheck: boolean;
  defaultThresholdMinutes: number;
  minWdNameLength: number;
  maxWdNameLength: number;
  maxWdUrlLength: number;
  userAgent: string;
  dbPath: string;
  logDir: string;
  logLevel: string;
  logMaxSizeMb: number;
  logMaxFiles: number;
  consoleRuns: boolean;
  /** Serve the built web UI (BDELKO_SERVE_UI). */
  serveUi: boolean;
  /** Folder containing the built UI (BDELKO_UI_DIST_PATH). */
  uiDistPath: string;
  mail: MailConfig;
}

/** Fixed scan interval (active + passive). Hardcoded by design, not configurable. */
export const SCAN_INTERVAL_MS = 60_000;

let cached: Config | null = null;

/**
 * Parses and validates process.env. On any validation problem prints every
 * offending variable to stderr and exits the process (fail fast).
 */
export function loadConfig(): Config {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('bdelko: missing or invalid environment variables:');
    for (const issue of parsed.error.issues) {
      const name = issue.path.join('.') || '(unknown)';
      console.error(`  - ${name}: ${issue.message}`);
    }
    process.exit(1);
  }
  const env = parsed.data;

  const secure = env.BDELKO_SECURE;
  const basePath = env.BDELKO_BASE_PATH ?? null;
  const subdomain = env.BDELKO_SUBDOMAIN ?? null;
  const publicPort = env.BDELKO_PUBLIC_PORT ?? null;

  // Public base URL used to build heartbeat URLs shown in API responses.
  const publicBaseUrl =
    `${secure ? 'https' : 'http'}://` +
    `${subdomain ? subdomain + '.' : ''}${env.BDELKO_DOMAIN}` +
    `${publicPort ? ':' + publicPort : ''}` +
    `${basePath ? '/' + basePath : ''}`;

  // DKIM only when all three parts are provided; PEM pasted into .env usually
  // uses literal "\n" sequences, so convert them to real newlines.
  const dkimParts = [env.BDELKO_MAIL_DKIM_DOMAIN, env.BDELKO_MAIL_DKIM_SELECTOR, env.BDELKO_MAIL_DKIM_PRIVKEY];
  const dkimSet = dkimParts.filter((p) => p !== undefined && p !== null).length;
  const dkim: DkimConfig | null =
    dkimSet === 3
      ? {
          domain: env.BDELKO_MAIL_DKIM_DOMAIN!,
          selector: env.BDELKO_MAIL_DKIM_SELECTOR!,
          privateKey: env.BDELKO_MAIL_DKIM_PRIVKEY!.replace(/\\n/g, '\n'),
        }
      : null;

  const mailSecure = env.BDELKO_MAIL_SECURE;
  const mail: MailConfig = {
    enabled: !!env.BDELKO_MAIL_HOST,
    notifyEmail: env.BDELKO_NOTIFY_EMAIL ?? null,
    host: env.BDELKO_MAIL_HOST ?? null,
    port: env.BDELKO_MAIL_PORT ?? (mailSecure ? 465 : 587),
    secure: mailSecure,
    user: env.BDELKO_MAIL_USER ?? null,
    pass: env.BDELKO_MAIL_PASS ?? null,
    fromAddress: env.BDELKO_MAIL_FROM_ADDRESS ?? env.BDELKO_MAIL_USER ?? null,
    fromName: env.BDELKO_MAIL_FROM_NAME,
    tlsRejectUnauthorized: env.BDELKO_MAIL_TLS_REJECT_UNAUTHORIZED,
    dkim,
    dkimPartial: dkimSet > 0 && dkimSet < 3,
  };

  cached = {
    host: env.BDELKO_HOST,
    port: env.BDELKO_PORT,
    trustProxy: env.BDELKO_TRUST_PROXY,
    secure,
    subdomain,
    domain: env.BDELKO_DOMAIN,
    publicPort,
    basePath,
    publicBaseUrl,
    apiToken: env.BDELKO_API_TOKEN,
    rateLimitMax: env.BDELKO_RATE_LIMIT_MAX,
    rateLimitWindowMs: env.BDELKO_RATE_LIMIT_WINDOW_MS,
    scanIntervalMs: SCAN_INTERVAL_MS,
    // Default HTTP timeout is half the scan interval.
    requestTimeoutMs: env.BDELKO_REQUEST_TIMEOUT_MS ?? Math.floor(SCAN_INTERVAL_MS / 2),
    gapMarginMs: env.BDELKO_GAP_MARGIN_MS,
    connectivityCheck: env.BDELKO_CONNECTIVITY_CHECK,
    defaultThresholdMinutes: env.BDELKO_DEFAULT_THRESHOLD_MINUTES,
    minWdNameLength: env.BDELKO_MIN_WD_NAME_LENGTH,
    maxWdNameLength: env.BDELKO_MAX_WD_NAME_LENGTH,
    maxWdUrlLength: env.BDELKO_MAX_WD_URL_LENGTH,
    userAgent: env.BDELKO_USER_AGENT,
    dbPath: env.BDELKO_DB_PATH,
    logDir: env.BDELKO_LOG_DIR,
    logLevel: env.BDELKO_LOG_LEVEL,
    logMaxSizeMb: env.BDELKO_LOG_MAX_SIZE_MB,
    logMaxFiles: env.BDELKO_LOG_MAX_FILES,
    consoleRuns: env.BDELKO_CONSOLE_RUNS,
    serveUi: env.BDELKO_SERVE_UI,
    uiDistPath: env.BDELKO_UI_DIST_PATH,
    mail,
  };
  return cached;
}

/** Startup config summary with secrets masked (safe to log). */
export function maskedConfigSummary(cfg: Config): Record<string, unknown> {
  const mask = (s: string | null) => (s ? s.slice(0, 4) + '...(' + s.length + ' chars)' : null);
  return {
    listen: `${cfg.host}:${cfg.port}`,
    publicBaseUrl: cfg.publicBaseUrl,
    trustProxy: cfg.trustProxy,
    apiToken: mask(cfg.apiToken),
    rateLimitMax: cfg.rateLimitMax,
    rateLimitWindowMs: cfg.rateLimitWindowMs,
    scanIntervalMs: cfg.scanIntervalMs,
    requestTimeoutMs: cfg.requestTimeoutMs,
    gapMarginMs: cfg.gapMarginMs,
    connectivityCheck: cfg.connectivityCheck,
    defaultThresholdMinutes: cfg.defaultThresholdMinutes,
    dbPath: cfg.dbPath,
    logDir: cfg.logDir,
    logLevel: cfg.logLevel,
    consoleRuns: cfg.consoleRuns,
    serveUi: cfg.serveUi,
    uiDistPath: cfg.uiDistPath,
    mail: {
      enabled: cfg.mail.enabled,
      notifyEmail: cfg.mail.notifyEmail,
      host: cfg.mail.host,
      port: cfg.mail.port,
      secure: cfg.mail.secure,
      user: cfg.mail.user,
      pass: cfg.mail.pass ? '(set)' : null,
      fromAddress: cfg.mail.fromAddress,
      fromName: cfg.mail.fromName,
      tlsRejectUnauthorized: cfg.mail.tlsRejectUnauthorized,
      dkim: cfg.mail.dkim ? { domain: cfg.mail.dkim.domain, selector: cfg.mail.dkim.selector } : null,
    },
  };
}
