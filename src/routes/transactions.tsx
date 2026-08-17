import React, { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { confirm } from '../lib/useConfirmStore';
import { SEED } from '../lib/supabaseMock';
import { parseTextTransaction, parseReceiptImage, isGeminiConfigured } from '../lib/gemini';
import { 
  Plus, Search, Trash2, Sparkles, FileText, Pencil, Download, Camera, Filter, Check, ArrowLeftRight
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Skeleton } from '../components/ui/Skeleton';
import { mobileHeaderIconBtn } from '../components/ui/MobilePageHeader';
import { MobileProfileButton } from '../components/ui/MobileProfileButton';
import { HeaderWash } from '../components/ui/SprayFlow';
import { MoveMoneySheet, type MoveMoneyPrefill } from '../components/MoveMoneySheet';
import { useAppRefresh } from '../lib/refresh';

export const Transactions: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'spends' | 'income' | 'recurring'>('all');
  
  // Date Filter State
  const [dateFilter, setDateFilter] = useState<'all' | 'week' | 'month' | 'last_month' | 'year' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  
  // Quick Add State
  const [quickAddVal, setQuickAddVal] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  
  // Receipt Upload State
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isReceiptScannerLoading, setIsReceiptScannerLoading] = useState(false);
  
  // Main Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [moveMoneyOpen, setMoveMoneyOpen] = useState(false);
  const [movePrefill, setMovePrefill] = useState<MoveMoneyPrefill | undefined>();
  const [modalActiveTab, setModalActiveTab] = useState<'scanner' | 'manual'>('manual');
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
    recurrence_interval: 'monthly'
  });

  // Receipt Modal State
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<any | null>(null);

  // Edit Modal State
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  const LAST_ACCOUNT_KEY = 'wealthmap_last_account_id';
  const rememberAccount = (id: string) => {
    try {
      if (id) localStorage.setItem(LAST_ACCOUNT_KEY, id);
    } catch { /* ignore */ }
  };
  const resolveQuickAccountId = () => {
    try {
      const last = localStorage.getItem(LAST_ACCOUNT_KEY);
      if (last && accounts.some((a) => a.id === last)) return last;
    } catch { /* ignore */ }
    const funding = accounts.filter((a) => a.account_type !== 'Credit Card');
    if (funding.length === 1) return funding[0].id;
    return '';
  };

  // New Account Inline State
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');

  const submitNewAccount = async () => {
    if (!newAccountName.trim()) { setIsAddingAccount(false); return; }
    try {
      const { data, error } = await supabase.from('accounts').insert([{
        name: newAccountName.trim(),
        balance: 0,
        account_type: 'Checking',
        currency_id: SEED.currencies.usd
      }]).select();
      if (error) throw error;
      if (data && data.length > 0) {
        setAccounts([...accounts, data[0]]);
        setFormData({ ...formData, account_id: data[0].id });
        toast.success(`Account '${newAccountName.trim()}' added!`);
      }
    } catch (err: any) {
      toast.error('Failed to add account: ' + err.message);
    } finally {
      setIsAddingAccount(false);
      setNewAccountName('');
    }
  };

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      let [
        { data: txData },
        { data: accData },
        { data: expCatData },
        { data: incCatData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('transactions').select('*').eq('is_deleted', false),
        supabase.from('accounts').select('*').order('name', { ascending: true }),
        supabase.from('expense_categories').select('*').eq('is_active', true).order('name', { ascending: true }),
        supabase.from('income_categories').select('*').eq('is_active', true).order('name', { ascending: true }),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol)').maybeSingle()
      ]);

      // If new user has no accounts, auto-create defaults
      if (accData && accData.length === 0) {
        const { data: newAcc } = await supabase.from('accounts').insert([
          { name: 'Primary Checking', balance: 0.00, account_type: 'Checking', currency_id: SEED.currencies.usd },
          { name: 'Savings', balance: 0.00, account_type: 'Savings', currency_id: SEED.currencies.usd },
          { name: 'Credit Card', balance: 0.00, account_type: 'Credit Card', currency_id: SEED.currencies.usd }
        ]).select();
        if (newAcc) accData = newAcc;
      }

      if (settingsData && settingsData.currencies) {
        const sym = Array.isArray(settingsData.currencies)
          ? settingsData.currencies[0]?.symbol
          : (settingsData.currencies as any)?.symbol;
        if (sym) setCurrencySymbol(sym);
      }

      if (txData) {
        const sorted = [...txData].sort((a, b) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });
        setTransactions(sorted);
      }
      if (accData) setAccounts(accData);
      if (expCatData) setExpenseCategories(expCatData);
      if (incCatData) setIncomeCategories(incCatData);
    } catch (err) {
      console.error('Error fetching transactions ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useAppRefresh(() => fetchData(true));

  const handleQuickCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isGeminiConfigured()) {
      toast.error('AI not configured. Add your API key in Settings.');
      return;
    }

    setQuickAddLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Authentication required");

        const availableCats = [...expenseCategories, ...incomeCategories].map(c => c.name);
        const parsed = await parseReceiptImage(base64, file.type, availableCats);
        
        if (!parsed.merchant || !parsed.amount) {
           throw new Error("Could not extract receipt data clearly. Please ensure the image is clear.");
        }

        let categoryId = parsed.isIncome 
          ? incomeCategories[0]?.id || SEED.income_categories.salary
          : expenseCategories[0]?.id || SEED.expense_categories.food;
          
        if (parsed.categoryName) {
          const found = [...expenseCategories, ...incomeCategories].find(c => 
            c.name.toLowerCase() === parsed.categoryName?.toLowerCase()
          );
          if (found) categoryId = found.id;
        }

        let receipt_url = null;
        // Upload image
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
          receipt_url = urlData.publicUrl;
        }

        const accountId = resolveQuickAccountId();
        if (!accountId) {
          toast.error('Select an account in Log transaction once — quick scan will reuse it.');
          handleOpenAdd();
          return;
        }

        const newTx = {
          date: parsed.date || new Date().toISOString().split('T')[0],
          amount: parsed.amount,
          transaction_type_id: parsed.isIncome ? SEED.transaction_types.income : SEED.transaction_types.expense,
          category_id: categoryId,
          account_id: accountId,
          payment_method_id: SEED.payment_methods.debit_card,
          merchant: parsed.merchant,
          notes: `AI Scanned Receipt`,
          tags: ['Essential'],
          is_recurring: false,
          created_by: user.id,
          receipt_url
        };

        const { error } = await supabase.from('transactions').insert([newTx]);
        if (error) throw error;
        
        rememberAccount(accountId);
        fetchData();
        toast.success('Receipt scanned and saved directly!');
      } catch (err: any) {
        toast.error(err.message || 'Error processing receipt');
      } finally {
        setQuickAddLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddVal.trim()) return;
    
    setQuickAddLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const availableCats = [...expenseCategories, ...incomeCategories].map(c => c.name);
      const parsed = await parseTextTransaction(quickAddVal, availableCats);
      
      let categoryId = parsed.isIncome 
        ? incomeCategories[0]?.id || SEED.income_categories.salary
        : expenseCategories[0]?.id || SEED.expense_categories.food;
        
      if (parsed.categoryName) {
        const found = [...expenseCategories, ...incomeCategories].find(c => 
          c.name.toLowerCase() === parsed.categoryName?.toLowerCase()
        );
        if (found) categoryId = found.id;
      }

      const accountId = resolveQuickAccountId();
      if (!accountId) {
        toast.error('Select an account in Log transaction once — quick add will reuse it.');
        handleOpenAdd();
        return;
      }

      const newTx = {
        date: parsed.date || new Date().toISOString().split('T')[0],
        amount: parsed.amount,
        transaction_type_id: parsed.isIncome ? SEED.transaction_types.income : SEED.transaction_types.expense,
        category_id: categoryId,
        account_id: accountId,
        payment_method_id: SEED.payment_methods.debit_card,
        merchant: parsed.merchant,
        notes: `AI Quick entry: "${quickAddVal}"`,
        tags: ['Essential'],
        is_recurring: false,
        created_by: user.id
      };

      const { error } = await supabase.from('transactions').insert([newTx]);
      if (error) throw error;
      rememberAccount(accountId);
      setQuickAddVal('');
      fetchData();
      toast.success('Quick entry parsed and saved!');
    } catch (err: any) {
      toast.error(err.message || 'Error entering spend');
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let payload: any = {
        ...formData,
        payment_method_id: SEED.payment_methods.debit_card,
        created_by: user.id
      };
      
      if (payload.transaction_type_id === SEED.transaction_types.transfer) {
        payload.category_id = null as any;
        if (!payload.account_id) throw new Error('Select a source account');
        if (!payload.transfer_to_account_id) throw new Error('Select a destination account');
        if (payload.account_id === payload.transfer_to_account_id) {
          throw new Error('Source and destination accounts must be different');
        }
        const dest = accounts.find((a) => a.id === payload.transfer_to_account_id);
        if (dest?.account_type === 'Credit Card') {
          throw new Error('Use Pay credit card (Move money) to reduce card usage');
        }
      } else {
        payload.transfer_to_account_id = null as any;
        if (!payload.account_id) throw new Error('Select an account');
      }

      // Sanitize empty strings to null for UUIDs
      if (payload.account_id === '') payload.account_id = null as any;
      if (payload.transfer_to_account_id === '') payload.transfer_to_account_id = null as any;
      if (payload.category_id === '') payload.category_id = null as any;
      
      if (payload.is_recurring) {
        const nextDate = new Date(payload.date);
        const interval = payload.recurrence_interval || 'monthly';
        if (interval === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        else if (interval === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        else if (interval === '3 months') nextDate.setMonth(nextDate.getMonth() + 3);
        else if (interval === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
        else nextDate.setMonth(nextDate.getMonth() + 1);
        
        payload.next_recurring_date = nextDate.toISOString().split('T')[0];
      } else {
        payload.next_recurring_date = null;
      }

      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, receiptFile);
          
        if (uploadError) {
          console.error('Receipt upload error:', uploadError);
          toast.error('Failed to upload receipt, saving without it.');
        } else {
          const { data: urlData } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath);
          
          payload.receipt_url = urlData.publicUrl;
        }
      }

      if (editingTxId) {
        const { error } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', editingTxId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('transactions').insert([payload]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      setReceiptFile(null);
      setReceiptPreview(null);
      if (payload.account_id) rememberAccount(payload.account_id);
      fetchData();
      toast.success(editingTxId ? 'Transaction updated successfully!' : 'Transaction saved successfully!');
    } catch (err: any) {
      console.error("TRANSACTION SAVE ERROR:", err);
      toast.error(err.message || JSON.stringify(err) || 'Error logging entry');
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      setReceiptPreview(base64);

      if (!isGeminiConfigured()) return;

      setIsReceiptScannerLoading(true);
      try {
        const availableCats = [...expenseCategories, ...incomeCategories].map(c => c.name);
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
          date: parsed.date || prev.date,
          transaction_type_id: parsed.isIncome ? SEED.transaction_types.income : SEED.transaction_types.expense,
          category_id: catId
        }));
        
        setModalActiveTab('manual');
        toast.success('Receipt scanned! Please review the details.');
      } catch (err: any) {
        toast.error('Failed to parse receipt: ' + err.message);
      } finally {
        setIsReceiptScannerLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAdd = () => {
    setEditingTxId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      transaction_type_id: SEED.transaction_types.expense,
      category_id: expenseCategories[0]?.id || SEED.expense_categories.food,
      account_id: '',
      transfer_to_account_id: '',
      merchant: '',
      notes: '',
      tags: ['Essential'],
      is_recurring: false,
      recurrence_interval: 'monthly'
    });
    setModalActiveTab('manual');
    setIsModalOpen(true);
  };

  const navigate = useNavigate();
  const search = useSearch({ from: '/money' });

  useEffect(() => {
    if (search.tab === 'recurring') {
      setActiveTab('recurring');
    }
    if (search.add === '1') {
      handleOpenAdd();
      navigate({ to: '/money', search: search.tab === 'recurring' ? { tab: 'recurring' } : {}, replace: true });
    }
    if (search.move) {
      setMovePrefill({
        type: search.move,
        recurringId: search.recurringId,
        loanId: search.loanId,
        creditCardId: search.ccId,
      });
      setMoveMoneyOpen(true);
      navigate({ to: '/money', search: search.tab === 'recurring' ? { tab: 'recurring' } : {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when query flags are present
  }, [search.add, search.move, search.recurringId, search.loanId, search.ccId, search.tab]);

  const handleOpenEdit = (tx: any) => {
    setEditingTxId(tx.id);
    setFormData({
      date: tx.date || new Date().toISOString().split('T')[0],
      amount: parseFloat(tx.amount) || 0,
      transaction_type_id: tx.transaction_type_id,
      category_id: tx.category_id || '',
      account_id: tx.account_id || '',
      transfer_to_account_id: tx.transfer_to_account_id || accounts[0]?.id || '',
      merchant: tx.merchant || '',
      notes: tx.notes || '',
      tags: Array.isArray(tx.tags) ? tx.tags : ['Essential'],
      is_recurring: !!tx.is_recurring,
      recurrence_interval: tx.recurrence_interval || 'monthly'
    });
    setModalActiveTab('manual');
    setIsModalOpen(true);
  };


  const handleDelete = (id: string) => {
    confirm({
      title: 'Delete Transaction',
      description: 'Remove this transaction record? Account balances will be reversed automatically.',
      destructive: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('transactions')
            .update({ is_deleted: true })
            .eq('id', id);
          if (error) throw error;
          fetchData();
          toast.success('Transaction deleted');
        } catch (err) {
          toast.error('Error deleting transaction');
        }
      }
    });
  };

  const handleExportCSV = () => {
    const headers = 'Date,Description,Amount,Type,Account\n';
    const rows = transactions.map(tx => {
      const type =
        tx.transaction_type_id === SEED.transaction_types.income ? 'Income'
        : tx.transaction_type_id === SEED.transaction_types.transfer ? 'Transfer'
        : 'Spend';
      const accName = accounts.find(a => a.id === tx.account_id)?.name || '';
      return `"${tx.date}","${(tx.merchant || '').replace(/"/g, '""')}",${tx.amount},"${type}","${accName.replace(/"/g, '""')}"`;
    }).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_finance_helper_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Filter evaluation
  const filteredTransactions = transactions.filter(tx => {
    const merchant = (tx.merchant || '').toLowerCase();
    const matchesSearch = merchant.includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'income' && tx.transaction_type_id === SEED.transaction_types.income) ||
      (activeTab === 'spends' && tx.transaction_type_id === SEED.transaction_types.expense) ||
      (activeTab === 'recurring' && tx.is_recurring === true);

    const matchesCategory = true;

    // Recurring tab shows all templates regardless of date filter
    let matchesDate = true;
    if (activeTab !== 'recurring' && dateFilter !== 'all') {
      const txDate = new Date(tx.date);
      const now = new Date();
      if (dateFilter === 'week') {
        const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        matchesDate = txDate >= lastWeek;
      } else if (dateFilter === 'month') {
        matchesDate = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'last_month') {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        matchesDate = txDate.getMonth() === lastMonthDate.getMonth() && txDate.getFullYear() === lastMonthDate.getFullYear();
      } else if (dateFilter === 'year') {
        matchesDate = txDate.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'custom') {
        if (customStart) {
          matchesDate = matchesDate && txDate >= new Date(customStart);
        }
        if (customEnd) {
          // Add 1 day to end date to include the whole day
          const endObj = new Date(customEnd);
          endObj.setDate(endObj.getDate() + 1);
          matchesDate = matchesDate && txDate < endObj;
        }
      }
    }

    return matchesSearch && matchesTab && matchesCategory && matchesDate;
  });

  const activeCategories = formData.transaction_type_id === SEED.transaction_types.income
    ? incomeCategories
    : expenseCategories;

  const isTransfer = formData.transaction_type_id === SEED.transaction_types.transfer;

  return (
    <div className="flex flex-col gap-1.5">
      
      {/* Mobile sticky page header + quick add */}
      <div
        className="md:hidden sticky top-0 z-30 -mx-3 relative"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <HeaderWash />
        <div className="relative z-10 px-3 h-12 flex items-center gap-2">
          <MobileProfileButton className="!h-10 !w-10 text-[12px]" />
          <span className="min-w-0 flex-1 text-[17px] font-semibold tracking-tight text-foreground truncate leading-none">Transactions</span>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleExportCSV} aria-label="Export" className={`${mobileHeaderIconBtn} clay-btn`}>
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setMovePrefill(undefined);
                setMoveMoneyOpen(true);
              }}
              aria-label="Move money"
              className={`${mobileHeaderIconBtn} clay-btn`}
              title="Move money"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <button
              onClick={handleOpenAdd}
              aria-label="Add transaction"
              className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white cursor-pointer clay-btn"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
        <form onSubmit={handleQuickAdd} className="px-3 pb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="relative flex-1 flex items-center clay-input-wrapper h-10">
            <input
              type="text"
              placeholder="e.g. Coffee 5"
              value={quickAddVal}
              onChange={(e) => setQuickAddVal(e.target.value)}
              className="compact-input no-focus-ring w-full bg-transparent pl-3 pr-10 py-0 text-sm outline-none h-10"
              disabled={quickAddLoading}
            />
            {isGeminiConfigured() && (
              <label className="absolute right-0 text-muted-foreground cursor-pointer p-2 h-10 w-10 flex items-center justify-center">
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleQuickCameraUpload}
                  disabled={quickAddLoading}
                />
              </label>
            )}
          </div>
          <Button type="submit" size="sm" loading={quickAddLoading} className="shrink-0 h-10 cursor-pointer">
            Add
          </Button>
        </form>
      </div>

      {/* HEADER: Title & Actions */}
      <div className="hidden md:flex flex-row justify-between items-center w-full select-none">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Transactions</h1>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={handleExportCSV} aria-label="Export" className="flex items-center justify-center h-9 w-9 rounded-full clay-btn text-muted-foreground transition-colors cursor-pointer">
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setMovePrefill(undefined);
              setMoveMoneyOpen(true);
            }}
            aria-label="Move money"
            className="flex items-center justify-center h-9 w-9 rounded-full clay-btn text-muted-foreground transition-colors cursor-pointer"
            title="Move money"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <button 
            onClick={handleOpenAdd} 
            className="flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:opacity-90 transition-opacity cursor-pointer clay-btn"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>



      {/* FILTER BUTTON TABS */}
      <div className="flex clay-input-wrapper p-1 w-full select-none gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          { id: 'all' as const, label: 'All' },
          { id: 'spends' as const, label: 'Spend' },
          { id: 'income' as const, label: 'Income' },
          { id: 'recurring' as const, label: 'Recurring' },
        ]).map(({ id, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                if (search.tab === 'recurring' && id !== 'recurring') {
                  navigate({ to: '/money', search: {}, replace: true });
                }
              }}
              className={`flex-1 basis-0 min-w-0 text-[11px] sm:text-[13px] font-medium rounded-full py-2 px-1 transition-all duration-300 truncate ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Search + date filter (filter on the right) */}
      <div className="flex items-center gap-2 w-full">
        <div className="flex items-center gap-2 px-3 h-10 clay-input-wrapper flex-1 min-w-0">
          <Search className="h-3.5 w-3.5 text-muted-foreground opacity-70 shrink-0" />
          <input 
            type="text" 
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="compact-input no-focus-ring text-xs font-medium text-foreground bg-transparent border-none h-full focus:outline-none focus:ring-0 flex-1 min-w-0 placeholder:text-muted-foreground py-0"
          />
        </div>
        <button
          type="button"
          onClick={() => setDateSheetOpen(true)}
          aria-label="Filter by date"
          className="md:hidden shrink-0 clay-input-wrapper h-10 px-3 flex items-center gap-1.5 text-[12px] font-medium text-foreground cursor-pointer max-w-[42%]"
        >
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">
            {dateFilter === 'all' && 'All'}
            {dateFilter === 'week' && '7 days'}
            {dateFilter === 'month' && 'Month'}
            {dateFilter === 'last_month' && 'Last mo'}
            {dateFilter === 'year' && 'Year'}
            {dateFilter === 'custom' && 'Custom'}
          </span>
        </button>
        <select 
          value={dateFilter}
          onChange={(e: any) => setDateFilter(e.target.value)}
          className="hidden md:block shrink-0 w-[160px] compact-input no-focus-ring text-[13px] font-medium px-3 clay-input-wrapper text-foreground cursor-pointer"
        >
          <option value="all">All Time</option>
          <option value="week">Last 7 Days</option>
          <option value="month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="year">This Year</option>
          <option value="custom">Custom Range</option>
        </select>
      </div>

      {dateFilter === 'custom' && (
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-secondary/30 p-3 rounded-xl border border-border/50 text-xs text-foreground mt-[-10px]">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="font-semibold text-muted-foreground min-w-[35px]">Start</label>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="no-focus-ring bg-background border border-border rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-0 focus:border-border" />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="font-semibold text-muted-foreground min-w-[35px]">End</label>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="no-focus-ring bg-background border border-border rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-0 focus:border-border" />
          </div>
        </div>
      )}

      
      {/* TRANSACTION FEED LISTINGS */}
      <div className="flex flex-col gap-2 pb-6">
        {loading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[60px] w-full skeleton rounded-2xl" />
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground gap-3">
            <FileText className="h-12 w-12 opacity-20" />
            <p className="text-sm text-center max-w-xs">
              {activeTab === 'recurring'
                ? 'No recurring templates yet. Mark a transaction as recurring when you add or edit it.'
                : transactions.length === 0
                  ? 'No money moved yet. Transfer, pay a recurring item, or log a spend.'
                  : 'Nothing matches these filters.'}
            </p>
            {activeTab === 'recurring' ? (
              <Button size="sm" onClick={handleOpenAdd}>Add transaction</Button>
            ) : transactions.length === 0 ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setMoveMoneyOpen(true)}>Move money</Button>
                <Button size="sm" onClick={handleOpenAdd}>Log transaction</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { setDateFilter('all'); setActiveTab('all'); setSearchQuery(''); }}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          (() => {
            // Group transactions by date (or by next due on recurring tab)
            const groupedTransactions = filteredTransactions.reduce((acc: any, tx) => {
              let dateLabel: string;
              if (activeTab === 'recurring') {
                if (tx.next_recurring_date) {
                  const due = new Date(tx.next_recurring_date);
                  const today = new Date();
                  const tomorrow = new Date();
                  tomorrow.setDate(today.getDate() + 1);
                  if (due.toDateString() === today.toDateString()) dateLabel = 'Due today';
                  else if (due.toDateString() === tomorrow.toDateString()) dateLabel = 'Due tomorrow';
                  else if (due < today) dateLabel = 'Overdue';
                  else dateLabel = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } else {
                  dateLabel = 'No next due';
                }
              } else {
                const dateObj = new Date(tx.date);
                dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                const today = new Date();
                const yesterday = new Date();
                yesterday.setDate(today.getDate() - 1);

                if (dateObj.toDateString() === today.toDateString()) {
                  dateLabel = 'Today';
                } else if (dateObj.toDateString() === yesterday.toDateString()) {
                  dateLabel = 'Yesterday';
                }
              }

              if (!acc[dateLabel]) acc[dateLabel] = [];
              acc[dateLabel].push(tx);
              return acc;
            }, {});

            const entries = Object.entries(groupedTransactions) as [string, any[]][];
            if (activeTab === 'recurring') {
              entries.sort((a, b) => {
                const aDate = a[1][0]?.next_recurring_date || '9999';
                const bDate = b[1][0]?.next_recurring_date || '9999';
                return aDate.localeCompare(bDate);
              });
            }

            return entries.map(([dateLabel, txs]) => {
              const daySpend = txs
                .filter((t) => t.transaction_type_id === SEED.transaction_types.expense)
                .reduce((s, t) => s + (Math.abs(parseFloat(t.amount) || 0)), 0);

              return (
              <div key={dateLabel} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 px-1">
                  <h3 className="text-[13px] font-medium text-muted-foreground opacity-90">{dateLabel}</h3>
                  {activeTab !== 'recurring' && daySpend > 0 && (
                    <span className="text-[13px] font-semibold text-muted-foreground tabular-nums shrink-0">
                      {currencySymbol}{daySpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
                <div className="clay rounded-2xl overflow-hidden flex flex-col p-0">
                  {txs.map((tx: any) => {
                    const isIncome = tx.transaction_type_id === SEED.transaction_types.income;
                    const isTransferTx = tx.transaction_type_id === SEED.transaction_types.transfer;
                    const catName = isIncome
                      ? incomeCategories.find(c => c.id === tx.category_id)?.name || 'Income'
                      : (isTransferTx ? 'Transfer' : expenseCategories.find(c => c.id === tx.category_id)?.name || 'General Spend');

                    const sourceAccName = accounts.find(a => a.id === tx.account_id)?.name || 'Account';
                    const destAccName = accounts.find(a => a.id === tx.transfer_to_account_id)?.name || 'Account';
                    const displayMerchant = isTransferTx ? `${sourceAccName} → ${destAccName}` : tx.merchant;
                    const amt = Math.abs(parseFloat(tx.amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

                    return (
                      <div 
                        key={tx.id}
                        className={`group flex items-center justify-between px-3 py-2 rounded-xl hover:bg-accent/50 transition-colors relative cursor-pointer`}
                        onClick={() => handleOpenEdit(tx)}
                      >
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-[15px] shrink-0 ${isIncome ? 'bg-green-500/10 text-green-500' : isTransferTx ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>
                            {isIncome ? 'I' : isTransferTx ? 'A' : 'S'}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-semibold text-foreground/95 leading-tight truncate">{displayMerchant}</span>
                              {tx.receipt_url && (
                                <div onClick={(e) => { e.stopPropagation(); setSelectedTxForReceipt(tx); }} className="bg-primary/20 p-1 rounded-full text-primary hover:bg-primary/30 transition-colors shrink-0" title="View Receipt">
                                  <FileText className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground/70 mt-0.5 leading-none truncate">
                              {activeTab === 'recurring'
                                ? [
                                    tx.next_recurring_date
                                      ? `Next due ${new Date(tx.next_recurring_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                                      : 'No next due',
                                    tx.recurrence_interval || 'monthly',
                                  ].join(' · ')
                                : [
                                    catName,
                                    !isTransferTx ? sourceAccName : null,
                                  ].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className={`text-[15px] font-bold ${isIncome ? 'text-emerald-500' : isTransferTx ? 'text-blue-500' : 'text-red-500'}`}>
                            {isIncome ? '+' : isTransferTx ? '' : '-'}{currencySymbol}{amt}
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }} 
                            className="p-2 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:p-1.5 flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                            title="Delete transaction"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            });
          })()
        )}
      </div>

      {/* MANUAL ENTRY DIALOG */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
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
          <div className="flex flex-col gap-4">
            <div className="bg-amber-500/10 text-amber-500 text-xs p-3 rounded-lg flex items-start gap-2">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
              <p><strong>Tip:</strong> If you are paying a recurring item, use Move money → Pay recurring so the next due date advances correctly.</p>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 order-1">
              <label className="text-xs font-bold text-muted-foreground">Type</label>
              <select
                value={formData.transaction_type_id}
                onChange={(e) => {
                  const val = e.target.value;
                  const firstCat = val === SEED.transaction_types.income
                    ? incomeCategories[0]?.id || ''
                    : expenseCategories[0]?.id || '';
                  setFormData({ ...formData, transaction_type_id: val, category_id: firstCat });
                }}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 animate-none"
              >
                <option value={SEED.transaction_types.expense}>Spend (Expense)</option>
                <option value={SEED.transaction_types.income}>Income</option>
                <option value={SEED.transaction_types.transfer}>Transfer / Adjustment</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 order-2 sm:order-4">
              <label className="text-xs font-bold text-muted-foreground">
                Amount ({currencySymbol}) {isTransfer && <span className="font-normal opacity-80">- Use negative for Money Out</span>}
              </label>
              <input
                type="number"
                inputMode="numeric"
                step="0.01"
                required
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>
            {!isTransfer && (
              <div className="flex flex-col gap-1 order-3 sm:order-5 sm:col-span-2">
                <label className="text-xs font-bold text-muted-foreground">Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1 order-4 sm:order-2">
              <label className="text-xs font-bold text-muted-foreground">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-col gap-1 order-5 col-span-2 sm:order-3 sm:col-span-1">
              <label className="text-xs font-bold text-muted-foreground">Description / Source</label>
              <input
                type="text"
                required
                value={formData.merchant}
                onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="e.g. Starbucks, Salary Paycheck"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground">{isTransfer ? 'Source Account' : 'Account'}</label>
                {!isAddingAccount && (
                  <button 
                    type="button" 
                    onClick={() => setIsAddingAccount(true)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> New
                  </button>
                )}
              </div>
              
              {isAddingAccount ? (
                <div className="flex gap-2">
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="e.g. Amex Platinum" 
                    value={newAccountName}
                    onChange={e => setNewAccountName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <Button type="button" size="sm" onClick={submitNewAccount} className="px-3">Save</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setIsAddingAccount(false); setNewAccountName(''); }} className="px-2">X</Button>
                </div>
              ) : (
                <select
                  required
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Select account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </div>

            {isTransfer && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted-foreground">Destination Account</label>
                <select
                  value={formData.transfer_to_account_id}
                  onChange={(e) => setFormData({ ...formData, transfer_to_account_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Select destination</option>
                  {accounts.filter(a => a.account_type !== 'Credit Card').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Receipt Preview Section (Only show if image exists) */}
          {receiptPreview && (
            <div className="flex flex-col gap-2 pt-3 border-t border-border/30">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                Attached Receipt
              </label>
              <div className="relative group rounded-lg overflow-hidden border border-border/50 bg-background flex flex-col items-center">
                <img src={receiptPreview} alt="Receipt preview" className="max-h-[160px] object-contain" />
                <div className="hidden md:flex absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center">
                  <button type="button" onClick={() => { setReceiptFile(null); setReceiptPreview(null); }} className="text-white text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer">
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                  className="md:hidden min-h-[44px] w-full flex items-center justify-center gap-1.5 text-xs font-bold text-destructive bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove photo
                </button>
              </div>
            </div>
          )}

          {/* RECURRING OPTIONS */}
          <div className="space-y-3 border-t border-border/30 pt-3 select-none">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_recurring"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary/45"
              />
              <label htmlFor="is_recurring" className="text-xs font-bold text-muted-foreground cursor-pointer">
                This is a recurring entry (e.g. monthly paycheck, rent)
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

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Short Note (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 h-16 resize-none"
              placeholder="Record details..."
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4 select-none">
            {editingTxId && (
              <Button type="button" variant="outline" className="text-red-500 hover:text-red-600 border-red-500/20 bg-red-500/10 mr-auto flex items-center" onClick={() => { setIsModalOpen(false); handleDelete(editingTxId); }}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Entry
            </Button>
          </div>
        </form>
        </div>
        )}
      </Dialog>

      {/* RECEIPT VIEWER DIALOG */}
      <Dialog
        isOpen={!!selectedTxForReceipt}
        onClose={() => setSelectedTxForReceipt(null)}
        title="Transaction Receipt"
      >
        <div className="flex flex-col items-center justify-center p-4 border border-border/50 rounded-xl bg-card gap-4 select-none">
          {selectedTxForReceipt?.receipt_url ? (
            <div className="w-full flex flex-col items-center gap-4">
              <img 
                src={selectedTxForReceipt.receipt_url} 
                alt="Receipt" 
                className="max-w-full max-h-[60vh] object-contain rounded-lg border border-border/50 shadow-sm"
              />
              <div className="w-full flex justify-end">
                <Button 
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = selectedTxForReceipt.receipt_url;
                    a.download = `receipt-${selectedTxForReceipt.id}.jpg`;
                    a.target = '_blank';
                    a.click();
                  }}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" /> Download Receipt
                </Button>
              </div>
            </div>
          ) : (
            <>
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">No receipt image attached to this transaction.</p>
            </>
          )}
        </div>
      </Dialog>

      {/* QUICK ENTRY BOX (desktop) */}
      <div className="hidden md:block mt-8">
        <Card className="bg-primary/5">
          <CardContent className="p-6">
            <form onSubmit={handleQuickAdd} className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex items-center gap-2 text-primary shrink-0 select-none">
                <Sparkles className="icon-card animate-pulse text-amber-500" />
                <span className="label-text text-primary">AI Quick Log</span>
              </div>
              <div className="relative flex-1 w-full flex items-center">
                <input 
                  id="quick-expense-input"
                  type="text" 
                  placeholder='Type what you bought or earned (e.g. Starbucks 5 or Salary 2500)'
                  value={quickAddVal}
                  onChange={(e) => setQuickAddVal(e.target.value)}
                  className="w-full bg-background pl-3 pr-10 py-2 rounded-xl text-sm outline-none"
                  disabled={quickAddLoading}
                />
                {isGeminiConfigured() && (
                  <label className="absolute right-2 text-muted-foreground hover:text-primary cursor-pointer transition-colors p-1">
                    <Camera className="h-5 w-5" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      className="hidden" 
                      onChange={handleQuickCameraUpload}
                      disabled={quickAddLoading}
                    />
                  </label>
                )}
              </div>
              <Button type="submit" size="md" loading={quickAddLoading} className="w-full md:w-auto cursor-pointer">
                Save Entry
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog isOpen={dateSheetOpen} onClose={() => setDateSheetOpen(false)} title="Date range">
        <div className="flex flex-col gap-1">
          {([
            { value: 'all', label: 'All Time' },
            { value: 'week', label: 'Last 7 Days' },
            { value: 'month', label: 'This Month' },
            { value: 'last_month', label: 'Last Month' },
            { value: 'year', label: 'This Year' },
            { value: 'custom', label: 'Custom Range' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setDateFilter(opt.value);
                setDateSheetOpen(false);
              }}
              className={`flex items-center justify-between min-h-[44px] px-3 py-2 rounded-xl text-sm font-medium cursor-pointer ${
                dateFilter === opt.value ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
              }`}
            >
              <span>{opt.label}</span>
              {dateFilter === opt.value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </Dialog>

      <MoveMoneySheet
        isOpen={moveMoneyOpen}
        onClose={() => {
          setMoveMoneyOpen(false);
          setMovePrefill(undefined);
        }}
        onSuccess={() => fetchData()}
        currencySymbol={currencySymbol}
        prefill={movePrefill}
      />

    </div>
  );
};
