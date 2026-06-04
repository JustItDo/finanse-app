import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ANALYSIS_RANGE_OPTIONS,
  loadAnalysisState,
  type AnalysisCategorySlice,
  type AnalysisState,
  type AnalysisTimeRange,
  type AnalysisTrendPoint,
} from '@/src/features/analysis/data/analysis';
import { useAppServices } from '@/src/providers/AppServicesProvider';
import {
  radius,
  spacing,
  typography,
  type AppThemeColors,
} from '@/src/shared/theme';
import { useTheme, useThemeStyles } from '@/src/shared/theme/ThemeProvider';
import { AppCard, useScreenContentInsets } from '@/src/shared/ui';
import { formatMinorUnits } from '@/src/shared/utils/money';

export function AnalysisScreen() {
  const { repositories, status, error } = useAppServices();
  const styles = useThemeStyles(createStyles);
  const { contentBottomPadding, contentTopPadding } = useScreenContentInsets();
  const isFocused = useIsFocused();
  const [range, setRange] = useState<AnalysisTimeRange>('current_month');
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRangeSelectorOpen, setIsRangeSelectorOpen] = useState(false);

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
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Analizy</Text>
            <Text style={styles.description}>
              Tu szybko widać, gdzie uciekają pieniądze i kiedy wydatki się
              kumulują.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsRangeSelectorOpen(true)}
            style={styles.rangeButton}
          >
            <Text style={styles.rangeButtonLabel}>{analysis.rangeLabel}</Text>
            <Text style={styles.rangeButtonIcon}>v</Text>
          </Pressable>
        </View>
      </View>

      {loadError || error ? (
        <AppCard>
          <Text style={styles.errorTitle}>Błąd analiz</Text>
          <Text style={styles.errorText}>{loadError ?? error?.message}</Text>
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.sectionTitle}>Podsumowanie zakresu</Text>
        <Text style={styles.helperText}>{analysis.rangeDetail}</Text>
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
            label={analysis.activityMetricLabel}
            value={String(analysis.expenseActivityCount)}
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

      <AppCard>
        <View style={styles.balanceHeader}>
          <View style={styles.balanceHeaderCopy}>
            <Text style={styles.sectionTitle}>Bilans okresu</Text>
            <Text style={styles.helperText}>
              Wynik dotyczy tylko transakcji zapisanych w aplikacji, nie salda
              konta bankowego.
            </Text>
          </View>
          <Text
            style={[
              styles.balanceResult,
              analysis.balanceMinor < 0 ? styles.balanceResultNegative : null,
              analysis.balanceMinor === 0 ? styles.balanceResultNeutral : null,
            ]}
          >
            {formatMinorUnits(analysis.balanceMinor, analysis.currencyCode)}
          </Text>
        </View>
        <View style={styles.balanceBreakdown}>
          <BalanceBreakdownItem
            label="Przychody"
            tone="positive"
            value={formatMinorUnits(
              analysis.totalIncomeMinor,
              analysis.currencyCode,
            )}
          />
          <BalanceBreakdownItem
            label="Wydatki"
            tone="default"
            value={formatMinorUnits(
              analysis.totalExpenseMinor,
              analysis.currencyCode,
            )}
          />
          <BalanceBreakdownItem
            label="Wynik"
            tone={analysis.balanceMinor < 0 ? 'danger' : 'positive'}
            value={formatMinorUnits(
              analysis.balanceMinor,
              analysis.currencyCode,
            )}
          />
        </View>
      </AppCard>

      {!analysis.hasAnyExpenses ? (
        <AppCard>
          <Text style={styles.sectionTitle}>Brak danych wydatkowych</Text>
          <Text style={styles.helperText}>
            W wybranym okresie nie ma jeszcze wydatków. Po dodaniu transakcji
            analizy pokażą rozkład kategorii i trend w czasie.
          </Text>
        </AppCard>
      ) : (
        <>
          <AppCard>
            <Text style={styles.sectionTitle}>Na co idą pieniądze</Text>
            <Text style={styles.helperText}>
              Wykres pokazuje udział największych kategorii wydatkowych w całym
              wybranym okresie.
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
              {analysis.range === 'current_month' ||
              analysis.range === 'previous_month'
                ? 'Każdy słupek to jeden dzień miesiąca.'
                : 'Każdy słupek to jeden miesiąc.'}{' '}
              To szybki widok, kiedy wydatki naprawdę się kumulują.
            </Text>
            <TrendChart
              currencyCode={analysis.currencyCode}
              items={analysis.trend}
            />
          </AppCard>
        </>
      )}

      <RangeSelector
        currentRange={range}
        onClose={() => setIsRangeSelectorOpen(false)}
        onSelect={(nextRange) => {
          setRange(nextRange);
          setIsRangeSelectorOpen(false);
        }}
        visible={isRangeSelectorOpen}
      />
    </ScrollView>
  );
}

function BalanceBreakdownItem({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'default' | 'positive' | 'danger';
  value: string;
}) {
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.balanceBreakdownItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.balanceBreakdownValue,
          tone === 'positive' ? styles.balanceBreakdownValuePositive : null,
          tone === 'danger' ? styles.balanceBreakdownValueNegative : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function RangeSelector({
  currentRange,
  onClose,
  onSelect,
  visible,
}: {
  currentRange: AnalysisTimeRange;
  onClose: () => void;
  onSelect: (range: AnalysisTimeRange) => void;
  visible: boolean;
}) {
  const styles = useThemeStyles(createStyles);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.selectorOverlay}>
        <Pressable
          accessibilityLabel="Zamknij wybór okresu"
          onPress={onClose}
          style={styles.selectorBackdrop}
        />
        <View style={styles.selectorSheet}>
          <View style={styles.selectorHandle} />
          <View style={styles.selectorHeader}>
            <Text style={styles.selectorTitle}>Zakres analizy</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.selectorCloseButton}
            >
              <Text style={styles.selectorCloseLabel}>Zamknij</Text>
            </Pressable>
          </View>
          <View style={styles.selectorList}>
            {ANALYSIS_RANGE_OPTIONS.map((option) => {
              const selected = option.value === currentRange;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => onSelect(option.value)}
                  style={[
                    styles.selectorOption,
                    selected ? styles.selectorOptionActive : null,
                  ]}
                >
                  <View style={styles.selectorOptionCopy}>
                    <Text
                      style={[
                        styles.selectorOptionLabel,
                        selected ? styles.selectorOptionLabelActive : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.selectorOptionDescription}>
                      {option.description}
                    </Text>
                  </View>
                  {selected ? (
                    <Text style={styles.selectorOptionCheck}>Wybrano</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CategoryStackedBar({ items }: { items: AnalysisCategorySlice[] }) {
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);

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
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);

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
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);

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
  const styles = useThemeStyles(createStyles);

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
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
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
    heroHeader: {
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    heroCopy: {
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
    rangeButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 40,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    rangeButtonLabel: {
      color: colors.primary,
      fontWeight: '800',
    },
    rangeButtonIcon: {
      color: colors.textMuted,
      fontSize: typography.caption,
      fontWeight: '800',
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
    balanceHeader: {
      gap: spacing.lg,
    },
    balanceHeaderCopy: {
      gap: spacing.sm,
    },
    balanceResult: {
      color: colors.primary,
      fontSize: 34,
      fontWeight: '900',
      lineHeight: 40,
    },
    balanceResultNegative: {
      color: colors.danger,
    },
    balanceResultNeutral: {
      color: colors.text,
    },
    balanceBreakdown: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    balanceBreakdownItem: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      flex: 1,
      gap: spacing.xs,
      minWidth: '30%',
      padding: spacing.md,
    },
    balanceBreakdownValue: {
      color: colors.text,
      fontWeight: '800',
      lineHeight: 22,
    },
    balanceBreakdownValuePositive: {
      color: colors.primary,
    },
    balanceBreakdownValueNegative: {
      color: colors.danger,
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
      backgroundColor: colors.chartPrimary,
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
    selectorOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    selectorBackdrop: {
      backgroundColor: colors.modalBackdrop,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    selectorSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      gap: spacing.lg,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    selectorHandle: {
      alignSelf: 'center',
      backgroundColor: colors.border,
      borderRadius: radius.pill,
      height: 4,
      width: 44,
    },
    selectorHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between',
    },
    selectorTitle: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    selectorCloseButton: {
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    selectorCloseLabel: {
      color: colors.text,
      fontWeight: '700',
    },
    selectorList: {
      gap: spacing.sm,
    },
    selectorOption: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between',
      minHeight: 68,
      padding: spacing.md,
    },
    selectorOptionActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    selectorOptionCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    selectorOptionLabel: {
      color: colors.text,
      fontWeight: '800',
    },
    selectorOptionLabelActive: {
      color: colors.primary,
    },
    selectorOptionDescription: {
      color: colors.textMuted,
      lineHeight: 20,
    },
    selectorOptionCheck: {
      color: colors.primary,
      fontSize: typography.caption,
      fontWeight: '800',
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
}
