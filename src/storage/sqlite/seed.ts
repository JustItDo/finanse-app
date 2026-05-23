import type { SQLiteDatabase } from 'expo-sqlite';

import { seedCategories } from '@/src/storage/seedData';
import { toIsoTimestamp } from '@/src/shared/utils/date';

export async function runSeed(db: SQLiteDatabase) {
  const now = toIsoTimestamp();

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const category of seedCategories) {
      await txn.runAsync(
        `
          INSERT OR IGNORE INTO categories (
            id, name, transaction_type, icon, color, is_system, is_archived, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?)
        `,
        category.id,
        category.name,
        category.transactionType,
        category.icon,
        category.color,
        category.sortOrder,
        now,
        now,
      );
    }
  });
}
