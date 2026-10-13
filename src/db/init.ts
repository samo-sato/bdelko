/**
 * init.ts (npm run db:init)
 *
 * Creates the SQLite database file and all tables without starting the
 * server. Handy for deployment: config -> db:init -> build -> start.
 */
import { loadConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { Db } from './connection.js';
import { applySchema } from './schema.js';

async function main(): Promise<void> {
  const cfg = loadConfig(); // exits the process when env is invalid
  const db = await Db.open(cfg.dbPath);
  await applySchema(db);
  const version = await db.get<{ user_version: number }>('PRAGMA user_version');
  await db.close();
  logger.info(`Database initialized at ${cfg.dbPath} (user_version=${version?.user_version ?? '?'})`);
}

main().catch((err) => {
  logger.error('db:init failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
