/**
 * Single net-worth formula used by Home, Assets, and (conceptually) networth-cron.
 *
 *   NW = liquid cash
 *      + market investments
 *      + other assets
 *      − credit card usage
 *      − loan outstanding
 *
 * Liquid cash excludes credit cards. CC usage is amount owed (non-negative).
 */
export function computeNetWorth(parts: {
  liquidCash: number;
  investments: number;
  otherAssets: number;
  creditCardUsage?: number;
  loansOutstanding?: number;
}): number {
  const cc = parts.creditCardUsage ?? 0;
  const loans = parts.loansOutstanding ?? 0;
  return (
    (parts.liquidCash || 0) +
    (parts.investments || 0) +
    (parts.otherAssets || 0) -
    cc -
    loans
  );
}
