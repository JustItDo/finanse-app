import type { PaymentMethod, Transaction, TransactionType } from '@/src/domain/finance';
import { DEFAULT_CURRENCY_CODE } from '@/src/storage/sqlite/constants';
import type { DatabaseContext } from '@/src/storage/sqlite/database';
import { createEntityId } from '@/src/shared/utils/id';
import { toIsoTimestamp } from '@/src/shared/utils/date';

export type CreateTransactionInput = {
  type: TransactionType;
  amountMinor: number;
  currencyCode?: string;
  occurredAt: string;
  categoryId?: string | null;
  description?: string | null;
  paymentMethod?: PaymentMethod;
  sourceType?: Transaction['sourceType'];
  sourceReference?: string | null;
  note?: string | null;
  ocrStatus?: Transaction['ocrStatus'];
  ocrConfidence?: number | null;
  ocrRawText?: string | null;
  ocrAttachmentSource?: string | null;
};

export type TransactionListItem = {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currencyCode: string;
  occurredAt: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  paymentMethod: PaymentMethod;
  sourceType: Transaction['sourceType'];
};

export type TransactionDetail = TransactionListItem & {
  note: string | null;
  sourceReference: string | null;
  ocrStatus: Transaction['ocrStatus'];
  ocrConfidence: number | null;
  ocrRawText: string | null;
  ocrAttachmentSource: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransactionHistoryFilters = {
  monthKey?: string | null;
  type?: TransactionType | 'all';
  categoryId?: string | null;
  searchText?: string;
};

export type UpdateTransactionInput = {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currencyCode?: string;
  occurredAt: string;
  categoryId?: string | null;
  description?: string | null;
  paymentMethod?: PaymentMethod;
  note?: string | null;
};

export type CategoryTransactionTotal = {
  categoryId: string | null;
  totalMinor: number;
};

export type DailyTransactionTotal = {
  occurredOn: string;
  totalMinor: number;
};

type TransactionRow = {
  id: string;
  type: TransactionType;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
  category_id: string | null;
  description: string | null;
  payment_method: PaymentMethod;
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

type TransactionListRow = TransactionRow & {
  category_name: string | null;
};

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

function mapTransactionListItem(row: TransactionListRow): TransactionListItem {
  return {
    amountMinor: row.amount_minor,
    categoryId: row.category_id,
    categoryName: row.category_name,
    currencyCode: row.currency_code,
    description: row.description,
    id: row.id,
    occurredAt: row.occurred_at,
    paymentMethod: row.payment_method,
    sourceType: row.source_type,
    type: row.type,
  };
}

function mapTransactionDetail(row: TransactionListRow): TransactionDetail {
  return {
    ...mapTransactionListItem(row),
    createdAt: row.created_at,
    note: row.note,
    ocrAttachmentSource: row.ocr_attachment_source,
    ocrConfidence: row.ocr_confidence,
    ocrRawText: row.ocr_raw_text,
    ocrStatus: row.ocr_status,
    sourceReference: row.source_reference,
    updatedAt: row.updated_at,
  };
}

export function createTransactionsRepository(context: DatabaseContext) {
  return {
    async count() {
      const db = await context.getDb();
      const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM transactions');

      return row?.total ?? 0;
    },

    async create(input: CreateTransactionInput) {
      const db = await context.getDb();
      const id = createEntityId('transaction');
      const now = toIsoTimestamp();

      await db.runAsync(
        `
          INSERT INTO transactions (
            id, type, amount_minor, currency_code, occurred_at, category_id, description,
            payment_method, source_type, source_reference, note, ocr_status,
            ocr_confidence, ocr_raw_text, ocr_attachment_source, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        id,
        input.type,
        input.amountMinor,
        input.currencyCode ?? DEFAULT_CURRENCY_CODE,
        input.occurredAt,
        input.categoryId ?? null,
        input.description ?? null,
        input.paymentMethod ?? 'other',
        input.sourceType ?? 'manual',
        input.sourceReference ?? null,
        input.note ?? null,
        input.ocrStatus ?? 'not_requested',
        input.ocrConfidence ?? null,
        input.ocrRawText ?? null,
        input.ocrAttachmentSource ?? null,
        now,
        now,
      );

      const created = await db.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ?', id);

      if (!created) {
        throw new Error('Nie udało się odczytać zapisanej transakcji.');
      }

      return mapTransaction(created);
    },

    async listRecent(limit = 20) {
      const db = await context.getDb();
      const rows = await db.getAllAsync<TransactionListRow>(
        `
          SELECT
            transactions.*,
            categories.name AS category_name
          FROM transactions
          LEFT JOIN categories ON categories.id = transactions.category_id
          ORDER BY transactions.occurred_at DESC, transactions.created_at DESC
          LIMIT ?
        `,
        limit,
      );

      return rows.map(mapTransactionListItem);
    },

    async listHistory(filters: TransactionHistoryFilters = {}) {
      const db = await context.getDb();
      const params: (string | number | null)[] = [];
      const conditions: string[] = [];

      if (filters.monthKey) {
        conditions.push('substr(transactions.occurred_at, 1, 7) = ?');
        params.push(filters.monthKey);
      }

      if (filters.type && filters.type !== 'all') {
        conditions.push('transactions.type = ?');
        params.push(filters.type);
      }

      if (filters.categoryId) {
        conditions.push('transactions.category_id = ?');
        params.push(filters.categoryId);
      }

      const trimmedSearch = filters.searchText?.trim();

      if (trimmedSearch) {
        conditions.push(
          `(
            LOWER(COALESCE(transactions.description, '')) LIKE ?
            OR LOWER(COALESCE(categories.name, '')) LIKE ?
            OR LOWER(COALESCE(transactions.note, '')) LIKE ?
          )`,
        );
        const searchValue = `%${trimmedSearch.toLocaleLowerCase('pl-PL')}%`;
        params.push(searchValue, searchValue, searchValue);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await db.getAllAsync<TransactionListRow>(
        `
          SELECT
            transactions.*,
            categories.name AS category_name
          FROM transactions
          LEFT JOIN categories ON categories.id = transactions.category_id
          ${whereClause}
          ORDER BY transactions.occurred_at DESC, transactions.created_at DESC
        `,
        ...params,
      );

      return rows.map(mapTransactionListItem);
    },

    async listMonthsWithTransactions() {
      const db = await context.getDb();
      const rows = await db.getAllAsync<{ month_key: string }>(
        `
          SELECT DISTINCT substr(occurred_at, 1, 7) AS month_key
          FROM transactions
          ORDER BY month_key DESC
        `,
      );

      return rows.map((row) => row.month_key);
    },

    async getById(id: string) {
      const db = await context.getDb();
      const row = await db.getFirstAsync<TransactionListRow>(
        `
          SELECT
            transactions.*,
            categories.name AS category_name
          FROM transactions
          LEFT JOIN categories ON categories.id = transactions.category_id
          WHERE transactions.id = ?
          LIMIT 1
        `,
        id,
      );

      return row ? mapTransactionDetail(row) : null;
    },

    async update(input: UpdateTransactionInput) {
      const db = await context.getDb();
      const now = toIsoTimestamp();

      await db.runAsync(
        `
          UPDATE transactions
          SET
            type = ?,
            amount_minor = ?,
            currency_code = ?,
            occurred_at = ?,
            category_id = ?,
            description = ?,
            payment_method = ?,
            note = ?,
            updated_at = ?
          WHERE id = ?
        `,
        input.type,
        input.amountMinor,
        input.currencyCode ?? DEFAULT_CURRENCY_CODE,
        input.occurredAt,
        input.categoryId ?? null,
        input.description ?? null,
        input.paymentMethod ?? 'other',
        input.note ?? null,
        now,
        input.id,
      );

      const updated = await db.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ?', input.id);

      if (!updated) {
        throw new Error('Nie udało się zaktualizować transakcji.');
      }

      return mapTransaction(updated);
    },

    async remove(id: string) {
      const db = await context.getDb();

      await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
      await db.runAsync(
        'UPDATE attachments SET transaction_id = NULL, updated_at = ? WHERE transaction_id = ?',
        toIsoTimestamp(),
        id,
      );
    },

    async getMonthSummary(monthKey: string) {
      const db = await context.getDb();
      const [income, expense, count] = await Promise.all([
        db.getFirstAsync<{ total: number }>(
          `
            SELECT COALESCE(SUM(amount_minor), 0) AS total
            FROM transactions
            WHERE type = 'income' AND substr(occurred_at, 1, 7) = ?
          `,
          monthKey,
        ),
        db.getFirstAsync<{ total: number }>(
          `
            SELECT COALESCE(SUM(amount_minor), 0) AS total
            FROM transactions
            WHERE type = 'expense' AND substr(occurred_at, 1, 7) = ?
          `,
          monthKey,
        ),
        db.getFirstAsync<{ total: number }>(
          'SELECT COUNT(*) AS total FROM transactions WHERE substr(occurred_at, 1, 7) = ?',
          monthKey,
        ),
      ]);

      const incomeMinor = income?.total ?? 0;
      const expenseMinor = expense?.total ?? 0;

      return {
        balanceMinor: incomeMinor - expenseMinor,
        expenseMinor,
        incomeMinor,
        transactionsCount: count?.total ?? 0,
      };
    },

    async getTotalsByCategory(monthKey: string, type: TransactionType) {
      const db = await context.getDb();
      const rows = await db.getAllAsync<{ category_id: string | null; total_minor: number }>(
        `
          SELECT
            category_id,
            COALESCE(SUM(amount_minor), 0) AS total_minor
          FROM transactions
          WHERE type = ? AND substr(occurred_at, 1, 7) = ?
          GROUP BY category_id
        `,
        type,
        monthKey,
      );

      return rows.map((row) => ({
        categoryId: row.category_id,
        totalMinor: row.total_minor,
      }));
    },

    async getDailyTotals(monthKey: string, type: TransactionType) {
      const db = await context.getDb();
      const rows = await db.getAllAsync<{ occurred_on: string; total_minor: number }>(
        `
          SELECT
            substr(occurred_at, 1, 10) AS occurred_on,
            COALESCE(SUM(amount_minor), 0) AS total_minor
          FROM transactions
          WHERE type = ? AND substr(occurred_at, 1, 7) = ?
          GROUP BY occurred_on
          ORDER BY occurred_on ASC
        `,
        type,
        monthKey,
      );

      return rows.map((row) => ({
        occurredOn: row.occurred_on,
        totalMinor: row.total_minor,
      }));
    },
  };
}
