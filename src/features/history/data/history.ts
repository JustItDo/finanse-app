import {
  getEntrySourceMeta,
  type Attachment,
  type Category,
  type PaymentMethod,
  type TransactionType,
} from '@/src/domain/finance';
import type { AppRepositories } from '@/src/storage';
import {
  formatMonthKeyLabel,
  getCurrentMonthKey,
  getMonthKeyFromDateInput,
  isValidDateInput,
} from '@/src/shared/utils/date';
import { parseMoneyToMinorUnits } from '@/src/shared/utils/money';

export type HistoryFilterValues = {
  type: TransactionType | 'all';
  monthKey: string;
  categoryId: string;
  searchText: string;
};

const ALL_MONTHS_VALUE = '';

type HistorySourceMeta = ReturnType<typeof getEntrySourceMeta>;

type BaseHistoryTransaction = {
  sourceMeta: HistorySourceMeta;
};

export type HistoryTransactionItem = Awaited<
  ReturnType<AppRepositories['transactions']['listHistory']>
>[number] &
  BaseHistoryTransaction;

export type HistoryTransactionDetail = NonNullable<
  Awaited<ReturnType<AppRepositories['transactions']['getById']>>
> &
  BaseHistoryTransaction & {
    attachments: Attachment[];
  };

export type HistoryMonthOption = {
  value: string;
  label: string;
};

export type HistoryScreenState = {
  filters: HistoryFilterValues;
  monthOptions: HistoryMonthOption[];
  categoryOptions: Category[];
  transactions: HistoryTransactionItem[];
  totalCount: number;
  isCompletelyEmpty: boolean;
  isFilteredEmpty: boolean;
};

export type EditableTransactionValues = {
  type: TransactionType;
  amountText: string;
  categoryId: string;
  date: string;
  description: string;
  paymentMethod: PaymentMethod;
  note: string;
};

export type HistoryEditContext = {
  currencyCode: string;
  categoriesByType: Record<TransactionType, Category[]>;
  values: EditableTransactionValues;
};

export type HistoryValidationResult = {
  amountMinor: number | null;
  errors: Partial<Record<keyof EditableTransactionValues, string>>;
};

export async function loadHistoryScreenState(
  repositories: AppRepositories,
  filters: Partial<HistoryFilterValues>,
): Promise<HistoryScreenState> {
  const [months, categories, totalTransactionsCount] = await Promise.all([
    repositories.transactions.listMonthsWithTransactions(),
    repositories.categories.listAll(),
    repositories.transactions.count(),
  ]);

  const fallbackMonthKey = months[0] ?? getCurrentMonthKey();
  const resolvedFilters: HistoryFilterValues = {
    categoryId: filters.categoryId ?? '',
    monthKey:
      filters.monthKey !== undefined ? filters.monthKey : fallbackMonthKey,
    searchText: filters.searchText ?? '',
    type: filters.type ?? 'all',
  };

  const categoryOptions = categories.filter((category) => {
    if (category.isArchived) {
      return false;
    }

    if (resolvedFilters.type === 'all') {
      return true;
    }

    return (
      category.transactionType === resolvedFilters.type ||
      category.transactionType === 'both'
    );
  });

  const effectiveCategoryId = categoryOptions.some(
    (category) => category.id === resolvedFilters.categoryId,
  )
    ? resolvedFilters.categoryId
    : '';

  const transactions = await repositories.transactions.listHistory({
    categoryId: effectiveCategoryId || null,
    monthKey: resolvedFilters.monthKey || null,
    searchText: resolvedFilters.searchText,
    type: resolvedFilters.type,
  });

  return {
    categoryOptions,
    filters: {
      ...resolvedFilters,
      categoryId: effectiveCategoryId,
    },
    isCompletelyEmpty: totalTransactionsCount === 0,
    isFilteredEmpty: totalTransactionsCount > 0 && transactions.length === 0,
    monthOptions: buildMonthOptions(months, fallbackMonthKey),
    totalCount: transactions.length,
    transactions: transactions.map(attachSourceMeta),
  };
}

export async function loadHistoryDetail(
  repositories: AppRepositories,
  transactionId: string,
): Promise<HistoryTransactionDetail> {
  const [transaction, attachments] = await Promise.all([
    repositories.transactions.getById(transactionId),
    repositories.attachments.listByTransactionId(transactionId),
  ]);

  if (!transaction) {
    throw new Error('Nie znaleziono wybranej transakcji.');
  }

  return {
    ...attachSourceMeta(transaction),
    attachments,
  };
}

export async function loadHistoryEditContext(
  repositories: AppRepositories,
  transactionId: string,
): Promise<HistoryEditContext> {
  const [transaction, expenseCategories, incomeCategories] = await Promise.all([
    loadHistoryDetail(repositories, transactionId),
    repositories.categories.listByTransactionType('expense'),
    repositories.categories.listByTransactionType('income'),
  ]);

  return {
    categoriesByType: {
      expense: expenseCategories,
      income: incomeCategories,
    },
    currencyCode: transaction.currencyCode,
    values: {
      amountText: formatMinorToInput(transaction.amountMinor),
      categoryId: transaction.categoryId ?? '',
      date: transaction.occurredAt.slice(0, 10),
      description: transaction.description ?? '',
      note: transaction.note ?? '',
      paymentMethod: transaction.paymentMethod,
      type: transaction.type,
    },
  };
}

export function validateEditableTransaction(
  values: EditableTransactionValues,
  categoriesByType: Record<TransactionType, Category[]>,
): HistoryValidationResult {
  const errors: HistoryValidationResult['errors'] = {};
  const amountMinor = parseMoneyToMinorUnits(values.amountText);

  if (amountMinor === null || amountMinor <= 0) {
    errors.amountText = 'Podaj poprawną kwotę większą od zera.';
  }

  if (!values.categoryId) {
    errors.categoryId =
      values.type === 'income'
        ? 'Wybierz kategorię przychodu.'
        : 'Wybierz kategorię wydatku.';
  } else {
    const availableCategories = categoriesByType[values.type];
    const exists = availableCategories.some(
      (category) => category.id === values.categoryId,
    );

    if (!exists) {
      errors.categoryId = 'Wybierz kategorię zgodną z typem transakcji.';
    }
  }

  if (!isValidDateInput(values.date)) {
    errors.date = 'Podaj poprawną datę w formacie RRRR-MM-DD.';
  }

  return {
    amountMinor,
    errors,
  };
}

export async function updateTransactionFromHistory(
  repositories: AppRepositories,
  transactionId: string,
  values: EditableTransactionValues,
  context: HistoryEditContext,
) {
  const validation = validateEditableTransaction(
    values,
    context.categoriesByType,
  );

  if (
    validation.amountMinor === null ||
    Object.keys(validation.errors).length > 0
  ) {
    throw new Error(
      'Nie można zapisać zmian bez poprawnych danych formularza.',
    );
  }

  await repositories.transactions.update({
    amountMinor: validation.amountMinor,
    categoryId: values.categoryId,
    currencyCode: context.currencyCode,
    description: values.description.trim() || null,
    id: transactionId,
    note: values.note.trim() || null,
    occurredAt: `${values.date}T12:00:00.000Z`,
    paymentMethod: values.paymentMethod,
    type: values.type,
  });

  return {
    monthKey: getMonthKeyFromDateInput(values.date),
  };
}

export async function removeTransactionFromHistory(
  repositories: AppRepositories,
  transactionId: string,
) {
  await repositories.transactions.remove(transactionId);
}

export function buildNextHistoryFilters(
  current: HistoryFilterValues,
  patch: Partial<HistoryFilterValues>,
): HistoryFilterValues {
  const nextType = patch.type ?? current.type;
  const typeChanged = patch.type !== undefined && patch.type !== current.type;

  return {
    categoryId: typeChanged ? '' : (patch.categoryId ?? current.categoryId),
    monthKey: patch.monthKey ?? current.monthKey,
    searchText: patch.searchText ?? current.searchText,
    type: nextType,
  };
}

function buildMonthOptions(
  months: string[],
  fallbackMonthKey: string,
): HistoryMonthOption[] {
  const values = months.length > 0 ? months : [fallbackMonthKey];

  return [
    { label: 'Wszystkie miesiące', value: ALL_MONTHS_VALUE },
    ...values.map((monthKey) => ({
      label: formatMonthKeyLabel(monthKey),
      value: monthKey,
    })),
  ];
}

function formatMinorToInput(amountMinor: number) {
  return (amountMinor / 100).toFixed(2).replace('.', ',');
}

function attachSourceMeta<
  T extends { sourceType: Parameters<typeof getEntrySourceMeta>[0] },
>(transaction: T) {
  return {
    ...transaction,
    sourceMeta: getEntrySourceMeta(transaction.sourceType),
  };
}
