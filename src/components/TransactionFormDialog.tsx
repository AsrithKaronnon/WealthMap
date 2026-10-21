import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { SEED } from '../lib/supabaseMock';
import { parseTextTransaction, parseReceiptImage, isGeminiConfigured } from '../lib/gemini';
import { Sparkles, FileText, Trash2, Camera, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { ProjectSelector } from './ui/ProjectSelector';
import { tracksExpenses } from '../lib/projects';

interface TransactionFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accounts: any[];
  expenseCategories: any[];
  incomeCategories: any[];
  currencySymbol: string;
  projects: any[];
  projectsAvailable: boolean;
  editingTxId?: string | null;
  initialFormData?: any;
}

export const TransactionFormDialog: React.FC<TransactionFormDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  accounts,
  expenseCategories,
  incomeCategories,
  currencySymbol,
  projects,
  projectsAvailable,
  editingTxId = null,
  initialFormData,
}) => {
  const [modalActiveTab, setModalActiveTab] = useState<'scanner' | 'manual'>('manual');
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isReceiptScannerLoading, setIsReceiptScannerLoading] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    transaction_type_id: SEED.transaction_types.expense,
    category_id: '',
    account_id: '',
    transfer_to_account_id: '',
    merchant: '',
    notes: '',
    tags: ['Essential'],
    is_recurring: false,
    recurrence_interval: 'monthly',
    project_id: ''
  });

  const [transactions, setTransactions] = useState<any[]>([]);

  // Fetch transactions for category usage calculation
  useEffect(() => {
    const fetchTransactions = async () => {
      const { data } = await supabase.from('transactions').select('*').eq('is_deleted', false);
      if (data) setTransactions(data);
    };
    fetchTransactions();
  }, []);

  // Reset form when opening/closing or editing changes
  useEffect(() => {
    if (isOpen) {
      if (initialFormData) {
        setFormData(initialFormData);
      } else {
        setFormData({
          date: new Date().toISOString().split('T')[0],
          amount: 0,
          transaction_type_id: SEED.transaction_types.expense,
          category_id: expenseCategories[0]?.id || SEED.expense_categories.food,
          account_id: accounts[0]?.id || null,
          transfer_to_account_id: null,
          merchant: '',
          notes: '',
          tags: ['Essential'],
          is_recurring: false,
          recurrence_interval: 'monthly',
          project_id: null
        });
      }
      setModalActiveTab('manual');
      setMoreOptionsOpen(false);
      setReceiptFile(null);
      setReceiptPreview(null);
    }
  }, [isOpen, initialFormData, expenseCategories, accounts]);

  // Auto-focus amount input when modal opens
  useEffect(() => {
    if (isOpen && modalActiveTab === 'manual' && !editingTxId) {
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, modalActiveTab, editingTxId]);

  const activeCategories = formData.transaction_type_id === SEED.transaction_types.income
    ? incomeCategories
    : expenseCategories;

  // Calculate frequently used categories
  const frequentlyUsedCategories = useMemo(() => {
    const categoryUsage = new Map<string, number>();
    transactions
      .filter(t => t.transaction_type_id === formData.transaction_type_id && !t.is_deleted)
      .forEach(t => {
        if (t.category_id) {
          categoryUsage.set(t.category_id, (categoryUsage.get(t.category_id) || 0) + 1);
        }
      });

    const sorted = activeCategories
      .map(cat => ({ ...cat, usage: categoryUsage.get(cat.id) || 0 }))
      .sort((a, b) => b.usage - a.usage);

    return sorted;
  }, [transactions, activeCategories, formData.transaction_type_id]);

  const isTransfer = formData.transaction_type_id === SEED.transaction_types.transfer;
  const assignedProject = projects.find((p) => p.id === formData.project_id);
  const skipLedger = !isTransfer && !!formData.project_id && !tracksExpenses(assignedProject);

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isGeminiConfigured()) {
      toast.error('AI not configured. Add your API key in Settings.');
      return;
    }

    setIsReceiptScannerLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setReceiptPreview(base64);
        setReceiptFile(file);

        const availableCats = [...expenseCategories, ...incomeCategories];
        const parsed = await parseReceiptImage(base64, file.type, availableCats);

        let catId = parsed.isIncome
          ? incomeCategories[0]?.id || SEED.income_categories.salary
          : expenseCategories[0]?.id || SEED.expense_categories.food;

        if (parsed.categoryName) {
          const found = [...expenseCategories, ...incomeCategories].find(c =>
            c.name.toLowerCase() === parsed.categoryName?.toLowerCase()
          );
          if (found) catId = found.id;
        }

        setFormData(prev => ({
          ...prev,
          amount: parsed.amount || prev.amount,
          merchant: parsed.merchant || prev.merchant,
          category_id: catId,
          transaction_type_id: parsed.isIncome ? SEED.transaction_types.income : SEED.transaction_types.expense
        }));

        setIsReceiptScannerLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error('Failed to scan receipt: ' + err.message);
      setIsReceiptScannerLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.account_id && !skipLedger) {
      toast.error('Please select an account');
      return;
    }

    if (isTransfer && !formData.transfer_to_account_id) {
      toast.error('Please select destination account');
      return;
    }

    try {
      let receiptUrl = '';
      if (receiptFile) {
        const fileName = `receipt-${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, receiptFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);
        receiptUrl = publicUrl;
      }

      // Sanitize empty strings to null for UUID fields
      const txData: any = {
        date: formData.date,
        amount: formData.amount,
        transaction_type_id: formData.transaction_type_id,
        category_id: isTransfer ? null : (formData.category_id || null),
        account_id: skipLedger ? null : (formData.account_id || null),
        transfer_to_account_id: isTransfer ? (formData.transfer_to_account_id || null) : null,
        merchant: formData.merchant,
        notes: formData.notes,
        tags: formData.tags,
        is_recurring: formData.is_recurring,
        recurrence_interval: formData.recurrence_interval,
        project_id: formData.project_id || null,
        receipt_url: receiptUrl || null,
      };

      let error;
      if (editingTxId) {
        const { error: updateError } = await supabase
          .from('transactions')
          .update(txData)
          .eq('id', editingTxId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('transactions')
          .insert([txData]);
        error = insertError;
      }

      if (error) throw error;

      toast.success(editingTxId ? 'Transaction updated!' : 'Transaction saved!');
      onClose();
      onSuccess();
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;

      toast.success('Transaction deleted');
      onClose();
      onSuccess();
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={editingTxId ? "Edit Transaction Record" : "Add Spend or Income"}
    >
      {!editingTxId && (
        <div className="flex border-b border-border/50 mb-4 select-none">
          <button
            type="button"
            onClick={() => setModalActiveTab('manual')}
            className={`flex-1 py-2 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${modalActiveTab === 'manual' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Pencil className="h-4 w-4" /> Manual Entry
          </button>
          <button
            type="button"
            onClick={() => setModalActiveTab('scanner')}
            className={`flex-1 py-2 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${modalActiveTab === 'scanner' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Camera className="h-4 w-4" /> Scan Bill
          </button>
        </div>
      )}

      {modalActiveTab === 'scanner' ? (
        <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border/50 rounded-xl bg-card hover:bg-muted/10 transition-colors cursor-pointer select-none min-h-[250px]">
           <input
             type="file"
             accept="image/*"
             capture="environment"
             className="hidden"
             onChange={handleReceiptUpload}
             disabled={isReceiptScannerLoading}
           />
           {isReceiptScannerLoading ? (
             <div className="flex flex-col items-center text-center">
               <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mb-4"></div>
               <p className="text-sm font-bold text-foreground">Analyzing receipt with AI...</p>
               <p className="text-xs text-muted-foreground mt-1">Extracting merchant and amount</p>
             </div>
           ) : (
             <div className="flex flex-col items-center text-center">
               <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                 <Camera className="h-8 w-8" />
               </div>
               <p className="text-sm font-bold text-foreground">Tap to take a photo</p>
               <p className="text-xs text-muted-foreground mt-1">Or choose a receipt from your gallery</p>
             </div>
           )}
        </label>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Tip banner */}
          <div className="bg-amber-500/10 text-amber-500 text-xs p-3 rounded-lg flex items-start gap-2">
            <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
            <p><strong>Tip:</strong> If you are paying a recurring item, use Move money → Pay recurring so the next due date advances correctly.</p>
          </div>

          {/* Type Selector */}
          <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
            <button
              type="button"
              onClick={() => {
                const firstCat = expenseCategories[0]?.id || '';
                setFormData({ ...formData, transaction_type_id: SEED.transaction_types.expense, category_id: firstCat });
              }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                formData.transaction_type_id === SEED.transaction_types.expense
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => {
                const firstCat = incomeCategories[0]?.id || '';
                setFormData({ ...formData, transaction_type_id: SEED.transaction_types.income, category_id: firstCat });
              }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                formData.transaction_type_id === SEED.transaction_types.income
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Income
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, transaction_type_id: SEED.transaction_types.transfer })}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                formData.transaction_type_id === SEED.transaction_types.transfer
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Transfer
            </button>
          </div>

          {/* Amount Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground">Amount ({currencySymbol})</label>
            <input
              ref={amountInputRef}
              type="number"
              inputMode="numeric"
              step="0.01"
              required
              value={formData.amount || ''}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              placeholder="0.00"
            />
          </div>

          {/* Category Selector - All Categories */}
          {!isTransfer && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-muted-foreground">Category</label>
              <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {frequentlyUsedCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, category_id: cat.id })}
                    className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      formData.category_id === cat.id
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground">Description / Source</label>
            <input
              type="text"
              required
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="e.g. Starbucks, Salary Paycheck"
            />
          </div>

          {/* Account and Date - Side by Side */}
          <div className="grid grid-cols-2 gap-3">
            {!skipLedger && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground">{isTransfer ? 'Source' : 'Account'}</label>
                </div>
                <select
                  required
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Select</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Transfer Destination */}
          {isTransfer && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Destination Account</label>
              <select
                value={formData.transfer_to_account_id}
                onChange={(e) => setFormData({ ...formData, transfer_to_account_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Select destination</option>
                {accounts.filter(a => a.account_type !== 'Credit Card').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          {/* More Options Collapsible */}
          <div className="border border-border/50 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setMoreOptionsOpen(!moreOptionsOpen)}
              className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <span>More options</span>
              {moreOptionsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {moreOptionsOpen && (
              <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border/30">
                {/* Recurring */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_recurring"
                      checked={formData.is_recurring}
                      onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                      className="rounded border-border text-primary focus:ring-primary/45"
                    />
                    <label htmlFor="is_recurring" className="text-xs font-bold text-muted-foreground cursor-pointer">
                      This is a recurring entry
                    </label>
                  </div>
                  {formData.is_recurring && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-muted-foreground">Repeat Frequency</label>
                      <select
                        value={formData.recurrence_interval}
                        onChange={(e) => setFormData({ ...formData, recurrence_interval: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="3 months">Every 3 Months</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-muted-foreground">Short Note (Optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 h-16 resize-none"
                    placeholder="Record details..."
                  />
                </div>

                {/* Project */}
                {projectsAvailable && projects.length > 0 && formData.transaction_type_id !== SEED.transaction_types.transfer && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-muted-foreground">Assign to Project</label>
                    <ProjectSelector
                      projects={projects}
                      value={formData.project_id}
                      activeOnly
                      trackedOnly
                      noneLabel="None (regular expense)"
                      onChange={(val) => setFormData({ ...formData, project_id: val })}
                    />
                  </div>
                )}

                {/* Receipt Upload */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Attach Receipt (Optional)
                  </label>
                  {receiptPreview ? (
                    <div className="relative group rounded-lg overflow-hidden border border-border/50 bg-background flex flex-col items-center">
                      <img src={receiptPreview} alt="Receipt preview" className="max-h-[160px] object-contain" />
                      <button
                        type="button"
                        onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                        className="min-h-[44px] w-full flex items-center justify-center gap-1.5 text-xs font-bold text-destructive bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove photo
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center p-4 border-2 border-dashed border-border/50 rounded-xl bg-card hover:bg-muted/10 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleReceiptUpload}
                        disabled={isReceiptScannerLoading}
                      />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Camera className="h-4 w-4" />
                        <span>Tap to add receipt</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {editingTxId && (
              <Button
                type="button"
                variant="outline"
                className="text-red-500 hover:text-red-600 border-red-500/20 bg-red-500/10"
                onClick={() => { onClose(); handleDelete(editingTxId); }}
              >
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {editingTxId ? 'Update' : 'Save'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
};
