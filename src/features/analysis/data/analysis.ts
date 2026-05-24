import type { AppRepositories } from '@/src/storage';
import { formatMonthKeyLabel, getCurrentMonthKey, shiftMonthKey } from '@/src/shared/utils/date';
import { DEFAULT_CURRENCY_CODE } from '@/src/storage/sqlite/constants';

export type AnalysisTimeRange = 'current_month' | 'previous_month';

export type AnalysisCategorySlice = {
  categoryId: string;
  name: string;
  color: string | null;
  icon: string | null;
  totalMinor: number;
  shareRatio: number;
  sharePercent: number;
};

export type AnalysisTrendPoint = {
  date: string;
  dayLabel: string;
  totalMinor: number;
  heightRatio: number;
};

export type AnalysisState = {
  range: AnalysisTimeRange;
  monthKey: string;
  monthLabel: string;
  currencyCode: string;
  totalExpenseMinor: number;
  transactionsCount: number;
  expenseDaysCount: number;
  topCategory: AnalysisCategorySlice | null;
  topCategories: AnalysisCategorySlice[];
  categoryChart: AnalysisCategorySlice[];
  trend: AnalysisTrendPoint[];
  hasAnyExpenses: boolean;
};

const CATEGORY_CHART_LIMIT = 5;
const TOP_CATEGORY_LIMIT = 4;
const FALLBACK_CATEGORY_COLOR = '#6B7280';
const OTHER_CATEGORY_ID = 'category_other_breakdown';

export async function loadAnalysisState(
  repositories: AppRepositories,
  range: AnalysisTimeRange,
): Promise<AnalysisState> {
  const currentMonthKey = getCurrentMonthKey();
  const monthKey = range === 'current_month' ? currentMonthKey : shiftMonthKey(currentMonthKey, -1);
  const [monthSummary, categoryTotals, dailyTotals, categories] = await Promise.all([
    repositories.transactions.getMonthSummary(monthKey),
    repositories.transactions.getTotalsByCategory(monthKey, 'expense'),
    repositories.transactions.getDailyTotals(monthKey, 'expense'),
    repositories.categories.listAll(),
  ]);

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const totalExpenseMinor = monthSummary.expenseMinor;

  const categorySlices = categoryTotals
    .filter((item) => item.totalMinor > 0)
    .map<AnalysisCategorySlice>((item) => {
      const category = item.categoryId ? categoryById.get(item.categoryId) : null;
      const shareRatio = totalExpenseMinor <= 0 ? 0 : item.totalMinor / totalExpenseMinor;

      return {
        categoryId: item.categoryId ?? 'uncategorized',
        color: category?.color ?? FALLBACK_CATEGORY_COLOR,
        icon: category?.icon ?? null,
        name: category?.name ?? 'Bez kategorii',
        sharePercent: Math.round(shareRatio * 100),
        shareRatio,
        totalMinor: item.totalMinor,
      };
    })
    .sort((left, right) => right.totalMinor - left.totalMinor);

  const categoryChart = buildCategoryChart(categorySlices, totalExpenseMinor);
  const trend = buildTrendPoints(monthKey, dailyTotals);

  return {
    categoryChart,
    currencyCode: DEFAULT_CURRENCY_CODE,
    expenseDaysCount: trend.filter((point) => point.totalMinor > 0).length,
    hasAnyExpenses: totalExpenseMinor > 0,
    monthKey,
    monthLabel: formatMonthKeyLabel(monthKey),
    range,
    topCategories: categorySlices.slice(0, TOP_CATEGORY_LIMIT),
    topCategory: categorySlices[0] ?? null,
    totalExpenseMinor,
    transactionsCount: monthSummary.transactionsCount,
    trend,
  };
}

function buildCategoryChart(
  sortedCategories: AnalysisCategorySlice[],
  totalExpenseMinor: number,
): AnalysisCategorySlice[] {
  if (sortedCategories.length <= CATEGORY_CHART_LIMIT) {
    return sortedCategories;
  }

  const topCategories = sortedCategories.slice(0, CATEGORY_CHART_LIMIT - 1);
  const otherTotalMinor = sortedCategories
    .slice(CATEGORY_CHART_LIMIT - 1)
    .reduce((sum, item) => sum + item.totalMinor, 0);
  const otherShareRatio = totalExpenseMinor <= 0 ? 0 : otherTotalMinor / totalExpenseMinor;

  return [
    ...topCategories,
    {
      categoryId: OTHER_CATEGORY_ID,
      color: FALLBACK_CATEGORY_COLOR,
      icon: null,
      name: 'Pozostałe',
      sharePercent: Math.round(otherShareRatio * 100),
      shareRatio: otherShareRatio,
      totalMinor: otherTotalMinor,
    },
  ];
}

function buildTrendPoints(
  monthKey: string,
  dailyTotals: Awaited<ReturnType<AppRepositories['transactions']['getDailyTotals']>>,
): AnalysisTrendPoint[] {
  const totalByDate = new Map(dailyTotals.map((item) => [item.occurredOn, item.totalMinor]));
  const daysInMonth = getDaysInMonth(monthKey);
  const values = Array.from(totalByDate.values());
  const maxTotalMinor = values.length > 0 ? Math.max(...values) : 0;

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    const date = `${monthKey}-${day}`;
    const totalMinor = totalByDate.get(date) ?? 0;

    return {
      date,
      dayLabel: String(index + 1),
      heightRatio: maxTotalMinor <= 0 ? 0 : totalMinor / maxTotalMinor,
      totalMinor,
    };
  });
}

function getDaysInMonth(monthKey: string) {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return 30;
  }

  return new Date(year, month, 0).getDate();
}
