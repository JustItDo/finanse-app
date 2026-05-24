import type { Category, TransactionType } from '@/src/domain/finance';
import type { AppRepositories } from '@/src/storage';
import { DEFAULT_CURRENCY_CODE } from '@/src/storage/sqlite/constants';

export const BUDGET_WARNING_RATIO = 0.85;

export type BudgetCategoryStatus =
  | 'income'
  | 'inactive'
  | 'no_limit'
  | 'on_track'
  | 'warning'
  | 'over_budget';

export type BudgetMonthStatus = 'no_budget' | 'on_track' | 'warning' | 'over_budget';

export type BudgetCategoryItem = {
  category: Category;
  isActive: boolean;
  budgetLimitMinor: number | null;
  spentMinor: number;
  remainingMinor: number | null;
  isOverBudget: boolean;
  transactionType: TransactionType | 'both';
  usageRatio: number | null;
  usagePercent: number | null;
  status: BudgetCategoryStatus;
};

export type BudgetSetupState = {
  monthKey: string;
  currencyCode: string;
  monthlyBudgetMinor: number | null;
  monthlyIncomeMinor: number;
  monthlySpentMinor: number;
  monthlyRemainingMinor: number | null;
  monthlyBalanceMinor: number;
  monthlyBudgetUsageRatio: number | null;
  monthlyBudgetUsagePercent: number | null;
  monthlyBudgetStatus: BudgetMonthStatus;
  transactionsCount: number;
  configuredCategoryBudgetsMinor: number;
  monthlyBudgetGapMinor: number | null;
  targetSavingsMinor: number | null;
  hasMonthlyBudget: boolean;
  hasAnyActiveCategory: boolean;
  hasAnyConfiguredCategoryBudget: boolean;
  uncappedExpenseCategoriesCount: number;
  activeExpenseCategoriesCount: number;
  categoriesAtRiskCount: number;
  overBudgetCategoriesCount: number;
  expenseCategories: BudgetCategoryItem[];
  incomeCategories: BudgetCategoryItem[];
  problemExpenseCategories: BudgetCategoryItem[];
  stableExpenseCategories: BudgetCategoryItem[];
  uncappedExpenseCategories: BudgetCategoryItem[];
  inactiveExpenseCategories: BudgetCategoryItem[];
};

function getUsageRatio(limitMinor: number | null, spentMinor: number) {
  if (limitMinor === null || limitMinor <= 0) {
    return null;
  }

  return spentMinor / limitMinor;
}

function getUsagePercent(limitMinor: number | null, spentMinor: number) {
  const usageRatio = getUsageRatio(limitMinor, spentMinor);

  if (usageRatio === null) {
    return null;
  }

  return Math.round(usageRatio * 100);
}

function getExpenseStatus(input: {
  isActive: boolean;
  limitMinor: number | null;
  spentMinor: number;
}): BudgetCategoryStatus {
  if (!input.isActive) {
    return 'inactive';
  }

  if (input.limitMinor === null) {
    return 'no_limit';
  }

  if (input.spentMinor > input.limitMinor) {
    return 'over_budget';
  }

  const usageRatio = getUsageRatio(input.limitMinor, input.spentMinor);

  if (usageRatio !== null && usageRatio >= BUDGET_WARNING_RATIO) {
    return 'warning';
  }

  return 'on_track';
}

function getMonthlyStatus(monthlyBudgetMinor: number | null, spentMinor: number): BudgetMonthStatus {
  if (monthlyBudgetMinor === null) {
    return 'no_budget';
  }

  if (spentMinor > monthlyBudgetMinor) {
    return 'over_budget';
  }

  const usageRatio = getUsageRatio(monthlyBudgetMinor, spentMinor);

  if (usageRatio !== null && usageRatio >= BUDGET_WARNING_RATIO) {
    return 'warning';
  }

  return 'on_track';
}

function getStatusSeverity(status: BudgetCategoryStatus) {
  switch (status) {
    case 'over_budget':
      return 4;
    case 'warning':
      return 3;
    case 'on_track':
      return 2;
    case 'no_limit':
      return 1;
    case 'inactive':
      return 0;
    case 'income':
      return 0;
  }
}

function sortBudgetItems(left: BudgetCategoryItem, right: BudgetCategoryItem) {
  if (left.isActive !== right.isActive) {
    return left.isActive ? -1 : 1;
  }

  const severityDifference = getStatusSeverity(right.status) - getStatusSeverity(left.status);

  if (severityDifference !== 0) {
    return severityDifference;
  }

  const ratioLeft = left.usageRatio ?? -1;
  const ratioRight = right.usageRatio ?? -1;

  if (ratioLeft !== ratioRight) {
    return ratioRight - ratioLeft;
  }

  if (right.spentMinor !== left.spentMinor) {
    return right.spentMinor - left.spentMinor;
  }

  return left.category.name.localeCompare(right.category.name, 'pl');
}

function sortIncomeItems(left: BudgetCategoryItem, right: BudgetCategoryItem) {
  if (left.isActive !== right.isActive) {
    return left.isActive ? -1 : 1;
  }

  if (right.spentMinor !== left.spentMinor) {
    return right.spentMinor - left.spentMinor;
  }

  return left.category.name.localeCompare(right.category.name, 'pl');
}

export async function loadBudgetSetup(
  repositories: AppRepositories,
  monthKey: string,
): Promise<BudgetSetupState> {
  const [categories, monthlyBudget, categoryBudgets, monthSummary, expenseTotals, incomeTotals] = await Promise.all([
    repositories.categories.listAll(),
    repositories.budgets.getMonthlyBudget(monthKey),
    repositories.budgets.listCategoryBudgets(monthKey),
    repositories.transactions.getMonthSummary(monthKey),
    repositories.transactions.getTotalsByCategory(monthKey, 'expense'),
    repositories.transactions.getTotalsByCategory(monthKey, 'income'),
  ]);

  const budgetByCategoryId = new Map(categoryBudgets.map((budget) => [budget.categoryId, budget]));
  const expenseByCategoryId = new Map(expenseTotals.map((item) => [item.categoryId ?? '__uncategorized__', item.totalMinor]));
  const incomeByCategoryId = new Map(incomeTotals.map((item) => [item.categoryId ?? '__uncategorized__', item.totalMinor]));

  const categoryItems = categories.map<BudgetCategoryItem>((category) => {
    const categoryBudget = budgetByCategoryId.get(category.id) ?? null;
    const isIncome = category.transactionType === 'income';
    const spentMinor = isIncome
      ? incomeByCategoryId.get(category.id) ?? 0
      : expenseByCategoryId.get(category.id) ?? 0;
    const budgetLimitMinor = isIncome ? null : (categoryBudget?.limitAmountMinor ?? null);
    const remainingMinor = budgetLimitMinor === null ? null : budgetLimitMinor - spentMinor;
    const status = isIncome
      ? 'income'
      : getExpenseStatus({
          isActive: !category.isArchived,
          limitMinor: budgetLimitMinor,
          spentMinor,
        });

    return {
      budgetLimitMinor,
      category,
      isActive: !category.isArchived,
      isOverBudget: status === 'over_budget',
      remainingMinor,
      spentMinor,
      status,
      transactionType: category.transactionType,
      usagePercent: isIncome ? null : getUsagePercent(budgetLimitMinor, spentMinor),
      usageRatio: isIncome ? null : getUsageRatio(budgetLimitMinor, spentMinor),
    };
  });

  const expenseCategories = categoryItems
    .filter((item) => item.transactionType === 'expense' || item.transactionType === 'both')
    .sort(sortBudgetItems);
  const incomeCategories = categoryItems.filter((item) => item.transactionType === 'income').sort(sortIncomeItems);

  const problemExpenseCategories = expenseCategories.filter(
    (item) => item.status === 'warning' || item.status === 'over_budget',
  );
  const stableExpenseCategories = expenseCategories.filter(
    (item) => item.status === 'on_track' && item.isActive,
  );
  const uncappedExpenseCategories = expenseCategories.filter((item) => item.status === 'no_limit');
  const inactiveExpenseCategories = expenseCategories.filter((item) => item.status === 'inactive');

  const configuredCategoryBudgetsMinor = expenseCategories.reduce(
    (sum, item) => sum + (item.budgetLimitMinor ?? 0),
    0,
  );
  const monthlyBudgetMinor = monthlyBudget?.totalBudgetMinor ?? null;
  const monthlyRemainingMinor =
    monthlyBudgetMinor === null ? null : monthlyBudgetMinor - monthSummary.expenseMinor;

  return {
    activeExpenseCategoriesCount: expenseCategories.filter((item) => item.isActive).length,
    categoriesAtRiskCount: problemExpenseCategories.length,
    configuredCategoryBudgetsMinor,
    currencyCode: monthlyBudget?.currencyCode ?? DEFAULT_CURRENCY_CODE,
    expenseCategories,
    hasAnyActiveCategory: categoryItems.some((item) => item.isActive),
    hasAnyConfiguredCategoryBudget: expenseCategories.some((item) => item.budgetLimitMinor !== null),
    hasMonthlyBudget: monthlyBudgetMinor !== null,
    inactiveExpenseCategories,
    incomeCategories,
    monthKey,
    monthlyBalanceMinor: monthSummary.balanceMinor,
    monthlyBudgetGapMinor:
      monthlyBudgetMinor === null ? null : monthlyBudgetMinor - configuredCategoryBudgetsMinor,
    monthlyBudgetMinor,
    monthlyBudgetStatus: getMonthlyStatus(monthlyBudgetMinor, monthSummary.expenseMinor),
    monthlyBudgetUsagePercent: getUsagePercent(monthlyBudgetMinor, monthSummary.expenseMinor),
    monthlyBudgetUsageRatio: getUsageRatio(monthlyBudgetMinor, monthSummary.expenseMinor),
    monthlyIncomeMinor: monthSummary.incomeMinor,
    monthlyRemainingMinor,
    monthlySpentMinor: monthSummary.expenseMinor,
    overBudgetCategoriesCount: expenseCategories.filter((item) => item.status === 'over_budget').length,
    problemExpenseCategories,
    stableExpenseCategories,
    targetSavingsMinor: monthlyBudget?.targetSavingsMinor ?? null,
    transactionsCount: monthSummary.transactionsCount,
    uncappedExpenseCategories,
    uncappedExpenseCategoriesCount: uncappedExpenseCategories.length,
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

  if (!input.isActive) {
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
