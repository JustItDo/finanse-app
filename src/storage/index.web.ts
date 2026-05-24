import type { Attachment, Category, CategoryBudget, MonthlyBudget, Transaction, TransactionType } from '@/src/domain/finance';
import { obsidianIntegrationConfig } from '@/src/shared/config/obsidian';
import { getCurrentMonthKey, toIsoTimestamp } from '@/src/shared/utils/date';
import { createEntityId } from '@/src/shared/utils/id';
import { DEFAULT_CURRENCY_CODE, DATABASE_SCHEMA_VERSION } from '@/src/storage/sqlite/constants';
import type {
  TransactionHistoryFilters,
  UpdateTransactionInput,
} from '@/src/storage/sqlite/repositories/TransactionsRepository';
import { seedCategories } from '@/src/storage/seedData';

const WEB_STORAGE_KEY = 'finansowy-copilot-web-store';

type WebStore = {
  schemaVersion: number;
  categories: Category[];
  categoryBudgets: CategoryBudget[];
  monthlyBudgets: MonthlyBudget[];
  transactions: Transaction[];
  attachments: Attachment[];
};

let memoryStore: WebStore | null = null;

function createSeededStore(): WebStore {
  const now = toIsoTimestamp();

  return {
    attachments: [],
    categories: seedCategories.map((category) => ({
      color: category.color,
      createdAt: now,
      icon: category.icon,
      id: category.id,
      isArchived: false,
      isSystem: true,
      name: category.name,
      sortOrder: category.sortOrder,
      transactionType: category.transactionType,
      updatedAt: now,
    })),
    categoryBudgets: [],
    monthlyBudgets: [],
    schemaVersion: DATABASE_SCHEMA_VERSION,
    transactions: [],
  };
}

function canUseLocalStorage() {
  return typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage !== null;
}

function readStore(): WebStore {
  if (memoryStore) {
    return memoryStore;
  }

  if (canUseLocalStorage()) {
    const raw = globalThis.localStorage.getItem(WEB_STORAGE_KEY);

    if (raw) {
      memoryStore = JSON.parse(raw) as WebStore;
      return memoryStore;
    }
  }

  memoryStore = createSeededStore();
  writeStore(memoryStore);

  return memoryStore;
}

function writeStore(store: WebStore) {
  memoryStore = store;

  if (canUseLocalStorage()) {
    globalThis.localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(store));
  }
}

export async function createStorageServices() {
  readStore();

  return {
    repositories: {
      attachments: {
        async create(input: {
          transactionId?: string | null;
          kind: Attachment['kind'];
          fileUri: string;
          fileName?: string | null;
          mimeType?: string | null;
          fileSizeBytes?: number | null;
          sourceType?: Attachment['sourceType'];
          sourceReference?: string | null;
          ocrStatus?: Attachment['ocrStatus'];
          ocrConfidence?: number | null;
          ocrRawText?: string | null;
        }) {
          const store = readStore();
          const now = toIsoTimestamp();
          const attachment: Attachment = {
            createdAt: now,
            fileName: input.fileName ?? null,
            fileSizeBytes: input.fileSizeBytes ?? null,
            fileUri: input.fileUri,
            id: createEntityId('attachment'),
            kind: input.kind,
            mimeType: input.mimeType ?? null,
            ocrConfidence: input.ocrConfidence ?? null,
            ocrRawText: input.ocrRawText ?? null,
            ocrStatus: input.ocrStatus ?? 'not_requested',
            sourceReference: input.sourceReference ?? null,
            sourceType: input.sourceType ?? 'manual',
            storageType: 'local_file',
            transactionId: input.transactionId ?? null,
            updatedAt: now,
          };

          store.attachments.unshift(attachment);
          writeStore(store);

          return attachment;
        },

        async listByTransactionId(transactionId: string) {
          return readStore().attachments.filter((attachment) => attachment.transactionId === transactionId);
        },

        async linkToTransaction(attachmentId: string, transactionId: string) {
          const store = readStore();
          const attachment = store.attachments.find((item) => item.id === attachmentId);

          if (!attachment) {
            throw new Error('Nie znaleziono załącznika do powiązania.');
          }

          attachment.transactionId = transactionId;
          attachment.updatedAt = toIsoTimestamp();
          writeStore(store);

          return attachment;
        },
      },

      budgets: {
        async clearMonthlyBudget(monthKey: string) {
          const store = readStore();
          store.monthlyBudgets = store.monthlyBudgets.filter((budget) => budget.monthKey !== monthKey);
          writeStore(store);
        },

        async getMonthlyBudget(monthKey: string) {
          return readStore().monthlyBudgets.find((budget) => budget.monthKey === monthKey) ?? null;
        },

        async listCategoryBudgets(monthKey: string) {
          return readStore().categoryBudgets.filter((budget) => budget.monthKey === monthKey);
        },

        async removeCategoryBudget(categoryId: string, monthKey: string) {
          const store = readStore();
          store.categoryBudgets = store.categoryBudgets.filter(
            (budget) => !(budget.categoryId === categoryId && budget.monthKey === monthKey),
          );
          writeStore(store);
        },

        async upsertCategoryBudget(input: {
          categoryId: string;
          monthKey: string;
          currencyCode: string;
          limitAmountMinor: number;
          rolloverEnabled?: boolean;
        }) {
          const store = readStore();
          const existing = store.categoryBudgets.find(
            (budget) => budget.categoryId === input.categoryId && budget.monthKey === input.monthKey,
          );
          const now = toIsoTimestamp();

          if (existing) {
            existing.currencyCode = input.currencyCode;
            existing.limitAmountMinor = input.limitAmountMinor;
            existing.rolloverEnabled = input.rolloverEnabled ?? false;
            existing.updatedAt = now;
            writeStore(store);
            return existing;
          }

          const budget: CategoryBudget = {
            categoryId: input.categoryId,
            createdAt: now,
            currencyCode: input.currencyCode,
            id: createEntityId('category_budget'),
            limitAmountMinor: input.limitAmountMinor,
            monthKey: input.monthKey,
            rolloverEnabled: input.rolloverEnabled ?? false,
            updatedAt: now,
          };

          store.categoryBudgets.push(budget);
          writeStore(store);
          return budget;
        },

        async upsertMonthlyBudget(input: {
          monthKey: string;
          currencyCode: string;
          totalBudgetMinor: number;
          targetSavingsMinor?: number | null;
          startingBalanceMinor?: number | null;
          notes?: string | null;
        }) {
          const store = readStore();
          const existing = store.monthlyBudgets.find((budget) => budget.monthKey === input.monthKey);
          const now = toIsoTimestamp();

          if (existing) {
            existing.currencyCode = input.currencyCode;
            existing.totalBudgetMinor = input.totalBudgetMinor;
            existing.targetSavingsMinor = input.targetSavingsMinor ?? null;
            existing.startingBalanceMinor = input.startingBalanceMinor ?? null;
            existing.notes = input.notes ?? null;
            existing.updatedAt = now;
            writeStore(store);
            return existing;
          }

          const monthlyBudget: MonthlyBudget = {
            createdAt: now,
            currencyCode: input.currencyCode,
            id: createEntityId('monthly_budget'),
            monthKey: input.monthKey,
            notes: input.notes ?? null,
            startingBalanceMinor: input.startingBalanceMinor ?? null,
            targetSavingsMinor: input.targetSavingsMinor ?? null,
            totalBudgetMinor: input.totalBudgetMinor,
            updatedAt: now,
          };

          store.monthlyBudgets.push(monthlyBudget);
          writeStore(store);
          return monthlyBudget;
        },
      },

      categories: {
        async count() {
          return readStore().categories.length;
        },

        async listAll() {
          return readStore().categories.slice().sort((left, right) => left.sortOrder - right.sortOrder);
        },

        async listByTransactionType(type: TransactionType | 'all' = 'all') {
          const categories = readStore().categories.filter((category) => !category.isArchived);

          if (type === 'all') {
            return categories;
          }

          return categories.filter(
            (category) => category.transactionType === type || category.transactionType === 'both',
          );
        },

        async updateCategory(input: { id: string; name: string; isArchived: boolean }) {
          const store = readStore();
          const category = store.categories.find((item) => item.id === input.id);

          if (!category) {
            throw new Error('Nie znaleziono kategorii do aktualizacji.');
          }

          category.name = input.name.trim();
          category.isArchived = input.isArchived;
          category.updatedAt = toIsoTimestamp();
          writeStore(store);

          return category;
        },
      },

      dashboard: {
        async getSnapshot(monthKey = getCurrentMonthKey()) {
          const store = readStore();
          const monthTransactions = store.transactions.filter((transaction) =>
            transaction.occurredAt.startsWith(monthKey),
          );

          return {
            categoriesCount: store.categories.length,
            categoryBudgetsCount: store.categoryBudgets.filter((budget) => budget.monthKey === monthKey).length,
            currencyCode:
              store.monthlyBudgets.find((budget) => budget.monthKey === monthKey)?.currencyCode ??
              DEFAULT_CURRENCY_CODE,
            expenseTotalMinor: monthTransactions
              .filter((transaction) => transaction.type === 'expense')
              .reduce((sum, transaction) => sum + transaction.amountMinor, 0),
            incomeTotalMinor: monthTransactions
              .filter((transaction) => transaction.type === 'income')
              .reduce((sum, transaction) => sum + transaction.amountMinor, 0),
            monthKey,
            monthlyBudgetMinor:
              store.monthlyBudgets.find((budget) => budget.monthKey === monthKey)?.totalBudgetMinor ?? 0,
            obsidianVaultRelativePath: obsidianIntegrationConfig.relativeVaultPathFromApp,
            recentTransactionsCount: store.transactions.length,
            schemaVersion: store.schemaVersion,
          };
        },
      },

      transactions: {
        async count() {
          return readStore().transactions.length;
        },

        async create(input: {
          type: TransactionType;
          amountMinor: number;
          currencyCode?: string;
          occurredAt: string;
          categoryId?: string | null;
          description?: string | null;
          paymentMethod?: Transaction['paymentMethod'];
          sourceType?: Transaction['sourceType'];
          sourceReference?: string | null;
          note?: string | null;
          ocrStatus?: Transaction['ocrStatus'];
          ocrConfidence?: number | null;
          ocrRawText?: string | null;
          ocrAttachmentSource?: string | null;
        }) {
          const store = readStore();
          const now = toIsoTimestamp();
          const transaction: Transaction = {
            amountMinor: input.amountMinor,
            categoryId: input.categoryId ?? null,
            createdAt: now,
            currencyCode: input.currencyCode ?? DEFAULT_CURRENCY_CODE,
            description: input.description ?? null,
            id: createEntityId('transaction'),
            note: input.note ?? null,
            occurredAt: input.occurredAt,
            ocrAttachmentSource: input.ocrAttachmentSource ?? null,
            ocrConfidence: input.ocrConfidence ?? null,
            ocrRawText: input.ocrRawText ?? null,
            ocrStatus: input.ocrStatus ?? 'not_requested',
            paymentMethod: input.paymentMethod ?? 'other',
            sourceReference: input.sourceReference ?? null,
            sourceType: input.sourceType ?? 'manual',
            type: input.type,
            updatedAt: now,
          };

          store.transactions.unshift(transaction);
          writeStore(store);
          return transaction;
        },

        async getById(id: string) {
          const store = readStore();
          const transaction = store.transactions.find((item) => item.id === id);

          if (!transaction) {
            return null;
          }

          return {
            amountMinor: transaction.amountMinor,
            categoryId: transaction.categoryId,
            categoryName: store.categories.find((category) => category.id === transaction.categoryId)?.name ?? null,
            createdAt: transaction.createdAt,
            currencyCode: transaction.currencyCode,
            description: transaction.description,
            id: transaction.id,
            note: transaction.note,
            occurredAt: transaction.occurredAt,
            ocrAttachmentSource: transaction.ocrAttachmentSource,
            ocrConfidence: transaction.ocrConfidence,
            ocrRawText: transaction.ocrRawText,
            ocrStatus: transaction.ocrStatus,
            paymentMethod: transaction.paymentMethod,
            sourceReference: transaction.sourceReference,
            sourceType: transaction.sourceType,
            type: transaction.type,
            updatedAt: transaction.updatedAt,
          };
        },

        async getMonthSummary(monthKey: string) {
          const transactions = readStore().transactions.filter((transaction) =>
            transaction.occurredAt.startsWith(monthKey),
          );
          const incomeMinor = transactions
            .filter((transaction) => transaction.type === 'income')
            .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
          const expenseMinor = transactions
            .filter((transaction) => transaction.type === 'expense')
            .reduce((sum, transaction) => sum + transaction.amountMinor, 0);

          return {
            balanceMinor: incomeMinor - expenseMinor,
            expenseMinor,
            incomeMinor,
            transactionsCount: transactions.length,
          };
        },

        async getTotalsByCategory(monthKey: string, type: TransactionType) {
          const grouped = new Map<string | null, number>();

          readStore()
            .transactions.filter(
              (transaction) => transaction.type === type && transaction.occurredAt.startsWith(monthKey),
            )
            .forEach((transaction) => {
              const current = grouped.get(transaction.categoryId) ?? 0;
              grouped.set(transaction.categoryId, current + transaction.amountMinor);
            });

          return Array.from(grouped.entries()).map(([categoryId, totalMinor]) => ({
            categoryId,
            totalMinor,
          }));
        },

        async getDailyTotals(monthKey: string, type: TransactionType) {
          const grouped = new Map<string, number>();

          readStore()
            .transactions.filter(
              (transaction) => transaction.type === type && transaction.occurredAt.startsWith(monthKey),
            )
            .forEach((transaction) => {
              const occurredOn = transaction.occurredAt.slice(0, 10);
              const current = grouped.get(occurredOn) ?? 0;
              grouped.set(occurredOn, current + transaction.amountMinor);
            });

          return Array.from(grouped.entries())
            .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
            .map(([occurredOn, totalMinor]) => ({
              occurredOn,
              totalMinor,
            }));
        },

        async listRecent(limit = 20) {
          const store = readStore();

          return store.transactions
            .slice()
            .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
            .slice(0, limit)
            .map((transaction) => ({
              amountMinor: transaction.amountMinor,
              categoryId: transaction.categoryId,
              categoryName:
                store.categories.find((category) => category.id === transaction.categoryId)?.name ?? null,
              currencyCode: transaction.currencyCode,
              description: transaction.description,
              id: transaction.id,
              occurredAt: transaction.occurredAt,
              paymentMethod: transaction.paymentMethod,
              sourceType: transaction.sourceType,
              type: transaction.type,
            }));
        },

        async listHistory(filters: TransactionHistoryFilters = {}) {
          const store = readStore();
          const normalizedSearch = filters.searchText?.trim().toLocaleLowerCase('pl-PL') ?? '';

          return store.transactions
            .filter((transaction) => {
              if (filters.monthKey && !transaction.occurredAt.startsWith(filters.monthKey)) {
                return false;
              }

              if (filters.type && filters.type !== 'all' && transaction.type !== filters.type) {
                return false;
              }

              if (filters.categoryId && transaction.categoryId !== filters.categoryId) {
                return false;
              }

              if (!normalizedSearch) {
                return true;
              }

              const categoryName =
                store.categories.find((category) => category.id === transaction.categoryId)?.name ?? '';
              const haystack = [transaction.description ?? '', transaction.note ?? '', categoryName]
                .join(' ')
                .toLocaleLowerCase('pl-PL');

              return haystack.includes(normalizedSearch);
            })
            .sort((left, right) => {
              const occurredCompare = right.occurredAt.localeCompare(left.occurredAt);

              if (occurredCompare !== 0) {
                return occurredCompare;
              }

              return right.createdAt.localeCompare(left.createdAt);
            })
            .map((transaction) => ({
              amountMinor: transaction.amountMinor,
              categoryId: transaction.categoryId,
              categoryName:
                store.categories.find((category) => category.id === transaction.categoryId)?.name ?? null,
              currencyCode: transaction.currencyCode,
              description: transaction.description,
              id: transaction.id,
              occurredAt: transaction.occurredAt,
              paymentMethod: transaction.paymentMethod,
              sourceType: transaction.sourceType,
              type: transaction.type,
            }));
        },

        async listMonthsWithTransactions() {
          return Array.from(
            new Set(readStore().transactions.map((transaction) => transaction.occurredAt.slice(0, 7))),
          ).sort((left, right) => right.localeCompare(left));
        },

        async remove(id: string) {
          const store = readStore();
          store.transactions = store.transactions.filter((transaction) => transaction.id !== id);
          store.attachments = store.attachments.map((attachment) =>
            attachment.transactionId === id
              ? { ...attachment, transactionId: null, updatedAt: toIsoTimestamp() }
              : attachment,
          );
          writeStore(store);
        },

        async update(input: UpdateTransactionInput) {
          const store = readStore();
          const transaction = store.transactions.find((item) => item.id === input.id);

          if (!transaction) {
            throw new Error('Nie znaleziono transakcji do aktualizacji.');
          }

          transaction.amountMinor = input.amountMinor;
          transaction.categoryId = input.categoryId ?? null;
          transaction.currencyCode = input.currencyCode ?? DEFAULT_CURRENCY_CODE;
          transaction.description = input.description ?? null;
          transaction.note = input.note ?? null;
          transaction.occurredAt = input.occurredAt;
          transaction.paymentMethod = input.paymentMethod ?? 'other';
          transaction.type = input.type;
          transaction.updatedAt = toIsoTimestamp();
          writeStore(store);

          return transaction;
        },
      },
    },
  };
}

export function createBootstrapErrorRepositories() {
  const notReady = async () => {
    throw new Error('Warstwa danych nie jest jeszcze gotowa.');
  };

  return {
    attachments: {
      create: notReady,
      linkToTransaction: notReady,
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
        currencyCode: DEFAULT_CURRENCY_CODE,
        expenseTotalMinor: 0,
        incomeTotalMinor: 0,
        monthKey: getCurrentMonthKey(),
        monthlyBudgetMinor: 0,
        obsidianVaultRelativePath: obsidianIntegrationConfig.relativeVaultPathFromApp,
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
