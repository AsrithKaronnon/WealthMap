import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabaseClient';
import { SEED } from '../lib/supabaseMock';
import { computeAccountBalances } from '../lib/accountUtils';
import { toast } from '../lib/useToastStore';

export type MoveMoneyType = 'transfer' | 'recurring' | 'emi' | 'cc';

export interface MoveMoneyPrefill {
  type?: MoveMoneyType;
  recurringId?: string;
  loanId?: string;
  creditCardId?: string;
  amount?: number;
}

interface MoveMoneySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currencySymbol?: string;
  prefill?: MoveMoneyPrefill;
}

const TYPES: { id: MoveMoneyType; label: string }[] = [
  { id: 'transfer', label: 'Transfer' },
  { id: 'recurring', label: 'Pay recurring' },
  { id: 'emi', label: 'Pay EMI' },
  { id: 'cc', label: 'Pay credit card' },
];

/** Mirror process-recurring-transactions edge function interval math. */
function advanceRecurringDate(fromDateStr: string, intervalRaw?: string | null): string {
  const nextDate = new Date(fromDateStr);
  const interval = (intervalRaw || 'monthly').toLowerCase();
  if (interval === 'daily') {
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (interval === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (interval === '3 months') {
    nextDate.setMonth(nextDate.getMonth() + 3);
  } else if (interval === 'yearly') {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  } else {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }
  return nextDate.toISOString().split('T')[0];
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45';

export const MoveMoneySheet: React.FC<MoveMoneySheetProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currencySymbol = '₹',
  prefill,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

  const [moveType, setMoveType] = useState<MoveMoneyType>('transfer');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [recurringId, setRecurringId] = useState('');
  const [loanId, setLoanId] = useState('');
  const [creditCardId, setCreditCardId] = useState('');
  const [notes, setNotes] = useState('');

  const fundingAccounts = useMemo(
    () => accounts.filter((a) => a.account_type !== 'Credit Card'),
    [accounts]
  );
  const creditCards = useMemo(
    () => accounts.filter((a) => a.account_type === 'Credit Card'),
    [accounts]
  );

  const selectedRecurring = recurringTemplates.find((t) => t.id === recurringId);
  const selectedLoan = loans.find((l) => l.id === loanId);
  const selectedCc = creditCards.find((c) => c.id === creditCardId);
  const ccUsage = selectedCc ? Math.abs(selectedCc.computed_balance || 0) : 0;

  const resetForm = (nextType: MoveMoneyType = 'transfer') => {
    setMoveType(nextType);
    setAmount(0);
    setDate(new Date().toISOString().split('T')[0]);
    setFromAccountId('');
    setToAccountId('');
    setRecurringId('');
    setLoanId('');
    setCreditCardId('');
    setNotes('');
  };

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: accData }, { data: recurringData }, { data: loanData }, { data: txData }] =
          await Promise.all([
            supabase.from('accounts').select('*').order('name', { ascending: true }),
            supabase
              .from('transactions')
              .select('*')
              .eq('is_recurring', true)
              .eq('is_deleted', false)
              .order('next_recurring_date', { ascending: true }),
            supabase.from('loans').select('*').eq('is_deleted', false).order('name', { ascending: true }),
            supabase
              .from('transactions')
              .select('id, account_id, transfer_to_account_id, transaction_type_id, amount, is_deleted')
              .eq('is_deleted', false),
          ]);

        if (cancelled) return;

        const withBal = computeAccountBalances(accData || [], txData || []);
        setAccounts(withBal);
        // Prefer expenses first, then income / other recurring templates
        const templates = [...(recurringData || [])].sort((a, b) => {
          const aExp = a.transaction_type_id === SEED.transaction_types.expense ? 0 : 1;
          const bExp = b.transaction_type_id === SEED.transaction_types.expense ? 0 : 1;
          if (aExp !== bExp) return aExp - bExp;
          const aDue = a.next_recurring_date || '';
          const bDue = b.next_recurring_date || '';
          return aDue.localeCompare(bDue);
        });
        setRecurringTemplates(templates);
        setLoans(loanData || []);

        const type = prefill?.type || 'transfer';
        resetForm(type);

        if (prefill?.amount && prefill.amount > 0) setAmount(prefill.amount);
        if (prefill?.recurringId) {
          setRecurringId(prefill.recurringId);
          const t = templates.find((x: any) => x.id === prefill.recurringId);
          if (t) {
            setAmount(parseFloat(t.amount) || 0);
            if (t.account_id && withBal.some((a) => a.id === t.account_id && a.account_type !== 'Credit Card')) {
              setFromAccountId(t.account_id);
            }
          }
        }
        if (prefill?.loanId) {
          setLoanId(prefill.loanId);
          const l = (loanData || []).find((x: any) => x.id === prefill.loanId);
          if (l) setAmount(parseFloat(l.monthly_emi) || 0);
        }
        if (prefill?.creditCardId) {
          setCreditCardId(prefill.creditCardId);
          const cc = withBal.find((a) => a.id === prefill.creditCardId);
          if (cc) setAmount(Math.abs(cc.computed_balance || 0));
        }
      } catch {
        toast.error('Could not load accounts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, prefill?.type, prefill?.recurringId, prefill?.loanId, prefill?.creditCardId, prefill?.amount]);

  useEffect(() => {
    if (moveType === 'recurring' && selectedRecurring) {
      if (amount <= 0) setAmount(parseFloat(selectedRecurring.amount) || 0);
      if (
        !fromAccountId &&
        selectedRecurring.account_id &&
        fundingAccounts.some((a) => a.id === selectedRecurring.account_id)
      ) {
        setFromAccountId(selectedRecurring.account_id);
      }
    }
  }, [selectedRecurring, moveType]);

  useEffect(() => {
    if (moveType === 'emi' && selectedLoan && amount <= 0) {
      setAmount(parseFloat(selectedLoan.monthly_emi) || 0);
    }
  }, [selectedLoan, moveType]);

  useEffect(() => {
    if (moveType === 'cc' && selectedCc) {
      const usage = Math.abs(selectedCc.computed_balance || 0);
      if (amount <= 0 || amount > usage) setAmount(usage);
    }
  }, [selectedCc, moveType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!fromAccountId) {
      toast.error('Select an account to pay from');
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      if (moveType === 'transfer') {
        if (!toAccountId) throw new Error('Select a destination account');
        if (fromAccountId === toAccountId) throw new Error('Choose two different accounts');
        const dest = accounts.find((a) => a.id === toAccountId);
        if (dest?.account_type === 'Credit Card') {
          throw new Error('Use Pay credit card to reduce card usage — transfers to cards inflate debt');
        }

        const { error } = await supabase.from('transactions').insert([
          {
            date,
            amount,
            transaction_type_id: SEED.transaction_types.transfer,
            category_id: null,
            account_id: fromAccountId,
            transfer_to_account_id: toAccountId,
            payment_method_id: SEED.payment_methods.bank_transfer,
            merchant: 'Transfer',
            notes: notes || null,
            tags: ['Transfer'],
            is_recurring: false,
            created_by: user.id,
          },
        ]);
        if (error) throw error;
        toast.success('Transfer recorded');
      } else if (moveType === 'recurring') {
        if (!recurringId || !selectedRecurring) throw new Error('Select a recurring transaction');

        const { error: txErr } = await supabase.from('transactions').insert([
          {
            date,
            amount,
            transaction_type_id: selectedRecurring.transaction_type_id,
            category_id: selectedRecurring.category_id || null,
            account_id: fromAccountId,
            payment_method_id: selectedRecurring.payment_method_id || SEED.payment_methods.debit_card,
            merchant: selectedRecurring.merchant || 'Recurring',
            notes: notes || selectedRecurring.notes || `Paid: ${selectedRecurring.merchant || 'Recurring'}`,
            tags: Array.isArray(selectedRecurring.tags) ? selectedRecurring.tags : ['Recurring'],
            is_recurring: false,
            created_by: user.id,
          },
        ]);
        if (txErr) throw txErr;

        const baseDate =
          selectedRecurring.next_recurring_date || date || new Date().toISOString().split('T')[0];
        const nextDateStr = advanceRecurringDate(baseDate, selectedRecurring.recurrence_interval);
        const { error: updErr } = await supabase
          .from('transactions')
          .update({ next_recurring_date: nextDateStr })
          .eq('id', selectedRecurring.id);
        if (updErr) throw updErr;

        toast.success('Recurring payment recorded');
      } else if (moveType === 'emi') {
        if (!loanId || !selectedLoan) throw new Error('Select a loan');

        const newOutstanding = Math.max(0, parseFloat(selectedLoan.outstanding_amount) - amount);
        const newRemaining = Math.max(0, (parseInt(selectedLoan.remaining_emis, 10) || 0) - 1);

        const { error: txErr } = await supabase.from('transactions').insert([
          {
            date,
            amount,
            transaction_type_id: SEED.transaction_types.expense,
            category_id: SEED.expense_categories.housing,
            account_id: fromAccountId,
            payment_method_id: SEED.payment_methods.bank_transfer,
            merchant: `EMI Payment: ${selectedLoan.name}`,
            notes: notes || `EMI for ${selectedLoan.name}`,
            tags: ['Loan', 'EMI'],
            is_recurring: false,
            created_by: user.id,
          },
        ]);
        if (txErr) throw txErr;

        const { error: loanErr } = await supabase
          .from('loans')
          .update({ outstanding_amount: newOutstanding, remaining_emis: newRemaining })
          .eq('id', selectedLoan.id);
        if (loanErr) throw loanErr;
        toast.success('EMI paid');
      } else if (moveType === 'cc') {
        if (!creditCardId || !selectedCc) throw new Error('Select a credit card');
        if (amount > ccUsage + 0.001) throw new Error('Payoff cannot exceed current credit usage');
        if (fromAccountId === creditCardId) throw new Error('Pay from a bank or cash account');

        const label = `CC Payment: ${selectedCc.name}`;
        const { data: bankRows, error: bankErr } = await supabase
          .from('transactions')
          .insert([
            {
              date,
              amount,
              transaction_type_id: SEED.transaction_types.expense,
              category_id: SEED.expense_categories.utilities,
              account_id: fromAccountId,
              payment_method_id: SEED.payment_methods.bank_transfer,
              merchant: label,
              notes: notes || `Credit card payment toward ${selectedCc.name}`,
              tags: ['Credit Card', 'Payment'],
              is_recurring: false,
              created_by: user.id,
            },
          ])
          .select('id');
        if (bankErr) throw bankErr;
        const bankTxId = bankRows?.[0]?.id;

        const { error: ccErr } = await supabase.from('transactions').insert([
          {
            date,
            amount: -amount,
            transaction_type_id: SEED.transaction_types.transfer,
            category_id: null,
            account_id: creditCardId,
            transfer_to_account_id: null,
            payment_method_id: SEED.payment_methods.bank_transfer,
            merchant: label,
            notes: `Applied payment to reduce credit usage on ${selectedCc.name}`,
            tags: ['Credit Card', 'Payment'],
            is_recurring: false,
            created_by: user.id,
          },
        ]);
        if (ccErr) {
          if (bankTxId) {
            await supabase.from('transactions').update({ is_deleted: true }).eq('id', bankTxId);
          }
          throw ccErr;
        }
        toast.success('Credit card payment recorded');
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Could not complete payment');
    } finally {
      setSaving(false);
    }
  };

  const canSubmit =
    amount > 0 &&
    !!fromAccountId &&
    (moveType === 'transfer'
      ? !!toAccountId && toAccountId !== fromAccountId
      : moveType === 'recurring'
        ? !!recurringId
        : moveType === 'emi'
          ? !!loanId
          : !!creditCardId && amount <= ccUsage + 0.001);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Move money" size="md">
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setMoveType(t.id);
                  setAmount(0);
                  setRecurringId('');
                  setLoanId('');
                  setCreditCardId('');
                  setToAccountId('');
                }}
                className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  moveType === t.id
                    ? 'bg-primary/15 border-primary/40 text-foreground'
                    : 'bg-background border-border text-muted-foreground hover:bg-muted/40'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Amount ({currencySymbol})</label>
            <input
              type="number"
              inputMode="decimal"
              required
              step="0.01"
              min="0"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className={`${inputClass} font-mono`}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Pay from</label>
            <select
              required
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select account</option>
              {fundingAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {moveType === 'transfer' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">To account</label>
              <select
                required
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select account</option>
                {accounts
                  .filter((a) => a.id !== fromAccountId && a.account_type !== 'Credit Card')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {moveType === 'recurring' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Recurring</label>
              <select
                required
                value={recurringId}
                onChange={(e) => {
                  setRecurringId(e.target.value);
                  const t = recurringTemplates.find((x) => x.id === e.target.value);
                  if (t) {
                    setAmount(parseFloat(t.amount) || 0);
                    if (t.account_id && fundingAccounts.some((a) => a.id === t.account_id)) {
                      setFromAccountId(t.account_id);
                    }
                  }
                }}
                className={inputClass}
              >
                <option value="">Select recurring…</option>
                {recurringTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.merchant || 'Untitled'}
                    {t.next_recurring_date ? ` · due ${t.next_recurring_date}` : ''}
                    {t.recurrence_interval ? ` · ${t.recurrence_interval}` : ''}
                  </option>
                ))}
              </select>
              {recurringTemplates.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  No recurring templates yet. Mark a transaction as recurring when you add or edit it.
                </p>
              )}
            </div>
          )}

          {moveType === 'emi' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Loan</label>
              <select
                required
                value={loanId}
                onChange={(e) => {
                  setLoanId(e.target.value);
                  const l = loans.find((x) => x.id === e.target.value);
                  if (l) setAmount(parseFloat(l.monthly_emi) || 0);
                }}
                className={inputClass}
              >
                <option value="">Select loan</option>
                {loans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} · EMI {currencySymbol}
                    {parseFloat(l.monthly_emi || 0).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {moveType === 'cc' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Credit card</label>
              <select
                required
                value={creditCardId}
                onChange={(e) => {
                  setCreditCardId(e.target.value);
                  const cc = creditCards.find((x) => x.id === e.target.value);
                  if (cc) setAmount(Math.abs(cc.computed_balance || 0));
                }}
                className={inputClass}
              >
                <option value="">Select card</option>
                {creditCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · used {currencySymbol}
                    {Math.abs(c.computed_balance || 0).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
              {selectedCc && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Usage {currencySymbol}
                  {ccUsage.toLocaleString('en-IN')}
                  {selectedCc.credit_limit
                    ? ` · Available ${currencySymbol}${Math.max(0, (selectedCc.credit_limit || 0) - ccUsage).toLocaleString('en-IN')}`
                    : ''}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || saving}>
              {saving ? 'Saving…' : 'Confirm'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
};
