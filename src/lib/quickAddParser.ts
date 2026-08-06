import { SEED } from './supabaseMock';

export const autoCategorize = (text: string) => {
  const term = text.toLowerCase();
  if (term.includes('tea') || term.includes('coffee') || term.includes('starbucks') || term.includes('food') || term.includes('restaurant')) {
    return SEED.expense_categories.food;
  }
  if (term.includes('fuel') || term.includes('petrol') || term.includes('gas') || term.includes('uber') || term.includes('cab')) {
    return SEED.expense_categories.transport;
  }
  if (term.includes('rent') || term.includes('apartment') || term.includes('housing')) {
    return SEED.expense_categories.housing;
  }
  if (term.includes('wifi') || term.includes('internet') || term.includes('electricity')) {
    return SEED.expense_categories.utilities;
  }
  if (term.includes('netflix') || term.includes('spotify') || term.includes('gym')) {
    return SEED.expense_categories.entertainment;
  }
  return SEED.expense_categories.shopping;
};

export const parseQuickAdd = (val: string) => {
  const parts = val.trim().split(/\s+/);
  let amount = 0;
  let amountIndex = -1;

  for (let i = parts.length - 1; i >= 0; i--) {
    const num = parseFloat(parts[i]);
    if (!isNaN(num)) {
      amount = num;
      amountIndex = i;
      break;
    }
  }

  if (amountIndex === -1 || amount <= 0) {
    return null;
  }

  const merchantParts = parts.slice(0, amountIndex);
  const merchant = merchantParts.join(' ') || 'General Entry';
  const isIncome = merchant.toLowerCase().includes('salary') || merchant.toLowerCase().includes('paycheck') || merchant.toLowerCase().includes('freelance');
  const categoryId = isIncome ? SEED.income_categories.salary : autoCategorize(merchant);

  return { amount, merchant, isIncome, categoryId };
};
