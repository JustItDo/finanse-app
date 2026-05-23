export type TransactionType = 'expense' | 'income';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'blik' | 'other';
export type EntrySourceType =
  | 'manual'
  | 'receipt_ocr'
  | 'screenshot_ocr'
  | 'obsidian_import'
  | 'obsidian_sync';
export type OcrStatus = 'not_requested' | 'pending' | 'processed' | 'reviewed' | 'failed';
export type AttachmentKind = 'receipt_photo' | 'screenshot' | 'document';
export type CategoryTransactionType = TransactionType | 'both';

export type Transaction = {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currencyCode: string;
  occurredAt: string;
  categoryId: string | null;
  description: string | null;
  paymentMethod: PaymentMethod;
  sourceType: EntrySourceType;
  sourceReference: string | null;
  note: string | null;
  ocrStatus: OcrStatus;
  ocrConfidence: number | null;
  ocrRawText: string | null;
  ocrAttachmentSource: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Attachment = {
  id: string;
  transactionId: string | null;
  kind: AttachmentKind;
  storageType: 'local_file';
  fileUri: string;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  sourceType: EntrySourceType;
  sourceReference: string | null;
  ocrStatus: OcrStatus;
  ocrConfidence: number | null;
  ocrRawText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  transactionType: CategoryTransactionType;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryBudget = {
  id: string;
  categoryId: string;
  monthKey: string;
  limitAmountMinor: number;
  currencyCode: string;
  rolloverEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyBudget = {
  id: string;
  monthKey: string;
  currencyCode: string;
  totalBudgetMinor: number;
  targetSavingsMinor: number | null;
  startingBalanceMinor: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
