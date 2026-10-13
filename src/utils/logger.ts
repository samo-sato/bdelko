/**
 * logger.ts
 *
 * Two logging channels:
 *  1. `logger` - winston system log: JSON lines to ${BDELKO_LOG_DIR}/system.log
 *     (size-based rotation via maxsize/maxFiles) plus a colorized console
 *     transport. All timestamps are local-time ISO 8601.
 *  2. `runLine()` - the colored per-run scanner summary printed straight to
 *     stdout (like JASMA), toggled by BDELKO_CONSOLE_RUNS. Kept out of the
 *     JSON system log on purpose.
 */
import path from 'node:path';
import winston from 'winston';
import { toLocalIso } from './time.js';

/** Injects a local-time ISO timestamp into every log record. */
const localTimestamp = winston.format((info) => {
  info.timestamp = toLocalIso(Date.now());
  return info;
});

const consoleFormat = winston.format.combine(
  localTimestamp(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const rest = Object.keys(meta).length > 0 ? ' ' + safeJson(meta) : '';
    return `${timestamp} ${level} ${String(message)}${rest}`;
  }),
);

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const consoleTransport = new winston.transports.Console({ format: consoleFormat });
// A transport with no 'error' listener re-throws stream errors (e.g. EPIPE
// when stdout is closed), which would bounce into the uncaughtException
// handler, trigger another log write, and loop forever. Swallow them here:
// a dead console must not take the app down.
consoleTransport.on('error', () => {});

/**
 * The shared system logger. Starts with a console transport only;
 * initFileLogging() adds the rotating file transport once config is loaded.
 */
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(localTimestamp(), winston.format.json()),
  transports: [consoleTransport],
});
logger.on('error', () => {});

export interface FileLoggingOptions {
  logDir: string;
  level: string;
  maxSizeMb: number;
  maxFiles: number;
}

/** Adds the rotating JSON file transport and applies the configured level. */
export function initFileLogging(opts: FileLoggingOptions): void {
  const fileTransport = new winston.transports.File({
    filename: path.join(opts.logDir, 'system.log'),
    maxsize: opts.maxSizeMb * 1024 * 1024,
    maxFiles: opts.maxFiles,
    tailable: true,
  });
  // See the note on consoleTransport: never let transport errors loop.
  fileTransport.on('error', () => {});
  logger.add(fileTransport);
  logger.level = opts.level;
}

// A closed stdout/stderr (e.g. `bdelko | head -1`, or a parent process that
// went away) raises EPIPE as an 'error' event; unhandled, it becomes an
// uncaughtException. Logging must never be able to kill the process.
process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

// ---------------------------------------------------------------------------
// Colored per-run console output (BDELKO_CONSOLE_RUNS)
// ---------------------------------------------------------------------------

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

export type RunColor = keyof typeof ANSI;

let consoleRunsEnabled = true;

/** Enable/disable the colored per-run console output (from BDELKO_CONSOLE_RUNS). */
export function setConsoleRuns(enabled: boolean): void {
  consoleRunsEnabled = enabled;
}

/** Wrap text in an ANSI color (never leaves the terminal in a colored state). */
export function paint(color: RunColor, text: string): string {
  return `${ANSI[color]}${text}${ANSI.reset}`;
}

/** Print one line of the per-run summary when console runs are enabled. */
export function runLine(text: string, color?: RunColor): void {
  if (!consoleRunsEnabled) return;
  try {
    console.log(color ? paint(color, text) : text);
  } catch {
    // stdout is gone (EPIPE) - console run output is best-effort only.
  }
}
