import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  loadBudgetSetup,
  saveCategoryConfig,
  saveMonthlyBudgetConfig,
  type BudgetCategoryItem,
  type BudgetCategoryStatus,
  type BudgetMonthStatus,
  type BudgetSetupState,
} from '@/src/features/budgets/data/budgetSetup';
import { useAppServices } from '@/src/providers/AppServicesProvider';
import { colors, radius, spacing, typography } from '@/src/shared/theme';
import { AppButton, AppCard, AppInput } from '@/src/shared/ui';
import { getCurrentMonthKey } from '@/src/shared/utils/date';
import {
  formatMinorUnits,
  formatMinorUnitsInput,
  parseMoneyToMinorUnits,
} from '@/src/shared/utils/money';

type CategoryDraft = {
  name: string;
  isActive: boolean;
  limitEnabled: boolean;
  limitText: string;
};

function createDrafts(setup: BudgetSetupState) {
  const drafts: Record<string, CategoryDraft> = {};

  [...setup.expenseCategories, ...setup.incomeCategories].forEach((item) => {
    drafts[item.category.id] = {
      isActive: item.isActive,
      limitEnabled: item.budgetLimitMinor !== null,
      limitText: formatMinorUnitsInput(item.budgetLimitMinor),
      name: item.category.name,
    };
  });

  return drafts;
}

function formatUsage(usagePercent: number | null) {
  if (usagePercent === null) {
    return 'Bez limitu';
  }

  return `${usagePercent}% limitu`;
}

function getMonthStatusLabel(status: BudgetMonthStatus) {
  switch (status) {
    case 'over_budget':
      return 'Przekroczony';
    case 'warning':
      return 'Blisko limitu';
    case 'on_track':
      return 'W normie';
    case 'no_budget':
      return 'Bez budżetu';
  }
}

function getCategoryStatusLabel(status: BudgetCategoryStatus) {
  switch (status) {
    case 'over_budget':
      return 'Przekroczona';
    case 'warning':
      return 'Blisko limitu';
    case 'on_track':
      return 'Pod kontrolą';
    case 'no_limit':
      return 'Bez limitu';
    case 'inactive':
      return 'Nieaktywna';
    case 'income':
      return 'Przychód';
  }
}

export function BudgetsScreen() {
  const { repositories, status } = useAppServices();
  const monthKey = getCurrentMonthKey();

  const [setup, setSetup] = useState<BudgetSetupState | null>(null);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CategoryDraft>>({});
  const [monthBudgetEnabled, setMonthBudgetEnabled] = useState(false);
  const [monthBudgetText, setMonthBudgetText] = useState('');
  const [targetSavingsText, setTargetSavingsText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hydrate = (nextSetup: BudgetSetupState) => {
    setCategoryDrafts(createDrafts(nextSetup));
    setMonthBudgetEnabled(nextSetup.monthlyBudgetMinor !== null);
    setMonthBudgetText(formatMinorUnitsInput(nextSetup.monthlyBudgetMinor));
    setTargetSavingsText(formatMinorUnitsInput(nextSetup.targetSavingsMinor));
    setSetup(nextSetup);
  };

  const reload = async () => {
    const nextSetup = await loadBudgetSetup(repositories, monthKey);
    hydrate(nextSetup);
  };

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const nextSetup = await loadBudgetSetup(repositories, monthKey);

        if (!cancelled) {
          hydrate(nextSetup);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Nie udało się wczytać budżetów.');
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [monthKey, repositories, status]);

  const saveMonthBudget = async () => {
    if (!setup) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const parsedValue = monthBudgetEnabled ? parseMoneyToMinorUnits(monthBudgetText) : null;
      const parsedTargetSavings = monthBudgetEnabled
        ? (targetSavingsText.trim() ? parseMoneyToMinorUnits(targetSavingsText) : null)
        : null;

      if (monthBudgetEnabled && parsedValue === null) {
        throw new Error('Podaj poprawną kwotę budżetu miesiąca.');
      }

      if (monthBudgetEnabled && targetSavingsText.trim() && parsedTargetSavings === null) {
        throw new Error('Podaj poprawny miesięczny cel oszczędności.');
      }

      await saveMonthlyBudgetConfig(repositories, {
        currencyCode: setup.currencyCode,
        monthKey: setup.monthKey,
        targetSavingsMinor: parsedTargetSavings,
        totalBudgetMinor: parsedValue,
      });

      await reload();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Nie udało się zapisać budżetu miesiąca.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveCategory = async (item: BudgetCategoryItem) => {
    const draft = categoryDrafts[item.category.id];

    if (!draft || !setup) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const trimmedName = draft.name.trim();

      if (!trimmedName) {
        throw new Error('Nazwa kategorii nie może być pusta.');
      }

      const isExpense = item.transactionType === 'expense' || item.transactionType === 'both';
      const parsedLimit = isExpense && draft.limitEnabled ? parseMoneyToMinorUnits(draft.limitText) : null;

      if (isExpense && draft.limitEnabled && parsedLimit === null) {
        throw new Error(`Podaj poprawny limit dla kategorii „${item.category.name}”.`);
      }

      await saveCategoryConfig(repositories, {
        categoryId: item.category.id,
        categoryName: trimmedName,
        currencyCode: setup.currencyCode,
        isActive: draft.isActive,
        limitAmountMinor: isExpense && draft.isActive ? parsedLimit : null,
        monthKey: setup.monthKey,
        transactionType: item.transactionType,
      });

      await reload();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Nie udało się zapisać kategorii.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategoryActive = (categoryId: string) => {
    setCategoryDrafts((current) => ({
      ...current,
      [categoryId]: {
        ...current[categoryId],
        isActive: !current[categoryId].isActive,
      },
    }));
  };

  const toggleCategoryLimit = (categoryId: string) => {
    setCategoryDrafts((current) => ({
      ...current,
      [categoryId]: {
        ...current[categoryId],
        limitEnabled: !current[categoryId].limitEnabled,
      },
    }));
  };

  if (!setup) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Ładuję budżety...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Update 03.0</Text>
        <Text style={styles.title}>Budżety</Text>
        <Text style={styles.description}>
          Najpierw widać problemy, potem stabilne kategorie. Wszystkie limity i stany budżetu korzystają z
          tej samej warstwy danych co dashboard, historia i wpis ręczny.
        </Text>
      </View>

      {errorMessage ? (
        <AppCard>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </AppCard>
      ) : null}

      {!setup.hasMonthlyBudget && !setup.hasAnyConfiguredCategoryBudget ? (
        <AppCard>
          <Text style={styles.sectionTitle}>Start budżetów</Text>
          <Text style={styles.helperText}>
            Zacznij od budżetu miesiąca i limitów dla kilku głównych kategorii wydatkowych. Resztę możesz
            zostawić aktywną bez limitu.
          </Text>
        </AppCard>
      ) : null}

      <AppCard>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderCopy}>
            <Text style={styles.sectionTitle}>Miesiąc pod kontrolą</Text>
            <Text style={styles.helperText}>
              Tu widać, czy cały miesiąc mieści się w planie i ile kategorii wymaga już uwagi.
            </Text>
          </View>
          <StatusBadge label={getMonthStatusLabel(setup.monthlyBudgetStatus)} status={setup.monthlyBudgetStatus} />
        </View>

        <View style={styles.metricsGrid}>
          <Metric label="Wydane" value={formatMinorUnits(setup.monthlySpentMinor, setup.currencyCode)} />
          <Metric
            label="Budżet miesiąca"
            value={
              setup.monthlyBudgetMinor === null
                ? 'Nieustawiony'
                : formatMinorUnits(setup.monthlyBudgetMinor, setup.currencyCode)
            }
          />
          <Metric
            label="Pozostało"
            value={
              setup.monthlyRemainingMinor === null
                ? 'Bez limitu'
                : formatMinorUnits(setup.monthlyRemainingMinor, setup.currencyCode)
            }
          />
          <Metric label="Kategorie ryzyka" value={String(setup.categoriesAtRiskCount)} />
          <Metric label="Aktywne wydatki" value={String(setup.activeExpenseCategoriesCount)} />
          <Metric label="Bez limitu" value={String(setup.uncappedExpenseCategoriesCount)} />
          <Metric
            label="Cel oszczędności"
            value={
              setup.targetSavingsMinor === null
                ? 'Nieustawiony'
                : formatMinorUnits(setup.targetSavingsMinor, setup.currencyCode)
            }
          />
        </View>

        {setup.monthlyBudgetUsageRatio !== null ? (
          <>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Wykorzystanie budżetu miesiąca</Text>
              <Text style={styles.progressValue}>{formatUsage(setup.monthlyBudgetUsagePercent)}</Text>
            </View>
            <ProgressBar ratio={setup.monthlyBudgetUsageRatio} status={setup.monthlyBudgetStatus} />
          </>
        ) : null}
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Ustawienia budżetu miesiąca</Text>
        <Text style={styles.helperText}>
          Budżet miesiąca jest opcjonalny. Cel oszczędności w MVP trzymamy w tym samym planie miesiąca, więc
          działa tylko przy aktywnym budżecie miesiąca.
        </Text>

        <View style={styles.row}>
          <ToggleChip
            active={monthBudgetEnabled}
            label={monthBudgetEnabled ? 'Budżet miesiąca aktywny' : 'Budżet miesiąca wyłączony'}
            onPress={() => setMonthBudgetEnabled((value) => !value)}
          />
        </View>

        <AppInput
          editable={monthBudgetEnabled}
          keyboardType="decimal-pad"
          onChangeText={setMonthBudgetText}
          placeholder="Np. 4700,00"
          value={monthBudgetText}
        />

        <AppInput
          editable={monthBudgetEnabled}
          keyboardType="decimal-pad"
          onChangeText={setTargetSavingsText}
          placeholder="Cel oszczędności, np. 1200,00"
          value={targetSavingsText}
        />

        <AppButton label={isSaving ? 'Zapisywanie...' : 'Zapisz budżet miesiąca'} onPress={saveMonthBudget} />
      </AppCard>

      {setup.problemExpenseCategories.length > 0 ? (
        <BudgetSection
          currencyCode={setup.currencyCode}
          drafts={categoryDrafts}
          items={setup.problemExpenseCategories}
          onChangeDraft={setCategoryDrafts}
          onSaveCategory={saveCategory}
          onToggleActive={toggleCategoryActive}
          onToggleLimit={toggleCategoryLimit}
          subtitle="Te kategorie są już ponad limitem albo zbliżają się do niego."
          title="Wymagają uwagi"
        />
      ) : null}

      <BudgetSection
        currencyCode={setup.currencyCode}
        drafts={categoryDrafts}
        items={setup.stableExpenseCategories}
        onChangeDraft={setCategoryDrafts}
        onSaveCategory={saveCategory}
        onToggleActive={toggleCategoryActive}
        onToggleLimit={toggleCategoryLimit}
        subtitle="Aktywne kategorie z limitem, które są na razie pod kontrolą."
        title="Aktywne i pod kontrolą"
      />

      {setup.uncappedExpenseCategories.length > 0 ? (
        <BudgetSection
          currencyCode={setup.currencyCode}
          drafts={categoryDrafts}
          items={setup.uncappedExpenseCategories}
          onChangeDraft={setCategoryDrafts}
          onSaveCategory={saveCategory}
          onToggleActive={toggleCategoryActive}
          onToggleLimit={toggleCategoryLimit}
          subtitle="Kategorie bez limitu dalej zbierają wydatki, ale nie ostrzegają przed przekroczeniem."
          title="Aktywne bez limitu"
        />
      ) : null}

      {setup.inactiveExpenseCategories.length > 0 ? (
        <BudgetSection
          currencyCode={setup.currencyCode}
          drafts={categoryDrafts}
          items={setup.inactiveExpenseCategories}
          onChangeDraft={setCategoryDrafts}
          onSaveCategory={saveCategory}
          onToggleActive={toggleCategoryActive}
          onToggleLimit={toggleCategoryLimit}
          subtitle="Nieaktywne kategorie zostają na dole, żeby nie zaśmiecać codziennej kontroli."
          title="Nieaktywne kategorie"
        />
      ) : null}

      <AppCard>
        <Text style={styles.sectionTitle}>Kategorie przychodów</Text>
        <Text style={styles.helperText}>
          W MVP przychody zostają proste: widać realne wpływy, bez osobnych celów i limitów.
        </Text>

        <View style={styles.categoryList}>
          {setup.incomeCategories.map((item) =>
            categoryDrafts[item.category.id] ? (
              <CategoryBudgetCard
                key={item.category.id}
                currencyCode={setup.currencyCode}
                draft={categoryDrafts[item.category.id]}
                item={item}
                onChangeDraft={setCategoryDrafts}
                onSave={() => saveCategory(item)}
                onToggleActive={() => toggleCategoryActive(item.category.id)}
                onToggleLimit={() => toggleCategoryLimit(item.category.id)}
              />
            ) : null,
          )}
        </View>
      </AppCard>
    </ScrollView>
  );
}

function BudgetSection({
  title,
  subtitle,
  items,
  drafts,
  currencyCode,
  onChangeDraft,
  onToggleActive,
  onToggleLimit,
  onSaveCategory,
}: {
  title: string;
  subtitle: string;
  items: BudgetCategoryItem[];
  drafts: Record<string, CategoryDraft>;
  currencyCode: string;
  onChangeDraft: Dispatch<SetStateAction<Record<string, CategoryDraft>>>;
  onToggleActive: (categoryId: string) => void;
  onToggleLimit: (categoryId: string) => void;
  onSaveCategory: (item: BudgetCategoryItem) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <AppCard>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.helperText}>{subtitle}</Text>
      <View style={styles.categoryList}>
        {items.map((item) =>
          drafts[item.category.id] ? (
            <CategoryBudgetCard
              key={item.category.id}
              currencyCode={currencyCode}
              draft={drafts[item.category.id]}
              item={item}
              onChangeDraft={onChangeDraft}
              onSave={() => onSaveCategory(item)}
              onToggleActive={() => onToggleActive(item.category.id)}
              onToggleLimit={() => onToggleLimit(item.category.id)}
            />
          ) : null,
        )}
      </View>
    </AppCard>
  );
}

function CategoryBudgetCard({
  item,
  draft,
  currencyCode,
  onChangeDraft,
  onToggleActive,
  onToggleLimit,
  onSave,
}: {
  item: BudgetCategoryItem;
  draft: CategoryDraft;
  currencyCode: string;
  onChangeDraft: Dispatch<SetStateAction<Record<string, CategoryDraft>>>;
  onToggleActive: () => void;
  onToggleLimit: () => void;
  onSave: () => void;
}) {
  const isIncomeCategory = item.transactionType === 'income';
  const supportsBudget = item.transactionType === 'expense' || item.transactionType === 'both';

  return (
    <View style={styles.categoryCard}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryHeaderText}>
          <Text style={styles.categoryName}>{item.category.name}</Text>
          <Text style={styles.categoryMeta}>
            {isIncomeCategory
              ? `Wpłynęło: ${formatMinorUnits(item.spentMinor, currencyCode)}`
              : item.budgetLimitMinor === null
                ? `Wydano: ${formatMinorUnits(item.spentMinor, currencyCode)} • Bez limitu`
                : `Wydano: ${formatMinorUnits(item.spentMinor, currencyCode)} • Limit: ${formatMinorUnits(item.budgetLimitMinor, currencyCode)}`}
          </Text>
        </View>
        <StatusBadge label={getCategoryStatusLabel(item.status)} status={item.status} />
      </View>

      {!isIncomeCategory && item.usageRatio !== null ? (
        <>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Wykorzystanie kategorii</Text>
            <Text style={styles.progressValue}>{formatUsage(item.usagePercent)}</Text>
          </View>
          <ProgressBar ratio={item.usageRatio} status={item.status} />
        </>
      ) : null}

      <View style={styles.metricsRow}>
        <MiniMetric
          label={isIncomeCategory ? 'Wpłynęło' : 'Wydano'}
          value={formatMinorUnits(item.spentMinor, currencyCode)}
        />
        <MiniMetric
          label={isIncomeCategory ? 'Status' : 'Pozostało'}
          value={
            isIncomeCategory
              ? getCategoryStatusLabel(item.status)
              : item.remainingMinor === null
                ? 'Bez limitu'
                : formatMinorUnits(item.remainingMinor, currencyCode)
          }
        />
        <MiniMetric
          label={isIncomeCategory ? 'Aktywność' : 'Wykorzystanie'}
          value={isIncomeCategory ? (item.isActive ? 'Aktywna' : 'Nieaktywna') : formatUsage(item.usagePercent)}
        />
      </View>

      <View style={styles.row}>
        <ToggleChip
          active={draft.isActive}
          label={draft.isActive ? 'Aktywna' : 'Nieaktywna'}
          onPress={onToggleActive}
        />
      </View>

      <AppInput
        onChangeText={(value) =>
          onChangeDraft((current) => ({
            ...current,
            [item.category.id]: {
              ...current[item.category.id],
              name: value,
            },
          }))
        }
        placeholder="Nazwa kategorii"
        value={draft.name}
      />

      {supportsBudget ? (
        <>
          <View style={styles.row}>
            <ToggleChip
              active={draft.limitEnabled}
              label={draft.limitEnabled ? 'Limit aktywny' : 'Bez limitu'}
              onPress={onToggleLimit}
            />
          </View>
          <AppInput
            editable={draft.limitEnabled}
            keyboardType="decimal-pad"
            onChangeText={(value) =>
              onChangeDraft((current) => ({
                ...current,
                [item.category.id]: {
                  ...current[item.category.id],
                  limitText: value,
                },
              }))
            }
            placeholder="Np. 500,00"
            value={draft.limitText}
          />
        </>
      ) : null}

      {item.status === 'over_budget' ? (
        <Text style={styles.errorText}>Ta kategoria jest już ponad limitem.</Text>
      ) : item.status === 'warning' ? (
        <Text style={styles.warningText}>Ta kategoria zbliża się do limitu i wymaga uwagi.</Text>
      ) : null}

      <AppButton label="Zapisz kategorię" onPress={onSave} />
    </View>
  );
}

function ToggleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleChip, active ? styles.toggleChipActive : styles.toggleChipInactive]}
    >
      <Text style={[styles.toggleChipLabel, active ? styles.toggleChipLabelActive : undefined]}>{label}</Text>
    </Pressable>
  );
}

function StatusBadge({
  label,
  status,
}: {
  label: string;
  status: BudgetCategoryStatus | BudgetMonthStatus;
}) {
  const isDanger = status === 'over_budget';
  const isWarning = status === 'warning';
  const isMuted = status === 'no_budget' || status === 'no_limit' || status === 'inactive';

  return (
    <View
      style={[
        styles.statusBadge,
        isDanger ? styles.statusBadgeDanger : null,
        isWarning ? styles.statusBadgeWarning : null,
        isMuted ? styles.statusBadgeMuted : styles.statusBadgePositive,
      ]}
    >
      <Text
        style={[
          styles.statusBadgeLabel,
          isDanger ? styles.statusBadgeLabelDanger : null,
          isWarning ? styles.statusBadgeLabelWarning : null,
          isMuted ? styles.statusBadgeLabelMuted : styles.statusBadgeLabelPositive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function ProgressBar({
  ratio,
  status,
}: {
  ratio: number;
  status: BudgetCategoryStatus | BudgetMonthStatus;
}) {
  const progress = Math.max(0, Math.min(ratio, 1));
  const width: `${number}%` = `${progress * 100}%`;

  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressBar,
          { width },
          status === 'over_budget'
            ? styles.progressBarDanger
            : status === 'warning'
              ? styles.progressBarWarning
              : styles.progressBarPositive,
        ]}
      />
    </View>
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniMetric}>
      <Text style={styles.miniMetricLabel}>{label}</Text>
      <Text style={styles.miniMetricValue}>{value}</Text>
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
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  cardHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
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
  errorText: {
    color: colors.danger,
    lineHeight: 22,
  },
  warningText: {
    color: '#A96300',
    lineHeight: 22,
  },
  metricsGrid: {
    gap: spacing.md,
  },
  metricCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textTransform: 'uppercase',
  },
  progressValue: {
    color: colors.text,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
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
    backgroundColor: '#C8891C',
  },
  progressBarDanger: {
    backgroundColor: colors.danger,
  },
  row: {
    flexDirection: 'row',
  },
  toggleChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  toggleChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  toggleChipInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  toggleChipLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  toggleChipLabelActive: {
    color: colors.primary,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusBadgePositive: {
    backgroundColor: colors.primarySoft,
  },
  statusBadgeWarning: {
    backgroundColor: '#F8E9C7',
  },
  statusBadgeDanger: {
    backgroundColor: '#F7D8D3',
  },
  statusBadgeMuted: {
    backgroundColor: colors.surfaceMuted,
  },
  statusBadgeLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  statusBadgeLabelPositive: {
    color: colors.primary,
  },
  statusBadgeLabelWarning: {
    color: '#A96300',
  },
  statusBadgeLabelDanger: {
    color: colors.danger,
  },
  statusBadgeLabelMuted: {
    color: colors.textMuted,
  },
  categoryList: {
    gap: spacing.lg,
  },
  categoryCard: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  categoryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  categoryHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  categoryName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  categoryMeta: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  miniMetric: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 92,
    padding: spacing.sm,
  },
  miniMetricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  miniMetricValue: {
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
