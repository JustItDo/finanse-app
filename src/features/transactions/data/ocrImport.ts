import { Platform } from 'react-native';
import TextRecognition, {
  type Frame,
  type TextBlock,
} from '@react-native-ml-kit/text-recognition';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import type { Attachment, PaymentMethod, TransactionType } from '@/src/domain/finance';
import type { TransactionFormValues, TransactionSourceDraft } from '@/src/features/transactions/data/addTransaction';
import type { AppRepositories } from '@/src/storage';
import { getTodayDateInput } from '@/src/shared/utils/date';
import { formatMinorUnitsInput } from '@/src/shared/utils/money';
import { createEntityId } from '@/src/shared/utils/id';

export type OcrImportMode = 'receipt_gallery' | 'receipt_photo' | 'payment_screenshot';

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

export type OcrAmountDebug = {
  candidateText: string;
  heuristic: string;
  normalizedAmount: string;
  sourceLine: string;
};

export type OcrCorrectionDraft = {
  amountDebug: OcrAmountDebug | null;
  fields: Record<OcrCorrectionFieldKey, OcrCorrectionField>;
  mode: OcrImportMode;
  paymentMethod: PaymentMethod;
  rawText: string;
  requiresReview: boolean;
  transactionType: TransactionType;
};

type ParsedOcrData = {
  amountDebug: OcrAmountDebug | null;
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

type OcrLine = {
  frame?: Frame;
  text: string;
};

type ReceiptAmountAnchor = {
  priority: number;
  type: 'generic_total' | 'payable' | 'sum_with_currency';
};

type ReceiptAmountCandidate = {
  amountMinor: number;
  candidateText: string;
  heuristic: string;
  sourceLine: string;
};

type ReceiptAmountResult = {
  amountMinor: number | null;
  debug: OcrAmountDebug | null;
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
    kind: mode === 'payment_screenshot' ? 'screenshot' : 'receipt_photo',
    mimeType: storedAsset.mimeType,
    ocrConfidence: parsed.status === 'processed' ? 0.45 : null,
    ocrRawText: parsed.rawText || null,
    ocrStatus: parsed.status,
    sourceReference: asset.assetId ?? asset.fileName ?? storedAsset.file.name,
    sourceType: mode === 'payment_screenshot' ? 'screenshot_ocr' : 'receipt_ocr',
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
    throw new Error(
      mode === 'receipt_gallery'
        ? 'Brak zgody na galerię. Bez niej nie da się wybrać zdjęcia paragonu.'
        : 'Brak zgody na galerię. Bez niej nie da się wybrać screena płatności.',
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    mediaTypes: ['images'],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) {
    throw new Error(
      mode === 'receipt_gallery'
        ? 'Wybór zdjęcia paragonu został anulowany.'
        : 'Wybór screena płatności został anulowany.',
    );
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
  const sourceFile = new File(asset.uri);

  await sourceFile.copy(targetFile);

  if (!targetFile.exists) {
    throw new Error('Nie udało się zapisać obrazu w pamięci aplikacji przed uruchomieniem OCR.');
  }

  return {
    file: targetFile,
    mimeType: asset.mimeType ?? inferMimeType(extension),
  };
}

async function runOcrAndParse(fileUri: string, mode: OcrImportMode): Promise<ParsedOcrData> {
  if (Platform.OS === 'web') {
    return {
      amountDebug: null,
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
    const ocrLines = flattenOcrLines(result.blocks);

    if (!rawText) {
      return {
        amountDebug: null,
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

    return mode === 'payment_screenshot'
      ? parseScreenshotText(rawText, ocrLines)
      : parseReceiptText(rawText, ocrLines);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd OCR.';
    const likelyMissingNativeModule =
      message.includes("doesn't seem to be linked") || message.includes('Expo managed workflow');

    return {
      amountDebug: null,
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

function parseReceiptText(rawText: string, ocrLines: OcrLine[]): ParsedOcrData {
  const lines = toTextLines(rawText, ocrLines);
  const merchantName = extractReceiptMerchant(lines.map((line) => line.text));
  const amountResult = extractReceiptAmount(lines, rawText);
  const amountMinor = amountResult.amountMinor;
  const date = extractDate(rawText);
  const categorySuggestion = suggestCategoryId(rawText, 'expense');

  return {
    amountDebug: amountResult.debug,
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

function parseScreenshotText(rawText: string, ocrLines: OcrLine[]): ParsedOcrData {
  const lines = toTextLines(rawText, ocrLines);
  const amountMinor = extractScreenshotAmount(lines.map((line) => line.text));
  const date = extractDate(rawText);
  const merchantName = extractScreenshotDescription(lines.map((line) => line.text));
  const transactionType = detectScreenshotTransactionType(rawText);
  const categorySuggestion = suggestCategoryId(rawText, transactionType);

  return {
    amountDebug: null,
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
    description:
      parsed.merchantName ?? (mode === 'payment_screenshot' ? 'Płatność do korekty' : 'Paragon do korekty'),
    paymentMethod:
      parsed.paymentMethod ??
      (mode === 'payment_screenshot' ? (parsed.transactionType === 'income' ? 'bank_transfer' : 'card') : 'card'),
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
      mode === 'payment_screenshot' ? 'Nadawca / sklep' : 'Sklep',
      parsed.merchantName ?? '',
      parsed.merchantConfidence,
      parsed.merchantName
        ? 'Nazwa sklepu lub kontrahenta została zasugerowana z pierwszych linii tekstu.'
        : 'OCR nie rozpoznał wiarygodnej nazwy sklepu lub kontrahenta.',
    ),
  };

  return {
    amountDebug: parsed.amountDebug,
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

function createReceiptAmountCandidate(
  amountMinor: number,
  candidateText: string,
  sourceLine: string,
  heuristic: string,
): ReceiptAmountCandidate {
  return {
    amountMinor,
    candidateText,
    heuristic,
    sourceLine,
  };
}

function createReceiptAmountResult(candidate: ReceiptAmountCandidate | null): ReceiptAmountResult {
  if (!candidate) {
    return {
      amountMinor: null,
      debug: null,
    };
  }

  return {
    amountMinor: candidate.amountMinor,
    debug: {
      candidateText: candidate.candidateText,
      heuristic: candidate.heuristic,
      normalizedAmount: formatMinorUnitsInput(candidate.amountMinor),
      sourceLine: candidate.sourceLine,
    },
  };
}

function extractReceiptAmount(lines: OcrLine[], rawText: string): ReceiptAmountResult {
  const rawLineCandidate = extractReceiptAmountFromRawLines(rawText);

  if (rawLineCandidate) {
    return createReceiptAmountResult(rawLineCandidate);
  }

  const anchoredAmount = extractAnchoredReceiptTotal(lines);

  if (anchoredAmount !== null) {
    return createReceiptAmountResult(
      createReceiptAmountCandidate(anchoredAmount, 'układ OCR bloków', '[pozycjonowany blok OCR]', 'anchored_layout'),
    );
  }

  const lineTexts = lines.map((line) => line.text);
  const priorityIndex = lineTexts.findIndex((line) => getReceiptAmountAnchor(line) !== null);

  if (priorityIndex >= 0) {
    const priorityWindowLines = lineTexts.slice(priorityIndex, priorityIndex + 2);
    const priorityWindow = priorityWindowLines.join(' ');
    const parsed = extractLargestMoneyCandidate(
      priorityWindow,
      {
        allowCompactTotal: true,
        allowSpaceDecimal: true,
      },
      'priority_window',
      priorityWindowLines.join(' | '),
    );

    if (parsed) {
      return createReceiptAmountResult(parsed);
    }
  }

  const receiptTailLines = lineTexts.slice(Math.max(lineTexts.length - 6, 0));
  const receiptTail = receiptTailLines.join(' ');
  const tailAmount = extractLargestMoneyCandidate(
    receiptTail,
    {
      allowCompactTotal: true,
      allowSpaceDecimal: true,
    },
    'receipt_tail',
    receiptTailLines.join(' | '),
  );

  if (tailAmount) {
    return createReceiptAmountResult(tailAmount);
  }

  const rawFallback = extractLargestMoneyCandidate(
    rawText,
    { allowSpaceDecimal: true },
    'raw_text_fallback',
    '[cały surowy tekst OCR]',
  );

  return createReceiptAmountResult(rawFallback);
}

function extractReceiptAmountFromRawLines(rawText: string): ReceiptAmountCandidate | null {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const finalAnchorTailAmount = extractFinalAnchorTailAmount(lines);

  if (finalAnchorTailAmount !== null) {
    return finalAnchorTailAmount;
  }

  const strongAnchorAmount = extractLastStrongAnchorAmount(lines);

  if (strongAnchorAmount !== null) {
    return strongAnchorAmount;
  }

  const strictTotalBlockAmount = extractStrictReceiptTotalBlockAmount(lines);

  if (strictTotalBlockAmount !== null) {
    return strictTotalBlockAmount;
  }

  const currencyLineAmount = extractCurrencyTaggedReceiptAmount(lines);

  if (currencyLineAmount !== null) {
    return currencyLineAmount;
  }

  const terminalAmount = extractReceiptAmountFromTail(lines);

  if (terminalAmount !== null) {
    return terminalAmount;
  }

  const anchorWindows = lines
    .map((line, index) => ({
      anchor: getReceiptAmountAnchor(line),
      index,
      line,
    }))
    .filter(
      (item): item is { anchor: ReceiptAmountAnchor; index: number; line: string } =>
        item.anchor !== null,
    );

  if (anchorWindows.length === 0) {
    return null;
  }

  const scoredCandidates = anchorWindows.flatMap(({ anchor, index, line }) => {
    const windowLines = lines.slice(index, Math.min(index + 10, lines.length));

    return windowLines.flatMap((windowLine, offset) =>
      collectMoneyCandidates(windowLine, {
        allowCompactTotal: true,
        allowSpaceDecimal: true,
      }).map((candidate) => {
        const value = toMinorUnits(candidate);

        if (value === null) {
          return null;
        }

        const score = scoreReceiptRawLineCandidate(anchor, line, windowLine, offset);

        return {
          score,
          value,
        };
      }),
    );
  });

  const validCandidates = scoredCandidates.filter(
    (
      item,
    ): item is { candidateText: string; score: number; sourceLine: string; value: number } => item !== null,
  );

  if (validCandidates.length === 0) {
    return null;
  }

  validCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.value - left.value;
  });

  const winner = validCandidates[0];

  return winner
    ? createReceiptAmountCandidate(winner.value, winner.candidateText, winner.sourceLine, 'raw_anchor_window')
    : null;
}

function extractFinalAnchorTailAmount(lines: string[]): ReceiptAmountCandidate | null {
  const anchorMatchers: RegExp[] = [/do zap[łl]aty/i, /zap[łl]acono/i, /\bsuma\b.*(?:pln|zł)/i];

  for (const matcher of anchorMatchers) {
    let anchorIndex = -1;

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index] ?? '';

      if (matcher.test(line) && !isTaxText(line)) {
        anchorIndex = index;
        break;
      }
    }

    if (anchorIndex === -1) {
      continue;
    }

    const candidates = lines
      .slice(anchorIndex, lines.length)
      .flatMap((line, offset) => {
        if (isTaxText(line) || isReceiptItemLine(line) || isReceiptMetaLine(line) || isReceiptCodeLine(line)) {
          return [];
        }

        return collectMoneyCandidates(line, {
          allowCompactTotal: true,
          allowSpaceDecimal: true,
        })
          .filter((candidate) => /[,.]/.test(candidate))
          .map((candidate) => {
            const value = toMinorUnits(candidate);

            if (value === null || value <= 0) {
              return null;
            }

            return {
              candidateText: candidate,
              hasCurrency: /pln|zł/i.test(line),
              offset,
              sourceLine: line,
              value,
            };
          })
          .filter(
            (
              item,
            ): item is { candidateText: string; hasCurrency: boolean; offset: number; sourceLine: string; value: number } =>
              item !== null,
          );
      });

    if (candidates.length === 0) {
      continue;
    }

    const currencyCandidates = candidates.filter((candidate) => candidate.hasCurrency);
    const pool = currencyCandidates.length > 0 ? currencyCandidates : candidates;
    const lastCandidate = pool[pool.length - 1];

    if (lastCandidate) {
      return createReceiptAmountCandidate(
        lastCandidate.value,
        lastCandidate.candidateText,
        lastCandidate.sourceLine,
        'final_anchor_tail',
      );
    }
  }

  return null;
}

function extractLastStrongAnchorAmount(lines: string[]): ReceiptAmountCandidate | null {
  const anchorMatchers: RegExp[] = [/do zap[łl]aty/i, /zap[łl]acono/i, /\bsuma\b.*(?:pln|zł)/i];

  for (const matcher of anchorMatchers) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index] ?? '';

      if (!matcher.test(line) || isTaxText(line)) {
        continue;
      }

      const amount = extractNearestAnchorAmount(lines, index);

      if (amount !== null) {
        return amount;
      }
    }
  }

  return null;
}

function extractNearestAnchorAmount(lines: string[], anchorIndex: number): ReceiptAmountCandidate | null {
  const windowLines = lines.slice(anchorIndex, Math.min(anchorIndex + 7, lines.length));

  for (const line of windowLines) {
    if (isTaxText(line) || isReceiptItemLine(line) || isReceiptMetaLine(line) || isReceiptCodeLine(line)) {
      continue;
    }

    const candidates = collectMoneyCandidates(line, {
      allowCompactTotal: true,
      allowSpaceDecimal: true,
    })
      .filter((candidate) => /[,.]/.test(candidate))
      .map((candidate) => {
        const value = toMinorUnits(candidate);
        return value === null ? null : { candidateText: candidate, value };
      })
      .filter((value): value is { candidateText: string; value: number } => value !== null);

    if (candidates.length === 0) {
      continue;
    }

    const normalizedLine = line.toLocaleLowerCase('pl-PL');
    const prioritized = /pln|zł|do zap[łl]aty|zap[łl]acono|rozliczenie|karta|got[óo]wk|blik/.test(normalizedLine);
    const selected = prioritized
      ? candidates[0]
      : [...candidates].sort((left, right) => right.value - left.value)[0];

    if (selected !== undefined) {
      return createReceiptAmountCandidate(selected.value, selected.candidateText, line, 'strong_anchor_window');
    }
  }

  return null;
}

function extractStrictReceiptTotalBlockAmount(lines: string[]): ReceiptAmountCandidate | null {
  const anchorCandidates = lines
    .map((line, index) => ({
      index,
      line,
      priority: getStrictReceiptTotalAnchorPriority(line),
    }))
    .filter((item): item is { index: number; line: string; priority: number } => item.priority !== null);

  if (anchorCandidates.length === 0) {
    return null;
  }

  const scoredCandidates = anchorCandidates.flatMap(({ index, line, priority }) => {
    const windowStart = Math.max(index - 1, 0);
    const windowEnd = Math.min(index + 4, lines.length);
    const windowLines = lines.slice(windowStart, windowEnd);

    return windowLines.flatMap((windowLine, windowOffset) =>
      collectMoneyCandidates(windowLine, {
        allowCompactTotal: true,
        allowSpaceDecimal: true,
      })
        .map((candidate) => {
          const value = toMinorUnits(candidate);

          if (value === null) {
            return null;
          }

          const normalizedLine = windowLine.toLocaleLowerCase('pl-PL');
          const relativeOffset = windowStart + windowOffset - index;

          if (isTaxText(normalizedLine) || isReceiptItemLine(normalizedLine)) {
            return null;
          }

          return {
            candidateText: candidate,
            score:
              2000 +
              priority -
              Math.abs(relativeOffset) * 120 +
              (relativeOffset >= 0 ? 80 : -120) +
              (isLikelyStandaloneAmountLine(windowLine) ? 340 : 0) +
              (/pln|zł/.test(normalizedLine) ? 280 : 0) +
              (/rozliczenie|zap[łl]acono|karta|got[óo]wk|blik/.test(normalizedLine) ? 220 : 0) -
              (/rabat|opust|kaucj|opakowan/.test(normalizedLine) ? 320 : 0),
            sourceLine: windowLine,
            value,
          };
        })
        .filter(
          (
            item,
          ): item is { candidateText: string; score: number; sourceLine: string; value: number } => item !== null,
        ),
    );
  });

  if (scoredCandidates.length === 0) {
    return null;
  }

  scoredCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.value - left.value;
  });

  const winner = scoredCandidates[0];

  return winner
    ? createReceiptAmountCandidate(winner.value, winner.candidateText, winner.sourceLine, 'strict_total_block')
    : null;
}

function extractCurrencyTaggedReceiptAmount(lines: string[]): ReceiptAmountCandidate | null {
  const scoredCandidates = lines.flatMap((line, index) => {
    const normalizedLine = line.toLocaleLowerCase('pl-PL');

    if (!/pln|zł/.test(normalizedLine) || isTaxText(normalizedLine)) {
      return [];
    }

    return collectMoneyCandidates(line, {
      allowCompactTotal: false,
      allowSpaceDecimal: true,
    })
      .filter((candidate) => /[,.]/.test(candidate))
      .map((candidate) => {
        const value = toMinorUnits(candidate);

        if (value === null) {
          return null;
        }

        return {
          candidateText: candidate,
          score:
            1200 +
            index * 18 +
            (isLikelyStandaloneAmountLine(line) ? 260 : 0) +
            (/do zap[łl]aty|suma|razem|total/.test(normalizedLine) ? 320 : 0) +
            (/rozliczenie|zap[łl]acono|karta|got[óo]wk|blik/.test(normalizedLine) ? 160 : 0),
          sourceLine: line,
          value,
        };
      })
      .filter(
        (
          item,
        ): item is { candidateText: string; score: number; sourceLine: string; value: number } => item !== null,
      );
  });

  if (scoredCandidates.length === 0) {
    return null;
  }

  scoredCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.value - left.value;
  });

  const winner = scoredCandidates[0];

  return winner
    ? createReceiptAmountCandidate(winner.value, winner.candidateText, winner.sourceLine, 'currency_tagged_line')
    : null;
}

function getStrictReceiptTotalAnchorPriority(text: string) {
  const normalized = text.toLocaleLowerCase('pl-PL');

  if (isTaxText(normalized)) {
    return null;
  }

  if (/do zap[łl]aty/.test(normalized)) {
    return 900;
  }

  if (/zap[łl]acono/.test(normalized)) {
    return 820;
  }

  if (/\bsuma\b/.test(normalized) && /pln|zł/.test(normalized)) {
    return 760;
  }

  if (/\brazem\b|\btotal\b|\bsuma\b/.test(normalized)) {
    return 620;
  }

  return null;
}

function extractReceiptAmountFromTail(lines: string[]): ReceiptAmountCandidate | null {
  const moneyLines = lines.flatMap((line, index) =>
    collectMoneyCandidates(line, {
      allowCompactTotal: true,
      allowSpaceDecimal: true,
    }).map((candidate) => {
      const value = toMinorUnits(candidate);

      if (value === null) {
        return null;
      }

      return {
        index,
        line,
        value,
      };
    }),
  );
  const validMoneyLines = moneyLines.filter(
    (item): item is { index: number; line: string; value: number } => item !== null,
  );

  if (validMoneyLines.length === 0) {
    return null;
  }

  const payableTailAmount = extractPayableTailAmount(lines, validMoneyLines);

  if (payableTailAmount !== null) {
    return payableTailAmount;
  }

  const repeatCountByValue = new Map<number, number>();

  for (const candidate of validMoneyLines) {
    repeatCountByValue.set(candidate.value, (repeatCountByValue.get(candidate.value) ?? 0) + 1);
  }

  const tailStartIndex = Math.max(lines.length - 16, 0);
  const scoredCandidates = validMoneyLines.map((candidate) => {
    const lineContext = lines
      .slice(Math.max(candidate.index - 2, 0), Math.min(candidate.index + 3, lines.length))
      .join(' ')
      .toLocaleLowerCase('pl-PL');
    const normalizedLine = candidate.line.toLocaleLowerCase('pl-PL');
    const repeatCount = repeatCountByValue.get(candidate.value) ?? 1;
    const hasCurrency = /pln|zł/.test(normalizedLine);
    const hasPaymentContext = /do zap[łl]aty|rozliczenie|zap[łl]acono|karta|got[óo]wk|blik/.test(lineContext);
    const hasTaxContext = isTaxText(lineContext);
    const hasPackagingContext = /opakowan|kaucj/.test(lineContext);
    const hasItemContext = /\bszt\b|[x*]\d+[,.]\d{2}|[a-d]\b/.test(normalizedLine);
    const isStandalone = isLikelyStandaloneAmountLine(candidate.line);
    const tailBonus = candidate.index >= tailStartIndex ? 360 : 0;
    const score =
      1000 +
      tailBonus +
      candidate.index * 24 +
      (hasCurrency ? 420 : 0) +
      (isStandalone ? 220 : 0) +
      (hasPaymentContext ? 260 : 0) +
      Math.min(repeatCount, 3) * 140 -
      (hasTaxContext ? 620 : 0) -
      (hasPackagingContext ? 260 : 0) -
      (hasItemContext ? 220 : 0);

    return {
      score,
      value: candidate.value,
    };
  });

  scoredCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.value - left.value;
  });

  const winner = scoredCandidates[0];

  return winner
    ? createReceiptAmountCandidate(winner.value, formatMinorUnitsInput(winner.value), '[końcówka paragonu]', 'tail_scoring')
    : null;
}

function extractPayableTailAmount(
  lines: string[],
  moneyLines: { index: number; line: string; value: number }[],
): ReceiptAmountCandidate | null {
  const hasPayableAnchor = lines.some((line) => getReceiptAmountAnchor(line)?.type === 'payable');

  if (!hasPayableAnchor) {
    return null;
  }

  const tailStartIndex = Math.max(lines.length - 10, 0);
  const tailCurrencyCandidates = moneyLines.filter((candidate) => {
    if (candidate.index < tailStartIndex) {
      return false;
    }

    const normalizedLine = candidate.line.toLocaleLowerCase('pl-PL');
    return /pln|zł/.test(normalizedLine) && !isTaxText(normalizedLine);
  });

  if (tailCurrencyCandidates.length === 0) {
    return null;
  }

  const repeatCountByValue = new Map<number, number>();

  for (const candidate of tailCurrencyCandidates) {
    repeatCountByValue.set(candidate.value, (repeatCountByValue.get(candidate.value) ?? 0) + 1);
  }

  tailCurrencyCandidates.sort((left, right) => {
    const rightRepeatCount = repeatCountByValue.get(right.value) ?? 1;
    const leftRepeatCount = repeatCountByValue.get(left.value) ?? 1;

    if (rightRepeatCount !== leftRepeatCount) {
      return rightRepeatCount - leftRepeatCount;
    }

    return right.index - left.index;
  });

  const winner = tailCurrencyCandidates[0];

  return winner
    ? createReceiptAmountCandidate(winner.value, formatMinorUnitsInput(winner.value), winner.line, 'payable_tail')
    : null;
}

function extractScreenshotAmount(lines: string[]) {
  const preferredLine =
    lines.find((line) => /pln|zł|zap[łl]acono|transakcja|płatno[śćsc]|przelew|otrzymano/i.test(line)) ?? lines[0];

  return preferredLine
    ? extractLargestMoneyValue(preferredLine, { allowSpaceDecimal: true }) ??
        extractLargestMoneyValue(lines.join(' '), { allowSpaceDecimal: true })
    : null;
}

function extractLargestMoneyValue(
  text: string,
  options: {
    allowCompactTotal?: boolean;
    allowSpaceDecimal?: boolean;
  } = {},
) {
  const values = collectMoneyCandidates(text, options)
    .map((candidate) => toMinorUnits(candidate))
    .filter((value): value is number => value !== null)
    .sort((left, right) => right - left);

  if (values.length === 0) {
    return null;
  }

  return values[0] ?? null;
}

function extractLargestMoneyCandidate(
  text: string,
  options: {
    allowCompactTotal?: boolean;
    allowSpaceDecimal?: boolean;
  },
  heuristic: string,
  sourceLine: string,
) {
  const candidates = collectMoneyCandidates(text, options)
    .map((candidateText) => {
      const amountMinor = toMinorUnits(candidateText);

      if (amountMinor === null) {
        return null;
      }

      return createReceiptAmountCandidate(amountMinor, candidateText, sourceLine, heuristic);
    })
    .filter((candidate): candidate is ReceiptAmountCandidate => candidate !== null)
    .sort((left, right) => right.amountMinor - left.amountMinor);

  return candidates[0] ?? null;
}

function collectMoneyCandidates(
  text: string,
  options: {
    allowCompactTotal?: boolean;
    allowSpaceDecimal?: boolean;
  },
) {
  const candidates = Array.from(text.matchAll(/(\d{1,4}(?:[ .]\d{3})*(?:[,.]\d{2}))/g))
    .filter((match) => !isDateOrTimeMoneyMatch(text, match.index ?? 0, match[0] ?? ''))
    .map((match) => match[1] ?? '');

  if (options.allowSpaceDecimal) {
    candidates.push(
      ...Array.from(text.matchAll(/(?<!\d)(\d{1,4}(?:[ .]\d{3})*)\s(\d{2})(?!\d)/g))
        .filter((match) => !isDateOrTimeMoneyMatch(text, match.index ?? 0, match[0] ?? ''))
        .map((match) => `${match[1] ?? ''},${match[2] ?? ''}`),
    );
  }

  if (options.allowCompactTotal) {
    candidates.push(
      ...Array.from(text.matchAll(/(?:pln|suma|razem|total|do zap[łl]aty)[^0-9]{0,10}(\d{3,6})(?!\d)/gi)).map(
        (match) => toDecimalString(match[1] ?? ''),
      ),
    );
  }

  return candidates.filter(Boolean);
}

function extractAnchoredReceiptTotal(lines: OcrLine[]) {
  const totalAnchors = lines
    .map((line) => ({
      anchor: getReceiptAmountAnchor(line.text),
      line,
    }))
    .filter(
      (item): item is { anchor: ReceiptAmountAnchor; line: OcrLine } =>
        item.anchor !== null,
    );

  if (totalAnchors.length === 0) {
    return null;
  }

  const scoredCandidates = totalAnchors.flatMap(({ anchor, line: anchorLine }) => {
    const anchorTop = anchorLine.frame?.top ?? 0;
    const anchorRight = getFrameRight(anchorLine.frame);
    const nearbyLines = lines.filter((line) => {
      const top = line.frame?.top ?? anchorTop;
      return Math.abs(top - anchorTop) <= 120;
    });

    const maxHeight = nearbyLines.reduce((currentMax, line) => Math.max(currentMax, line.frame?.height ?? 0), 0);

    return nearbyLines
      .flatMap((line) =>
        [
          ...collectMoneyCandidates(line.text, {
            allowCompactTotal: true,
            allowSpaceDecimal: true,
          }),
          ...collectMoneyCandidates(`${anchorLine.text} ${line.text}`, {
            allowCompactTotal: true,
            allowSpaceDecimal: true,
          }),
        ].map((candidate) => ({
          candidate,
          line,
          usesAnchorPair: line !== anchorLine,
        })),
      )
      .map(({ candidate, line, usesAnchorPair }) => {
        const value = toMinorUnits(candidate);

        if (value === null) {
          return null;
        }

        const lineTop = line.frame?.top ?? anchorTop;
        const lineRight = getFrameRight(line.frame);
        const lineHeight = line.frame?.height ?? 0;
        const verticalDistance = Math.abs(lineTop - anchorTop);
        const rightBias = Math.max(lineRight - anchorRight, 0);
        const belowAnchorBonus = lineTop >= anchorTop ? 80 : -160;
        const heightBonus = maxHeight > 0 ? Math.round((lineHeight / maxHeight) * 220) : 0;
        const valueOnlyBonus = isLikelyStandaloneAmountLine(line.text) ? 260 : 0;
        const totalContextBonus = /suma|razem|total|pln|zł|do zap[łl]aty/i.test(line.text) ? 180 : 0;
        const taxPenalty = isTaxText(line.text) ? 420 : 0;
        const anchorPriorityBonus = anchor.priority;
        const sameLineAnchorBonus = !usesAnchorPair && line === anchorLine ? 360 : 0;
        const pairPenalty = usesAnchorPair ? 60 : 0;
        const score =
          1000 -
          verticalDistance * 6 +
          rightBias +
          belowAnchorBonus +
          heightBonus +
          valueOnlyBonus +
          totalContextBonus -
          taxPenalty +
          anchorPriorityBonus +
          sameLineAnchorBonus -
          pairPenalty;

        return {
          score,
          value,
        };
      })
      .filter((item): item is { score: number; value: number } => item !== null);
  });

  if (scoredCandidates.length === 0) {
    return null;
  }

  scoredCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.value - left.value;
  });

  return scoredCandidates[0]?.value ?? null;
}

function isDateOrTimeMoneyMatch(text: string, matchIndex: number, matchText: string) {
  const beforeChar = matchIndex > 0 ? text[matchIndex - 1] ?? '' : '';
  const afterIndex = matchIndex + matchText.length;
  const afterChar = text[afterIndex] ?? '';
  const context = text.slice(Math.max(matchIndex - 8, 0), Math.min(afterIndex + 8, text.length));
  const normalizedMatch = matchText.replace(/\s/g, '');

  if (beforeChar === '-' || beforeChar === '/' || beforeChar === '.') {
    return true;
  }

  if (afterChar === ':' || afterChar === '-' || afterChar === '/' || afterChar === '.') {
    return true;
  }

  if (/\d{2,4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}[:.]\d{2}/.test(context)) {
    return true;
  }

  if (/^(19|20)\d{2}[,.]\d{2}$/.test(normalizedMatch) && /\b(19|20)\d{2}\b/.test(context)) {
    return true;
  }

  return false;
}

function isLikelyStandaloneAmountLine(text: string) {
  const normalized = text.trim();

  return /^(?:pln\s*)?\d{1,4}(?:[ ,.]\d{2})\s*(?:zł|pln)?$/i.test(normalized);
}

function isReceiptItemLine(text: string) {
  const normalized = text.toLocaleLowerCase('pl-PL');

  return (
    /\bszt\b/.test(normalized) ||
    /[x*]\s*\d+[,.]\d{2}/.test(normalized) ||
    /=\s*-?\d+[,.]\d{2}/.test(normalized) ||
    /\b[a-d]\b/.test(normalized)
  );
}

function isReceiptMetaLine(text: string) {
  const normalized = text.toLocaleLowerCase('pl-PL');

  return (
    /nr\b|dok\.|kasjer|sys\.|nip|rejestr|bdo|ean|salon|paragon fiskalny/.test(normalized) ||
    /\b\d{2}[./-]\d{2}[./-]\d{4}\b/.test(normalized) ||
    /\b\d{4}[./-]\d{2}[./-]\d{2}\b/.test(normalized) ||
    /\b\d{1,2}:\d{2}\b/.test(normalized)
  );
}

function isReceiptCodeLine(text: string) {
  const trimmed = text.trim();

  return (
    /^[a-z0-9#/-]{8,}$/i.test(trimmed) ||
    /^\d{3,}$/.test(trimmed) ||
    /^[a-z]{1,3}\s+[a-z0-9]{6,}$/i.test(trimmed)
  );
}

function scoreReceiptRawLineCandidate(
  anchor: ReceiptAmountAnchor,
  anchorLine: string,
  candidateLine: string,
  offset: number,
) {
  const normalizedCandidate = candidateLine.toLocaleLowerCase('pl-PL');
  const sameLineBonus = offset === 0 ? 380 : 0;
  const distancePenalty = offset * 55;
  const standaloneBonus = isLikelyStandaloneAmountLine(candidateLine) ? 260 : 0;
  const currencyBonus = /pln|zł/.test(normalizedCandidate) ? 220 : 0;
  const totalContextBonus = /do zap[łl]aty|suma|razem|total/.test(normalizedCandidate) ? 180 : 0;
  const paymentContextBonus = /got[óo]wk|karta|blik|zap[łl]acono|rozliczenie/.test(normalizedCandidate) ? 120 : 0;
  const taxPenalty = isTaxText(normalizedCandidate) ? 500 : 0;
  const anchorContextBonus = /pln|zł/.test(anchorLine.toLocaleLowerCase('pl-PL')) ? 100 : 0;

  return (
    1000 +
    anchor.priority +
    sameLineBonus -
    distancePenalty +
    standaloneBonus +
    currencyBonus +
    totalContextBonus +
    paymentContextBonus +
    anchorContextBonus -
    taxPenalty
  );
}

function getReceiptAmountAnchor(text: string): ReceiptAmountAnchor | null {
  const normalized = text.toLocaleLowerCase('pl-PL');

  if (isTaxText(normalized)) {
    return null;
  }

  if (/do zap[łl]aty/.test(normalized)) {
    return {
      priority: 600,
      type: 'payable',
    };
  }

  if (/\bsuma\b/.test(normalized) && /pln|zł/.test(normalized)) {
    return {
      priority: 420,
      type: 'sum_with_currency',
    };
  }

  if (/\brazem\b|\btotal\b|\bsuma\b/.test(normalized)) {
    return {
      priority: 300,
      type: 'generic_total',
    };
  }

  return null;
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

function flattenOcrLines(blocks: TextBlock[]) {
  return blocks
    .flatMap((block) => block.lines)
    .map((line) => ({
      frame: line.frame,
      text: normalizeText(line.text),
    }))
    .filter((line) => line.text);
}

function toTextLines(rawText: string, ocrLines: OcrLine[]) {
  if (ocrLines.length > 0) {
    return [...ocrLines].sort((left, right) => {
      const topDifference = (left.frame?.top ?? 0) - (right.frame?.top ?? 0);

      if (Math.abs(topDifference) > 6) {
        return topDifference;
      }

      return (left.frame?.left ?? 0) - (right.frame?.left ?? 0);
    });
  }

  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

function getFrameRight(frame?: Frame) {
  return frame ? frame.left + frame.width : 0;
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
  const normalized = normalizeMoneyCandidate(value);
  const parsed = Number(normalized);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function toDecimalString(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.length < 3) {
    return digits;
  }

  const integerPart = digits.slice(0, -2);
  const decimalPart = digits.slice(-2);

  return `${integerPart},${decimalPart}`;
}

function normalizeMoneyCandidate(value: string) {
  const compact = value.replace(/\s/g, '');
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      return compact.replace(/\./g, '').replace(',', '.');
    }

    return compact.replace(/,/g, '');
  }

  if (lastComma >= 0) {
    return compact.replace(',', '.');
  }

  if (lastDot >= 0) {
    return compact;
  }

  return compact;
}

function isTaxText(text: string) {
  return /ptu|vat|podatek|sp\.?\s*op/.test(text.toLocaleLowerCase('pl-PL'));
}
