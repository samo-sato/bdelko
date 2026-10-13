/**
 * connection.ts
 *
 * Thin async (promisified) wrapper around the sqlite3 driver. One process-wide
 * connection is opened at startup with:
 *   PRAGMA foreign_keys = ON   (cascading deletes)
 *   PRAGMA journal_mode = WAL  (concurrent readers while the scanner writes)
 * All SQL in the codebase is parameterized through run/get/all - no ORM.
 */
import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

/** Values that can be bound to SQL parameters. */
export type SqlValue = string | number | null;

export interface RunResult {
  lastID: number;
  changes: number;
}

export class Db {
  private constructor(private readonly db: sqlite3.Database) {}

  /** Open (or create) the database file and apply connection-level PRAGMAs. */
  static open(dbPath: string): Promise<Db> {
    // Make sure the parent directory exists (e.g. ./data).
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) return reject(err);
        db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;', (pragmaErr) => {
          if (pragmaErr) reject(pragmaErr);
          else resolve(new Db(db));
        });
      });
    });
  }

  /** INSERT/UPDATE/DELETE; resolves with lastID and number of changed rows. */
  run(sql: string, params: SqlValue[] = []): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /** SELECT a single row (undefined when none). */
  get<T>(sql: string, params: SqlValue[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err: Error | null, row: unknown) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  /** SELECT any number of rows. */
  all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: Error | null, rows: unknown[]) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  /** Execute raw SQL (multiple statements allowed). Used for schema setup. */
  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err: Error | null) => (err ? reject(err) : resolve()));
    });
  }

  /**
   * Run fn inside BEGIN IMMEDIATE ... COMMIT, rolling back on any error.
   * Used by the scanner so a whole run's log writes are atomic.
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.exec('BEGIN IMMEDIATE');
    try {
      const result = await fn();
      await this.exec('COMMIT');
      return result;
    } catch (err) {
      await this.exec('ROLLBACK').catch(() => undefined);
      throw err;
    }
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err: Error | null) => (err ? reject(err) : resolve()));
    });
  }
}
