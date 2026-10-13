/**
 * index.ts
 *
 * Entry point. Boot order: load+validate config (fail fast) -> file logging
 * -> open SQLite + apply schema -> mailer -> scanner (first run immediately)
 * -> HTTP server. SIGINT/SIGTERM trigger a graceful shutdown: stop the
 * scanner, stop accepting HTTP requests, close the database.
 */
import fs from 'node:fs';
import type { Server } from 'node:http';
import { loadConfig, maskedConfigSummary } from './config.js';
import { createApp } from './api/app.js';
import type { Context } from './api/context.js';
import { makeSchemas } from './api/validation.js';
import { Db } from './db/connection.js';
import { applySchema } from './db/schema.js';
import { LogsRepo } from './db/logs.repo.js';
import { NotificationsRepo } from './db/notifications.repo.js';
import { WatchdogsRepo } from './db/watchdogs.repo.js';
import { Mailer } from './mail/mailer.js';
import { Scanner } from './scanner/scanner.js';
import { initFileLogging, logger, setConsoleRuns } from './utils/logger.js';

async function main(): Promise<void> {
  // 1. Config: exits the process with a readable list when env is invalid.
  const cfg = loadConfig();

  // 2. Logging: ensure the log directory exists, then add the file transport.
  fs.mkdirSync(cfg.logDir, { recursive: true });
  initFileLogging({
    logDir: cfg.logDir,
    level: cfg.logLevel,
    maxSizeMb: cfg.logMaxSizeMb,
    maxFiles: cfg.logMaxFiles,
  });
  setConsoleRuns(cfg.consoleRuns);

  logger.info('bdelko starting', { config: maskedConfigSummary(cfg) });

  // 3. Mail warnings (disabled / partially configured).
  if (!cfg.mail.enabled) {
    logger.warn('BDELKO_MAIL_HOST is empty - email notifications are disabled');
  } else {
    if (!cfg.mail.notifyEmail) {
      logger.warn('BDELKO_NOTIFY_EMAIL is empty - notification emails have no recipient');
    }
    if (cfg.mail.dkimPartial) {
      logger.warn('DKIM is partially configured (need BDELKO_MAIL_DKIM_DOMAIN, _SELECTOR and _PRIVKEY) - DKIM signing disabled');
    }
  }

  // 4. Database.
  const db = await Db.open(cfg.dbPath);
  await applySchema(db);
  logger.info(`Database ready at ${cfg.dbPath}`);

  // 5. Repos + mailer + scanner.
  const watchdogs = new WatchdogsRepo(db);
  const logs = new LogsRepo(db);
  const notifications = new NotificationsRepo(db);
  const mailer = new Mailer(cfg);
  const scanner = new Scanner({ cfg, db, watchdogs, logs, notifications, mailer });
  scanner.start();

  // 6. HTTP server.
  const ctx: Context = { cfg, db, watchdogs, logs, notifications, mailer, scanner, schemas: makeSchemas(cfg) };
  const app = createApp(ctx);
  const mountPath = `${cfg.basePath ? '/' + cfg.basePath : ''}/api`;
  const server: Server = app.listen(cfg.port, cfg.host);
  // NOTE: Express 5.3's app.listen(callback) also invokes the callback on
  // bind errors (it registers it via server.once('error', ...)), so the
  // callback cannot be trusted to mean "we are serving". Log from the real
  // 'listening' event and fail hard on bind errors instead.
  server.on('listening', () => {
    logger.info(`Listening on http://${cfg.host}:${cfg.port}${mountPath} (public base: ${cfg.publicBaseUrl})`);
  });
  server.on('error', (err) => {
    const code = (err as NodeJS.ErrnoException).code;
    logger.error(`HTTP server failed: ${code === 'EADDRINUSE' ? `address already in use (${cfg.host}:${cfg.port})` : err.message}`);
    process.exit(1);
  });

  // 7. Graceful shutdown.
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal} - shutting down`);
    scanner.stop();
    server.close(async () => {
      try {
        await db.close();
        logger.info('Database closed, bye');
      } catch (err) {
        logger.error('Error while closing database', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      process.exit(0);
    });
    // Do not hang forever on keep-alive connections.
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.stack ?? reason.message : String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.stack ?? err.message });
});

main().catch((err) => {
  logger.error('Fatal startup error', { error: err instanceof Error ? err.stack ?? err.message : String(err) });
  process.exit(1);
});
