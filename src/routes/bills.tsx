import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { confirm } from '../lib/useConfirmStore';
import { SEED } from '../lib/supabaseMock';
import { 
  Plus, AlertCircle, Trash2, Sparkles, Check, Edit
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';
import { Tabs } from '../components/ui/Tabs';
import { getRelativeDateString } from '../lib/utils';
import { Skeleton } from '../components/ui/Skeleton';

export const Bills: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [billTypes, setBillTypes] = useState<any[]>([]);
  const [recurrenceTypes, setRecurrenceTypes] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  
  // Tab selector: Upcoming vs Paid
  const [activeTab, setActiveTab] = useState<'upcoming' | 'paid'>('upcoming');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: 0,
    due_date: new Date().toISOString().split('T')[0],
    bill_type_id: SEED.expense_categories.utilities,
    recurrence_type_id: SEED.recurrences.one_time,
    status_id: SEED.statuses.pending,
    end_date: '',
    is_active: true
  });

  // Pay Modal State
  const [payingItem, setPayingItem] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      let [
        { data: billsData },
        { data: accountsData },
        { data: typesData },
        { data: recData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('bills').select('*').order('due_date', { ascending: true }),
        supabase.from('accounts').select('*').order('name', { ascending: true }),
        supabase.from('expense_categories').select('*').eq('is_active', true).order('name', { ascending: true }),
        supabase.from('recurrence_types').select('*').eq('is_active', true).order('name', { ascending: true }),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol)').maybeSingle()
      ]);

      if (accountsData && accountsData.length === 0) {
        const { data: newAcc } = await supabase.from('accounts').insert([{
          name: 'Primary Checking',
          balance: 0.00,
          account_type: 'Checking',
          currency_id: SEED.currencies.usd
        }]).select();
        if (newAcc) accountsData = newAcc;
      }

      if (settingsData && settingsData.currencies) {
        const sym = Array.isArray(settingsData.currencies)
          ? settingsData.currencies[0]?.symbol
          : (settingsData.currencies as any)?.symbol;
        if (sym) setCurrencySymbol(sym);
      }

      if (billsData) setBills(billsData);
      if (accountsData) setAccounts(accountsData);
      if (typesData) setBillTypes(typesData);
      if (recData) setRecurrenceTypes(recData);
    } catch (err) {
      console.error('Error fetching bills configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      amount: 0,
      due_date: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0], // 7 days out
      bill_type_id: billTypes[0]?.id || SEED.expense_categories.utilities,
      recurrence_type_id: SEED.recurrences.one_time,
      status_id: SEED.statuses.pending,
      end_date: '',
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleEdit = (bill: any) => {
    setEditingId(bill.id);
    setFormData({
      name: bill.name || '',
      amount: parseFloat(bill.amount) || 0,
      due_date: bill.due_date || new Date().toISOString().split('T')[0],
      bill_type_id: bill.bill_type_id || SEED.expense_categories.utilities,
      recurrence_type_id: bill.recurrence_type_id || SEED.recurrences.one_time,
      status_id: bill.status_id || SEED.statuses.pending,
      end_date: bill.end_date || '',
      is_active: bill.is_active !== false
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const payload = {
        ...formData,
        end_date: formData.end_date || null
      };
      if (editingId) {
        const { error } = await supabase.from('bills').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Bill updated');
      } else {
        const { error } = await supabase.from('bills').insert([{ ...payload, created_by: user.id }]);
        if (error) throw error;
        toast.success('Bill saved');
      }
      setIsModalOpen(false);
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      console.error('Error saving bill:', err);
      toast.error(`Error saving bill: ${err.message || err}`);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await supabase.from('bills').update({ is_active: !currentStatus }).eq('id', id);
      fetchData();
    } catch (err) {
      console.error('Error toggling active status:', err);
    }
  };

  const handleDelete = (id: string, isLoan = false) => {
    if (isLoan) {
      toast.info("Please manage active loans in your bank portal. Set local billing logs to delete them.");
      return;
    }
    confirm({
      title: 'Delete Bill',
      description: 'Remove this payment log?',
      destructive: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await supabase.from('bills').delete().eq('id', id);
          fetchData();
          toast.success('Bill deleted');
        } catch (err) {
          toast.error('Error deleting bill');
        }
      }
    });
  };

  const handlePay = async () => {
    if (!payingItem || accounts.length === 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      // Regular Bill: Update bill status to paid
      // If not recurring, mark inactive
      const updates: any = { status_id: SEED.statuses.paid };
      if (payingItem.recurrence_type_id === SEED.recurrences.one_time) {
        updates.is_active = false;
      }
      await supabase.from('bills').update(updates).eq('id', payingItem.id);

      if (payingItem.recurrence_type_id !== SEED.recurrences.one_time) {
        let nextDate = null;
        const dueDate = new Date(payingItem.due_date);
        
        if (payingItem.recurrence_type_id === SEED.recurrences.monthly) {
          nextDate = new Date(dueDate.setMonth(dueDate.getMonth() + 1));
        } else if (payingItem.recurrence_type_id === SEED.recurrences.yearly) {
          nextDate = new Date(dueDate.setFullYear(dueDate.getFullYear() + 1));
        } else if (payingItem.recurrence_type_id === SEED.recurrences.weekly) {
          nextDate = new Date(dueDate.setDate(dueDate.getDate() + 7));
        } else if (payingItem.recurrence_type_id === SEED.recurrences.biweekly) {
          nextDate = new Date(dueDate.setDate(dueDate.getDate() + 14));
        } else if (payingItem.recurrence_type_id === SEED.recurrences.quarterly) {
          nextDate = new Date(dueDate.setMonth(dueDate.getMonth() + 3));
        }

        if (nextDate) {
          const nextBill = {
            name: payingItem.name,
            bill_type_id: payingItem.bill_type_id,
            amount: payingItem.amount,
            due_date: nextDate.toISOString().split('T')[0],
            status_id: SEED.statuses.pending,
            recurrence_type_id: payingItem.recurrence_type_id,
            account_id: payingItem.account_id,
            is_active: true,
            notes: payingItem.notes,
            created_by: user.id
          };
          await supabase.from('bills').insert([nextBill]);
        }
      }

      // Record a transaction
      const newTx = {
        date: new Date().toISOString().split('T')[0],
        amount: payingItem.amount,
        transaction_type_id: SEED.transaction_types.expense,
        category_id: SEED.expense_categories.utilities,
        account_id: accounts[0].id,
        payment_method_id: SEED.payment_methods.debit_card,
        merchant: payingItem.name,
        notes: `Paid Bill: ${payingItem.name}`,
        tags: ['Essential'],
        is_recurring: true,
        created_by: user.id
      };
      await supabase.from('transactions').insert([newTx]);

      setPayingItem(null);
      fetchData();
      toast.success('Payment recorded');
    } catch (err) {
      toast.error('Error updating payment status');
    }
  };

  // Build unified payments array (combining bills + loans EMIs)
  const unifiedPayments: any[] = [];

  // Add bills
  bills.forEach(b => {
    unifiedPayments.push({
      id: b.id,
      name: b.name,
      amount: b.amount,
      due_date: b.due_date,
      status_id: b.status_id,
      is_loan: false,
      category_id: b.bill_type_id,
      bill_type_id: b.bill_type_id,
      recurrence_type_id: b.recurrence_type_id,
      account_id: b.account_id,
      end_date: b.end_date,
      is_active: b.is_active !== false,
      notes: b.status_id === SEED.statuses.paid 
        ? 'Paid subscription/bill' 
        : b.end_date 
          ? `Unpaid (Expires: ${b.end_date})` 
          : 'Unpaid subscription/bill'
    });
  });

  // Sort unified payments by date
  unifiedPayments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  // Filter based on activeTab
  const filteredPayments = unifiedPayments.filter(p => {
    if (activeTab === 'paid') {
      return p.status_id === SEED.statuses.paid;
    } else {
      return p.status_id === SEED.statuses.pending || p.is_loan;
    }
  });

  return (
    <div className="flex flex-col gap-6">
      
      {/* HEADER: Title & Actions */}
      <div className="flex justify-between items-end select-none mb-4 sm:mb-6">
        <div>
          <h1 className="page-title text-foreground">Bills & Loans Due</h1>
          <p className="secondary-text">Log utilities, subscriptions, and active debt EMI repayments.</p>
        </div>
        <Button 
          onClick={handleOpenAdd} 
          size="sm" 
          className="flex items-center justify-center cursor-pointer h-10 w-10 p-0 sm:w-auto sm:px-3 sm:py-1.5 sm:gap-1.5 rounded-full sm:rounded-lg"
        >
          <Plus className="icon-inline" />
          <span className="hidden sm:inline">Add Bill</span>
        </Button>
      </div>

      {/* FILTER TABS */}
      <div className="w-full sm:w-64 select-none mb-3">
        <Tabs
          options={[
            { id: 'upcoming', label: 'Upcoming Bills' },
            { id: 'paid', label: 'Paid Bills' }
          ]}
          activeId={activeTab}
          onChange={(id: any) => setActiveTab(id)}
        />
      </div>

      {/* BILL LISTINGS */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-[72px] w-full skeleton" />
          ))}
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-xl">
          <AlertCircle className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium text-foreground">All Caught Up!</p>
          <p className="text-xs opacity-70 mt-1">No upcoming bills to display.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map((p) => {
            const isPaid = p.status_id === SEED.statuses.paid;

            return (
              <Card key={p.id} className="hoverEffect select-none">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
                  {/* Left block description */}
                  <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-foreground font-bold text-xs shrink-0 ${p.is_loan ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
                      {p.is_loan ? 'L' : 'B'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="body-text font-medium text-foreground truncate">{p.name}</span>
                      <span className="secondary-text mt-1 truncate">
                        Due: {getRelativeDateString(p.due_date)} • {p.notes}
                      </span>
                    </div>
                  </div>

                  {/* Right block details & actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t border-border/10 sm:border-none pt-2 sm:pt-0 shrink-0">
                    {!p.is_loan && p.recurrence_type_id !== SEED.recurrences.one_time && (
                      <button
                        onClick={() => handleToggleActive(p.id, p.is_active)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer select-none ${
                          p.is_active
                            ? 'bg-green-500/10 text-green-500 border-emerald-500/20 hover:bg-green-500/20'
                            : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                        }`}
                      >
                        {p.is_active ? 'Active' : 'Paused'}
                      </button>
                    )}
                    <span className="text-sm font-mono font-bold text-foreground">
                      {currencySymbol}{(parseFloat(p.amount) || 0).toFixed(0)}
                    </span>
                    {!isPaid ? (
                      <Button
                        onClick={() => setPayingItem(p)}
                        size="sm"
                        className="py-1 px-3 text-xs cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <Check className="h-3 w-3" />
                        Pay
                      </Button>
                    ) : (
                      <Badge variant="success" className="text-green-500 bg-green-500/5 border-emerald-500/20 text-[9px] px-2 py-0.5 shrink-0">
                        Paid
                      </Badge>
                    )}
                    {!p.is_loan && (
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(p)}
                          aria-label="Edit Bill"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-[#F8F8F8] hover:text-primary dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.is_loan)}
                          aria-label="Delete Bill"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-[#F8F8F8] hover:text-destructive dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE BILL DIALOG */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        title={editingId ? "Edit Bill Log" : "Add a Bill Log"}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">What bill is this?</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
              placeholder="e.g. Netflix, Electric Utility, Rent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Amount ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Due Date</label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Bill Category</label>
              <select
                value={formData.bill_type_id}
                onChange={(e) => setFormData({ ...formData, bill_type_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
              >
                {billTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Repeat Frequency</label>
              <select
                value={formData.recurrence_type_id}
                onChange={(e) => setFormData({ ...formData, recurrence_type_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
              >
                {recurrenceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">End Date (Optional)</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45"
              />
            </div>
            {formData.recurrence_type_id !== SEED.recurrences.one_time && (
              <div className="flex flex-col justify-end gap-1 pb-1 select-none">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary/45 h-4 w-4"
                  />
                  <label htmlFor="is_active" className="text-xs font-bold text-muted-foreground cursor-pointer">
                    Active billing status
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4 select-none">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Bill
            </Button>
          </div>
        </form>
      </Dialog>

      {/* CONFIRM PAY DIALOG */}
      <Dialog
        isOpen={!!payingItem}
        onClose={() => setPayingItem(null)}
        title={payingItem ? `Confirm payment: ${payingItem.name}` : ''}
      >
        <div className="flex flex-col gap-4 select-none">
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3 text-xs text-foreground items-start">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="font-bold">Automated Ledger Posting</span>
              <p className="text-muted-foreground mt-0.5">
                Funding this bill reduces your checking balance and records a spend transaction.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-bold text-foreground border-b border-border/40 pb-3">
            <span>Bill Amount:</span>
            <span className="font-mono text-base">{currencySymbol}{payingItem ? (parseFloat(payingItem.amount) || 0).toFixed(0) : '0'}</span>
          </div>

          {payingItem?.is_loan && (
            <div className="space-y-1 text-xs text-muted-foreground font-semibold">
              <div className="flex justify-between">
                <span>Remaining EMIs left:</span>
                <span>{payingItem.remaining_emis - 1} payments</span>
              </div>
              <div className="flex justify-between">
                <span>Outstanding debt balance:</span>
                <span>{currencySymbol}{((parseFloat(payingItem.outstanding_amount) || 0) - (parseFloat(payingItem.amount) || 0)).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPayingItem(null)}>
              Cancel
            </Button>
            <Button onClick={handlePay}>
              Complete Payment
            </Button>
          </div>
        </div>
      </Dialog>

    </div>
  );
};
