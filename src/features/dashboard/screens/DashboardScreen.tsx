import { FontAwesome5 } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { loadDashboardState, type DashboardCategoryHighlight, type DashboardState } from '@/src/features/dashboard/data/dashboard';
import type { RootTabParamList } from '@/src/navigation/AppNavigator';
import { useAppServices } from '@/src/providers/AppServicesProvider';
import { colors, radius, spacing, typography } from '@/src/shared/theme';
import { AppButton, AppCard } from '@/src/shared/ui';
import { getCurrentMonthKey, shiftMonthKey } from '@/src/shared/utils/date';
import { formatMinorUnits } from '@/src/shared/utils/money';

export function DashboardScreen() {
  const { repositories, status, error } = useAppServices();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const isFocused = useIsFocused();
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const changeMonth = (nextMonthKey: string) => {
    setDashboard(null);
    setLoadError(null);
    setMonthKey(nextMonthKey);
  };

  useEffect(() => {
    if (status !== 'ready' || !isFocused) {
      return;
    }

    let cancelled = false;

    loadDashboardState(repositories, monthKey)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setDashboard(result);
        setLoadError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadError(reason instanceof Error ? reason.message : 'Nie udało się wczytać dashboardu.');
      });

    return () => {
      cancelled = true;
    };
  }, [isFocused, monthKey, repositories, status]);

  if (!dashboard) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Ładuję przegląd miesiąca...</Text>
      </View>
    );
  }

  const currentMonthKey = getCurrentMonthKey();
  const isCurrentMonth = dashboard.monthKey === currentMonthKey;
  const isMonthlyBudgetOver =
    dashboard.monthlyRemainingMinor !== null && dashboard.monthlyRemainingMinor < 0;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Update 01.2</Text>
            <Text style={styles.title}>Dashboard MVP</Text>
            <Text style={styles.description}>
              Szybki obraz miesiąca: ile wydałeś, ile zostało i gdzie plan zaczyna się rozjeżdżać.
            </Text>
          </View>
          <AppButton label="Dodaj wydatek" onPress={() => navigation.navigate('AddTransaction')} />
        </View>

        <View style={styles.monthSwitcher}>
          <MonthButton label="‹" onPress={() => changeMonth(shiftMonthKey(monthKey, -1))} />
          <View style={styles.monthLabelBox}>
            <Text style={styles.monthLabel}>{dashboard.monthLabel}</Text>
            <Text style={styles.monthKey}>{dashboard.monthKey}</Text>
          </View>
          <MonthButton label="›" onPress={() => changeMonth(shiftMonthKey(monthKey, 1))} />
        </View>

        {!isCurrentMonth ? (
          <Pressable onPress={() => changeMonth(currentMonthKey)} style={styles.currentMonthButton}>
            <Text style={styles.currentMonthButtonLabel}>Wróć do bieżącego miesiąca</Text>
          </Pressable>
        ) : null}
      </View>

      {loadError || error ? (
        <AppCard>
          <Text style={styles.alertTitle}>Błąd dashboardu</Text>
          <Text style={styles.alertText}>{loadError ?? error?.message}</Text>
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.sectionTitle}>Sytuacja miesiąca</Text>
        <View style={styles.metricsGrid}>
          <MetricCard
            label="Przychody"
            tone="positive"
            value={formatMinorUnits(dashboard.incomeMinor, dashboard.currencyCode)}
          />
          <MetricCard
            label="Wydatki"
            tone="default"
            value={formatMinorUnits(dashboard.expenseMinor, dashboard.currencyCode)}
          />
          <MetricCard
            label="Bilans"
            tone={dashboard.balanceMinor < 0 ? 'danger' : 'positive'}
            value={formatMinorUnits(dashboard.balanceMinor, dashboard.currencyCode)}
          />
          <MetricCard
            label="Z budżetu zostało"
            tone={isMonthlyBudgetOver ? 'danger' : 'default'}
            value={
              dashboard.monthlyRemainingMinor === null
                ? 'Brak limitu'
                : formatMinorUnits(dashboard.monthlyRemainingMinor, dashboard.currencyCode)
            }
          />
        </View>
        <Text style={styles.helperText}>
          {dashboard.monthlyBudgetMinor === null
            ? 'Budżet miesiąca nie jest jeszcze ustawiony. Kontrola planu opiera się teraz na limitach kategorii.'
            : `Budżet miesiąca: ${formatMinorUnits(dashboard.monthlyBudgetMinor, dashboard.currencyCode)}`}
        </Text>
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Cel oszczędności</Text>
        {dashboard.savingsProgress.goalMinor === null ? (
          <Text style={styles.helperText}>
            Miesięczny cel oszczędności nie jest jeszcze ustawiony. Dodasz go w zakładce Budżety razem z planem
            miesiąca.
          </Text>
        ) : (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard
                label="Zaoszczędzono"
                tone={dashboard.savingsProgress.currentSavingsMinor < 0 ? 'danger' : 'positive'}
                value={formatMinorUnits(dashboard.savingsProgress.currentSavingsMinor, dashboard.currencyCode)}
              />
              <MetricCard
                label="Cel miesiąca"
                tone="default"
                value={formatMinorUnits(dashboard.savingsProgress.goalMinor, dashboard.currencyCode)}
              />
              <MetricCard
                label="Status"
                tone={dashboard.savingsProgress.status === 'goal_met' ? 'positive' : 'danger'}
                value={dashboard.savingsProgress.status === 'goal_met' ? 'Cel osiągnięty' : 'Poniżej planu'}
              />
              <MetricCard
                label={dashboard.savingsProgress.status === 'goal_met' ? 'Nadwyżka' : 'Brakuje'}
                tone={dashboard.savingsProgress.status === 'goal_met' ? 'positive' : 'default'}
                value={formatMinorUnits(Math.abs(dashboard.savingsProgress.remainingMinor ?? 0), dashboard.currencyCode)}
              />
            </View>

            <View style={styles.savingsProgressHeader}>
              <Text style={styles.metricLabel}>Postęp celu</Text>
              <Text style={styles.savingsProgressValue}>
                {dashboard.savingsProgress.progressPercent ?? 0}% celu
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.max(0, Math.min(dashboard.savingsProgress.progressRatio ?? 0, 1)) * 100}%`,
                  },
                  dashboard.savingsProgress.status === 'goal_met'
                    ? styles.progressBarPositive
                    : styles.progressBarWarning,
                ]}
              />
            </View>

            <Text style={styles.helperText}>
              Cel oszczędności liczymy prosto jako `przychody - wydatki` dla tego miesiąca.
            </Text>
          </>
        )}
      </AppCard>

      {dashboard.isEmpty ? (
        <AppCard>
          <Text style={styles.sectionTitle}>Pusty start</Text>
          <Text style={styles.helperText}>
            Ten miesiąc nie ma jeszcze transakcji ani ustawionych limitów. Zacznij od budżetu albo dodaj pierwszy
            wydatek, żeby dashboard zaczął pokazywać realny obraz miesiąca.
          </Text>
        </AppCard>
      ) : null}

      {!dashboard.hasAnyTransactions && dashboard.hasConfiguredBudgets ? (
        <AppCard>
          <Text style={styles.sectionTitle}>Budżet gotowy, brak wydatków</Text>
          <Text style={styles.helperText}>
            Masz już ustawione limity, ale w tym miesiącu nie zapisano jeszcze transakcji. Po pierwszym wydatku
            zobaczysz od razu wpływ na plan kategorii i miesiąca.
          </Text>
        </AppCard>
      ) : null}

      {!dashboard.hasConfiguredBudgets ? (
        <AppCard>
          <Text style={styles.sectionTitle}>Brak guardrailów budżetowych</Text>
          <Text style={styles.helperText}>
            Dashboard pokaże bilans i wydatki bez budżetu, ale pytanie „ile zostało” będzie dużo mocniejsze po
            ustawieniu budżetu miesiąca albo limitów kategorii w zakładce Budżety.
          </Text>
        </AppCard>
      ) : null}

      {dashboard.overBudgetCategoriesCount > 0 || isMonthlyBudgetOver ? (
        <AppCard>
          <Text style={styles.alertTitle}>Przekroczenie planu</Text>
          <Text style={styles.alertText}>
            {isMonthlyBudgetOver
              ? `Budżet miesiąca jest przekroczony o ${formatMinorUnits(
                  Math.abs(dashboard.monthlyRemainingMinor ?? 0),
                  dashboard.currencyCode,
                )}.`
              : 'Budżet miesiąca nadal mieści się w limicie.'}
          </Text>
          <Text style={styles.alertText}>
            {dashboard.overBudgetCategoriesCount === 0
              ? 'Żadna kategoria nie przekracza jeszcze limitu.'
              : `${dashboard.overBudgetCategoriesCount} kategorii przekracza aktualny plan.`}
          </Text>
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.sectionTitle}>Najważniejsze kategorie budżetowe</Text>
        <Text style={styles.helperText}>
          Najpierw pokazujemy przekroczenia i kategorie blisko limitu, żeby dało się zeskanować problem bez
          przechodzenia do pełnych budżetów.
        </Text>

        {dashboard.highlightCategories.length === 0 ? (
          <View style={styles.emptyCategoryState}>
            <Text style={styles.helperText}>
              Brak skonfigurowanych limitów kategorii dla tego miesiąca. Po ich dodaniu zobaczysz tu najważniejsze
              obszary budżetu.
            </Text>
          </View>
        ) : (
          <View style={styles.categoryList}>
            {dashboard.highlightCategories.map((item) => (
              <CategoryBudgetRow
                key={item.categoryId}
                currencyCode={dashboard.currencyCode}
                item={item}
              />
            ))}
          </View>
        )}

        <Text style={styles.footnoteText}>
          Limity kategorii aktywne: {dashboard.categoriesWithBudgetCount}. Transakcje w miesiącu:{' '}
          {dashboard.transactionsCount}.
        </Text>
      </AppCard>
    </ScrollView>
  );
}

function MonthButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.monthButton}>
      <Text style={styles.monthButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'default' | 'positive' | 'danger';
}) {
  return (
    <View
      style={[
        styles.metricCard,
        tone === 'positive' ? styles.metricCardPositive : null,
        tone === 'danger' ? styles.metricCardDanger : null,
      ]}
    >
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          tone === 'positive' ? styles.metricValuePositive : null,
          tone === 'danger' ? styles.metricValueDanger : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function CategoryBudgetRow({
  item,
  currencyCode,
}: {
  item: DashboardCategoryHighlight;
  currencyCode: string;
}) {
  const progress = Math.max(0, Math.min(item.usageRatio, 1));
  const progressWidth: `${number}%` = `${progress * 100}%`;

  return (
    <View style={styles.categoryCard}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryIdentity}>
          <View style={[styles.categoryIconWrap, item.color ? { backgroundColor: `${item.color}20` } : null]}>
            {item.icon ? (
              <FontAwesome5
                color={item.color ?? colors.primary}
                iconStyle="solid"
                name={item.icon as keyof typeof FontAwesome5.glyphMap}
                size={14}
              />
            ) : null}
          </View>
          <View style={styles.categoryCopy}>
            <Text style={styles.categoryName}>{item.name}</Text>
            <Text style={styles.categoryMeta}>
              {formatMinorUnits(item.spentMinor, currencyCode)} / {formatMinorUnits(item.limitMinor, currencyCode)}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusBadge,
            item.status === 'over_budget'
              ? styles.statusBadgeDanger
              : item.status === 'warning'
                ? styles.statusBadgeWarning
                : styles.statusBadgeNeutral,
          ]}
        >
          <Text
            style={[
              styles.statusBadgeLabel,
              item.status === 'over_budget'
                ? styles.statusBadgeLabelDanger
                : item.status === 'warning'
                  ? styles.statusBadgeLabelWarning
                  : null,
            ]}
          >
            {item.status === 'over_budget'
              ? 'Przekroczony'
              : item.status === 'warning'
                ? 'Blisko limitu'
                : 'W normie'}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressBar,
            { width: progressWidth },
            item.status === 'over_budget'
              ? styles.progressBarDanger
              : item.status === 'warning'
                ? styles.progressBarWarning
                : styles.progressBarPositive,
          ]}
        />
      </View>

      <Text style={styles.categoryMeta}>
        {item.remainingMinor < 0
          ? `Ponad plan o ${formatMinorUnits(Math.abs(item.remainingMinor), currencyCode)}`
          : `Pozostało ${formatMinorUnits(item.remainingMinor, currencyCode)}`}
      </Text>
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
    gap: spacing.md,
  },
  heroHeader: {
    gap: spacing.md,
  },
  heroCopy: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
  monthSwitcher: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  monthButtonLabel: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  monthLabelBox: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  monthLabel: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  monthKey: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  currentMonthButton: {
    alignSelf: 'flex-start',
  },
  currentMonthButtonLabel: {
    color: colors.primary,
    fontWeight: '700',
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
  metricCardPositive: {
    backgroundColor: colors.primarySoft,
  },
  metricCardDanger: {
    backgroundColor: '#F6DDDA',
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
  metricValuePositive: {
    color: colors.primary,
  },
  metricValueDanger: {
    color: colors.danger,
  },
  alertTitle: {
    color: colors.danger,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  alertText: {
    color: colors.text,
    lineHeight: 22,
  },
  emptyCategoryState: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  categoryList: {
    gap: spacing.md,
  },
  categoryCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    gap: spacing.sm,
    padding: spacing.md,
  },
  categoryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  categoryIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categoryIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  categoryCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  categoryName: {
    color: colors.text,
    fontWeight: '700',
  },
  categoryMeta: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusBadgeNeutral: {
    backgroundColor: colors.surface,
  },
  statusBadgeWarning: {
    backgroundColor: '#F7E7C7',
  },
  statusBadgeDanger: {
    backgroundColor: '#F6DDDA',
  },
  statusBadgeLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeLabelWarning: {
    color: '#9A6400',
  },
  statusBadgeLabelDanger: {
    color: colors.danger,
  },
  progressTrack: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 10,
    overflow: 'hidden',
  },
  progressBar: {
    borderRadius: radius.pill,
    height: '100%',
  },
  progressBarPositive: {
    backgroundColor: colors.primary,
  },
  progressBarWarning: {
    backgroundColor: '#C98B00',
  },
  progressBarDanger: {
    backgroundColor: colors.danger,
  },
  footnoteText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  savingsProgressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  savingsProgressValue: {
    color: colors.text,
    fontWeight: '700',
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
