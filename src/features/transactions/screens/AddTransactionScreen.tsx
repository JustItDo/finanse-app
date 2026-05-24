import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  createFormValuesForType,
  loadTransactionFormContext,
  saveManualTransaction,
  validateTransactionForm,
  type TransactionFormContext,
  type TransactionFormValues,
  type TransactionSaveImpact,
} from '@/src/features/transactions/data/addTransaction';
import { useAppServices } from '@/src/providers/AppServicesProvider';
import { colors, radius, spacing, typography } from '@/src/shared/theme';
import { AppButton, AppCard, AppInput } from '@/src/shared/ui';
import { getCurrentMonthKey } from '@/src/shared/utils/date';
import { formatMinorUnits } from '@/src/shared/utils/money';
import type { TransactionType } from '@/src/domain/finance';

const paymentMethodOptions: { value: TransactionFormValues['paymentMethod']; label: string }[] = [
  { value: 'card', label: 'Karta' },
  { value: 'blik', label: 'BLIK' },
  { value: 'cash', label: 'Gotówka' },
  { value: 'bank_transfer', label: 'Przelew' },
  { value: 'other', label: 'Inne' },
];

const transactionTypeOptions: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Wydatek' },
  { value: 'income', label: 'Przychód' },
];

export function AddTransactionScreen() {
  const { repositories, status } = useAppServices();

  const [context, setContext] = useState<TransactionFormContext | null>(null);
  const [form, setForm] = useState<TransactionFormValues | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof TransactionFormValues, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [impact, setImpact] = useState<TransactionSaveImpact | null>(null);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    let cancelled = false;

    loadTransactionFormContext(repositories, getCurrentMonthKey())
      .then((result) => {
        if (cancelled) {
          return;
        }

        setContext(result);
        setForm(result.defaultValues);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSubmitError(error instanceof Error ? error.message : 'Nie udało się przygotować formularza.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repositories, status]);

  if (!context || !form) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Przygotowuję formularz transakcji...</Text>
      </View>
    );
  }

  const selectedCategories = context.categoriesByType[form.type];
  const selectedCategory = selectedCategories.find((item) => item.id === form.categoryId) ?? null;
  const actionLabel = form.type === 'income' ? 'Dodaj przychód' : 'Dodaj wydatek';
  const saveLabel = form.type === 'income' ? 'Zapisz przychód' : 'Zapisz wydatek';
  const detailsDescription =
    form.type === 'income'
      ? 'Dla przychodu zostawiamy ten sam model zapisu, ale formularz pozostaje szybki i prosty.'
      : 'Najbardziej codzienny flow w aplikacji. Kwota i kategoria są na pierwszym planie, szczegóły są opcjonalne.';

  const handleSave = async () => {
    const validation = validateTransactionForm(form);
    setErrors(validation.errors);
    setSubmitError(null);

    if (Object.keys(validation.errors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      const result = await saveManualTransaction(repositories, form, context.currencyCode);
      const refreshed = await loadTransactionFormContext(repositories, getCurrentMonthKey());

      setContext(refreshed);
      setForm(
        createFormValuesForType(
          {
            ...refreshed.defaultValues,
            categoryId: form.categoryId,
            type: form.type,
          },
          form.type,
          refreshed,
        ),
      );
      setErrors({});
      setImpact(result);
      setShowDetails(false);
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Nie udało się zapisać transakcji.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Update 01.1</Text>
        <Text style={styles.title}>Dodaj transakcję</Text>
        <Text style={styles.description}>{detailsDescription}</Text>
      </View>

      {impact ? (
        <AppCard>
          <Text style={styles.sectionTitle}>
            {impact.transactionType === 'income' ? 'Przychód zapisany' : 'Wydatek zapisany'}
          </Text>
          <Text style={styles.helperText}>
            Dodano {formatMinorUnits(impact.amountMinor, context.currencyCode)} jako{' '}
            {impact.transactionType === 'income' ? 'przychód' : 'wydatek'} w kategorii {impact.categoryName}.
          </Text>
          <View style={styles.impactGrid}>
            <ImpactMetric
              label="Przychody miesiąca"
              before={impact.monthIncomeBeforeMinor}
              after={impact.monthIncomeAfterMinor}
              currencyCode={context.currencyCode}
            />
            <ImpactMetric
              label="Wydatki miesiąca"
              before={impact.monthExpenseBeforeMinor}
              after={impact.monthExpenseAfterMinor}
              currencyCode={context.currencyCode}
            />
            <ImpactMetric
              label="Bilans miesiąca"
              before={impact.monthBalanceBeforeMinor}
              after={impact.monthBalanceAfterMinor}
              currencyCode={context.currencyCode}
            />
            {impact.transactionType === 'expense' ? (
              <>
                <ImpactMetric
                  label="Kategoria"
                  before={impact.categorySpentBeforeMinor ?? 0}
                  after={impact.categorySpentAfterMinor ?? 0}
                  currencyCode={context.currencyCode}
                />
                <ImpactRemaining
                  label="Pozostało w kategorii"
                  before={impact.categoryRemainingBeforeMinor}
                  after={impact.categoryRemainingAfterMinor}
                  currencyCode={context.currencyCode}
                />
              </>
            ) : null}
          </View>
        </AppCard>
      ) : null}

      {submitError ? (
        <AppCard>
          <Text style={styles.errorText}>{submitError}</Text>
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.sectionTitle}>{actionLabel}</Text>

        <FieldLabel label="Typ transakcji" required />
        <View style={styles.chipGroup}>
          {transactionTypeOptions.map((option) => (
            <Chip
              key={option.value}
              active={form.type === option.value}
              label={option.label}
              onPress={() =>
                setForm((current) =>
                  current && context ? createFormValuesForType(current, option.value, context) : current,
                )
              }
            />
          ))}
        </View>

        <FieldLabel label="Kwota" required />
        <AppInput
          autoFocus
          keyboardType="decimal-pad"
          onChangeText={(value) => setForm((current) => (current ? { ...current, amountText: value } : current))}
          placeholder="Np. 34,90"
          value={form.amountText}
        />
        {errors.amountText ? <Text style={styles.errorText}>{errors.amountText}</Text> : null}

        <FieldLabel label="Kategoria" required />
        <View style={styles.chipGroup}>
          {selectedCategories.map((category) => (
            <Chip
              key={category.id}
              active={form.categoryId === category.id}
              label={category.name}
              onPress={() =>
                setForm((current) => (current ? { ...current, categoryId: category.id } : current))
              }
            />
          ))}
        </View>
        {errors.categoryId ? <Text style={styles.errorText}>{errors.categoryId}</Text> : null}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Data: {form.date}</Text>
          <Text style={styles.summaryText}>Typ: {form.type === 'income' ? 'Przychód' : 'Wydatek'}</Text>
          <Text style={styles.summaryText}>
            Metoda: {paymentMethodOptions.find((item) => item.value === form.paymentMethod)?.label}
          </Text>
        </View>

        <Pressable onPress={() => setShowDetails((value) => !value)} style={styles.detailsToggle}>
          <Text style={styles.detailsToggleText}>
            {showDetails ? 'Ukryj szczegóły' : 'Pokaż szczegóły'}
          </Text>
        </Pressable>

        {showDetails ? (
          <View style={styles.detailsSection}>
            <FieldLabel label="Data" required />
            <AppInput
              onChangeText={(value) => setForm((current) => (current ? { ...current, date: value } : current))}
              placeholder="RRRR-MM-DD"
              value={form.date}
            />
            {errors.date ? <Text style={styles.errorText}>{errors.date}</Text> : null}

            <FieldLabel label="Metoda płatności" />
            <View style={styles.chipGroup}>
              {paymentMethodOptions.map((option) => (
                <Chip
                  key={option.value}
                  active={form.paymentMethod === option.value}
                  label={option.label}
                  onPress={() =>
                    setForm((current) => (current ? { ...current, paymentMethod: option.value } : current))
                  }
                />
              ))}
            </View>

            <FieldLabel label="Opis" />
            <AppInput
              multiline
              onChangeText={(value) =>
                setForm((current) => (current ? { ...current, description: value } : current))
              }
              placeholder="Opcjonalnie, np. Lidl albo kawa po spotkaniu"
              value={form.description}
            />
          </View>
        ) : null}

        <AppButton disabled={isSaving} label={isSaving ? 'Zapisywanie...' : saveLabel} onPress={handleSave} />
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Podgląd zapisu</Text>
        <Text style={styles.helperText}>
          Zapis utworzy transakcję typu `{form.type}` z kategorią {selectedCategory?.name ?? 'nieustawioną'}.
          Bilans miesiąca dla {form.date.slice(0, 7)} przelicza się wspólnie dla przychodów i wydatków, a budżet
          kategorii jest aktualizowany tylko dla wydatków.
        </Text>
      </AppCard>
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
      <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required ? ' *' : ''}
    </Text>
  );
}

function ImpactMetric({
  label,
  before,
  after,
  currencyCode,
}: {
  label: string;
  before: number;
  after: number;
  currencyCode: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {formatMinorUnits(before, currencyCode)} → {formatMinorUnits(after, currencyCode)}
      </Text>
    </View>
  );
}

function ImpactRemaining({
  label,
  before,
  after,
  currencyCode,
}: {
  label: string;
  before: number | null;
  after: number | null;
  currencyCode: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {before === null ? 'bez limitu' : formatMinorUnits(before, currencyCode)} →{' '}
        {after === null ? 'bez limitu' : formatMinorUnits(after, currencyCode)}
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
  fieldLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  errorText: {
    color: colors.danger,
    lineHeight: 22,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  chipLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: colors.primary,
  },
  detailsToggle: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  detailsToggleText: {
    color: colors.primary,
    fontWeight: '700',
  },
  detailsSection: {
    gap: spacing.md,
  },
  summaryRow: {
    gap: spacing.xs,
  },
  summaryText: {
    color: colors.textMuted,
  },
  impactGrid: {
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
    fontWeight: '700',
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
