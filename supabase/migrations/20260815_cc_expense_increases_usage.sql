-- Credit card balances store usage owed (≥ 0).
-- Purchases (expense) must increase usage; refunds (income) decrease it.
-- Bank/cash accounts keep normal: expense ↓, income ↑.

CREATE OR REPLACE FUNCTION public._apply_tx_balance_delta(tx public.transactions, direction INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  income_type   TEXT := 't0000000-0000-0000-0000-000000000001';
  expense_type  TEXT := 't0000000-0000-0000-0000-000000000002';
  transfer_type TEXT := 't0000000-0000-0000-0000-000000000003';
  amt NUMERIC := tx.amount * direction;
  acc_type TEXT;
BEGIN
  IF tx.account_id IS NULL THEN
    RETURN;
  END IF;

  SELECT account_type INTO acc_type FROM accounts WHERE id = tx.account_id;

  IF tx.transaction_type_id = income_type THEN
    IF acc_type = 'Credit Card' THEN
      UPDATE accounts SET balance = GREATEST(0, balance - amt), updated_at = now() WHERE id = tx.account_id;
    ELSE
      UPDATE accounts SET balance = balance + amt, updated_at = now() WHERE id = tx.account_id;
    END IF;

  ELSIF tx.transaction_type_id = expense_type THEN
    IF acc_type = 'Credit Card' THEN
      UPDATE accounts SET balance = balance + amt, updated_at = now() WHERE id = tx.account_id;
    ELSE
      UPDATE accounts SET balance = balance - amt, updated_at = now() WHERE id = tx.account_id;
    END IF;

  ELSIF tx.transaction_type_id = transfer_type THEN
    IF tx.transfer_to_account_id IS NULL THEN
      UPDATE accounts SET balance = balance + amt, updated_at = now() WHERE id = tx.account_id;
      IF acc_type = 'Credit Card' THEN
        UPDATE accounts SET balance = GREATEST(0, balance), updated_at = now() WHERE id = tx.account_id;
      END IF;
    ELSE
      UPDATE accounts SET balance = balance - amt, updated_at = now() WHERE id = tx.account_id;
      UPDATE accounts SET balance = balance + amt, updated_at = now() WHERE id = tx.transfer_to_account_id;
    END IF;
  END IF;
END;
$function$;
