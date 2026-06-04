import type { AppRepositories } from '@/src/storage';
import {
  formatMonthKeyLabel,
  getCurrentMonthKey,
  shiftMonthKey,
} from '@/src/shared/utils/date';
import { DEFAULT_CURRENCY_CODE } from '@/src/storage/sqlite/constants';

export type AnalysisTimeRange =
  | 'current_month'
  | 'previous_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'last_12_months'
  | 'all_time';

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
  rangeLabel: string;
  rangeDetail: string;
  activityMetricLabel: string;
  currencyCode: string;
  balanceMinor: number;
  totalIncomeMinor: number;
  totalExpenseMinor: number;
  transactionsCount: number;
  expenseActivityCount: number;
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

export const ANALYSIS_RANGE_OPTIONS: {
  description: string;
  label: string;
  value: AnalysisTimeRange;
}[] = [
  {
    description: 'Tylko bieżący miesiąc kalendarzowy.',
    label: 'Ten miesiąc',
    value: 'current_month',
  },
  {
    description: 'Miesiąc bezpośrednio przed bieżącym.',
    label: 'Poprzedni miesiąc',
    value: 'previous_month',
  },
  {
    description: 'Bieżący miesiąc i dwa poprzednie.',
    label: '3 miesiące',
    value: 'last_3_months',
  },
  {
    description: 'Bieżący miesiąc i pięć poprzednich.',
    label: '6 miesięcy',
    value: 'last_6_months',
  },
  {
    description: 'Ostatnie 12 miesięcy razem z bieżącym.',
    label: 'Rok',
    value: 'last_12_months',
  },
  {
    description: 'Wszystkie miesiące, w których są transakcje.',
    label: 'Cały okres',
    value: 'all_time',
  },
];

export async function loadAnalysisState(
  repositories: AppRepositories,
  range: AnalysisTimeRange,
): Promise<AnalysisState> {
  const currentMonthKey = getCurrentMonthKey();
  const monthKeys = await resolveAnalysisMonthKeys(
    repositories,
    range,
    currentMonthKey,
  );
  const [
    monthSummaries,
    categoryTotalsByMonth,
    dailyTotalsByMonth,
    categories,
  ] = await Promise.all([
    Promise.all(
      monthKeys.map((monthKey) =>
        repositories.transactions.getMonthSummary(monthKey),
      ),
    ),
    Promise.all(
      monthKeys.map((monthKey) =>
        repositories.transactions.getTotalsByCategory(monthKey, 'expense'),
      ),
    ),
    Promise.all(
      monthKeys.map((monthKey) =>
        repositories.transactions.getDailyTotals(monthKey, 'expense'),
      ),
    ),
    repositories.categories.listAll(),
  ]);

  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const totalExpenseMinor = monthSummaries.reduce(
    (sum, summary) => sum + summary.expenseMinor,
    0,
  );
  const totalIncomeMinor = monthSummaries.reduce(
    (sum, summary) => sum + summary.incomeMinor,
    0,
  );
  const balanceMinor = totalIncomeMinor - totalExpenseMinor;
  const transactionsCount = monthSummaries.reduce(
    (sum, summary) => sum + summary.transactionsCount,
    0,
  );
  const groupedCategoryTotals = groupCategoryTotals(
    categoryTotalsByMonth.flat(),
  );

  const categorySlices = groupedCategoryTotals
    .filter((item) => item.totalMinor > 0)
    .map<AnalysisCategorySlice>((item) => {
      const category = item.categoryId
        ? categoryById.get(item.categoryId)
        : null;
      const shareRatio =
        totalExpenseMinor <= 0 ? 0 : item.totalMinor / totalExpenseMinor;

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
  const trend =
    monthKeys.length === 1
      ? buildDailyTrendPoints(monthKeys[0], dailyTotalsByMonth[0] ?? [])
      : buildMonthlyTrendPoints(monthKeys, monthSummaries);
  const rangeMeta = buildRangeMeta(range, monthKeys);

  return {
    activityMetricLabel:
      monthKeys.length === 1 ? 'Dni z wydatkami' : 'Miesiące z wydatkami',
    balanceMinor,
    categoryChart,
    currencyCode: DEFAULT_CURRENCY_CODE,
    expenseActivityCount: trend.filter((point) => point.totalMinor > 0).length,
    hasAnyExpenses: totalExpenseMinor > 0,
    range,
    rangeDetail: rangeMeta.detail,
    rangeLabel: rangeMeta.label,
    topCategories: categorySlices.slice(0, TOP_CATEGORY_LIMIT),
    topCategory: categorySlices[0] ?? null,
    totalExpenseMinor,
    totalIncomeMinor,
    transactionsCount,
    trend,
  };
}

async function resolveAnalysisMonthKeys(
  repositories: AppRepositories,
  range: AnalysisTimeRange,
  currentMonthKey: string,
) {
  if (range === 'all_time') {
    const months = await repositories.transactions.listMonthsWithTransactions();

    return months.slice().sort((left, right) => left.localeCompare(right));
  }

  if (range === 'previous_month') {
    return [shiftMonthKey(currentMonthKey, -1)];
  }

  const monthCountByRange: Partial<Record<AnalysisTimeRange, number>> = {
    current_month: 1,
    last_3_months: 3,
    last_6_months: 6,
    last_12_months: 12,
  };
  const monthCount = monthCountByRange[range] ?? 1;

  return Array.from({ length: monthCount }, (_, index) =>
    shiftMonthKey(currentMonthKey, index - monthCount + 1),
  );
}

function buildRangeMeta(range: AnalysisTimeRange, monthKeys: string[]) {
  const option = ANALYSIS_RANGE_OPTIONS.find((item) => item.value === range);

  if (monthKeys.length === 0) {
    return {
      detail: 'Brak transakcji w zapisanych danych',
      label: option?.label ?? 'Zakres',
    };
  }

  if (monthKeys.length === 1) {
    return {
      detail: `${formatMonthKeyLabel(monthKeys[0])} • ${monthKeys[0]}`,
      label: option?.label ?? formatMonthKeyLabel(monthKeys[0]),
    };
  }

  const firstMonthKey = monthKeys[0];
  const lastMonthKey = monthKeys[monthKeys.length - 1];

  return {
    detail: `${formatMonthKeyLabel(firstMonthKey)} - ${formatMonthKeyLabel(lastMonthKey)}`,
    label: option?.label ?? 'Zakres',
  };
}

function groupCategoryTotals(
  totals: Awaited<
    ReturnType<AppRepositories['transactions']['getTotalsByCategory']>
  >,
) {
  const grouped = new Map<string | null, number>();

  for (const item of totals) {
    grouped.set(
      item.categoryId,
      (grouped.get(item.categoryId) ?? 0) + item.totalMinor,
    );
  }

  return Array.from(grouped.entries()).map(([categoryId, totalMinor]) => ({
    categoryId,
    totalMinor,
  }));
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
  const otherShareRatio =
    totalExpenseMinor <= 0 ? 0 : otherTotalMinor / totalExpenseMinor;

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

function buildDailyTrendPoints(
  monthKey: string,
  dailyTotals: Awaited<
    ReturnType<AppRepositories['transactions']['getDailyTotals']>
  >,
): AnalysisTrendPoint[] {
  const totalByDate = new Map(
    dailyTotals.map((item) => [item.occurredOn, item.totalMinor]),
  );
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

function buildMonthlyTrendPoints(
  monthKeys: string[],
  monthSummaries: Awaited<
    ReturnType<AppRepositories['transactions']['getMonthSummary']>
  >[],
): AnalysisTrendPoint[] {
  const maxTotalMinor =
    monthSummaries.length > 0
      ? Math.max(...monthSummaries.map((summary) => summary.expenseMinor))
      : 0;

  return monthKeys.map((monthKey, index) => {
    const totalMinor = monthSummaries[index]?.expenseMinor ?? 0;

    return {
      date: monthKey,
      dayLabel: formatShortMonthLabel(monthKey),
      heightRatio: maxTotalMinor <= 0 ? 0 : totalMinor / maxTotalMinor,
      totalMinor,
    };
  });
}

function formatShortMonthLabel(monthKey: string) {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return monthKey;
  }

  return new Intl.DateTimeFormat('pl-PL', {
    month: 'short',
  }).format(new Date(year, month - 1, 1));
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
