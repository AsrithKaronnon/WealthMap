/**
 * accountUtils.ts
 *
 * Display helpers for account balances (Option B).
 *
 * Live balances live in `accounts.balance` and are maintained by the DB trigger
 * `update_account_balance_on_transaction` (see supabase/migrations/20260815_balance_triggers.sql).
 *
 *   income  → balance + amount
 *   expense → balance - amount
 *   transfer with destination → source -, destination +
 *   transfer without destination (adjustment) → balance + amount (use negative to subtract)
 *
 * Credit cards store usage (amount owed) as a non-negative `balance`.
 * Purchases (expense) increase usage; payoffs use a negative transfer adjustment
 * (and funding expense on the bank account). `computed_balance` mirrors `balance`.
 */

export interface AccountWithBalance {
  id: string;
  name: string;
  opening_balance: number;
  computed_balance: number;
  [key: string]: any;
}

/**
 * Enrich accounts with computed_balance for display.
 * Under Option B this is the trigger-maintained `accounts.balance`.
 */
export function computeAccountBalances(
  accounts: any[],
  _transactions?: any[]
): AccountWithBalance[] {
  return accounts.map(account => {
    const bal = parseFloat(account.balance ?? 0);
    const isCC = account.account_type === 'Credit Card';
    const usageOrBalance = isCC ? Math.abs(bal) : bal;
    return {
      ...account,
      opening_balance: usageOrBalance,
      computed_balance: usageOrBalance,
    };
  });
}

/**
 * Returns total liquid balance across all accounts (sum of computed_balance).
 */
export function totalLiquidBalance(accountsWithBalance: AccountWithBalance[]): number {
  return accountsWithBalance
    .filter(a => a.account_type !== 'Credit Card')
    .reduce((sum, a) => sum + a.computed_balance, 0);
}
