import type { Category, CategoryTransactionType, TransactionType } from '@/src/domain/finance';
import { toIsoTimestamp } from '@/src/shared/utils/date';
import type { DatabaseContext } from '@/src/storage/sqlite/database';

type CategoryRow = {
  id: string;
  name: string;
  transaction_type: CategoryTransactionType;
  icon: string | null;
  color: string | null;
  is_system: number;
  is_archived: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function mapCategory(row: CategoryRow): Category {
  return {
    color: row.color,
    createdAt: row.created_at,
    icon: row.icon,
    id: row.id,
    isArchived: Boolean(row.is_archived),
    isSystem: Boolean(row.is_system),
    name: row.name,
    sortOrder: row.sort_order,
    transactionType: row.transaction_type,
    updatedAt: row.updated_at,
  };
}

export function createCategoriesRepository(context: DatabaseContext) {
  return {
    async count() {
      const db = await context.getDb();
      const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM categories');

      return row?.total ?? 0;
    },

    async listAll() {
      const db = await context.getDb();
      const rows = await db.getAllAsync<CategoryRow>(
        'SELECT * FROM categories ORDER BY sort_order ASC, name ASC',
      );

      return rows.map(mapCategory);
    },

    async listByTransactionType(type: TransactionType | 'all' = 'all') {
      const db = await context.getDb();

      if (type === 'all') {
        const rows = await db.getAllAsync<CategoryRow>(
          'SELECT * FROM categories WHERE is_archived = 0 ORDER BY sort_order ASC, name ASC',
        );

        return rows.map(mapCategory);
      }

      const rows = await db.getAllAsync<CategoryRow>(
        `
          SELECT * FROM categories
          WHERE is_archived = 0
            AND transaction_type IN (?, 'both')
          ORDER BY sort_order ASC, name ASC
        `,
        type,
      );

      return rows.map(mapCategory);
    },

    async updateCategory(input: { id: string; name: string; isArchived: boolean }) {
      const db = await context.getDb();

      await db.runAsync(
        `
          UPDATE categories
          SET name = ?, is_archived = ?, updated_at = ?
          WHERE id = ?
        `,
        input.name.trim(),
        input.isArchived ? 1 : 0,
        toIsoTimestamp(),
        input.id,
      );

      const updated = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ? LIMIT 1', input.id);

      if (!updated) {
        throw new Error('Nie udało się zaktualizować kategorii.');
      }

      return mapCategory(updated);
    },
  };
}
