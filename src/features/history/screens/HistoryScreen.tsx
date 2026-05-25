import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import type { TransactionType } from '@/src/domain/finance';
import {
  buildNextHistoryFilters,
  loadHistoryDetail,
  loadHistoryEditContext,
  loadHistoryScreenState,
  removeTransactionFromHistory,
  updateTransactionFromHistory,
  validateEditableTransaction,
  type EditableTransactionValues,
  type HistoryEditContext,
  type HistoryScreenState,
  type HistoryTransactionDetail,
  type HistoryTransactionItem,
} from '@/src/features/history/data/history';
import type { RootTabParamList } from '@/src/navigation/AppNavigator';
import { useAppServices } from '@/src/providers/AppServicesProvider';
import { colors, radius, spacing, typography } from '@/src/shared/theme';
import { AppButton, AppCard, AppInput } from '@/src/shared/ui';
import { formatMonthKeyLabel } from '@/src/shared/utils/date';
import { formatMinorUnits } from '@/src/shared/utils/money';

const transactionTypeOptions: {
  value: TransactionType | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'expense', label: 'Wydatki' },
  { value: 'income', label: 'Przychody' },
];

const editTypeOptions: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Wydatek' },
  { value: 'income', label: 'Przychód' },
];

const paymentMethodOptions: {
  value: EditableTransactionValues['paymentMethod'];
  label: string;
}[] = [
  { value: 'card', label: 'Karta' },
  { value: 'blik', label: 'BLIK' },
  { value: 'cash', label: 'Gotówka' },
  { value: 'bank_transfer', label: 'Przelew' },
  { value: 'other', label: 'Inne' },
];

export function HistoryScreen() {
  const { repositories, status, error } = useAppServices();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const isFocused = useIsFocused();

  const [historyState, setHistoryState] = useState<HistoryScreenState | null>(
    null,
  );
  const [searchDraft, setSearchDraft] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<
    string | null
  >(null);
  const [detail, setDetail] = useState<HistoryTransactionDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editContext, setEditContext] = useState<HistoryEditContext | null>(
    null,
  );
  const [editValues, setEditValues] =
    useState<EditableTransactionValues | null>(null);
  const [editErrors, setEditErrors] = useState<
    Partial<Record<keyof EditableTransactionValues, string>>
  >({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const latestFiltersRef = useRef<Parameters<typeof loadHistoryScreenState>[1]>(
    {},
  );
  const latestSelectedTransactionIdRef = useRef<string | null>(null);

  const loadScreen = async (
    filters: Parameters<typeof loadHistoryScreenState>[1],
    preferredSelectionId?: string | null,
  ) => {
    const nextState = await loadHistoryScreenState(repositories, filters);
    const nextSelectionId = resolveSelectedTransactionId(
      nextState.transactions,
      preferredSelectionId,
      latestSelectedTransactionIdRef.current,
    );

    latestFiltersRef.current = nextState.filters;
    latestSelectedTransactionIdRef.current = nextSelectionId;
    setHistoryState(nextState);
    setSearchDraft(nextState.filters.searchText);
    setSelectedTransactionId(nextSelectionId);
    setLoadError(null);

    if (!nextSelectionId) {
      setDetail(null);
      setDetailError(null);
      setEditContext(null);
      setEditValues(null);
      setIsEditing(false);
      setConfirmDelete(false);
      setEditErrors({});
    }
  };

  useEffect(() => {
    if (status !== 'ready' || !isFocused) {
      return;
    }

    let cancelled = false;
    const initialFilters = latestFiltersRef.current;

    loadHistoryScreenState(repositories, initialFilters)
      .then((nextState) => {
        if (cancelled) {
          return;
        }

        const nextSelectionId = resolveSelectedTransactionId(
          nextState.transactions,
          null,
          latestSelectedTransactionIdRef.current,
        );

        latestFiltersRef.current = nextState.filters;
        latestSelectedTransactionIdRef.current = nextSelectionId;
        setHistoryState(nextState);
        setSearchDraft(nextState.filters.searchText);
        setSelectedTransactionId(nextSelectionId);
        setLoadError(null);

        if (!nextSelectionId) {
          setDetail(null);
          setDetailError(null);
          setEditContext(null);
          setEditValues(null);
          setIsEditing(false);
          setConfirmDelete(false);
          setEditErrors({});
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadError(
          reason instanceof Error
            ? reason.message
            : 'Nie udało się wczytać historii.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isFocused, repositories, status]);

  useEffect(() => {
    if (status !== 'ready' || !isFocused || !selectedTransactionId) {
      return;
    }

    let cancelled = false;

    Promise.all([
      loadHistoryDetail(repositories, selectedTransactionId),
      loadHistoryEditContext(repositories, selectedTransactionId),
    ])
      .then(([nextDetail, nextEditContext]) => {
        if (cancelled) {
          return;
        }

        setDetail(nextDetail);
        setEditContext(nextEditContext);
        setEditValues(nextEditContext.values);
        setDetailError(null);
        setEditErrors({});
        setConfirmDelete(false);
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return;
        }

        setDetailError(
          reason instanceof Error
            ? reason.message
            : 'Nie udało się wczytać szczegółu transakcji.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isFocused, repositories, selectedTransactionId, status]);

  if (!historyState) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Ładuję historię transakcji...</Text>
      </View>
    );
  }

  const applyFilterPatch = async (
    patch: Partial<HistoryScreenState['filters']>,
  ) => {
    const nextFilters = buildNextHistoryFilters(historyState.filters, patch);

    try {
      await loadScreen(nextFilters, selectedTransactionId);
    } catch (reason: unknown) {
      setLoadError(
        reason instanceof Error
          ? reason.message
          : 'Nie udało się odświeżyć historii.',
      );
    }
  };

  const handleSaveEdit = async () => {
    if (
      !selectedTransactionId ||
      !editContext ||
      !editValues ||
      !historyState
    ) {
      return;
    }

    const validation = validateEditableTransaction(
      editValues,
      editContext.categoriesByType,
    );
    setEditErrors(validation.errors);

    if (Object.keys(validation.errors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateTransactionFromHistory(
        repositories,
        selectedTransactionId,
        editValues,
        editContext,
      );
      const nextFilters = buildNextHistoryFilters(historyState.filters, {
        categoryId:
          historyState.filters.categoryId &&
          historyState.filters.categoryId !== editValues.categoryId
            ? ''
            : historyState.filters.categoryId,
        monthKey: result.monthKey,
        type:
          historyState.filters.type !== 'all' &&
          historyState.filters.type !== editValues.type
            ? 'all'
            : historyState.filters.type,
      });

      await loadScreen(nextFilters, selectedTransactionId);
      setIsEditing(false);
    } catch (reason: unknown) {
      setDetailError(
        reason instanceof Error
          ? reason.message
          : 'Nie udało się zapisać zmian transakcji.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTransactionId || !historyState) {
      return;
    }

    setIsDeleting(true);

    try {
      await removeTransactionFromHistory(repositories, selectedTransactionId);
      await loadScreen(historyState.filters, null);
    } catch (reason: unknown) {
      setDetailError(
        reason instanceof Error
          ? reason.message
          : 'Nie udało się usunąć transakcji.',
      );
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const header = (
    <View style={styles.headerContent}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Historia transakcji</Text>
          <Text style={styles.description}>
            Filtruj wpisy i poprawiaj je bez rozjeżdżania budżetów.
          </Text>
        </View>
        <AppButton
          label="Dodaj nową"
          onPress={() => navigation.navigate('AddTransaction')}
        />
      </View>

      {loadError || error ? (
        <AppCard>
          <Text style={styles.errorTitle}>Błąd historii</Text>
          <Text style={styles.errorText}>{loadError ?? error?.message}</Text>
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.sectionTitle}>Filtry</Text>

        <FieldLabel label="Szukaj" />
        <AppInput
          onChangeText={setSearchDraft}
          onSubmitEditing={() => {
            void applyFilterPatch({ searchText: searchDraft });
          }}
          placeholder="Opis, notatka albo kategoria"
          returnKeyType="search"
          value={searchDraft}
        />

        <View style={styles.inlineActions}>
          <InlineButton
            label="Szukaj"
            onPress={() => {
              void applyFilterPatch({ searchText: searchDraft });
            }}
          />
          <InlineButton
            label="Wyczyść"
            onPress={() => {
              setSearchDraft('');
              void applyFilterPatch({ searchText: '' });
            }}
            tone="muted"
          />
        </View>

        <FieldLabel label="Typ" />
        <View style={styles.chipGroup}>
          {transactionTypeOptions.map((option) => (
            <Chip
              key={option.value}
              active={historyState.filters.type === option.value}
              label={option.label}
              onPress={() => {
                void applyFilterPatch({ type: option.value });
              }}
            />
          ))}
        </View>

        <FieldLabel label="Miesiąc" />
        <View style={styles.chipGroup}>
          {historyState.monthOptions.map((option) => (
            <Chip
              key={option.value}
              active={historyState.filters.monthKey === option.value}
              label={option.label}
              onPress={() => {
                void applyFilterPatch({ monthKey: option.value });
              }}
            />
          ))}
        </View>

        <FieldLabel label="Kategoria" />
        <View style={styles.chipGroup}>
          <Chip
            active={historyState.filters.categoryId === ''}
            label="Wszystkie"
            onPress={() => {
              void applyFilterPatch({ categoryId: '' });
            }}
          />
          {historyState.categoryOptions.map((category) => (
            <Chip
              key={category.id}
              active={historyState.filters.categoryId === category.id}
              label={category.name}
              onPress={() => {
                void applyFilterPatch({ categoryId: category.id });
              }}
            />
          ))}
        </View>

        <Text style={styles.helperText}>
          Wyniki: {historyState.totalCount} dla{' '}
          {formatMonthKeyLabel(historyState.filters.monthKey)}.
        </Text>
      </AppCard>

      {historyState.isCompletelyEmpty ? (
        <AppCard>
          <Text style={styles.sectionTitle}>Brak historii</Text>
          <Text style={styles.helperText}>
            Nie ma jeszcze żadnych transakcji. Zacznij od dodania pierwszego
            wydatku albo przychodu, a historia od razu pokaże szczegóły i
            pozwoli je później poprawić.
          </Text>
        </AppCard>
      ) : null}

      {historyState.isFilteredEmpty ? (
        <AppCard>
          <Text style={styles.sectionTitle}>Brak wyników</Text>
          <Text style={styles.helperText}>
            W tym zestawie filtrów nic nie pasuje. Zmień miesiąc, kategorię albo
            wyczyść wyszukiwanie.
          </Text>
        </AppCard>
      ) : null}
    </View>
  );

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={historyState.transactions}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={null}
      ListFooterComponent={
        detail ? (
          <TransactionDetailCard
            confirmDelete={confirmDelete}
            detail={detail}
            editContext={editContext}
            editErrors={editErrors}
            editValues={editValues}
            isDeleting={isDeleting}
            isEditing={isEditing}
            isSaving={isSaving}
            onCancelEdit={() => {
              setIsEditing(false);
              setEditValues(editContext?.values ?? null);
              setEditErrors({});
              setConfirmDelete(false);
            }}
            onConfirmDelete={() => setConfirmDelete(true)}
            onDelete={handleDelete}
            onEditValueChange={(patch) => {
              setEditValues((current) => {
                if (!current || !editContext) {
                  return current;
                }

                const nextValues = { ...current, ...patch };

                if (patch.type && patch.type !== current.type) {
                  const availableCategories =
                    editContext.categoriesByType[patch.type];
                  const hasCategory = availableCategories.some(
                    (category) => category.id === nextValues.categoryId,
                  );

                  if (!hasCategory) {
                    nextValues.categoryId = '';
                  }
                }

                return nextValues;
              });
            }}
            onSave={handleSaveEdit}
            onStartEdit={() => {
              setIsEditing(true);
              setConfirmDelete(false);
              setEditErrors({});
            }}
          />
        ) : detailError ? (
          <AppCard>
            <Text style={styles.errorTitle}>Błąd szczegółu</Text>
            <Text style={styles.errorText}>{detailError}</Text>
          </AppCard>
        ) : null
      }
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <TransactionRow
          active={selectedTransactionId === item.id}
          item={item}
          onPress={() => {
            latestSelectedTransactionIdRef.current = item.id;
            setSelectedTransactionId(item.id);
            setIsEditing(false);
            setConfirmDelete(false);
          }}
        />
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

function TransactionRow({
  item,
  active,
  onPress,
}: {
  item: HistoryTransactionItem;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.rowCard, active ? styles.rowCardActive : null]}
    >
      <View style={styles.rowTop}>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>
            {item.description?.trim() ||
              item.categoryName ||
              'Transakcja bez opisu'}
          </Text>
          <Text style={styles.rowMeta}>
            {item.categoryName ?? 'Bez kategorii'} ·{' '}
            {item.occurredAt.slice(0, 10)} ·{' '}
            {getPaymentMethodLabel(item.paymentMethod)}
          </Text>
        </View>
        <Text
          style={[
            styles.rowAmount,
            item.type === 'income'
              ? styles.rowAmountPositive
              : styles.rowAmountNegative,
          ]}
        >
          {item.type === 'income' ? '+' : '-'}
          {formatMinorUnits(item.amountMinor, item.currencyCode)}
        </Text>
      </View>

      <View style={styles.badgeRow}>
        <Badge
          label={item.type === 'income' ? 'Przychód' : 'Wydatek'}
          tone={item.type === 'income' ? 'positive' : 'default'}
        />
        <Badge
          label={item.sourceMeta.shortLabel}
          tone={item.sourceMeta.isOcr ? 'positive' : 'muted'}
        />
      </View>
    </Pressable>
  );
}

function TransactionDetailCard({
  detail,
  editContext,
  editValues,
  editErrors,
  isEditing,
  isSaving,
  isDeleting,
  confirmDelete,
  onStartEdit,
  onCancelEdit,
  onEditValueChange,
  onSave,
  onConfirmDelete,
  onDelete,
}: {
  detail: HistoryTransactionDetail;
  editContext: HistoryEditContext | null;
  editValues: EditableTransactionValues | null;
  editErrors: Partial<Record<keyof EditableTransactionValues, string>>;
  isEditing: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  confirmDelete: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditValueChange: (patch: Partial<EditableTransactionValues>) => void;
  onSave: () => void;
  onConfirmDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <AppCard>
      <Text style={styles.sectionTitle}>Szczegóły transakcji</Text>
      <Text style={styles.detailTitle}>
        {detail.description?.trim() ||
          detail.categoryName ||
          'Transakcja bez opisu'}
      </Text>
      <Text style={styles.helperText}>
        {detail.type === 'income' ? 'Przychód' : 'Wydatek'} ·{' '}
        {detail.occurredAt.slice(0, 10)} ·{' '}
        {detail.categoryName ?? 'Bez kategorii'}
      </Text>

      {!isEditing ? (
        <>
          <View style={styles.detailGrid}>
            <DetailMetric
              label="Kwota"
              value={formatMinorUnits(detail.amountMinor, detail.currencyCode)}
            />
            <DetailMetric
              label="Metoda"
              value={getPaymentMethodLabel(detail.paymentMethod)}
            />
            <DetailMetric label="Źródło" value={detail.sourceMeta.label} />
            <DetailMetric
              label="Aktualizacja"
              value={detail.updatedAt.slice(0, 10)}
            />
          </View>

          {detail.note ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Notatka</Text>
              <Text style={styles.noteText}>{detail.note}</Text>
            </View>
          ) : null}

          <View style={styles.inlineActions}>
            <InlineButton label="Edytuj" onPress={onStartEdit} />
            <InlineButton
              label="Usuń"
              onPress={onConfirmDelete}
              tone="danger"
            />
          </View>

          {confirmDelete ? (
            <View style={styles.deleteBox}>
              <Text style={styles.deleteTitle}>Usunąć transakcję?</Text>
              <Text style={styles.helperText}>
                Rekord zniknie z historii, a budżety i dashboard przeliczą się
                na podstawie pozostałych danych.
              </Text>
              <View style={styles.inlineActions}>
                <InlineButton
                  label={isDeleting ? 'Usuwanie...' : 'Potwierdź'}
                  onPress={onDelete}
                  tone="danger"
                />
                <InlineButton
                  label="Anuluj"
                  onPress={onCancelEdit}
                  tone="muted"
                />
              </View>
            </View>
          ) : null}
        </>
      ) : editContext && editValues ? (
        <>
          <FieldLabel label="Typ" required />
          <View style={styles.chipGroup}>
            {editTypeOptions.map((option) => (
              <Chip
                key={option.value}
                active={editValues.type === option.value}
                label={option.label}
                onPress={() => onEditValueChange({ type: option.value })}
              />
            ))}
          </View>

          <FieldLabel label="Kwota" required />
          <AppInput
            keyboardType="decimal-pad"
            onChangeText={(value) => onEditValueChange({ amountText: value })}
            placeholder="Np. 34,90"
            value={editValues.amountText}
          />
          {editErrors.amountText ? (
            <Text style={styles.errorText}>{editErrors.amountText}</Text>
          ) : null}

          <FieldLabel label="Kategoria" required />
          <View style={styles.chipGroup}>
            {editContext.categoriesByType[editValues.type].map((category) => (
              <Chip
                key={category.id}
                active={editValues.categoryId === category.id}
                label={category.name}
                onPress={() => onEditValueChange({ categoryId: category.id })}
              />
            ))}
          </View>
          {editErrors.categoryId ? (
            <Text style={styles.errorText}>{editErrors.categoryId}</Text>
          ) : null}

          <FieldLabel label="Data" required />
          <AppInput
            onChangeText={(value) => onEditValueChange({ date: value })}
            placeholder="RRRR-MM-DD"
            value={editValues.date}
          />
          {editErrors.date ? (
            <Text style={styles.errorText}>{editErrors.date}</Text>
          ) : null}

          <FieldLabel label="Metoda płatności" />
          <View style={styles.chipGroup}>
            {paymentMethodOptions.map((option) => (
              <Chip
                key={option.value}
                active={editValues.paymentMethod === option.value}
                label={option.label}
                onPress={() =>
                  onEditValueChange({ paymentMethod: option.value })
                }
              />
            ))}
          </View>

          <FieldLabel label="Opis" />
          <AppInput
            onChangeText={(value) => onEditValueChange({ description: value })}
            placeholder="Np. Lidl albo przelew od klienta"
            value={editValues.description}
          />

          <FieldLabel label="Notatka" />
          <AppInput
            multiline
            onChangeText={(value) => onEditValueChange({ note: value })}
            placeholder="Opcjonalny kontekst do transakcji"
            value={editValues.note}
          />

          <View style={styles.inlineActions}>
            <InlineButton
              label={isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
              onPress={onSave}
            />
            <InlineButton label="Anuluj" onPress={onCancelEdit} tone="muted" />
          </View>
        </>
      ) : (
        <Text style={styles.helperText}>Przygotowuję formularz edycji...</Text>
      )}
    </AppCard>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function FieldLabel({
  label,
  required = false,
}: {
  label: string;
  required?: boolean;
}) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required ? ' *' : ''}
    </Text>
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
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function InlineButton({
  label,
  onPress,
  tone = 'default',
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'muted' | 'danger';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.inlineButton,
        tone === 'muted' ? styles.inlineButtonMuted : null,
        tone === 'danger' ? styles.inlineButtonDanger : null,
      ]}
    >
      <Text
        style={[
          styles.inlineButtonLabel,
          tone === 'muted' ? styles.inlineButtonLabelMuted : null,
          tone === 'danger' ? styles.inlineButtonLabelDanger : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: 'default' | 'positive' | 'muted';
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'positive' ? styles.badgePositive : null,
        tone === 'muted' ? styles.badgeMuted : null,
      ]}
    >
      <Text
        style={[
          styles.badgeLabel,
          tone === 'positive' ? styles.badgeLabelPositive : null,
          tone === 'muted' ? styles.badgeLabelMuted : null,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function getPaymentMethodLabel(
  value: EditableTransactionValues['paymentMethod'],
) {
  return (
    paymentMethodOptions.find((item) => item.value === value)?.label ?? 'Inne'
  );
}

function resolveSelectedTransactionId(
  items: HistoryTransactionItem[],
  preferredSelectionId?: string | null,
  currentSelectionId?: string | null,
) {
  if (
    preferredSelectionId &&
    items.some((item) => item.id === preferredSelectionId)
  ) {
    return preferredSelectionId;
  }

  if (
    currentSelectionId &&
    items.some((item) => item.id === currentSelectionId)
  ) {
    return currentSelectionId;
  }

  return items[0]?.id ?? null;
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  badgeLabelMuted: {
    color: colors.textMuted,
  },
  badgeLabelPositive: {
    color: colors.primary,
  },
  badgeMuted: {
    backgroundColor: colors.background,
  },
  badgePositive: {
    backgroundColor: colors.primarySoft,
  },
  badgeRow: {
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
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  chipLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: colors.surface,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  deleteBox: {
    backgroundColor: '#FFF2EF',
    borderColor: '#F0C7C2',
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  deleteTitle: {
    color: colors.danger,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  fieldLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  headerContent: {
    gap: spacing.lg,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  hero: {
    gap: spacing.md,
  },
  heroCopy: {
    gap: spacing.sm,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inlineButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  inlineButtonDanger: {
    backgroundColor: '#FFF2EF',
  },
  inlineButtonLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  inlineButtonLabelDanger: {
    color: colors.danger,
  },
  inlineButtonLabelMuted: {
    color: colors.textMuted,
  },
  inlineButtonMuted: {
    backgroundColor: colors.surfaceMuted,
  },
  loadingState: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    textAlign: 'center',
  },
  metricCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 132,
    padding: spacing.md,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  metricValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  noteBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noteLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  noteText: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 22,
  },
  rowAmount: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  rowAmountNegative: {
    color: colors.text,
  },
  rowAmountPositive: {
    color: colors.primary,
  },
  rowCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  rowCardActive: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  rowTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  rowTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
});
