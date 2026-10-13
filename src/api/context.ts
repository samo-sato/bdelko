/**
 * context.ts
 *
 * Shared dependency-injection context handed to every route factory, so
 * routes stay thin and testable. Assembled once in index.ts.
 */
import type { Config } from '../config.js';
import type { Db } from '../db/connection.js';
import type { LogsRepo } from '../db/logs.repo.js';
import type { NotificationsRepo } from '../db/notifications.repo.js';
import type { WatchdogsRepo } from '../db/watchdogs.repo.js';
import type { Mailer } from '../mail/mailer.js';
import type { Scanner } from '../scanner/scanner.js';
import type { Schemas } from './validation.js';

export interface Context {
  cfg: Config;
  db: Db;
  watchdogs: WatchdogsRepo;
  logs: LogsRepo;
  notifications: NotificationsRepo;
  mailer: Mailer;
  scanner: Scanner;
  schemas: Schemas;
}
