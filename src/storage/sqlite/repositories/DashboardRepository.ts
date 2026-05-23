import { obsidianIntegrationConfig } from '@/src/shared/config/obsidian';
import { DEFAULT_CURRENCY_CODE } from '@/src/storage/sqlite/constants';
import type { DatabaseContext } from '@/src/storage/sqlite/database';
import { getCurrentMonthKey } from '@/src/shared/utils/date';

export type DashboardSnapshot = {
  schemaVersion: number;
  monthKey: string;
  categoriesCount: number;
  categoryBudgetsCount: number;
  recentTransactionsCount: number;
  incomeTotalMinor: number;
  expenseTotalMinor: number;
  monthlyBudgetMinor: number;
  currencyCode: string;
  obsidianVaultRelativePath: string;
};

export function createDashboardRepository(context: DatabaseContext) {
  return {
    async getSnapshot(monthKey = getCurrentMonthKey()): Promise<DashboardSnapshot> {
      const db = await context.getDb();
      const [schemaVersion, categoriesCount, categoryBudgetsCount, recentTransactionsCount, incomeTotal, expenseTotal, monthlyBudget] =
        await Promise.all([
          db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;'),
          db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM categories'),
          db.getFirstAsync<{ total: number }>(
            'SELECT COUNT(*) AS total FROM category_budgets WHERE month_key = ?',
            monthKey,
          ),
          db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM transactions'),
          db.getFirstAsync<{ total: number }>(
            `
              SELECT COALESCE(SUM(amount_minor), 0) AS total
              FROM transactions
              WHERE type = 'income' AND substr(occurred_at, 1, 7) = ?
            `,
            monthKey,
          ),
          db.getFirstAsync<{ total: number }>(
            `
              SELECT COALESCE(SUM(amount_minor), 0) AS total
              FROM transactions
              WHERE type = 'expense' AND substr(occurred_at, 1, 7) = ?
            `,
            monthKey,
          ),
          db.getFirstAsync<{ total_budget_minor: number; currency_code: string }>(
            'SELECT total_budget_minor, currency_code FROM monthly_budgets WHERE month_key = ? LIMIT 1',
            monthKey,
          ),
        ]);

      return {
        categoriesCount: categoriesCount?.total ?? 0,
        categoryBudgetsCount: categoryBudgetsCount?.total ?? 0,
        currencyCode: monthlyBudget?.currency_code ?? DEFAULT_CURRENCY_CODE,
        expenseTotalMinor: expenseTotal?.total ?? 0,
        incomeTotalMinor: incomeTotal?.total ?? 0,
        monthKey,
        monthlyBudgetMinor: monthlyBudget?.total_budget_minor ?? 0,
        obsidianVaultRelativePath: obsidianIntegrationConfig.relativeVaultPathFromApp,
        recentTransactionsCount: recentTransactionsCount?.total ?? 0,
        schemaVersion: schemaVersion?.user_version ?? 0,
      };
    },
  };
}
