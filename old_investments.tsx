import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { confirm } from '../lib/useConfirmStore';
import { SEED } from '../lib/supabaseMock';
import { 
  Plus, TrendingUp, Landmark, Search, Trash2, Edit2, Loader2
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';

export const Investments: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [investments, setInvestments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'stocks' | 'mf'>('stocks');
  
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

  const fetchInvestments = async () => {
    setLoading(true);
    try {
      const [
        { data: invData },
        { data: accData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('investments').select('*'),
        supabase.from('accounts').select('id, name'),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol)').maybeSingle()
      ]);

      if (accData) {
        setAccounts(accData);
      }

      if (invData) {
        setInvestments(invData);
        // Fetch live prices explicitly on load
        if (invData.length > 0) {
          fetchLivePrices(invData);
        }
      }

      if (settingsData && settingsData.currencies) {
        const sym = Array.isArray(settingsData.currencies)
          ? settingsData.currencies[0]?.symbol
          : (settingsData.currencies as any)?.symbol;
        if (sym) setCurrencySymbol(sym);
      }
    } catch (err) {
      console.error('Failed to load investments', err);
    } finally {
      setLoading(false);
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

      // Fetch MF prices
      if (mfSymbols.length > 0) {
        promises.push(Promise.all(mfSymbols.map(async (symbol) => {
          try {
            const res = await fetch(`https://api.mfapi.in/mf/${symbol}`);
            const data = await res.json();
            if (data && data.data && data.data.length > 0) {
              newPrices[symbol] = parseFloat(data.data[0].nav);
            }
          } catch (e) {
            console.error(`Failed to fetch live NAV for ${symbol}:`, e);
          }
        })));
      }

      // Fetch Stock prices
      if (stockSymbols.length > 0) {
        promises.push((async () => {
          const { data, error } = await supabase.functions.invoke('finance', {
            body: { action: 'quote', symbols: stockSymbols }
          });
          if (!error && data && data.quoteResponse && data.quoteResponse.result) {
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
      toast.error("Failed to sync live market data");
    } finally {
      setIsFetchingPrices(false);
    }
  };

  useEffect(() => {
    fetchInvestments();
  }, []);

  // Debounced Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        if (activeTab === 'mf') {
          const res = await fetch(`https://api.mfapi.in/mf/search?q=${searchQuery}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            setSearchResults(data.slice(0, 10)); // Limit to 10 results
          }
        } else {
          const { data, error } = await supabase.functions.invoke('finance', {
            body: { action: 'search', query: searchQuery }
          });
          if (error) throw error;
          if (data && data.quotes) {
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
  }, [searchQuery, activeTab]);

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
      symbol: activeTab === 'mf' ? String(res.schemeCode) : res.symbol,
      name: activeTab === 'mf' ? res.schemeName : (res.longname || res.shortname || res.symbol),
      investment_type_id: activeTab === 'mf' ? SEED.investment_types.mutual_funds : SEED.investment_types.stocks
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
        if (!session) throw new Error("Not authenticated");

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
      description: 'Are you sure you want to remove this asset? This action cannot be undone.',
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

  const totalNetWorth = investments.reduce((acc, curr) => {
    const price = livePrices[curr.symbol] || 0;
    return acc + (curr.quantity * price);
  }, 0);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title text-foreground flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            Stock & Mutual Funds
          </h1>
          <p className="secondary-text">Track your market assets and total net worth in real-time.</p>
        </div>
        <Button onClick={handleOpenAdd} className="flex items-center gap-1.5 cursor-pointer">
          <Plus className="h-4 w-4" />
          Add Asset
        </Button>
      </div>

      {/* Net Worth Highlight */}
      <Card className="bg-primary text-primary-foreground border-none">
        <CardContent className="p-6 sm:p-8 flex flex-col justify-center items-center text-center">
          <span className="text-sm font-semibold uppercase tracking-widest opacity-80 mb-2">Total Portfolio Value</span>
          <span className="text-4xl sm:text-5xl font-extrabold flex items-center gap-2">
            {currencySymbol}{totalNetWorth.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          <div className="flex items-center gap-2 mt-4 text-xs font-medium bg-white/10 px-3 py-1.5 rounded-full">
            {isFetchingPrices ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
            {isFetchingPrices ? 'Syncing live market data...' : 'Live Market Pricing Active'}
          </div>
        </CardContent>
      </Card>

      {/* Assets Grid */}
      {loading ? (
        <div className="h-64 animate-pulse bg-card border border-border/50 rounded-xl" />
      ) : investments.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl flex flex-col justify-center items-center gap-3">
          <Landmark className="h-12 w-12 text-muted-foreground/40" />
          <div className="text-sm font-semibold text-foreground">No assets added yet</div>
          <Button size="sm" onClick={handleOpenAdd} variant="outline" className="mt-2">
            Start Tracking
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {investments.map(inv => {
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
                      <span className="text-sm font-semibold">{price > 0 ? `${currencySymbol}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '---'}</span>
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

      {/* Add / Edit Modal */}
      <Dialog 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={formData.id ? 'Edit Asset' : 'Add New Asset'}
      >
        <div className="flex flex-col gap-4 mt-2">
            
            {/* Search or Selected Asset */}
            {!formData.symbol ? (
              <div className="flex flex-col gap-2 relative">
                
                {/* Tabs */}
                <div className="flex bg-secondary/30 p-1 rounded-lg">
                  <button 
                    type="button"
                    onClick={() => { setActiveTab('stocks'); setSearchResults([]); setSearchQuery(''); }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${activeTab === 'stocks' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
                  >
                    Stocks & ETFs
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setActiveTab('mf'); setSearchResults([]); setSearchQuery(''); }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${activeTab === 'mf' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
                  >
                    Indian Mutual Funds
                  </button>
                </div>

                <label className="text-[11px] font-bold text-muted-foreground uppercase mt-2">Search {activeTab === 'mf' ? 'Mutual Fund' : 'Ticker'}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus
                    type="text"
                    placeholder={activeTab === 'mf' ? "e.g. Parag Parikh, Quant" : "e.g. AAPL, TSLA, REL"}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="no-focus-ring pl-9 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-0 focus:border-primary transition-colors"
                  />
                  {isSearching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                {/* Dropdown Results */}
                {searchResults.length > 0 && (
                  <div className="absolute top-[110px] left-0 right-0 bg-popover border border-border rounded-lg shadow-xl z-50 max-h-[250px] overflow-y-auto">
                    {searchResults.map((res, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectAsset(res)}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted border-b border-border/50 last:border-0 flex flex-col cursor-pointer transition-colors"
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-bold text-sm text-foreground">{activeTab === 'mf' ? res.schemeCode : res.symbol}</span>
                          <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase">{activeTab === 'mf' ? 'MF' : 'Stock'}</span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate">{activeTab === 'mf' ? res.schemeName : (res.longname || res.shortname)}</span>
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
                  <Button type="button" variant="outline" size="sm" onClick={() => setFormData({...formData, symbol: '', name: ''})} className="shrink-0 cursor-pointer h-7 text-[10px]">
                    Change
                  </Button>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">Quantity Owned (Units)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                required
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                className="no-focus-ring w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-0 focus:border-primary transition-colors font-mono"
                placeholder="e.g. 10.5"
              />
            </div>

            {/* SIP Automation Toggle */}
            <div className="mt-2 p-4 border border-border rounded-lg bg-secondary/10 flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={formData.is_sip}
                  onChange={(e) => setFormData({ ...formData, is_sip: e.target.checked })}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-sm font-bold text-foreground">Enable Monthly SIP Automation</span>
              </label>

              {formData.is_sip && (
                <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
                  <p className="text-[11px] text-muted-foreground">The system will automatically log a transaction and buy units on this date every month.</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">SIP Date (Day of Month)</label>
                      <select
                        value={formData.sip_date}
                        onChange={(e) => setFormData({ ...formData, sip_date: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      >
                        {Array.from({length: 28}, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Amount ({currencySymbol})</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.sip_amount || ''}
                        onChange={(e) => setFormData({ ...formData, sip_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                        placeholder="5000"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Pay From Account</label>
                    <select
                      value={formData.sip_account_id}
                      onChange={(e) => setFormData({ ...formData, sip_account_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      <option value="">-- Select Account --</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <Button onClick={handleSave} className="w-full mt-2 cursor-pointer">
              Save Asset
            </Button>
          </div>
      </Dialog>
    </div>
  );
};
