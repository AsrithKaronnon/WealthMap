import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { confirm } from '../lib/useConfirmStore';
import { SEED } from '../lib/supabaseMock';
import {
  Plus, TrendingUp, Landmark, Search, Trash2, Edit2, Loader2,
  Banknote, Building2, Car, Package, Coins, Settings2, RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Tabs } from '../components/ui/Tabs';
import { computeAccountBalances } from '../lib/accountUtils';

// ─── Asset Tab Definitions ────────────────────────────────────────────────────
const ALL_ASSET_TABS = [
  { id: 'liquid', label: 'Liquid', icon: Banknote, description: 'Bank & Cash accounts' },
  { id: 'investments', label: 'Investments', icon: TrendingUp, description: 'Stocks, MFs & FDs' },
  { id: 'physical', label: 'Physical', icon: Building2, description: 'Property, Gold & Vehicles' },
];



// ─── Label helpers ────────────────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  bank_cash: 'Balance',
  gold: 'Current Value',
  fd: 'Maturity Value',
  property: 'Current Market Value',
  vehicle: 'Current Value',
  other: 'Current Value',
};

export const Investments: React.FC = () => {

  // ── Existing Investments (Stocks & MF) state ──────────────────────────────
  const [loading, setLoading] = useState(true);
  const [investments, setInvestments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSearchTab, setActiveSearchTab] = useState<'stocks' | 'mf'>('stocks');
  const [formData, setFormData] = useState({
    id: '',
    symbol: '',
    name: '',
    quantity: 0,
    investment_type_id: SEED.investment_types.mutual_funds,
    is_sip: false,
    sip_amount: 0,
    sip_date: 5,
    sip_account_id: ''
  });

  const [isAddChoiceModalOpen, setIsAddChoiceModalOpen] = useState(false);

  // ── New Assets state ──────────────────────────────────────────────────────
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assets, setAssets] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [activeAssetTab, setActiveAssetTab] = useState('liquid');
  
  
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [hiddenAccountIds, setHiddenAccountIds] = useState<string[]>([]);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountForm, setAccountForm] = useState<any>({
    id: '', name: '', account_type: 'Checking', opening_balance: ''
  });
  const [assetForm, setAssetForm] = useState<any>({
    asset_category: 'other',
    id: '',
    name: '',
    current_value: '',
    purchase_value: '',
    purchase_date: '',
    notes: '',
    metadata: {}
  });

  // ─── Data Fetching ────────────────────────────────────────────────────────
  const fetchInvestments = async () => {
    setLoading(true);
    try {
      const [
        { data: invData },
        { data: accData },
        { data: txData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('investments').select('*'),
        supabase.from('accounts').select('*').order('name', { ascending: true }),
        supabase.from('transactions').select('id, account_id, transfer_to_account_id, transaction_type_id, amount, is_deleted'),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol), enabled_asset_tabs, hidden_asset_account_ids').maybeSingle()
      ]);

      if (accData) setAccounts(accData);
      if (txData) setAllTransactions(txData);

      if (invData) {
        setInvestments(invData);
        if (invData.length > 0) fetchLivePrices(invData);
      }

      if (settingsData?.currencies) {
        const sym = Array.isArray(settingsData.currencies)
          ? settingsData.currencies[0]?.symbol
          : (settingsData.currencies as any)?.symbol;
        if (sym) setCurrencySymbol(sym);
      }



      if (settingsData?.hidden_asset_account_ids) {
        setHiddenAccountIds(settingsData.hidden_asset_account_ids);
      }
    } catch (err) {
      console.error('Failed to load investments', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    setAssetsLoading(true);
    try {
      const { data } = await supabase.from('assets').select('*').eq('is_deleted', false);
      if (data) setAssets(data);
    } catch (err) {
      console.error('Failed to load assets', err);
    } finally {
      setAssetsLoading(false);
    }
  };

  const fetchLivePrices = async (invs: any[]) => {
    if (invs.length === 0) return;
    setIsFetchingPrices(true);
    try {
      const newPrices: Record<string, number> = {};
      const mfSymbols = invs.filter(i => i.investment_type_id === SEED.investment_types.mutual_funds).map(i => i.symbol);
      const stockSymbols = invs.filter(i => i.investment_type_id === SEED.investment_types.stocks).map(i => i.symbol);
      const promises = [];

      if (mfSymbols.length > 0) {
        promises.push(Promise.all(mfSymbols.map(async (symbol) => {
          try {
            const res = await fetch(`https://api.mfapi.in/mf/${symbol}`);
            const data = await res.json();
            if (data?.data?.length > 0) newPrices[symbol] = parseFloat(data.data[0].nav);
          } catch (e) {
            console.error(`Failed to fetch NAV for ${symbol}:`, e);
          }
        })));
      }

      if (stockSymbols.length > 0) {
        promises.push((async () => {
          const { data, error } = await supabase.functions.invoke('finance', {
            body: { action: 'quote', symbols: stockSymbols }
          });
          if (!error && data?.quoteResponse?.result) {
            data.quoteResponse.result.forEach((q: any) => {
              newPrices[q.symbol] = q.regularMarketPrice;
            });
          }
        })());
      }

      await Promise.all(promises);
      setLivePrices(prev => ({ ...prev, ...newPrices }));
    } catch (err) {
      console.error('Failed to fetch live prices:', err);
    } finally {
      setIsFetchingPrices(false);
    }
  };

  useEffect(() => {
    fetchInvestments();
    fetchAssets();
  }, []);

  // Debounced search (existing — unchanged)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length < 2) { setSearchResults([]); return; }
      setIsSearching(true);
      try {
        if (activeSearchTab === 'mf') {
          const res = await fetch(`https://api.mfapi.in/mf/search?q=${searchQuery}`);
          const data = await res.json();
          if (Array.isArray(data)) setSearchResults(data.slice(0, 10));
        } else {
          const { data, error } = await supabase.functions.invoke('finance', {
            body: { action: 'search', query: searchQuery }
          });
          if (error) throw error;
          if (data?.quotes) {
            setSearchResults(data.quotes.filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF'));
          }
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeSearchTab]);

  // ─── Existing Investments Handlers (unchanged) ────────────────────────────
  const handleOpenAdd = () => {
    setFormData({ id: '', symbol: '', name: '', quantity: 0, investment_type_id: SEED.investment_types.mutual_funds, is_sip: false, sip_amount: 0, sip_date: 5, sip_account_id: '' });
    setSearchQuery('');
    setSearchResults([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (inv: any) => {
    setFormData({
      id: inv.id,
      symbol: inv.symbol || '',
      name: inv.name || '',
      quantity: inv.quantity || 0,
      investment_type_id: inv.investment_type_id || SEED.investment_types.mutual_funds,
      is_sip: inv.is_sip || false,
      sip_amount: inv.sip_amount || 0,
      sip_date: inv.sip_date || 5,
      sip_account_id: inv.sip_account_id || ''
    });
    setSearchQuery('');
    setSearchResults([]);
    setIsModalOpen(true);
  };

  const handleSelectAsset = (res: any) => {
    setFormData({
      ...formData,
      symbol: activeSearchTab === 'mf' ? String(res.schemeCode) : res.symbol,
      name: activeSearchTab === 'mf' ? res.schemeName : (res.longname || res.shortname || res.symbol),
      investment_type_id: activeSearchTab === 'mf' ? SEED.investment_types.mutual_funds : SEED.investment_types.stocks
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.symbol || formData.quantity <= 0) {
      toast.error('Please select an asset and enter a valid quantity.');
      return;
    }
    try {
      if (formData.id) {
        const { error } = await supabase.from('investments').update({
          symbol: formData.symbol,
          name: formData.name,
          quantity: formData.quantity,
          investment_type_id: formData.investment_type_id,
          is_sip: formData.is_sip,
          sip_amount: formData.is_sip ? formData.sip_amount : 0,
          sip_date: formData.is_sip ? formData.sip_date : null,
          sip_account_id: formData.is_sip ? (formData.sip_account_id || null) : null
        }).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        const { error } = await supabase.from('investments').insert([{
          symbol: formData.symbol,
          name: formData.name,
          quantity: formData.quantity,
          investment_type_id: formData.investment_type_id,
          is_sip: formData.is_sip,
          sip_amount: formData.is_sip ? formData.sip_amount : 0,
          sip_date: formData.is_sip ? formData.sip_date : null,
          sip_account_id: formData.is_sip ? (formData.sip_account_id || null) : null,
          user_id: session.user.id
        }]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchInvestments();
      toast.success('Asset saved successfully');
    } catch (err: any) {
      toast.error('Error saving asset: ' + err.message);
    }
  };

  const handleDelete = (id: string) => {
    confirm({
      title: 'Remove Asset',
      description: 'Are you sure you want to remove this asset?',
      destructive: true,
      confirmText: 'Remove',
      onConfirm: async () => {
        try {
          await supabase.from('investments').delete().eq('id', id);
          fetchInvestments();
          toast.success('Asset removed');
        } catch (err) {
          toast.error('Error deleting asset');
        }
      }
    });
  };

  // ─── New Asset Handlers ───────────────────────────────────────────────────
  const handleOpenAddAsset = () => {
    setAssetForm({ id: '', name: '', asset_category: activeAssetTab === 'investments' ? 'fd' : 'gold', current_value: '', purchase_value: '', purchase_date: '', notes: '', metadata: {} });
    setIsAssetModalOpen(true);
  };

  const handleOpenEditAsset = (asset: any) => {
    setAssetForm({
      id: asset.id,
      asset_category: asset.asset_category,
      name: asset.name,
      current_value: asset.current_value || '',
      purchase_value: asset.purchase_value || '',
      purchase_date: asset.purchase_date || '',
      notes: asset.notes || '',
      metadata: asset.metadata || {}
    });
    setIsAssetModalOpen(true);
  };

  const setMeta = (key: string, val: any) => {
    setAssetForm((prev: any) => ({ ...prev, metadata: { ...prev.metadata, [key]: val } }));
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: assetForm.name,
        asset_category: assetForm.asset_category,
        current_value: parseFloat(assetForm.current_value) || 0,
        notes: assetForm.notes || '',
        metadata: assetForm.metadata || {}
      };

      // Only include purchase fields where relevant
      if (activeAssetTab !== 'bank_cash') {
        payload.purchase_value = parseFloat(assetForm.purchase_value) || 0;
        payload.purchase_date = assetForm.purchase_date || null;
      }

      if (assetForm.id) {
        const { error } = await supabase.from('assets').update(payload).eq('id', assetForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assets').insert([payload]);
        if (error) throw error;
      }
      setIsAssetModalOpen(false);
      fetchAssets();
      toast.success('Asset saved!');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  const handleDeleteAsset = (id: string) => {
    confirm({
      title: 'Remove Asset',
      description: 'Are you sure you want to remove this asset?',
      destructive: true,
      confirmText: 'Remove',
      onConfirm: async () => {
        await supabase.from('assets').update({ is_deleted: true }).eq('id', id);
        fetchAssets();
        toast.success('Asset removed');
      }
    });
  };

  // ─── Account Handlers (Bank & Cash) ───────────────────────────────────────
  const handleOpenAddAccount = () => {
    setAccountForm({ id: '', name: '', account_type: 'Checking', opening_balance: '' });
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: any) => {
    setAccountForm({
      id: acc.id,
      name: acc.name,
      account_type: acc.account_type || 'Checking',
      opening_balance: acc.account_type === 'Credit Card' ? (acc.credit_limit || 0) : (acc.computed_balance || 0)
    });
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: accountForm.name,
        account_type: accountForm.account_type,
        currency_id: SEED.currencies.usd
      };
      
      const val = parseFloat(accountForm.opening_balance as string) || 0;
      if (accountForm.account_type === 'Credit Card') {
        payload.credit_limit = val;
        // Only set balance if it's a new account, otherwise we preserve current available credit
        if (!accountForm.id) {
          payload.balance = val;
        }
      } else {
        payload.balance = val;
      }
      
      const { data: settings } = await supabase.from('user_settings').select('base_currency_id').maybeSingle();
      if (settings?.base_currency_id) payload.currency_id = settings.base_currency_id;

      if (accountForm.id) {
        const { error } = await supabase.from('accounts').update(payload).eq('id', accountForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('accounts').insert([payload]);
        if (error) throw error;
      }
      setIsAccountModalOpen(false);
      fetchInvestments();
      toast.success('Account saved!');
    } catch (err: any) {
      toast.error('Error saving account: ' + err.message);
    }
  };

  const handleResetCreditCard = async (acc: any) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ balance: acc.credit_limit || 0 })
        .eq('id', acc.id);
      if (error) throw error;
      fetchInvestments();
      toast.success('Credit card reset to full limit!');
    } catch (err: any) {
      toast.error('Failed to reset credit card: ' + err.message);
    }
  };

  const handleHideAccount = (id: string) => {
    confirm({
      title: 'Hide Account',
      description: 'This will hide the account from the Assets page, but it will still be visible in other parts of the app.',
      destructive: false,
      confirmText: 'Hide',
      onConfirm: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');
          
          const newHiddenIds = [...hiddenAccountIds, id];
          setHiddenAccountIds(newHiddenIds);
          
          const { error } = await supabase.from('user_settings')
            .update({ hidden_asset_account_ids: newHiddenIds })
            .eq('created_by', user.id);
            
          if (error) throw error;
          toast.success('Account hidden from assets');
        } catch (err: any) {
          toast.error('Error hiding account: ' + err.message);
        }
      }
    });
  };



  // ─── Computed Values ──────────────────────────────────────────────────────
  const accountsWithBalance = useMemo(() => {
    return computeAccountBalances(accounts, allTransactions).filter(a => !hiddenAccountIds.includes(a.id));
  }, [accounts, allTransactions, hiddenAccountIds]);
  const investmentsTotal = investments.reduce((acc, inv) => acc + (inv.quantity * (livePrices[inv.symbol] || 0)), 0);
  const assetsTotal = assets.reduce((acc, a) => acc + parseFloat(a.current_value || 0), 0);
  const bankCashTotal = accountsWithBalance.reduce((acc, a) => acc + a.computed_balance, 0);
  const totalNetWorth = investmentsTotal + assetsTotal + bankCashTotal;
  const currentTabAssets = assets.filter(a => {
    if (activeAssetTab === 'investments') return a.asset_category === 'fd';
    if (activeAssetTab === 'physical') return ['gold', 'property', 'vehicle', 'other'].includes(a.asset_category);
    return false;
  });
  

  // Shared input class for clay morphism style matching the rest of the app
  const inp = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-0 focus:border-primary transition-colors';

  // ─── Per-category form fields ─────────────────────────────────────────────
  const renderFormFields = () => {
    const meta = assetForm.metadata || {};

    switch (assetForm.asset_category) {
      case 'bank_cash':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Bank / Institution</label>
              <input type="text" placeholder="e.g. HDFC Bank" value={meta.bank_name || ''} onChange={e => setMeta('bank_name', e.target.value)} className={inp} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Account Type</label>
              <select value={meta.account_type || 'Savings'} onChange={e => setMeta('account_type', e.target.value)} className={inp}>
                <option>Savings</option>
                <option>Current</option>
                <option>Cash / Wallet</option>
                <option>Other</option>
              </select>
            </div>
          </div>
        );

      case 'gold':
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Gold Type</label>
                <select value={meta.gold_type || 'Physical Jewellery'} onChange={e => setMeta('gold_type', e.target.value)} className={inp}>
                  <option>Physical Jewellery</option>
                  <option>Physical Coins / Bars</option>
                  <option>Digital Gold</option>
                  <option>Gold ETF</option>
                  <option>Sovereign Gold Bond</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Purity</label>
                <select value={meta.purity || '22K'} onChange={e => setMeta('purity', e.target.value)} className={inp}>
                  <option>24K (99.9%)</option>
                  <option>22K (91.6%)</option>
                  <option>18K (75%)</option>
                  <option>N/A (ETF/Digital)</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Weight (grams)</label>
              <input type="number" step="0.001" min="0" placeholder="e.g. 50.5" value={meta.grams || ''} onChange={e => setMeta('grams', parseFloat(e.target.value) || 0)} className={`${inp} font-mono`} />
            </div>
          </>
        );

      case 'fd':
        return (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Bank / Institution</label>
              <input type="text" placeholder="e.g. SBI, HDFC" value={meta.bank_name || ''} onChange={e => setMeta('bank_name', e.target.value)} className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Interest Rate (%)</label>
                <input type="number" step="0.01" placeholder="e.g. 7.5" value={meta.interest_rate || ''} onChange={e => setMeta('interest_rate', parseFloat(e.target.value) || 0)} className={`${inp} font-mono`} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Maturity Date</label>
                <input type="date" value={meta.maturity_date || ''} onChange={e => setMeta('maturity_date', e.target.value)} className={inp} />
              </div>
            </div>
          </>
        );

      case 'property':
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Property Type</label>
                <select value={meta.property_type || 'Apartment'} onChange={e => setMeta('property_type', e.target.value)} className={inp}>
                  <option>Apartment</option>
                  <option>Independent House</option>
                  <option>Villa</option>
                  <option>Land / Plot</option>
                  <option>Commercial</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Area (sqft, optional)</label>
                <input type="number" placeholder="e.g. 1200" value={meta.area_sqft || ''} onChange={e => setMeta('area_sqft', parseFloat(e.target.value) || 0)} className={`${inp} font-mono`} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Address (optional)</label>
              <input type="text" placeholder="e.g. 3BHK, Kondapur, Hyderabad" value={meta.address || ''} onChange={e => setMeta('address', e.target.value)} className={inp} />
            </div>
          </>
        );

      case 'vehicle':
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Make</label>
                <input type="text" placeholder="e.g. Toyota" value={meta.make || ''} onChange={e => setMeta('make', e.target.value)} className={inp} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Model</label>
                <input type="text" placeholder="e.g. Innova Crysta" value={meta.model || ''} onChange={e => setMeta('model', e.target.value)} className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Year</label>
                <input type="number" min="1990" max="2030" placeholder="e.g. 2022" value={meta.year || ''} onChange={e => setMeta('year', parseInt(e.target.value) || 0)} className={`${inp} font-mono`} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Reg. Number (optional)</label>
                <input type="text" placeholder="e.g. TS09 AB 1234" value={meta.registration_number || ''} onChange={e => setMeta('registration_number', e.target.value)} className={inp} />
              </div>
            </div>
          </>
        );

      default: // other
        return (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground uppercase">Description</label>
            <textarea placeholder="Describe this asset..." value={meta.description || ''} onChange={e => setMeta('description', e.target.value)} className={`${inp} resize-none h-20`} />
          </div>
        );
    }
  };

  // ─── Per-category card subtitle ───────────────────────────────────────────
  const getCardSubtitle = (asset: any) => {
    const meta = asset.metadata || {};
    switch (asset.asset_category) {
      case 'bank_cash': return `${meta.bank_name || ''}${meta.bank_name && meta.account_type ? ' · ' : ''}${meta.account_type || ''}${meta.account_number_last4 ? ` ···${meta.account_number_last4}` : ''}`;
      case 'gold': return `${meta.grams || 0}g · ${meta.purity || ''} · ${meta.gold_type || ''}`;
      case 'fd': return `${meta.bank_name || ''} · ${meta.interest_rate || 0}% p.a. · Matures ${meta.maturity_date || 'N/A'}`;
      case 'property': return `${meta.property_type || ''}${meta.area_sqft ? ` · ${meta.area_sqft} sqft` : ''}${meta.address ? ` · ${meta.address}` : ''}`;
      case 'vehicle': return `${meta.make || ''} ${meta.model || ''} · ${meta.year || ''}${meta.registration_number ? ` · ${meta.registration_number}` : ''}`;
      default: return meta.description || '';
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 sm:gap-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <div className="flex justify-between items-center w-full sm:w-auto">
          <div>
            <h1 className="page-title text-foreground m-0">Assets</h1>
            <p className="secondary-text hidden sm:block mt-1">Your complete net worth — investments, savings, gold & more.</p>
          </div>
          {/* Mobile Buttons */}
          <div className="flex sm:hidden items-center gap-2">
            <Button size="sm" onClick={() => {
              if (activeAssetTab === 'liquid') handleOpenAddAccount();
              else if (activeAssetTab === 'investments') setIsAddChoiceModalOpen(true);
              else handleOpenAddAsset();
            }} className="flex items-center gap-1.5 cursor-pointer px-2.5">
              <Plus className="h-4 w-4" />
              <span>Add</span>
            </Button>
          </div>
        </div>
        <p className="secondary-text sm:hidden w-full text-left">Your complete net worth — investments, savings, gold & more.</p>
        
        {/* Desktop Buttons */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={() => {
            if (activeAssetTab === 'liquid') handleOpenAddAccount();
            else if (activeAssetTab === 'investments') setIsAddChoiceModalOpen(true);
            else handleOpenAddAsset();
          }} className="flex items-center gap-1.5 cursor-pointer">
            <Plus className="h-4 w-4" />
            Add {activeAssetTab === 'liquid' ? 'Account' : activeAssetTab === 'investments' ? 'Investment' : 'Asset'}
          </Button>
        </div>
      </div>

      {/* Total Net Worth Banner */}
      <div className="bg-primary text-primary-foreground border-none rounded-2xl shadow-lg transition-all duration-300 overflow-hidden">
        <div className="p-5 sm:p-7 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-col text-center sm:text-left">
            <span className="text-xs font-semibold uppercase tracking-widest opacity-75 mb-1">Total Net Worth</span>
            <span className="text-4xl sm:text-5xl font-extrabold flex items-center justify-center sm:justify-start">
              {(loading || assetsLoading || isFetchingPrices) ? (
                <div className="h-10 sm:h-12 w-40 sm:w-56 bg-white/20 animate-pulse rounded-lg mt-1" />
              ) : (
                `${currencySymbol}${totalNetWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
              )}
            </span>
          </div>
          <div className="flex flex-row justify-between sm:justify-start w-full sm:w-auto mt-3 sm:mt-0 gap-1 sm:gap-3">
            <div className="bg-white/10 rounded-xl px-1 sm:px-4 py-1.5 sm:py-2 text-center flex-1 sm:flex-none sm:min-w-[120px]">
              <div className="opacity-70 mb-0.5 text-[9px] sm:text-xs truncate">Bank & Cash</div>
              <div className="font-bold text-[10px] sm:text-sm flex justify-center mt-1">
                {loading ? <div className="h-3 w-10 sm:h-4 sm:w-16 bg-white/20 animate-pulse rounded" /> : `${currencySymbol}${bankCashTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              </div>
            </div>
            <div className="bg-white/10 rounded-xl px-1 sm:px-4 py-1.5 sm:py-2 text-center flex-1 sm:flex-none sm:min-w-[120px]">
              <div className="opacity-70 mb-0.5 text-[9px] sm:text-xs truncate">Stocks & MF</div>
              <div className="font-bold text-[10px] sm:text-sm flex justify-center mt-1">
                {(loading || isFetchingPrices) ? <div className="h-3 w-10 sm:h-4 sm:w-16 bg-white/20 animate-pulse rounded" /> : `${currencySymbol}${investmentsTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              </div>
            </div>
            <div className="bg-white/10 rounded-xl px-1 sm:px-4 py-1.5 sm:py-2 text-center flex-1 sm:flex-none sm:min-w-[120px]">
              <div className="opacity-70 mb-0.5 text-[9px] sm:text-xs truncate">Other Assets</div>
              <div className="font-bold text-[10px] sm:text-sm flex justify-center mt-1">
                {assetsLoading ? <div className="h-3 w-10 sm:h-4 sm:w-16 bg-white/20 animate-pulse rounded" /> : `${currencySymbol}${assetsTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Tab Bar — using same Tabs component as Goals page */}
      <div className="overflow-x-auto pb-1">
        <Tabs
          options={ALL_ASSET_TABS.map(t => ({ id: t.id, label: t.label }))}
          activeId={activeAssetTab}
          onChange={setActiveAssetTab}
        />
      </div>

      {/* ── STOCKS & MF TAB (existing UI — completely unchanged) ── */}
      {activeAssetTab === 'investments' && (
        <>
          {loading ? (
            <div className="h-64 animate-pulse bg-card border border-border/50 rounded-xl" />
          ) : investments.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border rounded-2xl flex flex-col justify-center items-center gap-3">
              <Landmark className="h-12 w-12 text-muted-foreground/40" />
              <div className="text-sm font-semibold text-foreground">No market assets yet</div>
              <Button size="sm" onClick={handleOpenAdd} variant="outline" className="mt-2">Start Tracking</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...investments].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(inv => {
                const price = livePrices[inv.symbol] || 0;
                const totalVal = inv.quantity * price;
                return (
                  <Card key={inv.id} className="group hover:border-primary/50 transition-colors">
                    <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-bold text-base truncate">{inv.symbol}</span>
                          <span className="text-xs text-muted-foreground truncate">{inv.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenEdit(inv)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(inv.id)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <div className="flex justify-between items-end pt-2 border-t border-border/30">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Quantity</span>
                          <span className="text-sm font-semibold">{Number(inv.quantity).toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 text-right">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Live Price</span>
                          <span className="text-sm font-semibold">{price > 0 ? `${currencySymbol}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---'}</span>
                        </div>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-2.5 flex justify-between items-center mt-1">
                        <span className="text-xs font-semibold text-muted-foreground">Total Value</span>
                        <span className="font-bold text-foreground">{currencySymbol}{totalVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── BANK & CASH TAB — live computed balances from transactions ── */}
      {activeAssetTab === 'liquid' && (
        <>
          {loading ? (
            <div className="h-48 animate-pulse bg-card border border-border/50 rounded-xl" />
          ) : accountsWithBalance.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border rounded-2xl flex flex-col justify-center items-center gap-3">
              <Banknote className="h-12 w-12 text-muted-foreground/40" />
              <div className="text-sm font-semibold text-foreground">No accounts yet</div>
              <p className="text-xs text-muted-foreground max-w-xs">Add transactions with an account to see balances here. Balances are computed live from your transaction history.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accountsWithBalance.map(acc => (
                <Card key={acc.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-base truncate">{acc.name}</span>
                        <span className="text-xs text-muted-foreground">{acc.account_type || 'Account'}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenEditAccount(acc)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors cursor-pointer" title="Edit"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleHideAccount(acc.id)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer" title="Hide Account"><Trash2 className="h-3.5 w-3.5" /></button>
                        {acc.account_type === 'Credit Card' && (
                          <button onClick={() => handleResetCreditCard(acc)} className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors cursor-pointer" title="Pay Off / Reset"><RefreshCw className="h-3.5 w-3.5" /></button>
                        )}
                        <span className="ml-1 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full hidden sm:block">Live</span>
                      </div>
                    </div>

                    <div className="bg-secondary/30 rounded-lg p-3 mt-1 flex justify-between items-center">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                          {acc.account_type === 'Credit Card' ? 'Available Credit' : 'Current Balance'}
                        </span>
                        <span className={`font-bold text-lg leading-none ${acc.computed_balance >= 0 || acc.account_type === 'Credit Card' ? 'text-foreground' : 'text-rose-500'}`}>
                          {acc.account_type !== 'Credit Card' && acc.computed_balance < 0 ? '-' : ''}{currencySymbol}{Math.abs(acc.computed_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {acc.account_type === 'Credit Card' && (
                        <div className="flex flex-col gap-0.5 text-right">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Limit</span>
                          <span className="font-bold text-sm leading-none text-muted-foreground">
                            {currencySymbol}{(acc.credit_limit || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── OTHER ASSET TABS (Gold, FD, Property, Vehicle, Other) ── */}
      {(activeAssetTab === 'investments' || activeAssetTab === 'physical') && (
        <>
          {assetsLoading ? (
            <div className="h-48 animate-pulse bg-card border border-border/50 rounded-xl" />
          ) : currentTabAssets.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border rounded-2xl flex flex-col justify-center items-center gap-3">
              {(() => { const TabIcon = ALL_ASSET_TABS.find(t => t.id === activeAssetTab)?.icon || Package; return <TabIcon className="h-12 w-12 text-muted-foreground/40" />; })()}
              <div className="text-sm font-semibold text-foreground">{activeAssetTab === 'investments' ? 'No Fixed Deposits yet' : 'No Physical assets yet'}</div>
              <Button size="sm" onClick={handleOpenAddAsset} variant="outline" className="mt-2">Add Your First</Button>
            </div>
          ) : (
            <>
              {/* Section header for FDs if in investments tab */}
              {activeAssetTab === 'investments' && currentTabAssets.length > 0 && (
                 <div className="mt-8 mb-4">
                   <h3 className="text-lg font-bold text-foreground">Fixed Deposits & Bonds</h3>
                 </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentTabAssets.map(asset => (
                <Card key={asset.id} className="group hover:border-primary/50 transition-colors">
                  <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-bold text-base truncate">{asset.name}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">{getCardSubtitle(asset)}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenEditAsset(asset)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDeleteAsset(asset.id)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Purchase vs Current Value */}
                    {parseFloat(asset.purchase_value) > 0 && (
                      <div className="flex justify-between items-end pt-2 border-t border-border/30">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">{asset.asset_category === 'fd' ? 'Principal' : 'Invested'}</span>
                          <span className="text-sm font-semibold">{currencySymbol}{parseFloat(asset.purchase_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                        {parseFloat(asset.current_value) > 0 && (
                          <div className="flex flex-col gap-0.5 text-right">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">P&L</span>
                            <span className={`text-sm font-bold ${parseFloat(asset.current_value) >= parseFloat(asset.purchase_value) ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {parseFloat(asset.current_value) >= parseFloat(asset.purchase_value) ? '+' : '-'}
                              {currencySymbol}{Math.abs(parseFloat(asset.current_value) - parseFloat(asset.purchase_value)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-secondary/30 rounded-lg p-2.5 flex justify-between items-center mt-auto">
                      <span className="text-xs font-semibold text-muted-foreground">{FIELD_LABELS[asset.asset_category] || 'Value'}</span>
                      <span className="font-bold text-foreground">{currencySymbol}{parseFloat(asset.current_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              </div>
            </>
          )}
        </>
      )}


      {/* ── STOCKS & MF Add/Edit Modal (existing, unchanged) ── */}
      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? 'Edit Asset' : 'Add New Asset'}>
        <div className="flex flex-col gap-4 mt-2">
          {!formData.symbol ? (
            <div className="flex flex-col gap-2 relative">
              <div className="flex bg-secondary/30 p-1 rounded-lg">
                <button type="button" onClick={() => { setActiveSearchTab('stocks'); setSearchResults([]); setSearchQuery(''); }} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${activeSearchTab === 'stocks' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
                  Stocks & ETFs
                </button>
                <button type="button" onClick={() => { setActiveSearchTab('mf'); setSearchResults([]); setSearchQuery(''); }} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${activeSearchTab === 'mf' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>
                  Indian Mutual Funds
                </button>
              </div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase mt-2">Search {activeSearchTab === 'mf' ? 'Mutual Fund' : 'Ticker'}</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input autoFocus type="text" placeholder={activeSearchTab === 'mf' ? 'e.g. Parag Parikh, Quant' : 'e.g. AAPL, TSLA, REL'} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="no-focus-ring pl-9 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-0 focus:border-primary transition-colors" />
                {isSearching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {searchResults.length > 0 && (
                <div className="absolute top-[110px] left-0 right-0 bg-popover border border-border rounded-lg shadow-xl z-50 max-h-[250px] overflow-y-auto">
                  {searchResults.map((res, i) => (
                    <button key={i} type="button" onClick={() => handleSelectAsset(res)} className="w-full text-left px-3 py-2.5 hover:bg-muted border-b border-border/50 last:border-0 flex flex-col cursor-pointer transition-colors">
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-sm text-foreground">{activeSearchTab === 'mf' ? res.schemeCode : res.symbol}</span>
                        <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase">{activeSearchTab === 'mf' ? 'MF' : 'Stock'}</span>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">{activeSearchTab === 'mf' ? res.schemeName : (res.longname || res.shortname)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Selected Asset</label>
              <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-secondary/20">
                <div className="flex flex-col min-w-0 pr-4">
                  <span className="font-bold text-sm text-foreground">{formData.symbol}</span>
                  <span className="text-xs text-muted-foreground truncate">{formData.name}</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, symbol: '', name: '' })} className="shrink-0 cursor-pointer h-7 text-[10px]">Change</Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground uppercase">Quantity Owned (Units)</label>
            <input type="number" step="0.0001" min="0" required value={formData.quantity || ''} onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })} className="no-focus-ring w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-0 focus:border-primary transition-colors font-mono" placeholder="e.g. 10.5" />
          </div>

          <div className="mt-2 p-4 border border-border rounded-lg bg-secondary/10 flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={formData.is_sip} onChange={(e) => setFormData({ ...formData, is_sip: e.target.checked })} className="rounded text-primary focus:ring-primary h-4 w-4" />
              <span className="text-sm font-bold text-foreground">Enable Monthly SIP Automation</span>
            </label>
            {formData.is_sip && (
              <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
                <p className="text-[11px] text-muted-foreground">The system will automatically log a transaction and buy units on this date every month.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">SIP Date (Day of Month)</label>
                    <select value={formData.sip_date} onChange={(e) => setFormData({ ...formData, sip_date: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Amount ({currencySymbol})</label>
                    <input type="number" min="1" value={formData.sip_amount || ''} onChange={(e) => setFormData({ ...formData, sip_amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" placeholder="5000" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Pay From Account</label>
                  <select value={formData.sip_account_id} onChange={(e) => setFormData({ ...formData, sip_account_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                    <option value="">-- Select Account --</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          <Button onClick={handleSave} className="w-full mt-2 cursor-pointer">Save Asset</Button>
        </div>
      </Dialog>

      {/* ── Other Asset Add/Edit Modal ── */}
      <Dialog
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        title={`${assetForm.id ? 'Edit' : 'Add'} ${ALL_ASSET_TABS.find(t => t.id === activeAssetTab)?.label || 'Asset'}`}
      >
        <form onSubmit={handleSaveAsset} className="flex flex-col gap-4 mt-2">
          {/* Category Dropdown (Only for Physical) */}
          {activeAssetTab === 'physical' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Asset Category</label>
              <select required value={assetForm.asset_category} onChange={e => setAssetForm({ ...assetForm, asset_category: e.target.value })} className={inp}>
                <option value="gold">Gold</option>
                <option value="property">Real Estate / Property</option>
                <option value="vehicle">Vehicle</option>
                <option value="other">Other Asset</option>
              </select>
            </div>
          )}

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground uppercase">Asset Name</label>
            <input required type="text" placeholder={
              assetForm.asset_category === 'bank_cash' ? 'e.g. HDFC Savings Account' :
              assetForm.asset_category === 'gold' ? 'e.g. Gold Necklace - Malabar' :
              assetForm.asset_category === 'fd' ? 'e.g. SBI FD - 2024' :
              assetForm.asset_category === 'property' ? 'e.g. 3BHK Flat, Kondapur' :
              assetForm.asset_category === 'vehicle' ? 'e.g. Honda City 2022' :
              'e.g. Bitcoin Holdings'
            } value={assetForm.name} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} className={inp} />
          </div>

          {/* Category-specific fields */}
          {renderFormFields()}

          {/* Value fields — gold only needs purchase (current fetched live) */}
          {assetForm.asset_category === 'gold' ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Purchase Value ({currencySymbol}) — optional</label>
              <input type="number" step="0.01" min="0" placeholder="0.00" value={assetForm.purchase_value} onChange={e => setAssetForm({ ...assetForm, purchase_value: e.target.value })} className={`${inp} font-mono`} />
            </div>
          ) : (
            <div className={`grid gap-3 ${assetForm.asset_category !== 'bank_cash' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">{FIELD_LABELS[assetForm.asset_category] || 'Current Value'} ({currencySymbol})</label>
                <input required type="number" step="0.01" min="0" placeholder="0.00" value={assetForm.current_value} onChange={e => setAssetForm({ ...assetForm, current_value: e.target.value })} className={`${inp} font-mono`} />
              </div>
              {assetForm.asset_category !== 'bank_cash' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">
                    {assetForm.asset_category === 'fd' ? 'Principal Amount' : 'Purchase / Invested'} ({currencySymbol})
                  </label>
                  <input type="number" step="0.01" min="0" placeholder="0.00" value={assetForm.purchase_value} onChange={e => setAssetForm({ ...assetForm, purchase_value: e.target.value })} className={`${inp} font-mono`} />
                </div>
              )}
            </div>
          )}

          {assetForm.asset_category !== 'bank_cash' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">
                {assetForm.asset_category === 'fd' ? 'FD Start Date' : 'Purchase Date'} (optional)
              </label>
              <input type="date" value={assetForm.purchase_date} onChange={e => setAssetForm({ ...assetForm, purchase_date: e.target.value })} className={inp} />
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground uppercase">Notes (optional)</label>
            <textarea placeholder="Any additional details..." value={assetForm.notes} onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })} className={`${inp} resize-none h-16`} />
          </div>

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAssetModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="flex-1 cursor-pointer">Save Asset</Button>
          </div>
        </form>
      </Dialog>



      {/* ── ACCOUNT Add/Edit Modal (Bank & Cash) ── */}
      <Dialog isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} title={accountForm.id ? 'Edit Account' : 'Add New Account'}>
        <form onSubmit={handleSaveAccount} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground uppercase">Account Name</label>
            <input autoFocus required type="text" placeholder="e.g. HDFC Salary Account" value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} className={inp} />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground uppercase">Account Type</label>
            <select required value={accountForm.account_type} onChange={e => setAccountForm({ ...accountForm, account_type: e.target.value })} className={inp}>
              <option value="Checking">Checking / Savings</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Wallet">Digital Wallet</option>
              <option value="Cash">Physical Cash</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground uppercase flex justify-between">
              {accountForm.account_type === 'Credit Card' ? 'Credit Limit' : 'Current Balance'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-medium text-muted-foreground">{currencySymbol}</span>
              <input type="number" step="0.01" placeholder="0.00" value={accountForm.opening_balance} onChange={e => setAccountForm({ ...accountForm, opening_balance: e.target.value })} className={`${inp} pl-8`} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {accountForm.account_type === 'Credit Card' 
                ? 'Set the total credit limit of this card. Your available credit will update as you spend.' 
                : 'Update this to match your current real-world balance. Your past transactions will be preserved.'}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border mt-2">
            <Button type="button" variant="outline" onClick={() => setIsAccountModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Account</Button>
          </div>
        </form>
      </Dialog>

      {/* ── Add Asset Choice Modal (Investments Tab) ── */}
      <Dialog isOpen={isAddChoiceModalOpen} onClose={() => setIsAddChoiceModalOpen(false)} title="What would you like to add?">
        <div className="flex flex-col gap-3 mt-4">
          <button
            onClick={() => {
              setIsAddChoiceModalOpen(false);
              handleOpenAdd();
            }}
            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left cursor-pointer"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-foreground">Stocks & Mutual Funds</div>
              <div className="text-xs text-muted-foreground mt-0.5">Live-tracked market assets</div>
            </div>
          </button>
          
          <button
            onClick={() => {
              setIsAddChoiceModalOpen(false);
              setAssetForm({ ...assetForm, asset_category: 'fd', id: '', name: '', current_value: '', purchase_value: '', purchase_date: '', notes: '', metadata: {} });
              setIsAssetModalOpen(true);
            }}
            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left cursor-pointer"
          >
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-foreground">Fixed Deposit / Bond</div>
              <div className="text-xs text-muted-foreground mt-0.5">Static-yield banking instruments</div>
            </div>
          </button>
        </div>
      </Dialog>
    </div>
  );
};
