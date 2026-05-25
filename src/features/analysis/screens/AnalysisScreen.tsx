import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  loadAnalysisState,
  type AnalysisCategorySlice,
  type AnalysisState,
  type AnalysisTimeRange,
  type AnalysisTrendPoint,
} from '@/src/features/analysis/data/analysis';
import { useAppServices } from '@/src/providers/AppServicesProvider';
import { colors, radius, spacing, typography } from '@/src/shared/theme';
import { AppCard, useScreenContentInsets } from '@/src/shared/ui';
import { formatMinorUnits } from '@/src/shared/utils/money';

const RANGE_OPTIONS: { label: string; value: AnalysisTimeRange }[] = [
  { label: 'Bieżący miesiąc', value: 'current_month' },
  { label: 'Poprzedni miesiąc', value: 'previous_month' },
];

export function AnalysisScreen() {
  const { repositories, status, error } = useAppServices();
  const { contentBottomPadding, contentTopPadding } = useScreenContentInsets();
  const isFocused = useIsFocused();
  const [range, setRange] = useState<AnalysisTimeRange>('current_month');
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'ready' || !isFocused) {
      return;
    }

    let cancelled = false;

    loadAnalysisState(repositories, range)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setAnalysis(result);
        setLoadError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadError(
          reason instanceof Error
            ? reason.message
            : 'Nie udało się wczytać analiz.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isFocused, range, repositories, status]);

  if (!analysis) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Ładuję analizy...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: contentBottomPadding, paddingTop: contentTopPadding },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={styles.hero}>
        <Text style={styles.title}>Analizy</Text>
        <Text style={styles.description}>
          Tu szybko widać, gdzie uciekają pieniądze i kiedy wydatki się
          kumulują.
        </Text>
      </View>

      <View style={styles.rangeSwitch}>
        {RANGE_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setRange(option.value)}
            style={[
              styles.rangeChip,
              range === option.value ? styles.rangeChipActive : null,
            ]}
          >
            <Text
              style={[
                styles.rangeChipLabel,
                range === option.value ? styles.rangeChipLabelActive : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loadError || error ? (
        <AppCard>
          <Text style={styles.errorTitle}>Błąd analiz</Text>
          <Text style={styles.errorText}>{loadError ?? error?.message}</Text>
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.sectionTitle}>Podsumowanie zakresu</Text>
        <Text style={styles.helperText}>
          {analysis.monthLabel} • {analysis.monthKey}
        </Text>
        <View style={styles.metricsGrid}>
          <Metric
            label="Wydatki"
            value={formatMinorUnits(
              analysis.totalExpenseMinor,
              analysis.currencyCode,
            )}
          />
          <Metric
            label="Transakcje"
            value={String(analysis.transactionsCount)}
          />
          <Metric
            label="Dni z wydatkami"
            value={String(analysis.expenseDaysCount)}
          />
          <Metric
            label="Największa kategoria"
            value={
              analysis.topCategory
                ? `${analysis.topCategory.name} • ${analysis.topCategory.sharePercent}%`
                : 'Brak danych'
            }
          />
        </View>
      </AppCard>

      {!analysis.hasAnyExpenses ? (
        <AppCard>
          <Text style={styles.sectionTitle}>Brak danych wydatkowych</Text>
          <Text style={styles.helperText}>
            W tym zakresie nie ma jeszcze wydatków. Po dodaniu transakcji
            analizy pokażą od razu rozkład kategorii i trend dzienny.
          </Text>
        </AppCard>
      ) : (
        <>
          <AppCard>
            <Text style={styles.sectionTitle}>Na co idą pieniądze</Text>
            <Text style={styles.helperText}>
              Wykres pokazuje udział największych kategorii wydatkowych w całym
              miesiącu.
            </Text>
            <CategoryStackedBar items={analysis.categoryChart} />
            <View style={styles.legendList}>
              {analysis.categoryChart.map((item) => (
                <CategoryBreakdownRow
                  key={item.categoryId}
                  currencyCode={analysis.currencyCode}
                  item={item}
                />
              ))}
            </View>
          </AppCard>

          <AppCard>
            <Text style={styles.sectionTitle}>
              Największe kategorie kosztów
            </Text>
            <Text style={styles.helperText}>
              Najpierw pokazujemy obszary, które najmocniej ciągną wydatki w tym
              zakresie.
            </Text>
            <View style={styles.topCategoryList}>
              {analysis.topCategories.map((item, index) => (
                <TopCategoryRow
                  key={item.categoryId}
                  currencyCode={analysis.currencyCode}
                  item={item}
                  rank={index + 1}
                />
              ))}
            </View>
          </AppCard>

          <AppCard>
            <Text style={styles.sectionTitle}>Trend wydatków w czasie</Text>
            <Text style={styles.helperText}>
              Każdy słupek to jeden dzień miesiąca. To szybki widok, kiedy
              wydatki naprawdę się kumulują.
            </Text>
            <TrendChart
              currencyCode={analysis.currencyCode}
              items={analysis.trend}
            />
          </AppCard>
        </>
      )}
    </ScrollView>
  );
}

function CategoryStackedBar({ items }: { items: AnalysisCategorySlice[] }) {
  return (
    <View style={styles.stackedBar}>
      {items.map((item) => (
        <View
          key={item.categoryId}
          style={[
            styles.stackedBarSegment,
            {
              backgroundColor: item.color ?? colors.primary,
              flex: Math.max(item.shareRatio, 0.08),
            },
          ]}
        />
      ))}
    </View>
  );
}

function CategoryBreakdownRow({
  item,
  currencyCode,
}: {
  item: AnalysisCategorySlice;
  currencyCode: string;
}) {
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendIdentity}>
        <View
          style={[
            styles.legendSwatch,
            { backgroundColor: item.color ?? colors.primary },
          ]}
        />
        <Text style={styles.legendLabel}>{item.name}</Text>
      </View>
      <View style={styles.legendValues}>
        <Text style={styles.legendAmount}>
          {formatMinorUnits(item.totalMinor, currencyCode)}
        </Text>
        <Text style={styles.legendPercent}>{item.sharePercent}%</Text>
      </View>
    </View>
  );
}

function TopCategoryRow({
  item,
  currencyCode,
  rank,
}: {
  item: AnalysisCategorySlice;
  currencyCode: string;
  rank: number;
}) {
  return (
    <View style={styles.topCategoryRow}>
      <View style={styles.topCategoryIdentity}>
        <View
          style={[
            styles.rankBadge,
            {
              backgroundColor: item.color
                ? `${item.color}20`
                : colors.primarySoft,
            },
          ]}
        >
          <Text
            style={[
              styles.rankBadgeLabel,
              { color: item.color ?? colors.primary },
            ]}
          >
            {rank}
          </Text>
        </View>
        <View style={styles.topCategoryCopy}>
          <Text style={styles.topCategoryName}>{item.name}</Text>
          <Text style={styles.topCategoryMeta}>
            {item.sharePercent}% wszystkich wydatków
          </Text>
        </View>
      </View>
      <Text style={styles.topCategoryAmount}>
        {formatMinorUnits(item.totalMinor, currencyCode)}
      </Text>
    </View>
  );
}

function TrendChart({
  items,
  currencyCode,
}: {
  items: AnalysisTrendPoint[];
  currencyCode: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.trendChart}>
        {items.map((item) => (
          <View key={item.date} style={styles.trendBarWrap}>
            <View style={styles.trendBarTrack}>
              <View
                style={[
                  styles.trendBar,
                  {
                    height: `${Math.max(item.heightRatio * 100, item.totalMinor > 0 ? 10 : 0)}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.trendLabel}>{item.dayLabel}</Text>
            <Text style={styles.trendValue}>
              {item.totalMinor > 0
                ? formatMinorUnits(item.totalMinor, currencyCode)
                : '—'}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  rangeSwitch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rangeChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rangeChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  rangeChipLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  rangeChipLabelActive: {
    color: colors.primary,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  helperText: {
    color: colors.textMuted,
    lineHeight: 22,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    gap: spacing.xs,
    minWidth: '47%',
    padding: spacing.md,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 22,
  },
  stackedBar: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    height: 18,
    overflow: 'hidden',
  },
  stackedBarSegment: {
    height: '100%',
  },
  legendList: {
    gap: spacing.sm,
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  legendIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  legendSwatch: {
    borderRadius: radius.pill,
    height: 10,
    width: 10,
  },
  legendLabel: {
    color: colors.text,
    flex: 1,
    fontWeight: '600',
  },
  legendValues: {
    alignItems: 'flex-end',
    gap: 2,
  },
  legendAmount: {
    color: colors.text,
    fontWeight: '700',
  },
  legendPercent: {
    color: colors.textMuted,
    fontSize: 12,
  },
  topCategoryList: {
    gap: spacing.md,
  },
  topCategoryRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  topCategoryIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rankBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  rankBadgeLabel: {
    fontWeight: '800',
  },
  topCategoryCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  topCategoryName: {
    color: colors.text,
    fontWeight: '700',
  },
  topCategoryMeta: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  topCategoryAmount: {
    color: colors.text,
    fontWeight: '800',
  },
  trendChart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 220,
    paddingTop: spacing.md,
  },
  trendBarWrap: {
    alignItems: 'center',
    gap: spacing.xs,
    width: 28,
  },
  trendBarTrack: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 120,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 18,
  },
  trendBar: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 0,
    width: '100%',
  },
  trendLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  trendValue: {
    color: colors.text,
    fontSize: 11,
    textAlign: 'center',
  },
  errorTitle: {
    color: colors.danger,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  errorText: {
    color: colors.text,
    lineHeight: 22,
  },
  loadingState: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.text,
  },
});
