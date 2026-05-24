import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Platform } from 'react-native';

const { Directory, File, Paths } = FileSystem;

import type { Attachment, PaymentMethod, TransactionType } from '@/src/domain/finance';
import type { TransactionFormValues, TransactionSourceDraft } from '@/src/features/transactions/data/addTransaction';
import type { AppRepositories } from '@/src/storage';
import { getTodayDateInput } from '@/src/shared/utils/date';
import { formatMinorUnitsInput } from '@/src/shared/utils/money';
import { createEntityId } from '@/src/shared/utils/id';

export type OcrImportMode = 'receipt_photo' | 'payment_screenshot';

export type OcrImportResult = {
  attachment: Attachment;
  canRetryManually: boolean;
  correctionDraft: OcrCorrectionDraft;
  message: string;
  parsedSummary: string[];
  prefilledValues: Partial<TransactionFormValues>;
  sourceDraft: TransactionSourceDraft;
};

export type OcrFieldConfidence = 'high' | 'medium' | 'low' | 'missing';

export type OcrCorrectionFieldKey = 'amountText' | 'date' | 'merchantName' | 'categoryId';

export type OcrCorrectionField = {
  confidence: OcrFieldConfidence;
  helperText: string;
  label: string;
  needsAttention: boolean;
  value: string;
};

export type OcrCorrectionDraft = {
  fields: Record<OcrCorrectionFieldKey, OcrCorrectionField>;
  mode: OcrImportMode;
  paymentMethod: PaymentMethod;
  rawText: string;
  requiresReview: boolean;
  transactionType: TransactionType;
};

type ParsedOcrData = {
  amountMinor: number | null;
  amountConfidence: OcrFieldConfidence;
  categoryConfidence: OcrFieldConfidence;
  categoryId: string | null;
  categoryHelperText: string;
  date: string | null;
  dateConfidence: OcrFieldConfidence;
  merchantConfidence: OcrFieldConfidence;
  merchantName: string | null;
  paymentMethod: PaymentMethod | null;
  rawText: string;
  status: Attachment['ocrStatus'];
  summary: string[];
  transactionType: TransactionType;
};

const RECEIPT_KEYWORDS: [string, string][] = [
  ['biedronka', 'category_groceries'],
  ['lidl', 'category_groceries'],
  ['zabka', 'category_groceries'],
  ['carrefour', 'category_groceries'],
  ['auchan', 'category_groceries'],
  ['apteka', 'category_health'],
  ['uber', 'category_transport'],
  ['bolt', 'category_transport'],
  ['orlen', 'category_transport'],
  ['shell', 'category_transport'],
  ['cinema', 'category_entertainment'],
  ['multikino', 'category_entertainment'],
  ['netflix', 'category_entertainment'],
  ['czynsz', 'category_housing'],
  ['ikea', 'category_housing'],
];

const SCREENSHOT_METHOD_KEYWORDS: [string, PaymentMethod][] = [
  ['blik', 'blik'],
  ['google pay', 'card'],
  ['apple pay', 'card'],
  ['karta', 'card'],
  ['visa', 'card'],
  ['mastercard', 'card'],
  ['przelew', 'bank_transfer'],
];

export async function importTransactionFromImage(
  repositories: AppRepositories,
  mode: OcrImportMode,
): Promise<OcrImportResult> {
  const asset = await pickImageAsset(mode);
  const storedAsset = await storeAttachmentAsset(asset, mode);
  const parsed = await runOcrAndParse(storedAsset.file.uri, mode);
  const prefilledValues = buildPrefilledValues(parsed, mode);
  const attachment = await repositories.attachments.create({
    fileName: storedAsset.file.name,
    fileSizeBytes: storedAsset.file.size,
    fileUri: storedAsset.file.uri,
    kind: mode === 'receipt_photo' ? 'receipt_photo' : 'screenshot',
    mimeType: storedAsset.mimeType,
    ocrConfidence: parsed.status === 'processed' ? 0.45 : null,
    ocrRawText: parsed.rawText || null,
    ocrStatus: parsed.status,
    sourceReference: asset.assetId ?? asset.fileName ?? storedAsset.file.name,
    sourceType: mode === 'receipt_photo' ? 'receipt_ocr' : 'screenshot_ocr',
  });

  return {
    attachment,
    canRetryManually: true,
    correctionDraft: buildCorrectionDraft(parsed, mode),
    message:
      parsed.status === 'processed'
        ? 'OCR przygotował dane do korekty. Najpierw przejdź przez wyróżnione pola i zapisz transakcję dopiero po sprawdzeniu.'
        : 'OCR nie odczytał wystarczająco dużo danych. Załącznik jest zapisany, a formularz pozostaje do ręcznego uzupełnienia.',
    parsedSummary: parsed.summary,
    prefilledValues,
    sourceDraft: {
      attachmentId: attachment.id,
      ocrAttachmentSource: attachment.id,
      ocrConfidence: attachment.ocrConfidence,
      ocrRawText: attachment.ocrRawText,
      ocrStatus: attachment.ocrStatus,
      sourceReference: attachment.id,
      sourceType: attachment.sourceType,
    },
  };
}

async function pickImageAsset(mode: OcrImportMode) {
  if (mode === 'receipt_photo') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      throw new Error('Brak zgody na aparat. Bez niej nie da się zrobić zdjęcia paragonu.');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) {
      throw new Error('Dodawanie zdjęcia paragonu zostało anulowane.');
    }

    return result.assets[0];
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Brak zgody na galerię. Bez niej nie da się wybrać screena płatności.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    mediaTypes: ['images'],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) {
    throw new Error('Wybór screena płatności został anulowany.');
  }

  return result.assets[0];
}

async function storeAttachmentAsset(
  asset: ImagePicker.ImagePickerAsset,
  mode: OcrImportMode,
) {
  const attachmentsDirectory = new Directory(Paths.document, 'attachments');
  await attachmentsDirectory.create({ idempotent: true, intermediates: true });

  const extension = extractExtension(asset);
  const filename = `${mode}_${createEntityId('capture')}.${extension}`;
  const targetFile = new File(attachmentsDirectory, filename);
  await targetFile.create({ intermediates: true, overwrite: true });

  // Use the stable Legacy API for copying, as it handles all URI types (file://, content://) correctly
  await FileSystem.copyAsync({
    from: asset.uri,
    to: targetFile.uri,
  });

  return {
    file: targetFile,
    mimeType: asset.mimeType ?? inferMimeType(extension),
  };
}

async function runOcrAndParse(fileUri: string, mode: OcrImportMode): Promise<ParsedOcrData> {
  if (Platform.OS === 'web') {
    return {
      amountMinor: null,
      amountConfidence: 'missing',
      categoryConfidence: 'missing',
      categoryHelperText: 'Na webie nie ma jeszcze natywnego OCR on-device w tym slice.',
      categoryId: null,
      date: null,
      dateConfidence: 'missing',
      merchantConfidence: 'missing',
      merchantName: null,
      paymentMethod: null,
      rawText: '',
      status: 'failed',
      summary: ['Web nie ma jeszcze natywnego OCR on-device w tym slice.'],
      transactionType: 'expense',
    };
  }

  try {
    const result = await TextRecognition.recognize(fileUri);
    const rawText = normalizeText(result.text);

    if (!rawText) {
      return {
        amountMinor: null,
        amountConfidence: 'missing',
        categoryConfidence: 'missing',
        categoryHelperText: 'OCR nie znalazł wystarczającego kontekstu do sugestii kategorii.',
        categoryId: null,
        date: null,
        dateConfidence: 'missing',
        merchantConfidence: 'missing',
        merchantName: null,
        paymentMethod: null,
        rawText: '',
        status: 'failed',
        summary: ['OCR nie odczytał tekstu z obrazu.'],
        transactionType: 'expense',
      };
    }

    return mode === 'receipt_photo' ? parseReceiptText(rawText) : parseScreenshotText(rawText);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd OCR.';
    const likelyMissingNativeModule =
      message.includes("doesn't seem to be linked") || message.includes('Expo managed workflow');

    return {
      amountMinor: null,
      amountConfidence: 'missing',
      categoryConfidence: 'missing',
      categoryHelperText: 'Moduł OCR nie był dostępny albo zwrócił błąd.',
      categoryId: null,
      date: null,
      dateConfidence: 'missing',
      merchantConfidence: 'missing',
      merchantName: null,
      paymentMethod: null,
      rawText: '',
      status: 'failed',
      summary: [
        likelyMissingNativeModule
          ? 'OCR wymaga development builda z natywnym modułem ML Kit.'
          : `OCR nie powiódł się: ${message}`,
      ],
      transactionType: 'expense',
    };
  }
}

function parseReceiptText(rawText: string): ParsedOcrData {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const merchantName = extractReceiptMerchant(lines);
  const amountMinor = extractReceiptAmount(lines);
  const date = extractDate(rawText);
  const categorySuggestion = suggestCategoryId(rawText, 'expense');

  return {
    amountMinor,
    amountConfidence: amountMinor !== null ? 'medium' : 'missing',
    categoryConfidence: categorySuggestion === 'category_other_expense' ? 'low' : 'medium',
    categoryHelperText:
      categorySuggestion === 'category_other_expense'
        ? 'OCR nie rozpoznał sklepu wystarczająco dobrze, więc podał kategorię ogólną.'
        : 'Kategoria została zasugerowana na podstawie nazwy sklepu lub słów kluczowych.',
    categoryId: categorySuggestion,
    date,
    dateConfidence: date ? 'medium' : 'missing',
    merchantConfidence: merchantName ? 'medium' : 'missing',
    merchantName,
    paymentMethod: detectPaymentMethod(rawText) ?? 'card',
    rawText,
    status: amountMinor || date || merchantName ? 'processed' : 'failed',
    summary: compactSummary(merchantName, amountMinor, date, 'paragon'),
    transactionType: 'expense',
  };
}

function parseScreenshotText(rawText: string): ParsedOcrData {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const amountMinor = extractScreenshotAmount(lines);
  const date = extractDate(rawText);
  const merchantName = extractScreenshotDescription(lines);
  const transactionType = detectScreenshotTransactionType(rawText);
  const categorySuggestion = suggestCategoryId(rawText, transactionType);

  return {
    amountMinor,
    amountConfidence: amountMinor !== null ? 'medium' : 'missing',
    categoryConfidence:
      transactionType === 'income'
        ? categorySuggestion === 'category_salary'
          ? 'medium'
          : 'low'
        : categorySuggestion === 'category_other_expense'
          ? 'low'
          : 'medium',
    categoryHelperText:
      transactionType === 'income'
        ? 'Kategoria przychodu została wybrana na podstawie słów wskazujących wpływ.'
        : categorySuggestion === 'category_other_expense'
          ? 'OCR nie znalazł mocnego sygnału dla kategorii, więc podał wariant bezpieczny.'
          : 'Kategoria została zasugerowana na podstawie treści płatności.',
    categoryId: categorySuggestion,
    date,
    dateConfidence: date ? 'medium' : 'missing',
    merchantConfidence: merchantName ? 'medium' : 'missing',
    merchantName,
    paymentMethod: detectPaymentMethod(rawText),
    rawText,
    status: amountMinor || date || merchantName ? 'processed' : 'failed',
    summary: compactSummary(merchantName, amountMinor, date, 'screen'),
    transactionType,
  };
}

function buildPrefilledValues(
  parsed: ParsedOcrData,
  mode: OcrImportMode,
): Partial<TransactionFormValues> {
  const type = parsed.transactionType;
  const categoryId = parsed.categoryId;

  return {
    amountText: formatMinorUnitsInput(parsed.amountMinor),
    categoryId: categoryId ?? '',
    date: parsed.date ?? getTodayDateInput(),
    description: parsed.merchantName ?? (mode === 'receipt_photo' ? 'Paragon do korekty' : 'Płatność do korekty'),
    paymentMethod:
      parsed.paymentMethod ?? (mode === 'receipt_photo' ? 'card' : parsed.transactionType === 'income' ? 'bank_transfer' : 'card'),
    type,
  };
}

function buildCorrectionDraft(parsed: ParsedOcrData, mode: OcrImportMode): OcrCorrectionDraft {
  const fields: OcrCorrectionDraft['fields'] = {
    amountText: createCorrectionField(
      'Kwota',
      formatMinorUnitsInput(parsed.amountMinor),
      parsed.amountConfidence,
      parsed.amountMinor !== null
        ? 'Kwota została odczytana z najbardziej prawdopodobnego pola sumy.'
        : 'OCR nie znalazł pewnej kwoty. To pole wymaga ręcznego uzupełnienia.',
    ),
    categoryId: createCorrectionField(
      'Kategoria',
      parsed.categoryId ?? '',
      parsed.categoryConfidence,
      parsed.categoryHelperText,
    ),
    date: createCorrectionField(
      'Data',
      parsed.date ?? getTodayDateInput(),
      parsed.dateConfidence,
      parsed.date
        ? 'Data została odczytana z obrazu.'
        : 'OCR nie rozpoznał daty jednoznacznie. Sprawdź ją przed zapisem.',
    ),
    merchantName: createCorrectionField(
      mode === 'receipt_photo' ? 'Sklep' : 'Nadawca / sklep',
      parsed.merchantName ?? '',
      parsed.merchantConfidence,
      parsed.merchantName
        ? 'Nazwa sklepu lub kontrahenta została zasugerowana z pierwszych linii tekstu.'
        : 'OCR nie rozpoznał wiarygodnej nazwy sklepu lub kontrahenta.',
    ),
  };

  return {
    fields,
    mode,
    paymentMethod:
      parsed.paymentMethod ?? (parsed.transactionType === 'income' ? 'bank_transfer' : 'card'),
    rawText: parsed.rawText,
    requiresReview: Object.values(fields).some((field) => field.needsAttention),
    transactionType: parsed.transactionType,
  };
}

function createCorrectionField(
  label: string,
  value: string,
  confidence: OcrFieldConfidence,
  helperText: string,
): OcrCorrectionField {
  return {
    confidence,
    helperText,
    label,
    needsAttention: confidence === 'low' || confidence === 'missing',
    value,
  };
}

export function updateCorrectionField(
  draft: OcrCorrectionDraft,
  key: OcrCorrectionFieldKey,
  value: string,
): OcrCorrectionDraft {
  const field = draft.fields[key];
  const nextConfidence: OcrFieldConfidence = value.trim() ? 'high' : 'missing';
  const nextField: OcrCorrectionField = {
    ...field,
    confidence: nextConfidence,
    helperText:
      nextConfidence === 'high'
        ? 'Pole zostało potwierdzone lub poprawione ręcznie.'
        : `${field.label} nadal wymaga uzupełnienia.`,
    needsAttention: nextConfidence === 'missing',
    value,
  };

  const nextFields = {
    ...draft.fields,
    [key]: nextField,
  };

  return {
    ...draft,
    fields: nextFields,
    requiresReview: Object.values(nextFields).some((item) => item.needsAttention),
  };
}

export function buildFormValuesFromCorrectionDraft(
  draft: OcrCorrectionDraft,
  currentValues: TransactionFormValues,
): TransactionFormValues {
  return {
    ...currentValues,
    amountText: draft.fields.amountText.value,
    categoryId: draft.fields.categoryId.value,
    date: draft.fields.date.value,
    description: draft.fields.merchantName.value,
    paymentMethod: draft.paymentMethod,
    type: draft.transactionType,
  };
}

export function getCorrectionStatusLabel(draft: OcrCorrectionDraft) {
  return draft.requiresReview ? 'Do poprawy' : 'Gotowe do zapisu';
}

export function getConfidenceLabel(confidence: OcrFieldConfidence) {
  if (confidence === 'high') {
    return 'Potwierdzone';
  }

  if (confidence === 'medium') {
    return 'Do sprawdzenia';
  }

  if (confidence === 'low') {
    return 'Niska pewność';
  }

  return 'Brak odczytu';
}

function extractReceiptAmount(lines: string[]) {
  const priorityLine = lines.find((line) => /suma|razem|total|do zap[łl]aty/i.test(line));

  if (priorityLine) {
    const parsed = extractLargestMoneyValue(priorityLine);

    if (parsed !== null) {
      return parsed;
    }
  }

  return extractLargestMoneyValue(lines.join(' '));
}

function extractScreenshotAmount(lines: string[]) {
  const preferredLine =
    lines.find((line) => /pln|zł|zap[łl]acono|transakcja|płatno[śćsc]|przelew|otrzymano/i.test(line)) ?? lines[0];

  return preferredLine ? extractLargestMoneyValue(preferredLine) ?? extractLargestMoneyValue(lines.join(' ')) : null;
}

function extractLargestMoneyValue(text: string) {
  const matches = Array.from(text.matchAll(/(\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2}))/g));

  if (matches.length === 0) {
    return null;
  }

  const values = matches
    .map((match) => toMinorUnits(match[1] ?? ''))
    .filter((value): value is number => value !== null)
    .sort((left, right) => right - left);

  return values[0] ?? null;
}

function extractDate(text: string) {
  const isoMatch = text.match(/\b(20\d{2})[-/.](\d{2})[-/.](\d{2})\b/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const localMatch = text.match(/\b(\d{2})[-/.](\d{2})[-/.](20\d{2})\b/);

  if (localMatch) {
    return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;
  }

  return null;
}

function detectPaymentMethod(rawText: string): PaymentMethod | null {
  const normalized = rawText.toLocaleLowerCase('pl-PL');

  for (const [keyword, method] of SCREENSHOT_METHOD_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return method;
    }
  }

  return null;
}

function detectScreenshotTransactionType(rawText: string): TransactionType {
  return /otrzymano|wpływ|przychodz[ąa]cy|received|incoming/i.test(rawText) ? 'income' : 'expense';
}

function extractScreenshotDescription(lines: string[]) {
  const candidate = lines.find(
    (line) =>
      !/\d{2}[./-]\d{2}[./-]\d{4}/.test(line) &&
      !/\d+[,.]\d{2}/.test(line) &&
      line.length >= 3 &&
      !/blik|visa|mastercard|saldo|konto|transakcja|płatno[śćsc]/i.test(line),
  );

  return candidate ?? lines[0] ?? null;
}

function extractReceiptMerchant(lines: string[]) {
  const candidate = lines.find(
    (line) =>
      line.length >= 3 &&
      !/\d+[,.]\d{2}/.test(line) &&
      !/\d{2}[./-]\d{2}[./-]\d{4}/.test(line) &&
      !/paragon|fiskalny|nip|sprzedaż|sprzedaz|kasa/i.test(line),
  );

  return candidate ?? lines[0] ?? null;
}

function suggestCategoryId(rawText: string, type: TransactionType) {
  if (type === 'income') {
    return /wynagrodzenie|salary|pensja/i.test(rawText) ? 'category_salary' : 'category_other_income';
  }

  const normalized = rawText.toLocaleLowerCase('pl-PL');

  for (const [keyword, categoryId] of RECEIPT_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return categoryId;
    }
  }

  return 'category_other_expense';
}

function compactSummary(description: string | null, amountMinor: number | null, date: string | null, modeLabel: string) {
  return [
    `${modeLabel === 'paragon' ? 'Źródło' : 'Wejście'}: ${modeLabel}`,
    description ? `Opis: ${description}` : null,
    amountMinor !== null ? `Kwota: ${formatMinorUnitsInput(amountMinor)} PLN` : null,
    date ? `Data: ${date}` : null,
  ].filter((item): item is string => Boolean(item));
}

function normalizeText(value: string) {
  return value.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
}

function inferMimeType(extension: string) {
  if (extension === 'png') {
    return 'image/png';
  }

  if (extension === 'webp') {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function extractExtension(asset: ImagePicker.ImagePickerAsset) {
  const uriExtension = asset.uri.split('.').pop()?.toLocaleLowerCase('pl-PL');

  if (uriExtension && ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(uriExtension)) {
    return uriExtension === 'jpg' ? 'jpeg' : uriExtension;
  }

  if (asset.mimeType?.includes('png')) {
    return 'png';
  }

  if (asset.mimeType?.includes('webp')) {
    return 'webp';
  }

  return 'jpeg';
}

function toMinorUnits(value: string) {
  const normalized = value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100);
}
