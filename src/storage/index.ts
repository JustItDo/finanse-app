import { getCurrentMonthKey } from '@/src/shared/utils/date';
import { createDatabaseContext, getDatabase } from '@/src/storage/sqlite/database';
import { createAttachmentsRepository } from '@/src/storage/sqlite/repositories/AttachmentsRepository';
import { createBudgetsRepository } from '@/src/storage/sqlite/repositories/BudgetsRepository';
import { createCategoriesRepository } from '@/src/storage/sqlite/repositories/CategoriesRepository';
import { createDashboardRepository } from '@/src/storage/sqlite/repositories/DashboardRepository';
import { createTransactionsRepository } from '@/src/storage/sqlite/repositories/TransactionsRepository';

export async function createStorageServices() {
  await getDatabase();

  const context = createDatabaseContext();

  return {
    repositories: {
      attachments: createAttachmentsRepository(context),
      budgets: createBudgetsRepository(context),
      categories: createCategoriesRepository(context),
      dashboard: createDashboardRepository(context),
      transactions: createTransactionsRepository(context),
    },
  };
}

export type AppRepositories = Awaited<ReturnType<typeof createStorageServices>>['repositories'];

export function createBootstrapErrorRepositories(): AppRepositories {
  const notReady = async () => {
    throw new Error('Warstwa danych nie jest jeszcze gotowa.');
  };

  return {
    attachments: {
      create: notReady,
      listByTransactionId: notReady,
    },
    budgets: {
      clearMonthlyBudget: notReady,
      getMonthlyBudget: notReady,
      listCategoryBudgets: notReady,
      removeCategoryBudget: notReady,
      upsertCategoryBudget: notReady,
      upsertMonthlyBudget: notReady,
    },
    categories: {
      count: notReady,
      listAll: notReady,
      listByTransactionType: notReady,
      updateCategory: notReady,
    },
    dashboard: {
      getSnapshot: async () => ({
        categoryBudgetsCount: 0,
        categoriesCount: 0,
        currencyCode: 'PLN',
        expenseTotalMinor: 0,
        incomeTotalMinor: 0,
        monthKey: getCurrentMonthKey(),
        monthlyBudgetMinor: 0,
        obsidianVaultRelativePath: '../obsidian value',
        recentTransactionsCount: 0,
        schemaVersion: 0,
      }),
    },
    transactions: {
      count: notReady,
      create: notReady,
      getTotalsByCategory: notReady,
      getMonthSummary: notReady,
      listRecent: notReady,
    },
  };
}
