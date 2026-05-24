import { loadBudgetSetup } from '@/src/features/budgets/data/budgetSetup';
import { formatMonthKeyLabel } from '@/src/shared/utils/date';
import type { AppRepositories } from '@/src/storage';

const MAX_HIGHLIGHT_CATEGORIES = 4;

export type DashboardCategoryHighlight = {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  spentMinor: number;
  limitMinor: number;
  remainingMinor: number;
  usageRatio: number;
  status: 'on_track' | 'warning' | 'over_budget';
};

export type DashboardState = {
  monthKey: string;
  monthLabel: string;
  currencyCode: string;
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
  monthlyBudgetMinor: number | null;
  monthlyRemainingMinor: number | null;
  overBudgetCategoriesCount: number;
  categoriesWithBudgetCount: number;
  transactionsCount: number;
  highlightCategories: DashboardCategoryHighlight[];
  hasConfiguredBudgets: boolean;
  hasAnyTransactions: boolean;
  isEmpty: boolean;
};

export async function loadDashboardState(
  repositories: AppRepositories,
  monthKey: string,
): Promise<DashboardState> {
  const setup = await loadBudgetSetup(repositories, monthKey);

  const highlightCategories = setup.expenseCategories
    .filter((item) => item.budgetLimitMinor !== null && item.isActive)
    .map<DashboardCategoryHighlight>((item) => {
      const limitMinor = item.budgetLimitMinor ?? 0;
      const spentMinor = item.spentMinor;
      const remainingMinor = item.remainingMinor ?? 0;
      const usageRatio = item.usageRatio ?? 0;

      return {
        categoryId: item.category.id,
        color: item.category.color,
        icon: item.category.icon,
        limitMinor,
        name: item.category.name,
        remainingMinor,
        spentMinor,
        status: item.status === 'over_budget' ? 'over_budget' : item.status === 'warning' ? 'warning' : 'on_track',
        usageRatio,
      };
    })
    .sort((left, right) => {
      const severityScore = (item: DashboardCategoryHighlight) => {
        if (item.status === 'over_budget') {
          return 2;
        }

        if (item.status === 'warning') {
          return 1;
        }

        return 0;
      };

      const severityDifference = severityScore(right) - severityScore(left);

      if (severityDifference !== 0) {
        return severityDifference;
      }

      if (right.spentMinor !== left.spentMinor) {
        return right.spentMinor - left.spentMinor;
      }

      return left.name.localeCompare(right.name, 'pl');
    })
    .slice(0, MAX_HIGHLIGHT_CATEGORIES);

  return {
    balanceMinor: setup.monthlyBalanceMinor,
    categoriesWithBudgetCount: setup.expenseCategories.filter(
      (item) => item.budgetLimitMinor !== null && item.isActive,
    ).length,
    currencyCode: setup.currencyCode,
    expenseMinor: setup.monthlySpentMinor,
    hasAnyTransactions: setup.monthlySpentMinor > 0 || setup.monthlyIncomeMinor > 0,
    hasConfiguredBudgets: setup.hasMonthlyBudget || setup.hasAnyConfiguredCategoryBudget,
    highlightCategories,
    incomeMinor: setup.monthlyIncomeMinor,
    isEmpty:
      setup.monthlyIncomeMinor === 0 &&
      setup.monthlySpentMinor === 0 &&
      !setup.hasMonthlyBudget &&
      !setup.hasAnyConfiguredCategoryBudget,
    monthKey,
    monthLabel: formatMonthKeyLabel(monthKey),
    monthlyBudgetMinor: setup.monthlyBudgetMinor,
    monthlyRemainingMinor: setup.monthlyRemainingMinor,
    overBudgetCategoriesCount: setup.expenseCategories.filter((item) => item.isOverBudget).length,
    transactionsCount: setup.transactionsCount,
  };
}
