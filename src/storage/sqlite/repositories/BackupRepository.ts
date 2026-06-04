import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import type {
  Attachment,
  Category,
  CategoryBudget,
  MonthlyBudget,
  Transaction,
} from '@/src/domain/finance';
import { toIsoTimestamp } from '@/src/shared/utils/date';
import type {
  BackupFileTarget,
  BackupImportResult,
  BackupRepository,
  BackupSaveResult,
  BackupSummaryCounts,
} from '@/src/storage/backup/types';
import {
  DATABASE_SCHEMA_VERSION,
  DEFAULT_CURRENCY_CODE,
} from '@/src/storage/sqlite/constants';
import type { DatabaseContext } from '@/src/storage/sqlite/database';

const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_APP_ID = 'zenifi';

type BackupAttachment = Omit<Attachment, 'fileUri'> & {
  backupPath: string;
  originalFileName: string | null;
};

type BackupData = {
  attachments: BackupAttachment[];
  categories: Category[];
  categoryBudgets: CategoryBudget[];
  monthlyBudgets: MonthlyBudget[];
  transactions: Transaction[];
};

type LocalBackupData = BackupData & {
  attachmentFileUris: Map<string, string>;
};

type BackupManifest = {
  appId: typeof BACKUP_APP_ID;
  backupSchemaVersion: number;
  createdAt: string;
  databaseSchemaVersion: number;
  encryption: {
    algorithm: 'none';
    keyDerivation: null;
  };
  cloud: {
    provider: null;
    remoteId: null;
  };
  counts: BackupSummaryCounts;
};

type CategoryRow = {
  id: string;
  name: string;
  transaction_type: Category['transactionType'];
  icon: string | null;
  color: string | null;
  is_system: number;
  is_archived: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type TransactionRow = {
  id: string;
  type: Transaction['type'];
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
  category_id: string | null;
  description: string | null;
  payment_method: Transaction['paymentMethod'];
  source_type: Transaction['sourceType'];
  source_reference: string | null;
  note: string | null;
  ocr_status: Transaction['ocrStatus'];
  ocr_confidence: number | null;
  ocr_raw_text: string | null;
  ocr_attachment_source: string | null;
  created_at: string;
  updated_at: string;
};

type MonthlyBudgetRow = {
  id: string;
  month_key: string;
  currency_code: string;
  total_budget_minor: number;
  target_savings_minor: number | null;
  starting_balance_minor: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CategoryBudgetRow = {
  id: string;
  category_id: string;
  month_key: string;
  limit_amount_minor: number;
  currency_code: string;
  rollover_enabled: number;
  created_at: string;
  updated_at: string;
};

type AttachmentRow = {
  id: string;
  transaction_id: string | null;
  kind: Attachment['kind'];
  storage_type: Attachment['storageType'];
  file_uri: string;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  source_type: Attachment['sourceType'];
  source_reference: string | null;
  ocr_status: Attachment['ocrStatus'];
  ocr_confidence: number | null;
  ocr_raw_text: string | null;
  created_at: string;
  updated_at: string;
};

function mapCategory(row: CategoryRow): Category {
  return {
    color: row.color,
    createdAt: row.created_at,
    icon: row.icon,
    id: row.id,
    isArchived: Boolean(row.is_archived),
    isSystem: Boolean(row.is_system),
    name: row.name,
    sortOrder: row.sort_order,
    transactionType: row.transaction_type,
    updatedAt: row.updated_at,
  };
}

function mapTransaction(row: TransactionRow): Transaction {
  return {
    amountMinor: row.amount_minor,
    categoryId: row.category_id,
    createdAt: row.created_at,
    currencyCode: row.currency_code,
    description: row.description,
    id: row.id,
    note: row.note,
    occurredAt: row.occurred_at,
    ocrAttachmentSource: row.ocr_attachment_source,
    ocrConfidence: row.ocr_confidence,
    ocrRawText: row.ocr_raw_text,
    ocrStatus: row.ocr_status,
    paymentMethod: row.payment_method,
    sourceReference: row.source_reference,
    sourceType: row.source_type,
    type: row.type,
    updatedAt: row.updated_at,
  };
}

function mapMonthlyBudget(row: MonthlyBudgetRow): MonthlyBudget {
  return {
    createdAt: row.created_at,
    currencyCode: row.currency_code,
    id: row.id,
    monthKey: row.month_key,
    notes: row.notes,
    startingBalanceMinor: row.starting_balance_minor,
    targetSavingsMinor: row.target_savings_minor,
    totalBudgetMinor: row.total_budget_minor,
    updatedAt: row.updated_at,
  };
}

function mapCategoryBudget(row: CategoryBudgetRow): CategoryBudget {
  return {
    categoryId: row.category_id,
    createdAt: row.created_at,
    currencyCode: row.currency_code,
    id: row.id,
    limitAmountMinor: row.limit_amount_minor,
    monthKey: row.month_key,
    rolloverEnabled: Boolean(row.rollover_enabled),
    updatedAt: row.updated_at,
  };
}

function mapAttachment(row: AttachmentRow): Attachment {
  return {
    createdAt: row.created_at,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    fileUri: row.file_uri,
    id: row.id,
    kind: row.kind,
    mimeType: row.mime_type,
    ocrConfidence: row.ocr_confidence,
    ocrRawText: row.ocr_raw_text,
    ocrStatus: row.ocr_status,
    sourceReference: row.source_reference,
    sourceType: row.source_type,
    storageType: row.storage_type,
    transactionId: row.transaction_id,
    updatedAt: row.updated_at,
  };
}

function buildCounts(data: BackupData): BackupSummaryCounts {
  return {
    attachments: data.attachments.length,
    categoryBudgets: data.categoryBudgets.length,
    categories: data.categories.length,
    monthlyBudgets: data.monthlyBudgets.length,
    transactions: data.transactions.length,
  };
}

function formatBackupFileName(date = new Date()) {
  const pad = (value: number) => value.toString().padStart(2, '0');

  return `zenifi-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}.zip`;
}

function sanitizeFileName(name: string | null | undefined) {
  const cleaned = (name ?? 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.length > 0 ? cleaned : 'attachment';
}

function assertSafeZipPath(path: string) {
  if (
    path.startsWith('/') ||
    path.startsWith('\\') ||
    path.includes('..') ||
    path.includes('\\') ||
    path.split('/').some((part) => part.length === 0)
  ) {
    throw new Error(`Backup zawiera niedozwoloną ścieżkę: ${path}`);
  }
}

function readJson<T>(entries: Record<string, Uint8Array>, path: string): T {
  const bytes = entries[path];

  if (!bytes) {
    throw new Error(`Backup nie zawiera pliku ${path}.`);
  }

  return JSON.parse(strFromU8(bytes)) as T;
}

function validateBackup(manifest: BackupManifest, data: BackupData) {
  if (manifest.appId !== BACKUP_APP_ID) {
    throw new Error('To nie jest kopia danych Zenifi.');
  }

  if (manifest.backupSchemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('Ta wersja kopii danych nie jest obsługiwana.');
  }

  if (manifest.encryption?.algorithm !== 'none') {
    throw new Error('Zaszyfrowane kopie danych nie są jeszcze obsługiwane.');
  }

  const counts = buildCounts(data);
  const countKeys: (keyof BackupSummaryCounts)[] = [
    'attachments',
    'categoryBudgets',
    'categories',
    'monthlyBudgets',
    'transactions',
  ];

  for (const key of countKeys) {
    if (manifest.counts[key] !== counts[key]) {
      throw new Error('Manifest kopii danych nie zgadza się z data.json.');
    }
  }

  const categoryIds = new Set(data.categories.map((category) => category.id));
  const transactionIds = new Set(
    data.transactions.map((transaction) => transaction.id),
  );

  for (const transaction of data.transactions) {
    if (transaction.categoryId && !categoryIds.has(transaction.categoryId)) {
      throw new Error('Backup zawiera transakcję z nieznaną kategorią.');
    }
  }

  for (const budget of data.categoryBudgets) {
    if (!categoryIds.has(budget.categoryId)) {
      throw new Error('Backup zawiera budżet z nieznaną kategorią.');
    }
  }

  for (const attachment of data.attachments) {
    assertSafeZipPath(attachment.backupPath);

    if (
      attachment.transactionId &&
      !transactionIds.has(attachment.transactionId)
    ) {
      throw new Error('Backup zawiera załącznik z nieznaną transakcją.');
    }
  }
}

async function readBackupData(db: SQLiteDatabase): Promise<LocalBackupData> {
  const [
    categoryRows,
    monthlyBudgetRows,
    categoryBudgetRows,
    transactionRows,
    attachmentRows,
  ] = await Promise.all([
    db.getAllAsync<CategoryRow>(
      'SELECT * FROM categories ORDER BY sort_order ASC, name ASC',
    ),
    db.getAllAsync<MonthlyBudgetRow>(
      'SELECT * FROM monthly_budgets ORDER BY month_key ASC',
    ),
    db.getAllAsync<CategoryBudgetRow>(
      'SELECT * FROM category_budgets ORDER BY month_key ASC, created_at ASC',
    ),
    db.getAllAsync<TransactionRow>(
      'SELECT * FROM transactions ORDER BY occurred_at ASC, created_at ASC',
    ),
    db.getAllAsync<AttachmentRow>(
      'SELECT * FROM attachments ORDER BY created_at ASC',
    ),
  ]);
  const attachments = attachmentRows.map((row) => {
    const attachment = mapAttachment(row);
    const backupFileName = sanitizeFileName(attachment.fileName);

    return {
      ...attachment,
      backupPath: `attachments/${attachment.id}/${backupFileName}`,
      originalFileName: attachment.fileName,
    };
  });

  return {
    attachmentFileUris: new Map(
      attachmentRows.map((row) => [row.id, row.file_uri]),
    ),
    attachments,
    categories: categoryRows.map(mapCategory),
    categoryBudgets: categoryBudgetRows.map(mapCategoryBudget),
    monthlyBudgets: monthlyBudgetRows.map(mapMonthlyBudget),
    transactions: transactionRows.map(mapTransaction),
  };
}

async function buildZip(data: LocalBackupData, manifest: BackupManifest) {
  const entries: Record<string, Uint8Array> = {
    'data.json': strToU8(
      JSON.stringify(
        {
          attachments: data.attachments,
          categories: data.categories,
          categoryBudgets: data.categoryBudgets,
          monthlyBudgets: data.monthlyBudgets,
          transactions: data.transactions,
        } satisfies BackupData,
        null,
        2,
      ),
    ),
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
  };

  for (const attachment of data.attachments) {
    const rowFileUri = data.attachmentFileUris.get(attachment.id);

    if (!rowFileUri) {
      continue;
    }

    const file = new File(rowFileUri);

    if (file.exists) {
      entries[attachment.backupPath] = await file.bytes();
    }
  }

  return zipSync(entries, { level: 6 });
}

function shouldUpdate(
  incomingUpdatedAt: string,
  localUpdatedAt?: string | null,
) {
  return !localUpdatedAt || incomingUpdatedAt > localUpdatedAt;
}

async function importCategories(
  txn: SQLiteDatabase,
  categories: Category[],
  warnings: string[],
) {
  const localRows = await txn.getAllAsync<CategoryRow>(
    'SELECT * FROM categories',
  );
  const localById = new Map(localRows.map((row) => [row.id, row]));
  const localByName = new Map(
    localRows.map((row) => [row.name.toLocaleLowerCase('pl-PL'), row]),
  );
  const categoryIdMap = new Map<string, string>();
  let imported = 0;

  for (const category of categories) {
    const sameId = localById.get(category.id);

    if (sameId) {
      categoryIdMap.set(category.id, category.id);

      if (shouldUpdate(category.updatedAt, sameId.updated_at)) {
        await txn.runAsync(
          `
            UPDATE categories
            SET name = ?, transaction_type = ?, icon = ?, color = ?, is_system = ?,
                is_archived = ?, sort_order = ?, created_at = ?, updated_at = ?
            WHERE id = ?
          `,
          category.name,
          category.transactionType,
          category.icon,
          category.color,
          category.isSystem ? 1 : 0,
          category.isArchived ? 1 : 0,
          category.sortOrder,
          category.createdAt,
          category.updatedAt,
          category.id,
        );
        imported += 1;
      }

      continue;
    }

    const sameName = localByName.get(category.name.toLocaleLowerCase('pl-PL'));
    let name = category.name;

    if (sameName) {
      if (sameName.transaction_type === category.transactionType) {
        categoryIdMap.set(category.id, sameName.id);
        continue;
      }

      name = `${category.name} (import)`;
      warnings.push(
        `Kategoria "${category.name}" dostała sufiks, bo lokalnie istnieje z innym typem.`,
      );
    }

    await txn.runAsync(
      `
        INSERT INTO categories (
          id, name, transaction_type, icon, color, is_system, is_archived,
          sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      category.id,
      name,
      category.transactionType,
      category.icon,
      category.color,
      category.isSystem ? 1 : 0,
      category.isArchived ? 1 : 0,
      category.sortOrder,
      category.createdAt,
      category.updatedAt,
    );
    categoryIdMap.set(category.id, category.id);
    localByName.set(name.toLocaleLowerCase('pl-PL'), {
      color: category.color,
      created_at: category.createdAt,
      icon: category.icon,
      id: category.id,
      is_archived: category.isArchived ? 1 : 0,
      is_system: category.isSystem ? 1 : 0,
      name,
      sort_order: category.sortOrder,
      transaction_type: category.transactionType,
      updated_at: category.updatedAt,
    });
    imported += 1;
  }

  return { categoryIdMap, imported };
}

async function importMonthlyBudgets(
  txn: SQLiteDatabase,
  budgets: MonthlyBudget[],
) {
  let imported = 0;

  for (const budget of budgets) {
    const sameId = await txn.getFirstAsync<MonthlyBudgetRow>(
      'SELECT * FROM monthly_budgets WHERE id = ? LIMIT 1',
      budget.id,
    );
    const sameMonth = await txn.getFirstAsync<MonthlyBudgetRow>(
      'SELECT * FROM monthly_budgets WHERE month_key = ? LIMIT 1',
      budget.monthKey,
    );
    const existing = sameId ?? sameMonth;

    if (existing && !shouldUpdate(budget.updatedAt, existing.updated_at)) {
      continue;
    }

    await txn.runAsync(
      `
        INSERT INTO monthly_budgets (
          id, month_key, currency_code, total_budget_minor, target_savings_minor,
          starting_balance_minor, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(month_key) DO UPDATE SET
          currency_code = excluded.currency_code,
          total_budget_minor = excluded.total_budget_minor,
          target_savings_minor = excluded.target_savings_minor,
          starting_balance_minor = excluded.starting_balance_minor,
          notes = excluded.notes,
          updated_at = excluded.updated_at
      `,
      existing?.id ?? budget.id,
      budget.monthKey,
      budget.currencyCode,
      budget.totalBudgetMinor,
      budget.targetSavingsMinor,
      budget.startingBalanceMinor,
      budget.notes,
      budget.createdAt,
      budget.updatedAt,
    );
    imported += 1;
  }

  return imported;
}

async function importCategoryBudgets(
  txn: SQLiteDatabase,
  budgets: CategoryBudget[],
  categoryIdMap: Map<string, string>,
) {
  let imported = 0;

  for (const budget of budgets) {
    const categoryId = categoryIdMap.get(budget.categoryId);

    if (!categoryId) {
      continue;
    }

    const sameId = await txn.getFirstAsync<CategoryBudgetRow>(
      'SELECT * FROM category_budgets WHERE id = ? LIMIT 1',
      budget.id,
    );
    const sameScope = await txn.getFirstAsync<CategoryBudgetRow>(
      'SELECT * FROM category_budgets WHERE category_id = ? AND month_key = ? LIMIT 1',
      categoryId,
      budget.monthKey,
    );
    const existing = sameId ?? sameScope;

    if (existing && !shouldUpdate(budget.updatedAt, existing.updated_at)) {
      continue;
    }

    await txn.runAsync(
      `
        INSERT INTO category_budgets (
          id, category_id, month_key, limit_amount_minor, currency_code,
          rollover_enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(category_id, month_key) DO UPDATE SET
          limit_amount_minor = excluded.limit_amount_minor,
          currency_code = excluded.currency_code,
          rollover_enabled = excluded.rollover_enabled,
          updated_at = excluded.updated_at
      `,
      existing?.id ?? budget.id,
      categoryId,
      budget.monthKey,
      budget.limitAmountMinor,
      budget.currencyCode,
      budget.rolloverEnabled ? 1 : 0,
      budget.createdAt,
      budget.updatedAt,
    );
    imported += 1;
  }

  return imported;
}

async function importTransactions(
  txn: SQLiteDatabase,
  transactions: Transaction[],
  categoryIdMap: Map<string, string>,
) {
  let imported = 0;

  for (const transaction of transactions) {
    const existing = await txn.getFirstAsync<TransactionRow>(
      'SELECT * FROM transactions WHERE id = ? LIMIT 1',
      transaction.id,
    );

    if (existing && !shouldUpdate(transaction.updatedAt, existing.updated_at)) {
      continue;
    }

    await txn.runAsync(
      `
        INSERT INTO transactions (
          id, type, amount_minor, currency_code, occurred_at, category_id, description,
          payment_method, source_type, source_reference, note, ocr_status,
          ocr_confidence, ocr_raw_text, ocr_attachment_source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          amount_minor = excluded.amount_minor,
          currency_code = excluded.currency_code,
          occurred_at = excluded.occurred_at,
          category_id = excluded.category_id,
          description = excluded.description,
          payment_method = excluded.payment_method,
          source_type = excluded.source_type,
          source_reference = excluded.source_reference,
          note = excluded.note,
          ocr_status = excluded.ocr_status,
          ocr_confidence = excluded.ocr_confidence,
          ocr_raw_text = excluded.ocr_raw_text,
          ocr_attachment_source = excluded.ocr_attachment_source,
          updated_at = excluded.updated_at
      `,
      transaction.id,
      transaction.type,
      transaction.amountMinor,
      transaction.currencyCode ?? DEFAULT_CURRENCY_CODE,
      transaction.occurredAt,
      transaction.categoryId
        ? (categoryIdMap.get(transaction.categoryId) ?? null)
        : null,
      transaction.description,
      transaction.paymentMethod,
      transaction.sourceType,
      transaction.sourceReference,
      transaction.note,
      transaction.ocrStatus,
      transaction.ocrConfidence,
      transaction.ocrRawText,
      transaction.ocrAttachmentSource,
      transaction.createdAt,
      transaction.updatedAt,
    );
    imported += 1;
  }

  return imported;
}

async function importAttachments(
  txn: SQLiteDatabase,
  attachments: BackupAttachment[],
  copiedFiles: Map<string, string>,
) {
  let imported = 0;

  for (const attachment of attachments) {
    const fileUri = copiedFiles.get(attachment.id);

    if (!fileUri) {
      continue;
    }

    const existing = await txn.getFirstAsync<AttachmentRow>(
      'SELECT * FROM attachments WHERE id = ? LIMIT 1',
      attachment.id,
    );

    if (existing && !shouldUpdate(attachment.updatedAt, existing.updated_at)) {
      continue;
    }

    await txn.runAsync(
      `
        INSERT INTO attachments (
          id, transaction_id, kind, storage_type, file_uri, file_name, mime_type,
          file_size_bytes, source_type, source_reference, ocr_status, ocr_confidence,
          ocr_raw_text, created_at, updated_at
        ) VALUES (?, ?, ?, 'local_file', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          transaction_id = excluded.transaction_id,
          kind = excluded.kind,
          file_uri = excluded.file_uri,
          file_name = excluded.file_name,
          mime_type = excluded.mime_type,
          file_size_bytes = excluded.file_size_bytes,
          source_type = excluded.source_type,
          source_reference = excluded.source_reference,
          ocr_status = excluded.ocr_status,
          ocr_confidence = excluded.ocr_confidence,
          ocr_raw_text = excluded.ocr_raw_text,
          updated_at = excluded.updated_at
      `,
      attachment.id,
      attachment.transactionId,
      attachment.kind,
      fileUri,
      attachment.originalFileName ?? attachment.fileName,
      attachment.mimeType,
      attachment.fileSizeBytes,
      attachment.sourceType,
      attachment.sourceReference,
      attachment.ocrStatus,
      attachment.ocrConfidence,
      attachment.ocrRawText,
      attachment.createdAt,
      attachment.updatedAt,
    );
    imported += 1;
  }

  return imported;
}

async function copyAttachmentFiles(
  entries: Record<string, Uint8Array>,
  attachments: BackupAttachment[],
  warnings: string[],
) {
  const attachmentsDirectory = new Directory(Paths.document, 'attachments');
  await attachmentsDirectory.create({ idempotent: true, intermediates: true });

  const copiedFiles = new Map<string, string>();
  const copiedForRollback: File[] = [];

  for (const attachment of attachments) {
    const bytes = entries[attachment.backupPath];

    if (!bytes) {
      warnings.push(`Pominięto załącznik ${attachment.id}: brak pliku w ZIP.`);
      continue;
    }

    const targetName = `${attachment.id}_${sanitizeFileName(attachment.originalFileName ?? attachment.fileName)}`;
    const targetFile = new File(attachmentsDirectory, targetName);
    targetFile.create({ intermediates: true, overwrite: true });
    targetFile.write(bytes);
    copiedFiles.set(attachment.id, targetFile.uri);
    copiedForRollback.push(targetFile);
  }

  return { copiedFiles, copiedForRollback };
}

async function assertPreparedBackupExists(fileUri: string) {
  const file = new File(fileUri);

  if (!file.exists) {
    throw new Error('Nie znaleziono przygotowanego pliku backupu.');
  }

  return file;
}

export function createBackupRepository(
  context: DatabaseContext,
): BackupRepository {
  return {
    async exportBackup() {
      const db = await context.getDb();
      const data = await readBackupData(db);
      const manifest: BackupManifest = {
        appId: BACKUP_APP_ID,
        backupSchemaVersion: BACKUP_SCHEMA_VERSION,
        cloud: {
          provider: null,
          remoteId: null,
        },
        counts: buildCounts(data),
        createdAt: toIsoTimestamp(),
        databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
        encryption: {
          algorithm: 'none',
          keyDerivation: null,
        },
      };
      const zip = await buildZip(data, manifest);
      const fileName = formatBackupFileName();
      const file = new File(Paths.cache, fileName);
      file.create({ intermediates: true, overwrite: true });
      file.write(zip);

      return {
        counts: manifest.counts,
        fileName,
        fileUri: file.uri,
      };
    },

    async saveBackupToFiles(
      target: BackupFileTarget,
    ): Promise<BackupSaveResult> {
      const sourceFile = await assertPreparedBackupExists(target.fileUri);
      const directory = await Directory.pickDirectoryAsync();
      const targetFile = directory.createFile(
        target.fileName,
        'application/zip',
      );
      targetFile.write(await sourceFile.bytes());

      return {
        fileName: target.fileName,
        fileUri: targetFile.uri,
        saved: true,
      };
    },

    async shareBackup(target: BackupFileTarget) {
      const sourceFile = await assertPreparedBackupExists(target.fileUri);
      const sharingAvailable = await Sharing.isAvailableAsync();

      if (!sharingAvailable) {
        throw new Error(
          'Udostępnianie plików nie jest dostępne na tym urządzeniu.',
        );
      }

      await Sharing.shareAsync(sourceFile.uri, {
        dialogTitle: 'Udostępnij kopię danych Zenifi',
        mimeType: 'application/zip',
        UTI: 'com.pkware.zip-archive',
      });

      return { shared: true };
    },

    async importBackup(): Promise<BackupImportResult | null> {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: ['application/zip', 'application/x-zip-compressed'],
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      const sourceFile = new File(result.assets[0].uri);
      const entries = unzipSync(await sourceFile.bytes());

      for (const path of Object.keys(entries)) {
        assertSafeZipPath(path);
      }

      const manifest = readJson<BackupManifest>(entries, 'manifest.json');
      const data = readJson<BackupData>(entries, 'data.json');
      validateBackup(manifest, data);

      const warnings: string[] = [];
      const { copiedFiles, copiedForRollback } = await copyAttachmentFiles(
        entries,
        data.attachments,
        warnings,
      );
      const db = await context.getDb();

      try {
        let counts: BackupSummaryCounts = {
          attachments: 0,
          categoryBudgets: 0,
          categories: 0,
          monthlyBudgets: 0,
          transactions: 0,
        };

        await db.withExclusiveTransactionAsync(async (txn) => {
          const categoryImport = await importCategories(
            txn,
            data.categories,
            warnings,
          );
          const monthlyBudgets = await importMonthlyBudgets(
            txn,
            data.monthlyBudgets,
          );
          const categoryBudgets = await importCategoryBudgets(
            txn,
            data.categoryBudgets,
            categoryImport.categoryIdMap,
          );
          const transactions = await importTransactions(
            txn,
            data.transactions,
            categoryImport.categoryIdMap,
          );
          const attachments = await importAttachments(
            txn,
            data.attachments,
            copiedFiles,
          );

          counts = {
            attachments,
            categoryBudgets,
            categories: categoryImport.imported,
            monthlyBudgets,
            transactions,
          };
        });

        return {
          counts,
          warnings,
        };
      } catch (error) {
        for (const file of copiedForRollback) {
          if (file.exists) {
            file.delete();
          }
        }

        throw error;
      }
    },
  };
}
