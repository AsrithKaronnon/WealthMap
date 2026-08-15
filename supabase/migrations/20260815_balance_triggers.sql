-- WealthMap: single source of truth for account balances (Option B)
-- IMPORTANT: transaction_type_id is VARCHAR (seed ids like t0000000-...), NOT uuid.

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
BEGIN
  IF tx.account_id IS NULL THEN
    RETURN;
  END IF;

  IF tx.transaction_type_id = income_type THEN
    UPDATE accounts SET balance = balance + amt, updated_at = now() WHERE id = tx.account_id;

  ELSIF tx.transaction_type_id = expense_type THEN
    UPDATE accounts SET balance = balance - amt, updated_at = now() WHERE id = tx.account_id;

  ELSIF tx.transaction_type_id = transfer_type THEN
    IF tx.transfer_to_account_id IS NULL THEN
      UPDATE accounts SET balance = balance + amt, updated_at = now() WHERE id = tx.account_id;
    ELSE
      UPDATE accounts SET balance = balance - amt, updated_at = now() WHERE id = tx.account_id;
      UPDATE accounts SET balance = balance + amt, updated_at = now() WHERE id = tx.transfer_to_account_id;
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_account_balance_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF COALESCE(NEW.is_deleted, false) THEN
      RETURN NEW;
    END IF;
    PERFORM public._apply_tx_balance_delta(NEW, 1);
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    IF NOT COALESCE(OLD.is_deleted, false) THEN
      PERFORM public._apply_tx_balance_delta(OLD, -1);
    END IF;
    RETURN OLD;

  ELSIF (TG_OP = 'UPDATE') THEN
    IF NOT COALESCE(OLD.is_deleted, false) AND COALESCE(NEW.is_deleted, false) THEN
      PERFORM public._apply_tx_balance_delta(OLD, -1);
      RETURN NEW;
    END IF;
    IF COALESCE(OLD.is_deleted, false) AND NOT COALESCE(NEW.is_deleted, false) THEN
      PERFORM public._apply_tx_balance_delta(NEW, 1);
      RETURN NEW;
    END IF;
    IF COALESCE(NEW.is_deleted, false) THEN
      RETURN NEW;
    END IF;
    PERFORM public._apply_tx_balance_delta(OLD, -1);
    PERFORM public._apply_tx_balance_delta(NEW, 1);
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS on_transaction_logged ON public.transactions;
DROP TRIGGER IF EXISTS trigger_update_account_balance ON public.transactions;

CREATE TRIGGER trigger_update_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance_on_transaction();

DROP FUNCTION IF EXISTS public.handle_transaction_balance_sync();

UPDATE public.accounts
SET balance = ABS(balance), updated_at = now()
WHERE account_type = 'Credit Card'
  AND balance < 0
  AND COALESCE(is_deleted, false) = false;
