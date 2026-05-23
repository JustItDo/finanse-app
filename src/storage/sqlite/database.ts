import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME } from '@/src/storage/sqlite/constants';
import { runMigrations } from '@/src/storage/sqlite/migrations';
import { runSeed } from '@/src/storage/sqlite/seed';

export type DatabaseContext = {
  getDb: () => Promise<SQLiteDatabase>;
};

let databasePromise: Promise<SQLiteDatabase> | null = null;

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = initializeDatabase();
  }

  return databasePromise;
}

export function createDatabaseContext(): DatabaseContext {
  return {
    getDb: getDatabase,
  };
}

async function initializeDatabase() {
  const db = await openDatabaseAsync(DATABASE_NAME);

  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  await runSeed(db);

  return db;
}
