import type { CategoryTransactionType } from '@/src/domain/finance';

export const seedCategories: {
  id: string;
  name: string;
  transactionType: CategoryTransactionType;
  icon: string;
  color: string;
  sortOrder: number;
}[] = [
  {
    id: 'category_salary',
    name: 'Wynagrodzenie',
    transactionType: 'income',
    icon: 'money-bill-wave',
    color: '#1E6F5C',
    sortOrder: 10,
  },
  {
    id: 'category_other_income',
    name: 'Inne przychody',
    transactionType: 'income',
    icon: 'coins',
    color: '#2B8A3E',
    sortOrder: 20,
  },
  {
    id: 'category_groceries',
    name: 'Jedzenie',
    transactionType: 'expense',
    icon: 'shopping-basket',
    color: '#D97706',
    sortOrder: 100,
  },
  {
    id: 'category_transport',
    name: 'Transport',
    transactionType: 'expense',
    icon: 'bus',
    color: '#2563EB',
    sortOrder: 110,
  },
  {
    id: 'category_housing',
    name: 'Mieszkanie',
    transactionType: 'expense',
    icon: 'home',
    color: '#7C3AED',
    sortOrder: 120,
  },
  {
    id: 'category_health',
    name: 'Zdrowie',
    transactionType: 'expense',
    icon: 'heartbeat',
    color: '#DC2626',
    sortOrder: 130,
  },
  {
    id: 'category_entertainment',
    name: 'Rozrywka',
    transactionType: 'expense',
    icon: 'film',
    color: '#DB2777',
    sortOrder: 140,
  },
  {
    id: 'category_other_expense',
    name: 'Inne wydatki',
    transactionType: 'expense',
    icon: 'receipt',
    color: '#6B7280',
    sortOrder: 150,
  },
];

export const seedCategoryBudgets = [
  { id: 'budget_groceries', categoryId: 'category_groceries', limitAmountMinor: 120000 },
  { id: 'budget_transport', categoryId: 'category_transport', limitAmountMinor: 40000 },
  { id: 'budget_housing', categoryId: 'category_housing', limitAmountMinor: 220000 },
  { id: 'budget_health', categoryId: 'category_health', limitAmountMinor: 25000 },
  { id: 'budget_entertainment', categoryId: 'category_entertainment', limitAmountMinor: 35000 },
  { id: 'budget_other_expense', categoryId: 'category_other_expense', limitAmountMinor: 30000 },
];

export const seedMonthlyBudget = {
  id: (monthKey: string) => `monthly_budget_${monthKey}`,
  notes: 'Seed startowy pod MVP',
  startingBalanceMinor: 0,
  targetSavingsMinor: 100000,
  totalBudgetMinor: 470000,
};
