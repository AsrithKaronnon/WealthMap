import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { confirm } from '../lib/useConfirmStore';
import { SEED } from '../lib/supabaseMock';
import { parseTextTransaction, parseReceiptImage, isGeminiConfigured } from '../lib/gemini';
import { 
  Plus, Search, Trash2, Sparkles, FileText, Pencil, Download, PieChart, Camera, UploadCloud
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { getRelativeDateString } from '../lib/utils';
import { Skeleton } from '../components/ui/Skeleton';
import { Tabs } from '../components/ui/Tabs';

export const Transactions: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  

  const [userBudgets, setUserBudgets] = useState<any[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetsMsg, setBudgetsMsg] = useState('');
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetAmount, setNewBudgetAmount] = useState<number>(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'spends' | 'income' | 'budgets'>('all');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  
  // Date Filter State
  const [dateFilter, setDateFilter] = useState<'all' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  // Quick Add State
  const [quickAddVal, setQuickAddVal] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  
  // Receipt Upload State
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isReceiptScannerLoading, setIsReceiptScannerLoading] = useState(false);
  
  // Main Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const fetchData = async () => {
    try {
      setLoading(true);
      let [
        { data: txData },
        { data: accData },
        { data: expCatData },
        { data: incCatData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('transactions').select('*'),
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

        const newTx = {
          date: parsed.date || new Date().toISOString().split('T')[0],
          amount: parsed.amount,
          transaction_type_id: parsed.isIncome ? SEED.transaction_types.income : SEED.transaction_types.expense,
          category_id: categoryId,
          account_id: accounts[0].id,
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

      const newTx = {
        date: parsed.date || new Date().toISOString().split('T')[0],
        amount: parsed.amount,
        transaction_type_id: parsed.isIncome ? SEED.transaction_types.income : SEED.transaction_types.expense,
        category_id: categoryId,
        account_id: accounts[0].id,
        payment_method_id: SEED.payment_methods.debit_card,
        merchant: parsed.merchant,
        notes: `AI Quick entry: "${quickAddVal}"`,
        tags: ['Essential'],
        is_recurring: false,
        created_by: user.id
      };

      const { error } = await supabase.from('transactions').insert([newTx]);
      if (error) throw error;
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
      let payload = {
        ...formData,
        payment_method_id: SEED.payment_methods.debit_card
      };
      
      if (payload.transaction_type_id === SEED.transaction_types.transfer) {
        payload.category_id = null as any;
      } else {
        payload.transfer_to_account_id = null as any;
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
        
        // @ts-ignore
        payload.next_recurring_date = nextDate.toISOString().split('T')[0];
      } else {
        // @ts-ignore
        payload.next_recurring_date = null;
      }

      if (receiptFile) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
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
            
            (payload as any).receipt_url = urlData.publicUrl;
          }
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
      account_id: accounts[0]?.id || '',
      transfer_to_account_id: accounts.length > 1 ? accounts[1].id : accounts[0]?.id || '',
      merchant: '',
      notes: '',
      tags: ['Essential'],
      is_recurring: false,
      recurrence_interval: 'monthly'
    });
    setModalActiveTab('manual');
    setIsModalOpen(true);
  };

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


  const removeBudget = (index: number) => {
    const newBudgets = userBudgets.filter((_, i) => i !== index);
    setUserBudgets(newBudgets);
  };
  const updateBudgetAmount = (index: number, newAmount: number) => {
    if(newAmount < 0) return;
    const newBudgets = [...userBudgets];
    newBudgets[index].amount = newAmount;
    setUserBudgets(newBudgets);
  };
  const handleAddBudgetSubmit = async () => {
    if (!newBudgetCategory || newBudgetAmount <= 0) return;
    const catName = expenseCategories.find(c => c.id === newBudgetCategory)?.name || 'Unknown';
    setUserBudgets([...userBudgets, { category_id: newBudgetCategory, amount: newBudgetAmount, sort_order: userBudgets.length, name: catName, is_system: true }]);
    setIsAddingBudget(false);
    setNewBudgetCategory('');
    setNewBudgetAmount(0);
  };
  const handleSaveBudgets = async () => {
    setBudgetsLoading(true);
    try {
      const promises = userBudgets.map(async (b, idx) => {
        b.sort_order = idx;
        if (b.id) {
          await supabase.from('budgets').update({ amount: b.amount, sort_order: b.sort_order }).eq('id', b.id);
        } else {
          await supabase.from('budgets').insert([{ category_id: b.category_id, amount: b.amount, budget_type_id: SEED.recurrences.monthly, sort_order: b.sort_order }]);
        }
      });
      await Promise.all(promises);
      const { data: currentBudgets } = await supabase.from('budgets').select('id');
      if (currentBudgets) {
        const keptIds = userBudgets.map(b => b.id).filter(Boolean);
        const toDeleteIds = currentBudgets.filter(b => !keptIds.includes(b.id)).map(b => b.id);
        if (toDeleteIds.length > 0) await supabase.from('budgets').delete().in('id', toDeleteIds);
      }
      setBudgetsMsg('Saved!');
      setTimeout(() => setBudgetsMsg(''), 3000);
    } catch (err) {
      toast.error('Error saving budgets');
    } finally {
      setBudgetsLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    confirm({
      title: 'Delete Transaction',
      description: 'Remove this transaction record?',
      destructive: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await supabase.from('transactions').delete().eq('id', id);
          fetchData();
          toast.success('Transaction deleted');
        } catch (err) {
          toast.error('Error deleting transaction');
        }
      }
    });
  };

  const handleExportCSV = () => {
    const headers = 'Date,Description,Amount,Type\n';
    const rows = transactions.map(tx => {
      const type = tx.transaction_type_id === SEED.transaction_types.income ? 'Income' : 'Spend';
      return `"${tx.date}","${tx.merchant.replace(/"/g, '""')}",${tx.amount},"${type}"`;
    }).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_finance_helper_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    // Fix memory leak
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Filter evaluation
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.merchant.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = 
      activeTab === 'all' || 
      (activeTab === 'income' && tx.transaction_type_id === SEED.transaction_types.income) ||
      (activeTab === 'spends' && tx.transaction_type_id === SEED.transaction_types.expense);
    
    const matchesCategory = true;

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const txDate = new Date(tx.date);
      const now = new Date();
      if (dateFilter === 'week') {
        const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        matchesDate = txDate >= lastWeek;
      } else if (dateFilter === 'month') {
        matchesDate = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
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
    <div className="flex flex-col gap-2 sm:gap-6">
      
      {/* HEADER: Title & Actions */}
      <div className="flex flex-row justify-between items-center w-full select-none">
        <div>
          <h1 className="page-title text-foreground">Transactions</h1>
          <p className="secondary-text hidden sm:block">Trace cash logs, view receipts, and record daily transactions.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button onClick={handleExportCSV} variant="outline" size="sm" className="flex items-center gap-1.5 cursor-pointer">
            <Download className="icon-inline" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button 
            onClick={handleOpenAdd} 
            size="sm" 
            className="flex items-center justify-center cursor-pointer h-10 w-10 p-0 sm:w-auto sm:px-3 sm:py-1.5 sm:gap-1.5 rounded-full sm:rounded-lg"
          >
            <Plus className="icon-inline" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </div>



      {/* FILTER BUTTON TABS */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-center justify-between select-none">
        <div className="w-full sm:w-72">
          <Tabs
            options={[
              { id: 'all', label: 'All Items' },
              { id: 'spends', label: 'Spends' },
              { id: 'income', label: 'Income' }
            ]}
            activeId={activeTab}
            onChange={(id: any) => setActiveTab(id)}
          />
        </div>

        {/* Small Search & Date Filter */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 w-full sm:w-auto">
          <select 
            value={dateFilter}
            onChange={(e: any) => setDateFilter(e.target.value)}
            className="no-focus-ring text-xs px-2 py-1.5 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-0 focus:border-border cursor-pointer h-[32px] w-full sm:w-auto"
          >
            <option value="all">All Time</option>
            <option value="week">Last 7 Days</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>

          <div className="flex items-center gap-2 px-3 py-1.5 clay-input-wrapper w-full sm:w-64 h-[48px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="no-focus-ring text-xs text-foreground bg-transparent border-none focus:outline-none focus:ring-0 flex-1"
            />
          </div>
        </div>
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

      
      {/* BUDGET TAB RENDER */}
      {activeTab === 'budgets' && (
        <Card className="mb-4">
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Monthly Budgets</h3>
              <Button size="sm" onClick={() => setIsAddingBudget(true)} className="flex items-center gap-1 cursor-pointer">
                <Plus className="h-4 w-4" /> Add Budget
              </Button>
            </div>
            
            {budgetsLoading ? (
               <div className="space-y-2">
                 {[1,2,3].map(i => <div key={i} className="h-16 bg-card border border-border/50 rounded-xl animate-pulse" />)}
               </div>
            ) : userBudgets.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-card rounded-xl border border-border/50">
                  <PieChart className="h-10 w-10 mb-2 opacity-20" />
                  <p>No budgets set</p>
                  <p className="text-xs opacity-70">Add a budget to keep your spending in check.</p>
               </div>
            ) : (
              <div className="space-y-3">
                {userBudgets.map((b, idx) => {
                   const spent = transactions.filter(t => t.category_id === b.category_id && t.transaction_type_id === SEED.transaction_types.expense).reduce((acc, t) => acc + Number(t.amount), 0);
                   const pct = Math.min((spent / (b.amount || 1)) * 100, 100);
                   const isWarning = pct >= 80;
                   const isDanger = pct >= 100;
                   return (
                     <div key={b.id || idx} className="p-4 bg-card rounded-xl border border-border/50">
                       <div className="flex justify-between items-center mb-2">
                         <span className="font-semibold">{b.name}</span>
                         <span className="text-sm font-medium">${spent.toLocaleString()} / ${b.amount.toLocaleString()}</span>
                       </div>
                       <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                         <div 
                           className={`h-full rounded-full ${isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-primary'}`} 
                           style={{ width: `${pct}%` }}
                         />
                       </div>
                       <div className="flex justify-between mt-3 text-xs">
                          <span className="text-muted-foreground">{pct.toFixed(0)}% used</span>
                          <div className="flex gap-2">
                            <button onClick={() => updateBudgetAmount(idx, b.amount - 50)} className="text-muted-foreground hover:text-foreground cursor-pointer">-$50</button>
                            <button onClick={() => updateBudgetAmount(idx, b.amount + 50)} className="text-muted-foreground hover:text-foreground cursor-pointer">+$50</button>
                            <button onClick={() => removeBudget(idx)} className="text-red-500/70 hover:text-red-500 ml-2 cursor-pointer">Remove</button>
                          </div>
                       </div>
                     </div>
                   );
                })}
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveBudgets} loading={budgetsLoading} className="cursor-pointer">Save Budgets</Button>
                </div>
                {budgetsMsg && <p className="text-sm text-primary text-right">{budgetsMsg}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* NEW BUDGET MODAL */}
      <Dialog isOpen={isAddingBudget} onClose={() => setIsAddingBudget(false)}>
        <div className="p-5 flex flex-col gap-4">
          <h2 className="text-lg font-bold">Add New Budget</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Category</label>
              <select 
                value={newBudgetCategory} 
                onChange={e => setNewBudgetCategory(e.target.value)}
                className="w-full p-2 bg-background border border-border rounded-lg text-sm"
              >
                <option value="">Select category...</option>
                {expenseCategories.filter(c => !userBudgets.some(b => b.category_id === c.id)).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Monthly Limit ($)</label>
              <input 
                type="number" 
                value={newBudgetAmount || ''} 
                onChange={e => setNewBudgetAmount(Number(e.target.value))}
                className="w-full p-2 bg-background border border-border rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsAddingBudget(false)}>Cancel</Button>
              <Button onClick={handleAddBudgetSubmit}>Add</Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* TRANSACTION FEED LISTINGS */}
      {activeTab !== 'budgets' && (
      <Card>
        <CardContent className="p-1 sm:p-2 space-y-0.5">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-[60px] w-full skeleton" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">No transactions found</p>
              <p className="text-xs opacity-70 mt-1">Adjust your filters or add a new transaction.</p>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const isIncome = tx.transaction_type_id === SEED.transaction_types.income;
              const isTransferTx = tx.transaction_type_id === SEED.transaction_types.transfer;
              const catName = isIncome
                ? incomeCategories.find(c => c.id === tx.category_id)?.name || 'General Income'
                : (isTransferTx ? 'Transfer' : expenseCategories.find(c => c.id === tx.category_id)?.name || 'General Spend');

              const sourceAccName = accounts.find(a => a.id === tx.account_id)?.name || 'Account';
              const destAccName = accounts.find(a => a.id === tx.transfer_to_account_id)?.name || 'Account';
              const displayMerchant = isTransferTx ? `${sourceAccName} → ${destAccName}` : tx.merchant;

              return (
                <div 
                  key={tx.id} 
                  onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/10 py-1.5 sm:py-2.5 px-3 gap-1 sm:gap-2 last:border-0 hover:bg-[#F8F8F8] dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                >
                  {/* Left block description */}
                  <div className="flex items-center gap-3 min-w-0 w-full sm:flex-1">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs select-none shrink-0 ${isIncome ? 'bg-green-500/10 text-green-500' : isTransferTx ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>
                      {isIncome ? 'I' : isTransferTx ? 'A' : 'S'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-extrabold text-foreground truncate leading-tight">{displayMerchant}</span>
                      <span className="text-xs text-muted-foreground/70 font-light mt-0.5 truncate leading-none block">
                        {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {catName}
                        {tx.is_recurring && (
                          <span className="ml-1.5 text-primary/60 bg-primary/10 px-1 py-0.5 rounded text-[10px] font-medium uppercase inline-flex items-center gap-1">
                            {tx.recurrence_interval} 
                            {tx.next_recurring_date && <span className="opacity-70">(Next: {tx.next_recurring_date})</span>}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Right block amount & actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 shrink-0 border-t border-border/10 sm:border-none">
                    <span className={`text-sm font-mono font-bold text-right sm:w-[100px] ${isIncome ? 'text-emerald-500/90' : isTransferTx ? 'text-blue-500/90' : 'text-foreground/75 dark:text-gray-300'}`}>
                      {isIncome || parseFloat(tx.amount) > 0 ? '+' : '-'}{currencySymbol}{Math.abs(parseFloat(tx.amount) || 0).toFixed(0)}
                    </span>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setSelectedTxForReceipt(tx)}
                        aria-label="View Receipt"
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-[#F8F8F8] hover:text-foreground dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleOpenEdit(tx)}
                        aria-label="Edit Transaction"
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-[#F8F8F8] hover:text-primary dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(tx.id)}
                        aria-label="Delete Transaction"
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-[#F8F8F8] hover:text-destructive dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-[16px] w-[16px]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
      )}

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
              <p><strong>Tip:</strong> If you are paying an upcoming bill, pay it directly from the Dashboard to avoid creating duplicate transaction records.</p>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
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
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
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
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">
                Amount ({currencySymbol}) {isTransfer && <span className="font-normal opacity-80">- Use negative for Money Out</span>}
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>
          </div>

          {!isTransfer && (
            <div className="flex flex-col gap-1">
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
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
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
                  <option value="" disabled>Select Destination Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
              <div className="relative group rounded-lg overflow-hidden border border-border/50 bg-background flex justify-center">
                <img src={receiptPreview} alt="Receipt preview" className="max-h-[160px] object-contain" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button type="button" onClick={() => { setReceiptFile(null); setReceiptPreview(null); }} className="text-white text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer">
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
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

      {/* QUICK ENTRY BOX (Moved to bottom) */}
      <div className="mt-8">
        <Card className="border border-primary/20 bg-primary/5 shadow-xs">
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

    </div>
  );
};
