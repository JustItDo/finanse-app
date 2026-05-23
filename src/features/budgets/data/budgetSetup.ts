import type { Category, TransactionType } from '@/src/domain/finance';
import type { AppRepositories } from '@/src/storage';
import { DEFAULT_CURRENCY_CODE } from '@/src/storage/sqlite/constants';

export type BudgetCategoryItem = {
  category: Category;
  isActive: boolean;
  budgetLimitMinor: number | null;
  spentMinor: number;
  remainingMinor: number | null;
  isOverBudget: boolean;
  transactionType: TransactionType | 'both';
};

export type BudgetSetupState = {
  monthKey: string;
  currencyCode: string;
  monthlyBudgetMinor: number | null;
  monthlySpentMinor: number;
  monthlyRemainingMinor: number | null;
  configuredCategoryBudgetsMinor: number;
  monthlyBudgetGapMinor: number | null;
  targetSavingsMinor: number | null;
  hasMonthlyBudget: boolean;
  hasAnyActiveCategory: boolean;
  hasAnyConfiguredCategoryBudget: boolean;
  uncappedExpenseCategoriesCount: number;
  expenseCategories: BudgetCategoryItem[];
  incomeCategories: BudgetCategoryItem[];
};

export async function loadBudgetSetup(
  repositories: AppRepositories,
  monthKey: string,
): Promise<BudgetSetupState> {
  const [categories, monthlyBudget, categoryBudgets, monthSummary, expenseTotals] = await Promise.all([
    repositories.categories.listAll(),
    repositories.budgets.getMonthlyBudget(monthKey),
    repositories.budgets.listCategoryBudgets(monthKey),
    repositories.transactions.getMonthSummary(monthKey),
    repositories.transactions.getExpenseTotalsByCategory(monthKey),
  ]);

  const budgetByCategoryId = new Map(categoryBudgets.map((budget) => [budget.categoryId, budget]));
  const spentByCategoryId = new Map(expenseTotals.map((item) => [item.categoryId ?? '__uncategorized__', item.spentMinor]));

  const categoryItems = categories.map<BudgetCategoryItem>((category) => {
    const categoryBudget = budgetByCategoryId.get(category.id) ?? null;
    const spentMinor = spentByCategoryId.get(category.id) ?? 0;
    const remainingMinor = categoryBudget ? categoryBudget.limitAmountMinor - spentMinor : null;

    return {
      budgetLimitMinor: categoryBudget?.limitAmountMinor ?? null,
      category,
      isActive: !category.isArchived,
      isOverBudget: remainingMinor !== null && remainingMinor < 0,
      remainingMinor,
      spentMinor,
      transactionType: category.transactionType,
    };
  });

  const expenseCategories = categoryItems.filter(
    (item) => item.transactionType === 'expense' || item.transactionType === 'both',
  );
  const incomeCategories = categoryItems.filter((item) => item.transactionType === 'income');
  const configuredCategoryBudgetsMinor = expenseCategories.reduce(
    (sum, item) => sum + (item.budgetLimitMinor ?? 0),
    0,
  );
  const monthlyBudgetMinor = monthlyBudget?.totalBudgetMinor ?? null;
  const monthlyRemainingMinor =
    monthlyBudgetMinor === null ? null : monthlyBudgetMinor - monthSummary.expenseMinor;

  return {
    configuredCategoryBudgetsMinor,
    currencyCode: monthlyBudget?.currencyCode ?? DEFAULT_CURRENCY_CODE,
    expenseCategories,
    hasAnyActiveCategory: categoryItems.some((item) => item.isActive),
    hasAnyConfiguredCategoryBudget: expenseCategories.some((item) => item.budgetLimitMinor !== null),
    hasMonthlyBudget: monthlyBudgetMinor !== null,
    incomeCategories,
    monthKey,
    monthlyBudgetGapMinor:
      monthlyBudgetMinor === null ? null : monthlyBudgetMinor - configuredCategoryBudgetsMinor,
    monthlyBudgetMinor,
    monthlyRemainingMinor,
    monthlySpentMinor: monthSummary.expenseMinor,
    targetSavingsMinor: monthlyBudget?.targetSavingsMinor ?? null,
    uncappedExpenseCategoriesCount: expenseCategories.filter(
      (item) => item.isActive && item.budgetLimitMinor === null,
    ).length,
  };
}

export async function saveMonthlyBudgetConfig(
  repositories: AppRepositories,
  input: {
    monthKey: string;
    currencyCode: string;
    totalBudgetMinor: number | null;
  },
) {
  if (input.totalBudgetMinor === null) {
    await repositories.budgets.clearMonthlyBudget(input.monthKey);
    return;
  }

  await repositories.budgets.upsertMonthlyBudget({
    currencyCode: input.currencyCode,
    monthKey: input.monthKey,
    totalBudgetMinor: input.totalBudgetMinor,
  });
}

export async function saveCategoryConfig(
  repositories: AppRepositories,
  input: {
    categoryId: string;
    categoryName: string;
    isActive: boolean;
    monthKey: string;
    currencyCode: string;
    transactionType: Category['transactionType'];
    limitAmountMinor: number | null;
  },
) {
  await repositories.categories.updateCategory({
    id: input.categoryId,
    isArchived: !input.isActive,
    name: input.categoryName,
  });

  const supportsBudget = input.transactionType === 'expense' || input.transactionType === 'both';

  if (!supportsBudget || !input.isActive) {
    await repositories.budgets.removeCategoryBudget(input.categoryId, input.monthKey);
    return;
  }

  if (input.limitAmountMinor === null) {
    await repositories.budgets.removeCategoryBudget(input.categoryId, input.monthKey);
    return;
  }

  await repositories.budgets.upsertCategoryBudget({
    categoryId: input.categoryId,
    currencyCode: input.currencyCode,
    limitAmountMinor: input.limitAmountMinor,
    monthKey: input.monthKey,
  });
}
