import { FontAwesome5 } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';

import { CATEGORY_ICON_OPTIONS } from '@/src/features/budgets/data/categoryIcons';
import {
  createCategoryConfig,
  deleteCategoryConfig,
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
import {
  AppButton,
  AppCard,
  AppInput,
  useFocusedFieldScroll,
  useScreenContentInsets,
} from '@/src/shared/ui';
import { getCurrentMonthKey } from '@/src/shared/utils/date';
import {
  formatMinorUnits,
  formatMinorUnitsInput,
  parseMoneyToMinorUnits,
} from '@/src/shared/utils/money';

type CategoryDraft = {
  icon: string | null;
  name: string;
  isActive: boolean;
  limitEnabled: boolean;
  limitText: string;
};

type CategoryTypeDraft = 'expense' | 'income';

function createDrafts(setup: BudgetSetupState) {
  const drafts: Record<string, CategoryDraft> = {};

  [...setup.expenseCategories, ...setup.incomeCategories].forEach((item) => {
    drafts[item.category.id] = {
      icon: item.category.icon,
      isActive: item.isActive,
      limitEnabled: item.budgetLimitMinor !== null,
      limitText: formatMinorUnitsInput(item.budgetLimitMinor),
      name: item.category.name,
    };
  });

  return drafts;
}

function getDefaultIconForType(type: CategoryTypeDraft) {
  return type === 'income' ? 'coins' : 'receipt';
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
      return 'Z limitem';
    case 'no_limit':
      return 'Bez limitu';
    case 'inactive':
      return 'Nieaktywna';
    case 'income':
      return 'Przychód';
  }
}

function buildCategoryPreview(item: BudgetCategoryItem, currencyCode: string) {
  if (item.transactionType === 'income') {
    return `Wpłynęło ${formatMinorUnits(item.spentMinor, currencyCode)}`;
  }

  if (!item.isActive) {
    return 'Nie pokazuje się w szybkim wyborze.';
  }

  if (item.budgetLimitMinor === null) {
    return `Wydano ${formatMinorUnits(item.spentMinor, currencyCode)}. Bez limitu.`;
  }

  return `${formatMinorUnits(item.spentMinor, currencyCode)} z ${formatMinorUnits(item.budgetLimitMinor, currencyCode)}`;
}

function flattenCategoryItems(setup: BudgetSetupState) {
  return [
    ...setup.problemExpenseCategories,
    ...setup.stableExpenseCategories,
    ...setup.uncappedExpenseCategories,
    ...setup.inactiveExpenseCategories,
    ...setup.incomeCategories,
  ];
}

export function BudgetsScreen() {
  const { repositories, status } = useAppServices();
  const { contentBottomPadding } = useScreenContentInsets();
  const monthKey = getCurrentMonthKey();
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollToKeyboardTarget = (target: number, topOffset: number) => {
    scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard?.(
      target,
      topOffset,
      true,
    );
  };
  const { createFocusHandler, registerField, registerInputRef } =
    useFocusedFieldScroll(
      (y) => {
        scrollRef.current?.scrollTo({ animated: true, y });
      },
      { scrollToTarget: scrollToKeyboardTarget },
    );

  const [setup, setSetup] = useState<BudgetSetupState | null>(null);
  const [categoryDrafts, setCategoryDrafts] = useState<
    Record<string, CategoryDraft>
  >({});
  const [monthBudgetEnabled, setMonthBudgetEnabled] = useState(false);
  const [monthBudgetText, setMonthBudgetText] = useState('');
  const [targetSavingsText, setTargetSavingsText] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] =
    useState<CategoryTypeDraft>('expense');
  const [newCategoryIcon, setNewCategoryIcon] = useState<string | null>(
    getDefaultIconForType('expense'),
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [deleteConfirmCategoryId, setDeleteConfirmCategoryId] = useState<
    string | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [detailCardOffsetY, setDetailCardOffsetY] = useState<number | null>(
    null,
  );

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
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Nie udało się wczytać budżetów.',
          );
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [monthKey, repositories, status]);

  const allCategoryItems = useMemo(
    () => (setup ? flattenCategoryItems(setup) : []),
    [setup],
  );

  const selectedCategoryItem = useMemo(
    () =>
      selectedCategoryId
        ? (allCategoryItems.find(
            (item) => item.category.id === selectedCategoryId,
          ) ?? null)
        : null,
    [allCategoryItems, selectedCategoryId],
  );
  const activeSelectedCategoryId = selectedCategoryItem?.category.id ?? null;

  useEffect(() => {
    if (!selectedCategoryItem || detailCardOffsetY === null) {
      return;
    }

    scrollRef.current?.scrollTo({
      animated: true,
      y: Math.max(detailCardOffsetY - spacing.lg, 0),
    });
  }, [detailCardOffsetY, selectedCategoryItem]);

  const setDraftPatch = (categoryId: string, patch: Partial<CategoryDraft>) => {
    setCategoryDrafts((current) => ({
      ...current,
      [categoryId]: {
        ...current[categoryId],
        ...patch,
      },
    }));
  };

  const saveMonthBudget = async () => {
    if (!setup) {
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsSaving(true);

    try {
      const parsedValue = monthBudgetEnabled
        ? parseMoneyToMinorUnits(monthBudgetText)
        : null;
      const parsedTargetSavings = monthBudgetEnabled
        ? targetSavingsText.trim()
          ? parseMoneyToMinorUnits(targetSavingsText)
          : null
        : null;

      if (monthBudgetEnabled && parsedValue === null) {
        throw new Error('Podaj poprawną kwotę budżetu miesiąca.');
      }

      if (
        monthBudgetEnabled &&
        targetSavingsText.trim() &&
        parsedTargetSavings === null
      ) {
        throw new Error('Podaj poprawny cel oszczędnościowy.');
      }

      await saveMonthlyBudgetConfig(repositories, {
        currencyCode: setup.currencyCode,
        monthKey: setup.monthKey,
        targetSavingsMinor: parsedTargetSavings,
        totalBudgetMinor: parsedValue,
      });

      await reload();
      setFeedbackMessage('Budżet miesiąca zapisany.');
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się zapisać budżetu miesiąca.',
      );
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
    setFeedbackMessage(null);
    setIsSaving(true);

    try {
      const trimmedName = draft.name.trim();

      if (!trimmedName) {
        throw new Error('Nazwa kategorii nie może być pusta.');
      }

      const isExpense =
        item.transactionType === 'expense' || item.transactionType === 'both';
      const parsedLimit =
        isExpense && draft.limitEnabled
          ? parseMoneyToMinorUnits(draft.limitText)
          : null;

      if (isExpense && draft.limitEnabled && parsedLimit === null) {
        throw new Error(
          `Podaj poprawny limit dla kategorii „${item.category.name}”.`,
        );
      }

      await saveCategoryConfig(repositories, {
        categoryId: item.category.id,
        categoryName: trimmedName,
        currencyCode: setup.currencyCode,
        isActive: draft.isActive,
        icon: draft.icon,
        limitAmountMinor: isExpense && draft.isActive ? parsedLimit : null,
        monthKey: setup.monthKey,
        transactionType: item.transactionType,
      });

      await reload();
      setFeedbackMessage('Kategoria zapisana.');
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się zapisać kategorii.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) {
      setErrorMessage('Podaj nazwę nowej kategorii.');
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsSaving(true);

    try {
      const created = await createCategoryConfig(repositories, {
        icon: newCategoryIcon,
        name: newCategoryName,
        transactionType: newCategoryType,
      });

      await reload();
      setNewCategoryName('');
      setNewCategoryIcon(getDefaultIconForType(newCategoryType));
      setSelectedCategoryId(created.id);
      setFeedbackMessage('Dodano kategorię.');
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się dodać kategorii.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCategory = async (item: BudgetCategoryItem) => {
    if (!setup) {
      return;
    }

    if (deleteConfirmCategoryId !== item.category.id) {
      setDeleteConfirmCategoryId(item.category.id);
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsSaving(true);

    try {
      await deleteCategoryConfig(repositories, {
        categoryId: item.category.id,
        monthKey: setup.monthKey,
      });

      await reload();
      setDeleteConfirmCategoryId(null);
      setSelectedCategoryId(null);
      setFeedbackMessage('Kategoria usunięta.');
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się usunąć kategorii.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!setup) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Ładuję budżety...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}
    >
      <ScrollView
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.content,
          { paddingBottom: contentBottomPadding },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={styles.hero}>
          <Text style={styles.title}>Budżety</Text>
          <Text style={styles.description}>
            Lista kategorii i limitów na ten miesiąc.
          </Text>
        </View>

        {errorMessage ? (
          <AppCard>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </AppCard>
        ) : null}

        {feedbackMessage ? (
          <AppCard>
            <Text style={styles.feedbackText}>{feedbackMessage}</Text>
          </AppCard>
        ) : null}

        <AppCard>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.sectionTitle}>Miesiąc pod kontrolą</Text>
              <Text style={styles.helperText}>
                Szybki podgląd planu, wydatków i ryzyk.
              </Text>
            </View>
            <StatusBadge
              label={getMonthStatusLabel(setup.monthlyBudgetStatus)}
              status={setup.monthlyBudgetStatus}
            />
          </View>

          <View style={styles.metricsGrid}>
            <Metric
              label="Wydane"
              value={formatMinorUnits(
                setup.monthlySpentMinor,
                setup.currencyCode,
              )}
            />
            <Metric
              label="Budżet miesiąca"
              value={
                setup.monthlyBudgetMinor === null
                  ? 'Nieustawiony'
                  : formatMinorUnits(
                      setup.monthlyBudgetMinor,
                      setup.currencyCode,
                    )
              }
            />
            <Metric
              label="Pozostało"
              value={
                setup.monthlyRemainingMinor === null
                  ? 'Bez limitu'
                  : formatMinorUnits(
                      setup.monthlyRemainingMinor,
                      setup.currencyCode,
                    )
              }
            />
            <Metric
              label="Kategorie ryzyka"
              value={String(setup.categoriesAtRiskCount)}
            />
            <Metric
              label="Kategorie z limitem"
              value={String(
                setup.activeExpenseCategoriesCount -
                  setup.uncappedExpenseCategoriesCount,
              )}
            />
            <Metric
              label="Kategorie bez limitu"
              value={String(setup.uncappedExpenseCategoriesCount)}
            />
            <Metric
              label="Cel oszczędnościowy"
              value={
                setup.targetSavingsMinor === null
                  ? 'Nieustawiony'
                  : formatMinorUnits(
                      setup.targetSavingsMinor,
                      setup.currencyCode,
                    )
              }
            />
          </View>

          {setup.monthlyBudgetUsageRatio !== null ? (
            <>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Wykorzystanie miesiąca</Text>
                <Text style={styles.progressValue}>
                  {formatUsage(setup.monthlyBudgetUsagePercent)}
                </Text>
              </View>
              <ProgressBar
                ratio={setup.monthlyBudgetUsageRatio}
                status={setup.monthlyBudgetStatus}
              />
            </>
          ) : null}
        </AppCard>

        <AppCard>
          <Text style={styles.sectionTitle}>Plan miesiąca</Text>
          <Text style={styles.helperText}>
            Budżet i cel oszczędnościowy ustawiasz raz na miesiąc.
          </Text>

          <View style={styles.row}>
            <ToggleChip
              active={monthBudgetEnabled}
              label={
                monthBudgetEnabled
                  ? 'Budżet miesiąca aktywny'
                  : 'Budżet miesiąca wyłączony'
              }
              onPress={() => setMonthBudgetEnabled((value) => !value)}
            />
          </View>

          <View onLayout={registerField('month_budget')}>
            <AppInput
              ref={registerInputRef('month_budget')}
              editable={monthBudgetEnabled}
              keyboardType="decimal-pad"
              onChangeText={setMonthBudgetText}
              onFocus={createFocusHandler('month_budget')}
              placeholder="Budżet miesiąca, np. 4700,00"
              value={monthBudgetText}
            />
          </View>

          <View onLayout={registerField('target_savings')}>
            <AppInput
              ref={registerInputRef('target_savings')}
              editable={monthBudgetEnabled}
              keyboardType="decimal-pad"
              onChangeText={setTargetSavingsText}
              onFocus={createFocusHandler('target_savings')}
              placeholder="Cel oszczędnościowy, np. 1200,00"
              value={targetSavingsText}
            />
          </View>

          <AppButton
            label={isSaving ? 'Zapisywanie...' : 'Zapisz plan miesiąca'}
            onPress={saveMonthBudget}
          />
        </AppCard>

        <AppCard>
          <Text style={styles.sectionTitle}>Dodaj kategorię</Text>
          <Text style={styles.helperText}>
            Własną kategorię dodasz od razu do listy budżetów.
          </Text>

          <View style={styles.row}>
            <ToggleChip
              active={newCategoryType === 'expense'}
              label="Wydatek"
              onPress={() => {
                setNewCategoryType('expense');
                setNewCategoryIcon((current) => current ?? 'receipt');
              }}
            />
            <ToggleChip
              active={newCategoryType === 'income'}
              label="Przychód"
              onPress={() => {
                setNewCategoryType('income');
                setNewCategoryIcon((current) => current ?? 'coins');
              }}
            />
          </View>

          <View style={styles.iconPickerBlock}>
            <Text style={styles.label}>Ikona na dashboardzie</Text>
            <CollapsibleIconPicker
              selectedIcon={newCategoryIcon}
              onSelect={(icon) => setNewCategoryIcon(icon)}
            />
          </View>

          <View onLayout={registerField('new_category_name')}>
            <AppInput
              ref={registerInputRef('new_category_name')}
              onChangeText={setNewCategoryName}
              onFocus={createFocusHandler('new_category_name')}
              placeholder="Np. Zwierzęta albo Edukacja"
              value={newCategoryName}
            />
          </View>

          <AppButton
            disabled={isSaving || !newCategoryName.trim()}
            label="Dodaj kategorię"
            onPress={createCategory}
          />
        </AppCard>

        {selectedCategoryItem ? (
          <CategoryDetailCard
            currencyCode={setup.currencyCode}
            deleteConfirmCategoryId={deleteConfirmCategoryId}
            draft={categoryDrafts[selectedCategoryItem.category.id]}
            isSaving={isSaving}
            item={selectedCategoryItem}
            onCardLayout={(event) =>
              setDetailCardOffsetY(event.nativeEvent.layout.y)
            }
            onChangeDraft={setDraftPatch}
            onClose={() => {
              setSelectedCategoryId(null);
              setDeleteConfirmCategoryId(null);
            }}
            onDelete={() => deleteCategory(selectedCategoryItem)}
            onFieldFocus={createFocusHandler}
            onFieldLayout={registerField}
            onFieldRef={registerInputRef}
            onSave={() => saveCategory(selectedCategoryItem)}
          />
        ) : null}

        {setup.problemExpenseCategories.length > 0 ? (
          <BudgetListSection
            currencyCode={setup.currencyCode}
            items={setup.problemExpenseCategories}
            onSelect={setSelectedCategoryId}
            selectedCategoryId={activeSelectedCategoryId}
            subtitle="Najpierw sprawdź te pozycje."
            title="Wymagają uwagi"
          />
        ) : null}

        <BudgetListSection
          currencyCode={setup.currencyCode}
          items={setup.stableExpenseCategories}
          onSelect={setSelectedCategoryId}
          selectedCategoryId={activeSelectedCategoryId}
          subtitle="Aktywne kategorie z limitem."
          title="Kategorie z limitem"
        />

        {setup.uncappedExpenseCategories.length > 0 ? (
          <BudgetListSection
            currencyCode={setup.currencyCode}
            items={setup.uncappedExpenseCategories}
            onSelect={setSelectedCategoryId}
            selectedCategoryId={activeSelectedCategoryId}
            subtitle="Zbierają wydatki bez progu."
            title="Kategorie bez limitu"
          />
        ) : null}

        {setup.inactiveExpenseCategories.length > 0 ? (
          <BudgetListSection
            currencyCode={setup.currencyCode}
            items={setup.inactiveExpenseCategories}
            onSelect={setSelectedCategoryId}
            selectedCategoryId={activeSelectedCategoryId}
            subtitle="Ukryte w codziennym wyborze."
            title="Nieaktywne kategorie"
          />
        ) : null}

        <BudgetListSection
          currencyCode={setup.currencyCode}
          items={setup.incomeCategories}
          onSelect={setSelectedCategoryId}
          selectedCategoryId={activeSelectedCategoryId}
          subtitle="Przychody bez osobnych limitów."
          title="Kategorie przychodów"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BudgetListSection({
  title,
  subtitle,
  items,
  currencyCode,
  selectedCategoryId,
  onSelect,
}: {
  title: string;
  subtitle: string;
  items: BudgetCategoryItem[];
  currencyCode: string;
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <AppCard>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.helperText}>{subtitle}</Text>
      <View style={styles.categoryList}>
        {items.map((item) => (
          <CategoryListItem
            key={item.category.id}
            currencyCode={currencyCode}
            isSelected={selectedCategoryId === item.category.id}
            item={item}
            onPress={() => onSelect(item.category.id)}
          />
        ))}
      </View>
    </AppCard>
  );
}

function CategoryListItem({
  item,
  currencyCode,
  isSelected,
  onPress,
}: {
  item: BudgetCategoryItem;
  currencyCode: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.listItem, isSelected ? styles.listItemSelected : null]}
    >
      <View
        style={[
          styles.categoryIconWrap,
          item.category.color
            ? { backgroundColor: `${item.category.color}20` }
            : null,
        ]}
      >
        {item.category.icon ? (
          <FontAwesome5
            color={item.category.color ?? colors.primary}
            iconStyle="solid"
            name={item.category.icon as keyof typeof FontAwesome5.glyphMap}
            size={14}
          />
        ) : (
          <FontAwesome5
            color={colors.primary}
            iconStyle="solid"
            name="receipt"
            size={14}
          />
        )}
      </View>
      <View style={styles.listItemCopy}>
        <Text style={styles.categoryName}>{item.category.name}</Text>
        <Text style={styles.categoryMeta}>
          {buildCategoryPreview(item, currencyCode)}
        </Text>
      </View>
      <View style={styles.listItemMeta}>
        <StatusBadge
          label={getCategoryStatusLabel(item.status)}
          status={item.status}
        />
        <Text style={styles.listItemAction}>
          {isSelected ? 'Wybrane' : 'Otwórz'}
        </Text>
      </View>
    </Pressable>
  );
}

function CategoryDetailCard({
  item,
  draft,
  currencyCode,
  isSaving,
  deleteConfirmCategoryId,
  onCardLayout,
  onChangeDraft,
  onSave,
  onDelete,
  onFieldFocus,
  onFieldLayout,
  onFieldRef,
  onClose,
}: {
  item: BudgetCategoryItem;
  draft: CategoryDraft | undefined;
  currencyCode: string;
  isSaving: boolean;
  deleteConfirmCategoryId: string | null;
  onCardLayout: (event: LayoutChangeEvent) => void;
  onChangeDraft: (categoryId: string, patch: Partial<CategoryDraft>) => void;
  onSave: () => void;
  onDelete: () => void;
  onFieldFocus: (fieldId: string) => () => void;
  onFieldLayout: (fieldId: string) => (event: LayoutChangeEvent) => void;
  onFieldRef: (fieldId: string) => (input: TextInput | null) => void;
  onClose: () => void;
}) {
  if (!draft) {
    return null;
  }

  const supportsBudget =
    item.transactionType === 'expense' || item.transactionType === 'both';
  const deleteNeedsConfirm = deleteConfirmCategoryId === item.category.id;

  return (
    <View onLayout={onCardLayout}>
      <AppCard>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderCopy}>
            <Text style={styles.sectionTitle}>{item.category.name}</Text>
            <Text style={styles.helperText}>
              Tu zmienisz nazwę, aktywność i limit tej kategorii.
            </Text>
          </View>
          <StatusBadge
            label={getCategoryStatusLabel(item.status)}
            status={item.status}
          />
        </View>

        <View style={styles.metricsRow}>
          <MiniMetric
            label={item.transactionType === 'income' ? 'Wpłynęło' : 'Wydano'}
            value={formatMinorUnits(item.spentMinor, currencyCode)}
          />
          <MiniMetric
            label={supportsBudget ? 'Pozostało' : 'Status'}
            value={
              supportsBudget
                ? item.remainingMinor === null
                  ? 'Bez limitu'
                  : formatMinorUnits(item.remainingMinor, currencyCode)
                : getCategoryStatusLabel(item.status)
            }
          />
          <MiniMetric
            label="Typ"
            value={item.transactionType === 'income' ? 'Przychód' : 'Wydatek'}
          />
        </View>

        <View style={styles.row}>
          <ToggleChip
            active={draft.isActive}
            label={draft.isActive ? 'Aktywna' : 'Nieaktywna'}
            onPress={() =>
              onChangeDraft(item.category.id, { isActive: !draft.isActive })
            }
          />
        </View>

        <View onLayout={onFieldLayout(`category_name_${item.category.id}`)}>
          <AppInput
            ref={onFieldRef(`category_name_${item.category.id}`)}
            onChangeText={(value) =>
              onChangeDraft(item.category.id, { name: value })
            }
            onFocus={onFieldFocus(`category_name_${item.category.id}`)}
            placeholder="Nazwa kategorii"
            value={draft.name}
          />
        </View>

        <View style={styles.iconPickerBlock}>
          <Text style={styles.label}>Ikona na dashboardzie</Text>
          <CollapsibleIconPicker
            selectedIcon={draft.icon}
            onSelect={(icon) => onChangeDraft(item.category.id, { icon })}
          />
        </View>

        {supportsBudget ? (
          <>
            <View style={styles.row}>
              <ToggleChip
                active={draft.limitEnabled}
                label={draft.limitEnabled ? 'Limit aktywny' : 'Bez limitu'}
                onPress={() =>
                  onChangeDraft(item.category.id, {
                    limitEnabled: !draft.limitEnabled,
                  })
                }
              />
            </View>

            <View
              onLayout={onFieldLayout(`category_limit_${item.category.id}`)}
            >
              <AppInput
                ref={onFieldRef(`category_limit_${item.category.id}`)}
                editable={draft.limitEnabled}
                keyboardType="decimal-pad"
                onChangeText={(value) =>
                  onChangeDraft(item.category.id, { limitText: value })
                }
                onFocus={onFieldFocus(`category_limit_${item.category.id}`)}
                placeholder="Limit kategorii, np. 500,00"
                value={draft.limitText}
              />
            </View>
          </>
        ) : null}

        {item.status === 'over_budget' ? (
          <Text style={styles.errorText}>
            Ta kategoria jest już ponad limitem.
          </Text>
        ) : item.status === 'warning' ? (
          <Text style={styles.warningText}>
            Ta kategoria jest blisko limitu.
          </Text>
        ) : null}

        <Text style={styles.helperText}>
          Usunięcie odłączy stare transakcje od tej kategorii i usunie jej limit
          z tego miesiąca.
        </Text>

        <View style={styles.inlineActions}>
          <View style={styles.inlineAction}>
            <AppButton
              disabled={isSaving}
              label="Zamknij"
              onPress={onClose}
              variant="secondary"
            />
          </View>
          <View style={styles.inlineAction}>
            <AppButton
              disabled={isSaving}
              label={deleteNeedsConfirm ? 'Potwierdź usunięcie' : 'Usuń'}
              onPress={onDelete}
              variant="secondary"
            />
          </View>
        </View>

        <AppButton
          disabled={isSaving}
          label={isSaving ? 'Zapisywanie...' : 'Zapisz kategorię'}
          onPress={onSave}
        />
      </AppCard>
    </View>
  );
}

function CollapsibleIconPicker({
  selectedIcon,
  onSelect,
}: {
  selectedIcon: string | null;
  onSelect: (icon: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption =
    CATEGORY_ICON_OPTIONS.find((option) => option.key === selectedIcon) ?? null;

  return (
    <View style={styles.iconPickerWrap}>
      <Pressable
        onPress={() => setIsOpen((current) => !current)}
        style={styles.iconPickerTrigger}
      >
        <View style={styles.iconPickerTriggerValue}>
          <View style={styles.categoryIconWrap}>
            <FontAwesome5
              color={colors.primary}
              iconStyle="solid"
              name={
                (selectedIcon ??
                  'receipt') as keyof typeof FontAwesome5.glyphMap
              }
              size={14}
            />
          </View>
          <Text style={styles.iconPickerTriggerLabel}>
            {selectedOption?.label ?? 'Wybierz ikonę'}
          </Text>
        </View>
        <Text style={styles.iconPickerTriggerAction}>
          {isOpen ? 'Zwiń' : 'Rozwiń'}
        </Text>
      </Pressable>

      {isOpen ? (
        <View style={styles.iconGrid}>
          {CATEGORY_ICON_OPTIONS.map((option) => {
            const active = selectedIcon === option.key;

            return (
              <Pressable
                key={option.key}
                onPress={() => {
                  onSelect(option.key);
                  setIsOpen(false);
                }}
                style={[
                  styles.iconOption,
                  active ? styles.iconOptionActive : null,
                ]}
              >
                <FontAwesome5
                  color={active ? colors.primary : colors.text}
                  iconStyle="solid"
                  name={option.key}
                  size={16}
                />
                <Text
                  style={[
                    styles.iconOptionLabel,
                    active ? styles.iconOptionLabelActive : null,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
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
      style={[
        styles.toggleChip,
        active ? styles.toggleChipActive : styles.toggleChipInactive,
      ]}
    >
      <Text
        style={[
          styles.toggleChipLabel,
          active ? styles.toggleChipLabelActive : undefined,
        ]}
      >
        {label}
      </Text>
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
  const isMuted =
    status === 'no_budget' || status === 'no_limit' || status === 'inactive';

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
          isMuted
            ? styles.statusBadgeLabelMuted
            : styles.statusBadgeLabelPositive,
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
    lineHeight: 20,
  },
  label: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  feedbackText: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    lineHeight: 20,
  },
  warningText: {
    color: '#A96300',
    lineHeight: 20,
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
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconPickerBlock: {
    gap: spacing.sm,
  },
  iconPickerWrap: {
    gap: spacing.sm,
  },
  iconPickerTrigger: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconPickerTriggerValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconPickerTriggerLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  iconPickerTriggerAction: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconOption: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: 76,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconOptionActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  iconOptionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  iconOptionLabelActive: {
    color: colors.primary,
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
    gap: spacing.md,
  },
  categoryIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  listItem: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  listItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  listItemCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  listItemMeta: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  listItemAction: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
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
  inlineActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineAction: {
    flex: 1,
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
