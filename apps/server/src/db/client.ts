import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

export const DEFAULT_DB_PATH = fileURLToPath(new URL('../../data/fretboard.db', import.meta.url));
const MIGRATIONS_FOLDER = fileURLToPath(new URL('./migrations', import.meta.url));

/** Opens the database and applies any pending migrations. */
export function openDb(path: string): { db: Db; close: () => void } {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, close: () => sqlite.close() };
}
