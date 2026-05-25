import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { TransactionType } from '@/src/domain/finance';
import {
  createFormValuesForType,
  loadTransactionFormContext,
  saveTransaction,
  validateTransactionForm,
  type RecentTransactionTemplate,
  type TransactionFormContext,
  type TransactionFormValues,
  type TransactionSaveImpact,
} from '@/src/features/transactions/data/addTransaction';
import {
  buildFormValuesFromCorrectionDraft,
  getConfidenceLabel,
  getCorrectionStatusLabel,
  importTransactionFromImage,
  updateCorrectionField,
  type OcrCorrectionDraft,
  type OcrCorrectionField,
  type OcrImportMode,
  type OcrImportResult,
} from '@/src/features/transactions/data/ocrImport';
import { useAppServices } from '@/src/providers/AppServicesProvider';
import { colors, radius, spacing, typography } from '@/src/shared/theme';
import { AppButton, AppCard, AppInput } from '@/src/shared/ui';
import { getCurrentMonthKey } from '@/src/shared/utils/date';

const paymentMethodOptions: {
  value: TransactionFormValues['paymentMethod'];
  label: string;
}[] = [
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

type EntryMode = 'manual' | 'ocr';

export function AddTransactionScreen() {
  const { repositories, status } = useAppServices();

  const [context, setContext] = useState<TransactionFormContext | null>(null);
  const [form, setForm] = useState<TransactionFormValues | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<keyof TransactionFormValues, string>>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState<OcrImportMode | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [impact, setImpact] = useState<TransactionSaveImpact | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrImportResult | null>(null);
  const [ocrCorrectionDraft, setOcrCorrectionDraft] =
    useState<OcrCorrectionDraft | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>('manual');
  const [showRawOcrText, setShowRawOcrText] = useState(false);

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
          setSubmitError(
            error instanceof Error
              ? error.message
              : 'Nie udało się przygotować formularza.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repositories, status]);

  useEffect(() => {
    if (!impact) {
      return;
    }

    const timeout = setTimeout(() => {
      setImpact(null);
    }, 1800);

    return () => {
      clearTimeout(timeout);
    };
  }, [impact]);

  if (!context || !form) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>
          Przygotowuję formularz transakcji...
        </Text>
      </View>
    );
  }

  const selectedCategories = context.categoriesByType[form.type];
  const recentTemplates = context.recentTemplatesByType[form.type];
  const actionLabel =
    form.type === 'income' ? 'Dodaj przychód' : 'Dodaj wydatek';
  const saveLabel =
    form.type === 'income' ? 'Zapisz przychód' : 'Zapisz wydatek';
  const ocrAttentionFields = ocrCorrectionDraft
    ? Object.values(ocrCorrectionDraft.fields).filter(
        (field) => field.needsAttention,
      )
    : [];
  const saveFeedback = impact ? 'Dodano' : null;

  const handleSave = async () => {
    const validation = validateTransactionForm(form);
    setErrors(validation.errors);
    setSubmitError(null);

    if (Object.keys(validation.errors).length > 0) {
      return;
    }

    Keyboard.dismiss();
    setIsSaving(true);

    try {
      const result = await saveTransaction(
        repositories,
        form,
        context.currencyCode,
        ocrResult?.sourceDraft
          ? {
              ...ocrResult.sourceDraft,
              ocrStatus: 'reviewed',
            }
          : undefined,
      );
      const refreshed = await loadTransactionFormContext(
        repositories,
        getCurrentMonthKey(),
      );

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
      setOcrResult(null);
      setOcrCorrectionDraft(null);
      setShowRawOcrText(false);
      setEntryMode('manual');
      setShowDetails(false);
    } catch (error: unknown) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Nie udało się zapisać transakcji.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async (mode: OcrImportMode) => {
    setIsImporting(mode);
    setSubmitError(null);
    setImpact(null);

    try {
      const result = await importTransactionFromImage(repositories, mode);
      setOcrResult(result);
      setOcrCorrectionDraft(result.correctionDraft);
      setEntryMode('ocr');
      setShowDetails(true);
      setShowRawOcrText(false);
      setForm((current) =>
        current
          ? buildFormValuesFromCorrectionDraft(
              result.correctionDraft,
              applyPrefillToForm(current, result.prefilledValues, context),
            )
          : current,
      );
    } catch (error: unknown) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Nie udało się przygotować OCR dla obrazu.',
      );
    } finally {
      setIsImporting(null);
    }
  };

  const applyRecentTemplate = (template: RecentTransactionTemplate) => {
    setImpact(null);
    setSubmitError(null);
    setShowDetails(Boolean(template.description));
    setForm((current) =>
      current
        ? {
            ...current,
            amountText: template.amountText,
            categoryId: template.categoryId,
            description: template.description,
            paymentMethod: template.paymentMethod,
            type: template.type,
          }
        : current,
    );
  };

  const updateDraftField = (
    key: 'amountText' | 'date' | 'merchantName' | 'categoryId',
    value: string,
  ) => {
    if (!ocrCorrectionDraft) {
      return;
    }

    const nextDraft = updateCorrectionField(ocrCorrectionDraft, key, value);
    setOcrCorrectionDraft(nextDraft);
    setForm((current) =>
      current
        ? buildFormValuesFromCorrectionDraft(nextDraft, current)
        : current,
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        style={styles.screen}
      >
        <View style={styles.hero}>
          <Text style={styles.title}>Dodaj transakcję</Text>
          <Text style={styles.description}>
            Szybki wpis ręczny jest domyślny. OCR uruchamiasz tylko wtedy, gdy
            dodajesz z obrazu.
          </Text>
        </View>

        {submitError ? (
          <AppCard>
            <Text style={styles.errorText}>{submitError}</Text>
          </AppCard>
        ) : null}

        <AppCard>
          <Text style={styles.sectionTitle}>Tryb dodawania</Text>
          <View style={styles.chipGroup}>
            <Chip
              active={entryMode === 'manual'}
              label="Szybki wpis ręczny"
              onPress={() => setEntryMode('manual')}
            />
            <Chip
              active={entryMode === 'ocr'}
              label="OCR z obrazu"
              onPress={() => setEntryMode('ocr')}
            />
          </View>
          <Text style={styles.helperText}>
            {entryMode === 'manual'
              ? 'Najpierw szybki wpis. OCR jest obok, gdy naprawdę go potrzebujesz.'
              : 'Po imporcie od razu poprawiasz pola i zapisujesz transakcję.'}
          </Text>
        </AppCard>

        {entryMode === 'ocr' ? (
          <AppCard>
            <Text style={styles.sectionTitle}>Import z obrazu</Text>
            <View style={styles.importActions}>
              <AppButton
                disabled={isImporting !== null}
                label={
                  isImporting === 'receipt_photo'
                    ? 'Otwieram aparat...'
                    : 'Zrób zdjęcie paragonu'
                }
                onPress={() => {
                  void handleImport('receipt_photo');
                }}
              />
              <AppButton
                disabled={isImporting !== null}
                label={
                  isImporting === 'receipt_gallery'
                    ? 'Otwieram galerię...'
                    : 'Wybierz paragon z galerii'
                }
                onPress={() => {
                  void handleImport('receipt_gallery');
                }}
              />
              <AppButton
                disabled={isImporting !== null}
                label={
                  isImporting === 'payment_screenshot'
                    ? 'Otwieram galerię...'
                    : 'Wybierz screen płatności'
                }
                onPress={() => {
                  void handleImport('payment_screenshot');
                }}
              />
            </View>
            <Text style={styles.footnoteText}>
              OCR działa w buildzie natywnym. Na webie zostaje ręczne
              uzupełnienie formularza.
            </Text>
          </AppCard>
        ) : null}

        {ocrResult && ocrCorrectionDraft ? (
          <AppCard>
            <Text style={styles.sectionTitle}>Korekta OCR</Text>
            <Image
              source={{ uri: ocrResult.attachment.fileUri }}
              style={styles.previewImage}
            />
            <Text style={styles.helperText}>{ocrResult.message}</Text>
            {ocrAttentionFields.length > 0 ? (
              <Text style={styles.attentionText}>
                Sprawdź najpierw {ocrAttentionFields.length}{' '}
                {ocrAttentionFields.length === 1 ? 'pole' : 'pola'} z
                oznaczeniem uwagi.
              </Text>
            ) : (
              <Text style={styles.helperText}>
                Najważniejsze pola wyglądają pewnie. Wystarczy szybki przegląd i
                zapis.
              </Text>
            )}
            <View style={styles.badgeRow}>
              <StatusBadge
                label={
                  ocrResult.attachment.sourceType === 'receipt_ocr'
                    ? 'Paragon'
                    : 'Screen płatności'
                }
              />
              <StatusBadge
                label={getCorrectionStatusLabel(ocrCorrectionDraft)}
                tone={ocrCorrectionDraft.requiresReview ? 'muted' : 'positive'}
              />
            </View>

            <View style={styles.reviewFieldList}>
              <ReviewFieldCard
                field={ocrCorrectionDraft.fields.amountText}
                keyboardType="decimal-pad"
                onChangeText={(value) => updateDraftField('amountText', value)}
              />
              <ReviewFieldCard
                field={ocrCorrectionDraft.fields.date}
                onChangeText={(value) => updateDraftField('date', value)}
              />
              <ReviewFieldCard
                field={ocrCorrectionDraft.fields.merchantName}
                onChangeText={(value) =>
                  updateDraftField('merchantName', value)
                }
              />
              <View
                style={[
                  styles.reviewFieldCard,
                  ocrCorrectionDraft.fields.categoryId.needsAttention
                    ? styles.reviewFieldCardAttention
                    : null,
                ]}
              >
                <View style={styles.reviewFieldHeader}>
                  <Text style={styles.reviewFieldLabel}>
                    {ocrCorrectionDraft.fields.categoryId.label}
                  </Text>
                  <StatusBadge
                    label={getConfidenceLabel(
                      ocrCorrectionDraft.fields.categoryId.confidence,
                    )}
                    tone={
                      ocrCorrectionDraft.fields.categoryId.needsAttention
                        ? 'muted'
                        : 'positive'
                    }
                  />
                </View>
                <Text style={styles.reviewFieldHelper}>
                  {ocrCorrectionDraft.fields.categoryId.helperText}
                </Text>
                <View style={styles.chipGroup}>
                  {selectedCategories.map((category) => (
                    <Chip
                      key={category.id}
                      active={form.categoryId === category.id}
                      label={category.name}
                      onPress={() =>
                        updateDraftField('categoryId', category.id)
                      }
                    />
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.summaryList}>
              {ocrResult.parsedSummary.map((item) => (
                <Text key={item} style={styles.summaryItem}>
                  {item}
                </Text>
              ))}
            </View>

            {ocrCorrectionDraft.rawText ? (
              <View style={styles.rawTextSection}>
                <Pressable
                  onPress={() => setShowRawOcrText((value) => !value)}
                  style={styles.detailsToggle}
                >
                  <Text style={styles.detailsToggleText}>
                    {showRawOcrText
                      ? 'Ukryj surowy tekst OCR'
                      : 'Pokaż surowy tekst OCR'}
                  </Text>
                </Pressable>
                {showRawOcrText ? (
                  <View style={styles.rawTextBox}>
                    <Text style={styles.rawTextTitle}>Surowy tekst OCR</Text>
                    <Text style={styles.rawTextValue}>
                      {ocrCorrectionDraft.rawText}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.inlineActions}>
              <Pressable
                onPress={() => {
                  setOcrResult(null);
                  setOcrCorrectionDraft(null);
                  setShowRawOcrText(false);
                  setEntryMode('manual');
                }}
                style={[styles.secondaryButton, styles.secondaryButtonMuted]}
              >
                <Text style={styles.secondaryButtonLabelMuted}>
                  Porzuć korektę OCR
                </Text>
              </Pressable>
            </View>
          </AppCard>
        ) : null}

        <AppCard>
          <Text style={styles.sectionTitle}>{actionLabel}</Text>
          {ocrCorrectionDraft ? (
            <Text style={styles.helperText}>
              Popraw pola i zapisz. Dane trafią do tego samego miejsca co wpis
              ręczny.
            </Text>
          ) : (
            <Text style={styles.helperText}>
              Najczęstszy flow to kwota, kategoria i zapis. Reszta jest schowana
              w szczegółach.
            </Text>
          )}

          {!ocrCorrectionDraft && recentTemplates.length > 0 ? (
            <View style={styles.quickRepeatSection}>
              <FieldLabel label="Szybkie powtórki" />
              <Text style={styles.helperText}>
                Jednym tapnięciem podstawisz ostatni podobny wpis.
              </Text>
              <View style={styles.chipGroup}>
                {recentTemplates.map((template) => (
                  <Chip
                    key={template.transactionId}
                    active={
                      form.categoryId === template.categoryId &&
                      form.amountText === template.amountText &&
                      form.paymentMethod === template.paymentMethod &&
                      form.description === template.description
                    }
                    label={`${template.label} • ${template.amountText}`}
                    onPress={() => applyRecentTemplate(template)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <FieldLabel label="Typ transakcji" required />
          <View style={styles.chipGroup}>
            {transactionTypeOptions.map((option) => (
              <Chip
                key={option.value}
                active={form.type === option.value}
                label={option.label}
                onPress={() =>
                  setForm((current) =>
                    current && context
                      ? createFormValuesForType(current, option.value, context)
                      : current,
                  )
                }
              />
            ))}
          </View>

          <FieldLabel label="Kwota" required />
          <AppInput
            keyboardType="decimal-pad"
            onChangeText={(value) => {
              setForm((current) =>
                current ? { ...current, amountText: value } : current,
              );
              if (ocrCorrectionDraft) {
                updateDraftField('amountText', value);
              }
            }}
            placeholder="Np. 34,90"
            value={form.amountText}
          />
          {errors.amountText ? (
            <Text style={styles.errorText}>{errors.amountText}</Text>
          ) : null}

          <FieldLabel label="Kategoria" required />
          <View style={styles.chipGroup}>
            {selectedCategories.map((category) => (
              <Chip
                key={category.id}
                active={form.categoryId === category.id}
                label={category.name}
                onPress={() => {
                  setForm((current) =>
                    current ? { ...current, categoryId: category.id } : current,
                  );
                  if (ocrCorrectionDraft) {
                    updateDraftField('categoryId', category.id);
                  }
                }}
              />
            ))}
          </View>
          {errors.categoryId ? (
            <Text style={styles.errorText}>{errors.categoryId}</Text>
          ) : null}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>Data: {form.date}</Text>
            <Text style={styles.summaryText}>
              Typ: {form.type === 'income' ? 'Przychód' : 'Wydatek'}
            </Text>
            <Text style={styles.summaryText}>
              Metoda:{' '}
              {
                paymentMethodOptions.find(
                  (item) => item.value === form.paymentMethod,
                )?.label
              }
            </Text>
          </View>

          <Pressable
            onPress={() => setShowDetails((value) => !value)}
            style={styles.detailsToggle}
          >
            <Text style={styles.detailsToggleText}>
              {showDetails ? 'Ukryj szczegóły' : 'Pokaż szczegóły'}
            </Text>
          </Pressable>

          {showDetails ? (
            <View style={styles.detailsSection}>
              <FieldLabel label="Data" required />
              <AppInput
                onChangeText={(value) => {
                  setForm((current) =>
                    current ? { ...current, date: value } : current,
                  );
                  if (ocrCorrectionDraft) {
                    updateDraftField('date', value);
                  }
                }}
                placeholder="RRRR-MM-DD"
                value={form.date}
              />
              {errors.date ? (
                <Text style={styles.errorText}>{errors.date}</Text>
              ) : null}

              <FieldLabel label="Metoda płatności" />
              <View style={styles.chipGroup}>
                {paymentMethodOptions.map((option) => (
                  <Chip
                    key={option.value}
                    active={form.paymentMethod === option.value}
                    label={option.label}
                    onPress={() =>
                      setForm((current) =>
                        current
                          ? { ...current, paymentMethod: option.value }
                          : current,
                      )
                    }
                  />
                ))}
              </View>

              <FieldLabel label="Sklep / opis" />
              <AppInput
                multiline
                onChangeText={(value) => {
                  setForm((current) =>
                    current ? { ...current, description: value } : current,
                  );
                  if (ocrCorrectionDraft) {
                    updateDraftField('merchantName', value);
                  }
                }}
                placeholder="Np. Lidl albo kawa po spotkaniu"
                value={form.description}
              />
            </View>
          ) : null}

          <AppButton
            disabled={isSaving || isImporting !== null}
            label={isSaving ? 'Zapisywanie...' : saveLabel}
            onPress={handleSave}
          />
          {saveFeedback ? (
            <Text style={styles.successText}>{saveFeedback}</Text>
          ) : null}
          {ocrResult ? (
            <Text style={styles.footnoteText}>
              Po zapisie zachowasz też załącznik i wynik OCR.
            </Text>
          ) : null}
        </AppCard>

        {isImporting ? (
          <View style={styles.importOverlay}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.helperText}>
              Przetwarzam obraz i przygotowuję dane do korekty...
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function applyPrefillToForm(
  current: TransactionFormValues,
  prefilledValues: Partial<TransactionFormValues>,
  context: TransactionFormContext,
) {
  let next = current;

  if (prefilledValues.type && prefilledValues.type !== current.type) {
    next = createFormValuesForType(current, prefilledValues.type, context);
  }

  const merged: TransactionFormValues = {
    ...next,
    ...prefilledValues,
    type: prefilledValues.type ?? next.type,
  };
  const categories = context.categoriesByType[merged.type];

  if (!categories.some((category) => category.id === merged.categoryId)) {
    merged.categoryId = '';
  }

  return merged;
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

function ReviewFieldCard({
  field,
  onChangeText,
  keyboardType,
}: {
  field: OcrCorrectionField;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <View
      style={[
        styles.reviewFieldCard,
        field.needsAttention ? styles.reviewFieldCardAttention : null,
      ]}
    >
      <View style={styles.reviewFieldHeader}>
        <Text style={styles.reviewFieldLabel}>{field.label}</Text>
        <StatusBadge
          label={getConfidenceLabel(field.confidence)}
          tone={field.needsAttention ? 'muted' : 'positive'}
        />
      </View>
      <AppInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        value={field.value}
      />
      <Text style={styles.reviewFieldHelper}>{field.helperText}</Text>
    </View>
  );
}

function StatusBadge({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'positive' | 'muted';
}) {
  return (
    <View
      style={[
        styles.statusBadge,
        tone === 'positive' ? styles.statusBadgePositive : null,
        tone === 'muted' ? styles.statusBadgeMuted : null,
      ]}
    >
      <Text
        style={[
          styles.statusBadgeLabel,
          tone === 'positive' ? styles.statusBadgeLabelPositive : null,
          tone === 'muted' ? styles.statusBadgeLabelMuted : null,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  description: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  detailsSection: {
    gap: spacing.sm,
  },
  detailsToggle: {
    alignSelf: 'flex-start',
  },
  detailsToggleText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  attentionText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  footnoteText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  hero: {
    gap: spacing.sm,
  },
  importActions: {
    gap: spacing.sm,
  },
  importOverlay: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  previewImage: {
    borderRadius: radius.md,
    height: 180,
    resizeMode: 'cover',
    width: '100%',
  },
  quickRepeatSection: {
    gap: spacing.sm,
  },
  rawTextBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  rawTextSection: {
    gap: spacing.sm,
  },
  rawTextTitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  rawTextValue: {
    color: colors.text,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  reviewFieldCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  reviewFieldCardAttention: {
    backgroundColor: '#FFF7ED',
    borderColor: '#D97706',
  },
  reviewFieldHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  reviewFieldHelper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  reviewFieldLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  reviewFieldList: {
    gap: spacing.sm,
  },
  screen: {
    backgroundColor: colors.background,
  },
  secondaryButton: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryButtonLabelMuted: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  secondaryButtonMuted: {
    backgroundColor: colors.surfaceMuted,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusBadgeLabel: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  statusBadgeLabelMuted: {
    color: colors.textMuted,
  },
  statusBadgeLabelPositive: {
    color: colors.primary,
  },
  statusBadgeMuted: {
    backgroundColor: colors.background,
  },
  statusBadgePositive: {
    backgroundColor: colors.primarySoft,
  },
  successText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  summaryItem: {
    color: colors.text,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  summaryList: {
    gap: spacing.xs,
  },
  summaryRow: {
    gap: spacing.xs,
  },
  summaryText: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
});
