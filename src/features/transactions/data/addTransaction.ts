import type { Category, PaymentMethod, TransactionType } from '@/src/domain/finance';
import { loadBudgetSetup, type BudgetCategoryItem } from '@/src/features/budgets/data/budgetSetup';
import type { AppRepositories } from '@/src/storage';
import { DEFAULT_CURRENCY_CODE } from '@/src/storage/sqlite/constants';
import { getMonthKeyFromDateInput, getTodayDateInput, isValidDateInput } from '@/src/shared/utils/date';
import { parseMoneyToMinorUnits } from '@/src/shared/utils/money';

export type TransactionFormValues = {
  type: TransactionType;
  amountText: string;
  categoryId: string;
  date: string;
  description: string;
  paymentMethod: PaymentMethod;
};

export type TransactionFormContext = {
  currencyCode: string;
  categoriesByType: Record<TransactionType, Category[]>;
  defaultPaymentMethodByType: Record<TransactionType, PaymentMethod>;
  defaultValues: TransactionFormValues;
};

export type TransactionSaveImpact = {
  transactionType: TransactionType;
  categoryName: string;
  monthKey: string;
  amountMinor: number;
  monthIncomeBeforeMinor: number;
  monthIncomeAfterMinor: number;
  monthExpenseBeforeMinor: number;
  monthExpenseAfterMinor: number;
  monthBalanceBeforeMinor: number;
  monthBalanceAfterMinor: number;
  categorySpentBeforeMinor: number | null;
  categorySpentAfterMinor: number | null;
  categoryRemainingBeforeMinor: number | null;
  categoryRemainingAfterMinor: number | null;
};

export type TransactionValidationResult = {
  amountMinor: number | null;
  errors: Partial<Record<keyof TransactionFormValues, string>>;
};

export async function loadTransactionFormContext(
  repositories: AppRepositories,
  _monthKey: string,
): Promise<TransactionFormContext> {
  const [expenseCategories, incomeCategories, recent] = await Promise.all([
    repositories.categories.listByTransactionType('expense'),
    repositories.categories.listByTransactionType('income'),
    repositories.transactions.listRecent(20),
  ]);

  const lastExpense = recent.find((item) => item.type === 'expense');
  const lastIncome = recent.find((item) => item.type === 'income');

  return {
    categoriesByType: {
      expense: expenseCategories,
      income: incomeCategories,
    },
    currencyCode: DEFAULT_CURRENCY_CODE,
    defaultPaymentMethodByType: {
      expense: lastExpense?.paymentMethod ?? 'card',
      income: lastIncome?.paymentMethod ?? 'bank_transfer',
    },
    defaultValues: {
      type: 'expense',
      amountText: '',
      categoryId: '',
      date: getTodayDateInput(),
      description: '',
      paymentMethod: lastExpense?.paymentMethod ?? 'card',
    },
  };
}

export function validateTransactionForm(values: TransactionFormValues): TransactionValidationResult {
  const errors: TransactionValidationResult['errors'] = {};
  const amountMinor = parseMoneyToMinorUnits(values.amountText);

  if (amountMinor === null || amountMinor <= 0) {
    errors.amountText = 'Podaj poprawną kwotę większą od zera.';
  }

  if (!values.categoryId) {
    errors.categoryId =
      values.type === 'income' ? 'Wybierz kategorię przychodu.' : 'Wybierz kategorię wydatku.';
  }

  if (!isValidDateInput(values.date)) {
    errors.date = 'Podaj poprawną datę w formacie RRRR-MM-DD.';
  }

  return {
    amountMinor,
    errors,
  };
}

export async function saveManualTransaction(
  repositories: AppRepositories,
  values: TransactionFormValues,
  currencyCode: string,
): Promise<TransactionSaveImpact> {
  const validation = validateTransactionForm(values);

  if (validation.amountMinor === null || Object.keys(validation.errors).length > 0) {
    throw new Error('Nie można zapisać transakcji bez poprawnych danych formularza.');
  }

  const monthKey = getMonthKeyFromDateInput(values.date);
  const [beforeSummary, categories, beforeSetup] = await Promise.all([
    repositories.transactions.getMonthSummary(monthKey),
    repositories.categories.listByTransactionType(values.type),
    values.type === 'expense' ? loadBudgetSetup(repositories, monthKey) : Promise.resolve(null),
  ]);

  const category = categories.find((item) => item.id === values.categoryId);

  if (!category) {
    throw new Error('Wybrana kategoria transakcji nie istnieje albo jest nieaktywna.');
  }

  const beforeCategory =
    values.type === 'expense' && beforeSetup
      ? findCategoryBudget(beforeSetup.expenseCategories, values.categoryId)
      : null;

  await repositories.transactions.create({
    amountMinor: validation.amountMinor,
    categoryId: values.categoryId,
    currencyCode,
    description: values.description.trim() || null,
    occurredAt: `${values.date}T12:00:00.000Z`,
    paymentMethod: values.paymentMethod,
    sourceType: 'manual',
    type: values.type,
  });

  const [afterSummary, afterSetup] = await Promise.all([
    repositories.transactions.getMonthSummary(monthKey),
    values.type === 'expense' ? loadBudgetSetup(repositories, monthKey) : Promise.resolve(null),
  ]);

  const afterCategory =
    values.type === 'expense' && afterSetup
      ? findCategoryBudget(afterSetup.expenseCategories, values.categoryId)
      : null;

  return {
    amountMinor: validation.amountMinor,
    categoryName: category.name,
    categoryRemainingAfterMinor: afterCategory?.remainingMinor ?? null,
    categoryRemainingBeforeMinor: beforeCategory?.remainingMinor ?? null,
    categorySpentAfterMinor: afterCategory?.spentMinor ?? null,
    categorySpentBeforeMinor: beforeCategory?.spentMinor ?? null,
    monthBalanceAfterMinor: afterSummary.balanceMinor,
    monthBalanceBeforeMinor: beforeSummary.balanceMinor,
    monthExpenseAfterMinor: afterSummary.expenseMinor,
    monthExpenseBeforeMinor: beforeSummary.expenseMinor,
    monthIncomeAfterMinor: afterSummary.incomeMinor,
    monthIncomeBeforeMinor: beforeSummary.incomeMinor,
    monthKey,
    transactionType: values.type,
  };
}

export function createFormValuesForType(
  current: TransactionFormValues,
  type: TransactionType,
  context: TransactionFormContext,
): TransactionFormValues {
  const categories = context.categoriesByType[type];
  const hasCurrentCategory = categories.some((category) => category.id === current.categoryId);

  return {
    ...current,
    type,
    categoryId: hasCurrentCategory ? current.categoryId : '',
    paymentMethod: context.defaultPaymentMethodByType[type],
  };
}

function findCategoryBudget(items: BudgetCategoryItem[], categoryId: string) {
  return items.find((item) => item.category.id === categoryId) ?? null;
}
