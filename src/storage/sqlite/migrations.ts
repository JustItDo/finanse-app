import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_SCHEMA_VERSION } from '@/src/storage/sqlite/constants';

type Migration = {
  version: number;
  name: string;
  sql: string;
};

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('expense', 'income', 'both')),
        icon TEXT,
        color TEXT,
        is_system INTEGER NOT NULL DEFAULT 1 CHECK(is_system IN (0, 1)),
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS monthly_budgets (
        id TEXT PRIMARY KEY NOT NULL,
        month_key TEXT NOT NULL UNIQUE,
        currency_code TEXT NOT NULL,
        total_budget_minor INTEGER NOT NULL,
        target_savings_minor INTEGER,
        starting_balance_minor INTEGER,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
        amount_minor INTEGER NOT NULL,
        currency_code TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        description TEXT,
        payment_method TEXT NOT NULL DEFAULT 'other' CHECK(payment_method IN ('cash', 'card', 'bank_transfer', 'blik', 'other')),
        source_type TEXT NOT NULL DEFAULT 'manual' CHECK(source_type IN ('manual', 'receipt_ocr', 'screenshot_ocr', 'obsidian_import', 'obsidian_sync')),
        source_reference TEXT,
        note TEXT,
        ocr_status TEXT NOT NULL DEFAULT 'not_requested' CHECK(ocr_status IN ('not_requested', 'pending', 'processed', 'reviewed', 'failed')),
        ocr_confidence REAL,
        ocr_raw_text TEXT,
        ocr_attachment_source TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY NOT NULL,
        transaction_id TEXT REFERENCES transactions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('receipt_photo', 'screenshot', 'document')),
        storage_type TEXT NOT NULL DEFAULT 'local_file' CHECK(storage_type IN ('local_file')),
        file_uri TEXT NOT NULL,
        file_name TEXT,
        mime_type TEXT,
        file_size_bytes INTEGER,
        source_type TEXT NOT NULL DEFAULT 'manual' CHECK(source_type IN ('manual', 'receipt_ocr', 'screenshot_ocr', 'obsidian_import', 'obsidian_sync')),
        source_reference TEXT,
        ocr_status TEXT NOT NULL DEFAULT 'not_requested' CHECK(ocr_status IN ('not_requested', 'pending', 'processed', 'reviewed', 'failed')),
        ocr_confidence REAL,
        ocr_raw_text TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS category_budgets (
        id TEXT PRIMARY KEY NOT NULL,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        month_key TEXT NOT NULL,
        limit_amount_minor INTEGER NOT NULL,
        currency_code TEXT NOT NULL,
        rollover_enabled INTEGER NOT NULL DEFAULT 0 CHECK(rollover_enabled IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(category_id, month_key)
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions (occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions (category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_month_type ON transactions (type, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_attachments_transaction_id ON attachments (transaction_id);
      CREATE INDEX IF NOT EXISTS idx_category_budgets_month_key ON category_budgets (month_key);
    `,
  },
  {
    version: 2,
    name: 'transaction_month_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_transactions_month_key
      ON transactions (substr(occurred_at, 1, 7), occurred_at DESC, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_transactions_month_type_category
      ON transactions (substr(occurred_at, 1, 7), type, category_id, occurred_at DESC, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_transactions_month_type
      ON transactions (substr(occurred_at, 1, 7), type, occurred_at DESC, created_at DESC);
    `,
  },
];

export async function runMigrations(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;',
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_SCHEMA_VERSION) {
    return;
  }

  const pendingMigrations = migrations.filter(
    (migration) => migration.version > currentVersion,
  );

  for (const migration of pendingMigrations) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(migration.sql);
      await txn.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
  }
}
