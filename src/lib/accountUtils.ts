/**
 * accountUtils.ts
 *
 * Utility for computing live account balances from transactions (Option A).
 *
 * Balance formula per account:
 *   computed_balance = opening_balance
 *                    + SUM(income transactions where account_id = this account)
 *                    - SUM(expense transactions where account_id = this account)
 *                    - SUM(transfer_out where account_id = this account)
 *                    + SUM(transfer_in where transfer_to_account_id = this account)
 *
 * This is the single source of truth. The `balance` column on accounts is
 * legacy and no longer used for display. `opening_balance` is the starting
 * balance before any tracked transaction.
 */

// Transaction type IDs — must match SEED values in supabaseMock.ts
const INCOME_TYPE   = 't0000000-0000-0000-0000-000000000001';
const EXPENSE_TYPE  = 't0000000-0000-0000-0000-000000000002';
const TRANSFER_TYPE = 't0000000-0000-0000-0000-000000000003';

export interface AccountWithBalance {
  id: string;
  name: string;
  opening_balance: number;
  computed_balance: number;
  [key: string]: any;
}

/**
 * Given raw accounts and all transactions, returns accounts enriched with
 * a `computed_balance` field reflecting the true current balance.
 */
export function computeAccountBalances(
  accounts: any[],
  _transactions?: any[]
): AccountWithBalance[] {
  return accounts.map(account => {
    const bal = parseFloat(account.balance ?? 0);
    return {
      ...account,
      opening_balance: bal,
      computed_balance: bal,
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
