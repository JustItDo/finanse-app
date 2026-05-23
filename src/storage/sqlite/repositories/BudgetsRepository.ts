import type { CategoryBudget, MonthlyBudget } from '@/src/domain/finance';
import { createEntityId } from '@/src/shared/utils/id';
import { toIsoTimestamp } from '@/src/shared/utils/date';
import type { DatabaseContext } from '@/src/storage/sqlite/database';

type MonthlyBudgetRow = {
  id: string;
  month_key: string;
  currency_code: string;
  total_budget_minor: number;
  target_savings_minor: number | null;
  starting_balance_minor: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CategoryBudgetRow = {
  id: string;
  category_id: string;
  month_key: string;
  limit_amount_minor: number;
  currency_code: string;
  rollover_enabled: number;
  created_at: string;
  updated_at: string;
};

export type UpsertMonthlyBudgetInput = {
  monthKey: string;
  currencyCode: string;
  totalBudgetMinor: number;
  targetSavingsMinor?: number | null;
  startingBalanceMinor?: number | null;
  notes?: string | null;
};

export type UpsertCategoryBudgetInput = {
  categoryId: string;
  monthKey: string;
  currencyCode: string;
  limitAmountMinor: number;
  rolloverEnabled?: boolean;
};

function mapMonthlyBudget(row: MonthlyBudgetRow): MonthlyBudget {
  return {
    createdAt: row.created_at,
    currencyCode: row.currency_code,
    id: row.id,
    monthKey: row.month_key,
    notes: row.notes,
    startingBalanceMinor: row.starting_balance_minor,
    targetSavingsMinor: row.target_savings_minor,
    totalBudgetMinor: row.total_budget_minor,
    updatedAt: row.updated_at,
  };
}

function mapCategoryBudget(row: CategoryBudgetRow): CategoryBudget {
  return {
    categoryId: row.category_id,
    createdAt: row.created_at,
    currencyCode: row.currency_code,
    id: row.id,
    limitAmountMinor: row.limit_amount_minor,
    monthKey: row.month_key,
    rolloverEnabled: Boolean(row.rollover_enabled),
    updatedAt: row.updated_at,
  };
}

export function createBudgetsRepository(context: DatabaseContext) {
  return {
    async clearMonthlyBudget(monthKey: string) {
      const db = await context.getDb();

      await db.runAsync('DELETE FROM monthly_budgets WHERE month_key = ?', monthKey);
    },

    async getMonthlyBudget(monthKey: string) {
      const db = await context.getDb();
      const row = await db.getFirstAsync<MonthlyBudgetRow>(
        'SELECT * FROM monthly_budgets WHERE month_key = ? LIMIT 1',
        monthKey,
      );

      return row ? mapMonthlyBudget(row) : null;
    },

    async listCategoryBudgets(monthKey: string) {
      const db = await context.getDb();
      const rows = await db.getAllAsync<CategoryBudgetRow>(
        'SELECT * FROM category_budgets WHERE month_key = ? ORDER BY created_at ASC',
        monthKey,
      );

      return rows.map(mapCategoryBudget);
    },

    async removeCategoryBudget(categoryId: string, monthKey: string) {
      const db = await context.getDb();

      await db.runAsync('DELETE FROM category_budgets WHERE category_id = ? AND month_key = ?', categoryId, monthKey);
    },

    async upsertMonthlyBudget(input: UpsertMonthlyBudgetInput) {
      const db = await context.getDb();
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM monthly_budgets WHERE month_key = ? LIMIT 1',
        input.monthKey,
      );
      const now = toIsoTimestamp();
      const id = existing?.id ?? createEntityId('monthly_budget');

      await db.runAsync(
        `
          INSERT INTO monthly_budgets (
            id, month_key, currency_code, total_budget_minor, target_savings_minor,
            starting_balance_minor, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(month_key) DO UPDATE SET
            currency_code = excluded.currency_code,
            total_budget_minor = excluded.total_budget_minor,
            target_savings_minor = excluded.target_savings_minor,
            starting_balance_minor = excluded.starting_balance_minor,
            notes = excluded.notes,
            updated_at = excluded.updated_at
        `,
        id,
        input.monthKey,
        input.currencyCode,
        input.totalBudgetMinor,
        input.targetSavingsMinor ?? null,
        input.startingBalanceMinor ?? null,
        input.notes ?? null,
        now,
        now,
      );

      const row = await db.getFirstAsync<MonthlyBudgetRow>(
        'SELECT * FROM monthly_budgets WHERE month_key = ? LIMIT 1',
        input.monthKey,
      );

      if (!row) {
        throw new Error('Nie udało się zapisać budżetu miesięcznego.');
      }

      return mapMonthlyBudget(row);
    },

    async upsertCategoryBudget(input: UpsertCategoryBudgetInput) {
      const db = await context.getDb();
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM category_budgets WHERE category_id = ? AND month_key = ? LIMIT 1',
        input.categoryId,
        input.monthKey,
      );
      const now = toIsoTimestamp();
      const id = existing?.id ?? createEntityId('category_budget');

      await db.runAsync(
        `
          INSERT INTO category_budgets (
            id, category_id, month_key, limit_amount_minor, currency_code,
            rollover_enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(category_id, month_key) DO UPDATE SET
            limit_amount_minor = excluded.limit_amount_minor,
            currency_code = excluded.currency_code,
            rollover_enabled = excluded.rollover_enabled,
            updated_at = excluded.updated_at
        `,
        id,
        input.categoryId,
        input.monthKey,
        input.limitAmountMinor,
        input.currencyCode,
        input.rolloverEnabled ? 1 : 0,
        now,
        now,
      );

      const row = await db.getFirstAsync<CategoryBudgetRow>(
        'SELECT * FROM category_budgets WHERE category_id = ? AND month_key = ? LIMIT 1',
        input.categoryId,
        input.monthKey,
      );

      if (!row) {
        throw new Error('Nie udało się zapisać budżetu kategorii.');
      }

      return mapCategoryBudget(row);
    },
  };
}
