import { getCurrentMonthKey } from '@/src/shared/utils/date';
import {
  createDatabaseContext,
  getDatabase,
} from '@/src/storage/sqlite/database';
import { createAttachmentsRepository } from '@/src/storage/sqlite/repositories/AttachmentsRepository';
import { createBackupRepository } from '@/src/storage/sqlite/repositories/BackupRepository';
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
      backup: createBackupRepository(context),
      budgets: createBudgetsRepository(context),
      categories: createCategoriesRepository(context),
      dashboard: createDashboardRepository(context),
      transactions: createTransactionsRepository(context),
    },
  };
}

export type AppRepositories = Awaited<
  ReturnType<typeof createStorageServices>
>['repositories'];

export function createBootstrapErrorRepositories(): AppRepositories {
  const notReady = async () => {
    throw new Error('Warstwa danych nie jest jeszcze gotowa.');
  };

  return {
    attachments: {
      create: notReady,
      linkToTransaction: notReady,
      listByTransactionId: notReady,
    },
    backup: {
      exportBackup: notReady,
      importBackup: notReady,
      saveBackupToFiles: notReady,
      shareBackup: notReady,
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
      createCategory: notReady,
      deleteCategory: notReady,
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
      getById: notReady,
      getDailyTotals: notReady,
      getTotalsByCategory: notReady,
      getMonthSummary: notReady,
      listHistory: notReady,
      listMonthsWithTransactions: notReady,
      listRecent: notReady,
      remove: notReady,
      update: notReady,
    },
  };
}
