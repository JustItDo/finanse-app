import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  loadBudgetSetup,
  saveCategoryConfig,
  saveMonthlyBudgetConfig,
  type BudgetCategoryItem,
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

export function BudgetsScreen() {
  const { repositories, status } = useAppServices();
  const monthKey = getCurrentMonthKey();

  const [setup, setSetup] = useState<BudgetSetupState | null>(null);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CategoryDraft>>({});
  const [monthBudgetEnabled, setMonthBudgetEnabled] = useState(false);
  const [monthBudgetText, setMonthBudgetText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = async () => {
    const nextSetup = await loadBudgetSetup(repositories, monthKey);
    setCategoryDrafts(createDrafts(nextSetup));
    setMonthBudgetEnabled(nextSetup.monthlyBudgetMinor !== null);
    setMonthBudgetText(formatMinorUnitsInput(nextSetup.monthlyBudgetMinor));
    setSetup(nextSetup);
  };

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const nextSetup = await loadBudgetSetup(repositories, monthKey);

        if (cancelled) {
          return;
        }

        setCategoryDrafts(createDrafts(nextSetup));
        setMonthBudgetEnabled(nextSetup.monthlyBudgetMinor !== null);
        setMonthBudgetText(formatMinorUnitsInput(nextSetup.monthlyBudgetMinor));
        setSetup(nextSetup);
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

      if (monthBudgetEnabled && parsedValue === null) {
        throw new Error('Podaj poprawną kwotę budżetu miesiąca.');
      }

      await saveMonthlyBudgetConfig(repositories, {
        currencyCode: setup.currencyCode,
        monthKey: setup.monthKey,
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
      const parsedLimit = (isExpense && draft.limitEnabled) ? parseMoneyToMinorUnits(draft.limitText) : null;

      if (isExpense && draft.limitEnabled && parsedLimit === null) {
        throw new Error(`Podaj poprawny limit dla kategorii „${item.category.name}”.`);
      }

      await saveCategoryConfig(repositories, {
        categoryId: item.category.id,
        categoryName: trimmedName,
        currencyCode: setup.currencyCode,
        isActive: draft.isActive,
        limitAmountMinor: (isExpense && draft.isActive) ? parsedLimit : null,
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
        <Text style={styles.loadingText}>Ładuję konfigurację budżetów...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Update 00.3</Text>
        <Text style={styles.title}>Kategorie i budżet startowy</Text>
        <Text style={styles.description}>
          Budżet miesiąca jest opcjonalny. Limity kategorii są niezależne od budżetu całościowego i
          służą jako dodatkowe guardraile dla wydatków.
        </Text>
      </View>

      {errorMessage ? (
        <AppCard>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </AppCard>
      ) : null}

      {!setup.hasMonthlyBudget && !setup.hasAnyConfiguredCategoryBudget ? (
        <AppCard>
          <Text style={styles.sectionTitle}>Pierwsza konfiguracja</Text>
          <Text style={styles.helperText}>
            Na starcie masz gotową listę kategorii, ale limity są puste. Najprostszy start to ustawienie
            budżetu miesiąca i dodanie limitów tylko dla kilku głównych kategorii wydatkowych.
          </Text>
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.sectionTitle}>Podsumowanie miesiąca</Text>
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
          <Metric
            label="Suma limitów kategorii"
            value={formatMinorUnits(setup.configuredCategoryBudgetsMinor, setup.currencyCode)}
          />
          <Metric
            label="Różnica miesiąc vs kategorie"
            value={
              setup.monthlyBudgetGapMinor === null
                ? 'Brak budżetu miesiąca'
                : formatMinorUnits(setup.monthlyBudgetGapMinor, setup.currencyCode)
            }
          />
          <Metric label="Kategorie bez limitu" value={String(setup.uncappedExpenseCategoriesCount)} />
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Budżet całego miesiąca</Text>
        <Text style={styles.helperText}>
          W MVP budżet miesiąca jest opcjonalny. Jeśli go nie ustawisz, aplikacja nadal działa, a kontrola
          opiera się tylko na limitach kategorii.
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

        <AppButton label={isSaving ? 'Zapisywanie...' : 'Zapisz budżet miesiąca'} onPress={saveMonthBudget} />
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Kategorie wydatkowe</Text>
        <Text style={styles.helperText}>
          Kategorie bez ustawionego limitu pozostają aktywne, ale są traktowane jako nielimitowane.
        </Text>
        <View style={styles.categoryList}>
          {setup.expenseCategories.map((item) => (
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
            ) : null
          ))}
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Kategorie przychodów</Text>
        <Text style={styles.helperText}>
          W MVP kategorie przychodów pozostają proste. Pokazujemy tu realne wpływy per kategoria,
          bez osobnych celów i limitów do ustawiania.
        </Text>
        <View style={styles.categoryList}>
          {setup.incomeCategories.map((item) => (
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
            ) : null
          ))}
        </View>
      </AppCard>

      {!setup.hasAnyActiveCategory ? (
        <AppCard>
          <Text style={styles.sectionTitle}>Brak aktywnych kategorii</Text>
          <Text style={styles.helperText}>
            Aktywuj przynajmniej jedną kategorię, żeby późniejsze update’y `01.0` i `01.2` mogły korzystać
            z gotowej konfiguracji.
          </Text>
        </AppCard>
      ) : null}
    </ScrollView>
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
  const amountLabel = isIncomeCategory ? 'Wpłynęło' : 'Wydano';

  return (
    <View style={styles.categoryCard}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryHeaderText}>
          <Text style={styles.categoryType}>
            {isIncomeCategory ? 'Przychód' : 'Wydatek'}
          </Text>
          <Text style={styles.categoryMeta}>
            {amountLabel}: {formatMinorUnits(item.spentMinor, currencyCode)}
            {!isIncomeCategory && item.remainingMinor !== null
              ? ` • Zostało: ${formatMinorUnits(item.remainingMinor, currencyCode)}`
              : !isIncomeCategory ? ' • Bez limitu' : ''}
          </Text>
        </View>
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

      {item.isOverBudget && !isIncomeCategory ? (
        <Text style={styles.errorText}>Ta kategoria jest już ponad limitem.</Text>
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
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  categoryHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  categoryType: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  categoryMeta: {
    color: colors.textMuted,
    lineHeight: 20,
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
