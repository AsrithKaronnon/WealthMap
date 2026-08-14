import React, { useState, useEffect, useMemo, useLayoutEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SEED } from '../lib/supabaseMock';
import { computeAccountBalances, totalLiquidBalance } from '../lib/accountUtils';
import { useNavigate } from '@tanstack/react-router';
import { Wallet, TrendingUp, Loader2, FileText, Receipt, Filter, ArrowDownToLine, CreditCard, Check, Plus } from 'lucide-react';
import { NotificationsBell } from '../components/NotificationsBell';
import { Card, CardContent } from '../components/ui/Card';
import { ProgressCircle } from '../components/ui/ProgressCircle';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { PinSetupPrompt } from '../components/PinSetupPrompt';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const TIME_FILTERS = [
  { value: 'current_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_1_year', label: 'Last 1 Year' },
  { value: 'all', label: 'All Time' },
] as const;

// Exact amounts, no 'k' abbreviation
const fmt = (n: number, sym: string) =>
  `${sym}${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const greetingFor = (name: string) => {
  const hrs = new Date().getHours();
  const g = hrs < 12 ? 'Good morning' : hrs < 18 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name.split(' ')[0]}!`;
};

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('User');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [networthHistory, setNetworthHistory] = useState<any[]>([]);
  const [hiddenAccountIds, setHiddenAccountIds] = useState<string[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [allCats, setAllCats] = useState<any[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  
  // Time filter state
  const [timeFilter, setTimeFilter] = useState<'current_month' | 'last_month' | 'last_3_months' | 'last_1_year' | 'all'>('current_month');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const navigate = useNavigate();
  const greetingRef = useRef<HTMLSpanElement>(null);
  const greetingText = greetingFor(userName);

  useLayoutEffect(() => {
    const el = greetingRef.current;
    if (!el) return;
    let size = 16;
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > el.clientWidth && size > 11) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
  }, [greetingText, loading]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: accountsData }, { data: txData }, { data: billsData }, { data: goalsData }, { data: loansData }, { data: catData }, { data: invData }, { data: settingsData }, { data: userData }, { data: assetsData }, { data: nwHistoryData }] = await Promise.all([
          supabase.from('accounts').select('*').order('name', { ascending: true }),
          supabase.from('transactions').select('*').order('date', { ascending: false }),
          supabase.from('bills').select('*').eq('status_id', SEED.statuses.pending).order('due_date', { ascending: true }).limit(10),
          supabase.from('goals').select('*'),
          supabase.from('loans').select('*'),
          supabase.from('expense_categories').select('*').eq('is_active', true).order('name', { ascending: true }),
          supabase.from('investments').select('*'),
          supabase.from('user_settings').select('base_currency_id, hidden_asset_account_ids, currencies(symbol)').maybeSingle(),
          supabase.auth.getUser(),
          supabase.from('assets').select('*').eq('is_deleted', false),
          supabase.from('networth_history').select('*').order('date', { ascending: true })
        ]);

        if (userData?.user) {
          const meta = userData.user.user_metadata;
          if (meta && (meta.first_name || meta.last_name)) {
            setUserName(`${meta.first_name || ''} ${meta.last_name || ''}`.trim());
          } else {
            setUserName(userData.user.email?.split('@')[0] || 'User');
          }
        }

        let finalAccounts = accountsData;
        if (accountsData && accountsData.length === 0) {
          const { data: newAcc } = await supabase.from('accounts').insert([{
            name: 'Primary Checking', balance: 0.00, account_type: 'Checking', currency_id: SEED.currencies.usd
          }]).select();
          if (newAcc) finalAccounts = newAcc;
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

        if (finalAccounts) setAccounts(finalAccounts);
        if (txData) setTransactions(txData);
        if (billsData) setBills(billsData);
        if (goalsData) setGoals(goalsData);
        if (loansData) setLoans(loansData);
        if (assetsData) setAssets(assetsData);
        if (nwHistoryData) setNetworthHistory(nwHistoryData);
        if (catData) setAllCats(catData);
        if (invData) {
          setInvestments(invData);
          if (invData.length > 0) fetchLivePrices(invData).catch(console.error);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const fetchLivePrices = async (invs: any[]) => {
    setIsFetchingPrices(true);
    try {
      const newPrices: Record<string, number> = {};
      const mfSymbols = invs.filter(i => i.investment_type_id === SEED.investment_types.mutual_funds).map(i => i.symbol);
      const stockSymbols = invs.filter(i => i.investment_type_id === SEED.investment_types.stocks).map(i => i.symbol);
      const promises: Promise<void>[] = [];
      if (mfSymbols.length > 0) {
        promises.push(Promise.all(mfSymbols.map(async (symbol) => {
          try {
            const res = await fetch(`https://api.mfapi.in/mf/${symbol}`);
            const data = await res.json();
            if (data?.data?.length > 0) newPrices[symbol] = parseFloat(data.data[0].nav);
          } catch (e) { console.error(e); }
        })).then(() => {}));
      }
      if (stockSymbols.length > 0) {
        promises.push((async () => {
          const { data, error } = await supabase.functions.invoke('finance', { body: { action: 'quote', symbols: stockSymbols } });
          if (!error && data?.quoteResponse?.result) {
            data.quoteResponse.result.forEach((q: any) => { newPrices[q.symbol] = q.regularMarketPrice; });
          }
        })());
      }
      await Promise.all(promises);
      setLivePrices(newPrices);
    } finally {
      setIsFetchingPrices(false);
    }
  };

  const accountsWithBalance = computeAccountBalances(accounts, transactions).filter(a => !hiddenAccountIds.includes(a.id));
  const totalBalance    = totalLiquidBalance(accountsWithBalance);
  
  const creditCardUsage = Math.abs(accountsWithBalance
    .filter(a => a.account_type === 'Credit Card')
    .reduce((sum, a) => sum + (a.computed_balance || 0), 0));

  const totalInvestments = investments.reduce((s, i) => s + (i.quantity * (livePrices[i.symbol] || 0)), 0);
  const totalAssets = assets.reduce((s, a) => s + parseFloat(a.current_value || 0), 0);
  const totalNetWorth   = totalBalance + totalInvestments + totalAssets;

  // Networth history chart and percentage
  const nwChartData = networthHistory.map(row => ({
    value: parseFloat(row.networth || 0),
    date: row.date
  }));
  // Append current live value
  nwChartData.push({
    value: totalNetWorth,
    date: new Date().toISOString()
  });

  let nwPercentChange = 0;
  if (nwChartData.length >= 2) {
    const currentVal = nwChartData[nwChartData.length - 1].value;
    const prevVal = nwChartData[0].value;
    if (prevVal > 0) {
      nwPercentChange = ((currentVal - prevVal) / prevVal) * 100;
    }
  }
  
  const isNwPositive = nwPercentChange >= 0;
  const nwPercentText = `${isNwPositive ? '▲' : '▼'} ${Math.abs(nwPercentChange).toFixed(1)}%`;
  const nwPercentColor = isNwPositive ? '#4ADE80' : '#F87171';

  // Date Filtering Logic
  const now = new Date();
  let filterStartDate: Date | null = null;
  let filterEndDate: Date | null = null;

  if (timeFilter === 'current_month') {
    filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    filterEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (timeFilter === 'last_month') {
    filterStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    filterEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (timeFilter === 'last_3_months') {
    filterStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    filterEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (timeFilter === 'last_1_year') {
    filterStartDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    filterEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  const inRange = (date: string, s: Date | null, e: Date | null) => {
    if (!s || !e) return true; // 'all' time
    const d = new Date(date);
    return d >= s && d <= e;
  };

  const filteredTxs = transactions.filter(tx => inRange(tx.date, filterStartDate, filterEndDate));

  const sumExp = (txs: any[]) => txs.filter(t => t.transaction_type_id === SEED.transaction_types.expense).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const sumInc = (txs: any[]) => txs.filter(t => t.transaction_type_id === SEED.transaction_types.income).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  const curIncome  = sumInc(filteredTxs);
  const curExpense = sumExp(filteredTxs);

  const savingsRate     = curIncome > 0 ? Math.max(0, Math.round(((curIncome - curExpense) / curIncome) * 100)) : 0;
  
  // Spending by category (donut)
  const spendByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredTxs.filter(t => t.transaction_type_id === SEED.transaction_types.expense).forEach(t => {
      const cat = allCats.find(c => c.id === t.category_id);
      const name = cat?.name || 'Other';
      map.set(name, (map.get(name) || 0) + (parseFloat(t.amount) || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [filteredTxs, allCats]);
  const totalSpend = spendByCategory.reduce((s, c) => s + c.value, 0);

  // 6-Month Income vs Expenses Line Chart Data (independent of filter)
  const sixMonthData = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString('en-US', { month: 'short' });
      
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      
      const monthTxs = transactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= mStart && txDate <= mEnd;
      });
      
      data.push({ 
        name: monthStr, 
        Income: Math.round(sumInc(monthTxs)), 
        Expenses: Math.round(sumExp(monthTxs)) 
      });
    }
    return data;
  }, [transactions]);

  // Activity feed (filtered)
  const activityFeed = useMemo(() => {
    const items: any[] = [];
    bills.forEach(b => {
      // Only include bills if they fall in the filter range, or if 'all' is selected.
      if (inRange(b.due_date, filterStartDate, filterEndDate)) {
        items.push({ type: 'bill', id: `bill-${b.id}`, date: new Date(b.due_date), title: b.name, amount: parseFloat(b.amount) || 0 })
      }
    });
    filteredTxs.slice(0, 15).forEach(t => items.push({
      type: 'tx', id: `tx-${t.id}`, date: new Date(t.date), title: t.merchant || 'Transaction',
      amount: parseFloat(t.amount) || 0, isIncome: t.transaction_type_id === SEED.transaction_types.income
    }));
    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 15);
  }, [bills, filteredTxs, filterStartDate, filterEndDate]);

  const relDate = (d: Date) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const dt = new Date(d); dt.setHours(0,0,0,0);
    const diff = Math.round((dt.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff < 7) return `In ${diff} days`;
    if (diff < -1 && diff > -7) return `${Math.abs(diff)} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const ttStyle: React.CSSProperties = {
    backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px'
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-7 w-32 animate-pulse rounded bg-muted/40" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 animate-pulse bg-card rounded-xl border border-border/50" />)}
        </div>
        <div className="h-60 animate-pulse bg-card rounded-xl border border-border/50" />
        <div className="h-72 animate-pulse bg-card rounded-xl border border-border/50" />
      </div>
    );
  }

  const hasData = transactions.length > 0;

  return (
    <div className="flex flex-col gap-2 sm:gap-3">

      {/* Mobile-only Header with Greeting and Filter */}
      <div className="md:hidden sticky top-0 z-30 -mx-3 px-3 h-12 flex items-center gap-2 bg-background/90 backdrop-blur-md border-b border-border/40">
        <span
          ref={greetingRef}
          className="min-w-0 flex-1 font-semibold text-foreground whitespace-nowrap leading-none"
        >
          {greetingText}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            aria-label="Filter time period"
            className="flex items-center justify-center h-9 w-9 rounded-xl clay-btn text-muted-foreground cursor-pointer"
          >
            <Filter className="h-4 w-4" />
          </button>
          <NotificationsBell className="!h-9 !w-9" />
          <button
            type="button"
            aria-label="Add transaction"
            onClick={() => navigate({ to: '/money', search: { add: '1' } })}
            className="flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white cursor-pointer clay-btn"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex flex-col gap-0.5">
        <div className="flex justify-between items-center gap-3">
          <h1 className="page-title text-foreground m-0">Dashboard</h1>
          
          {/* Time Filter - Right Side, Minimalist */}
          <div className="relative flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0 text-right">
            <Filter className="h-3 w-3" />
            <span className="text-[10px] sm:text-[11px] font-bold">
              {timeFilter === 'current_month' && 'This Month'}
              {timeFilter === 'last_month' && 'Last Month'}
              {timeFilter === 'last_3_months' && 'Last 3 Months'}
              {timeFilter === 'last_1_year' && 'Last 1 Year'}
              {timeFilter === 'all' && 'All Time'}
            </span>
          <select 
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Filter by time"
          >
            <option value="current_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="last_1_year">Last 1 Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
        </div>
        <p className="secondary-text">Your financial picture at a glance.</p>
      </div>

      {/* ── 4 STAT CARDS ── */}
      <div className="flex flex-col gap-2">
        {/* Top: Net Worth */}
        <Card className="transition-all duration-200 relative overflow-hidden">
          <CardContent className="p-4 sm:p-6 min-h-[120px] sm:min-h-[140px] h-full flex flex-row items-center justify-between relative">
            <div className="flex flex-col gap-2 relative z-20 w-1/2 sm:w-1/3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Worth</span>
              {isFetchingPrices ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Updating...</span>
                </div>
              ) : (
                <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-none tracking-tight z-20">
                  {fmt(totalNetWorth, currencySymbol)}
                </span>
              )}
              {!isFetchingPrices && (
                <div className="flex items-center gap-1 mt-1 z-20">
                  <span className="text-[10px] sm:text-xs font-bold" style={{ color: nwPercentColor }}>{nwPercentText}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground/70">vs history</span>
                </div>
              )}
            </div>
            
            {/* Net Worth Chart */}
            {isFetchingPrices ? (
              <div className="h-full w-1/2 sm:w-2/3 absolute right-0 bottom-0 flex items-center justify-end pr-8 pb-4 opacity-50 z-0">
                 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/20" />
              </div>
            ) : (
              <div className="h-[70%] max-h-[70%] sm:h-full sm:max-h-none w-1/2 sm:w-2/3 absolute right-0 bottom-0 pointer-events-none opacity-80 pt-4 z-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={nwChartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={nwPercentColor} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={nwPercentColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke={nwPercentColor} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Cards Group */}
        <div className="flex flex-col gap-2 sm:gap-3">
          {/* Bottom: 3 Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Cash */}
            <Card className="transition-all duration-200 relative overflow-hidden flex flex-col justify-center items-center text-center p-4 sm:p-5 gap-2 sm:gap-3">
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#4ADE80]" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Cash</span>
            </div>
            <span className="text-lg sm:text-2xl font-bold text-foreground leading-none tracking-tight text-center">
              {fmt(totalBalance, currencySymbol)}
            </span>
          </Card>

          {/* Income */}
          <Card className="transition-all duration-200 relative overflow-hidden flex flex-col justify-center items-center text-center p-4 sm:p-5 gap-2 sm:gap-3">
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#60A5FA]" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Income</span>
            </div>
            <span className="text-lg sm:text-2xl font-bold text-foreground leading-none tracking-tight text-center">
              {fmt(curIncome, currencySymbol)}
            </span>
          </Card>

          {/* Spent */}
          <Card className="transition-all duration-200 relative overflow-hidden flex flex-col justify-center items-center text-center p-4 sm:p-5 gap-2 sm:gap-3">
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <ArrowDownToLine className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#F87171]" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Spent</span>
            </div>
            <span className="text-lg sm:text-2xl font-bold text-foreground leading-none tracking-tight text-center">
              {fmt(curExpense, currencySymbol)}
            </span>
          </Card>
        </div>

        {/* Credit Card Usage */}
        {creditCardUsage > 0 && (
          <Card className="relative overflow-hidden flex flex-row justify-between items-center px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Credit Card Usage</span>
            </div>
            <span className="text-base sm:text-lg font-bold text-foreground leading-none">
              {fmt(creditCardUsage, currencySymbol)}
            </span>
          </Card>
        )}
        </div>
      </div>

      {/* ── CHART ROW: Donut + Bar side by side on desktop, stacked on mobile ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">

          {/* Spending by Category Donut */}
          <Card className="bg-gradient-to-br from-[#5C4DFF] to-[#312783]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Where You Spent</h3>
                  <p className="text-xs text-white/70">For selected period</p>
                </div>
                <span className="text-xs font-bold text-white">{fmt(totalSpend, currencySymbol)}</span>
              </div>
              {spendByCategory.length === 0 ? (
                <div className="h-40 flex items-center justify-center border border-dashed border-white/20 rounded-xl">
                  <p className="text-xs text-white/70">No expenses logged in this period</p>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="h-36 w-36 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={spendByCategory} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                          {spendByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip trigger={isMobile ? 'click' : 'hover'} contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: 'white' }} formatter={(v: any) => [fmt(v, currencySymbol), 'Spent']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    {spendByCategory.map((cat, i) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-white truncate flex-1">{cat.name}</span>
                        <span className="text-xs font-semibold text-white shrink-0">{fmt(cat.value, currencySymbol)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 6-Month Income vs Expenses Line Chart */}
          <Card className="bg-gradient-to-br from-[#5C4DFF] to-[#312783]">
            <CardContent className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-white">Income vs Expenses</h3>
                <p className="text-xs text-white/70">Last 6 months trend</p>
              </div>
              {sixMonthData.every(d => d.Income === 0 && d.Expenses === 0) ? (
                <div className="h-40 flex items-center justify-center border border-dashed border-white/20 rounded-xl">
                  <p className="text-xs text-white/70">No data in last 6 months</p>
                </div>
              ) : (
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sixMonthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" opacity={0.1} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.7)' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.7)' }} tickFormatter={v => fmt(v, currencySymbol)} />
                      <Tooltip trigger={isMobile ? 'click' : 'hover'} contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: 'white' }} formatter={(v: any) => [fmt(v, currencySymbol), undefined]} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: 'white' }} />
                      <Line type="monotone" dataKey="Income" stroke="#34d399" strokeWidth={3} dot={{ r: 3, strokeWidth: 2, fill: '#34d399' }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="Expenses" stroke="#f87171" strokeWidth={3} dot={{ r: 3, strokeWidth: 2, fill: '#f87171' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
      </div>

      {/* ── GOALS & LOANS ROW ── */}
      {(goals.length > 0 || loans.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {goals.length > 0 && (
            <Card className="bg-gradient-to-br from-[#5C4DFF] to-[#312783] relative">
              <CardContent className="p-3 sm:p-4 flex flex-row items-center gap-3 overflow-x-auto">
                <div className="text-xs font-bold text-white/70 uppercase whitespace-nowrap pr-2 border-r border-white/20 shrink-0">Goals</div>
                {goals.map(g => {
                  const pct = Math.min(100, Math.round(((parseFloat(g.current_amount)||0) / (parseFloat(g.target_amount)||1)) * 100));
                  return (
                    <div key={g.id} className="flex items-center gap-2 min-w-max">
                      <ProgressCircle value={pct} size={34} strokeWidth={3} className="text-green-400">
                        <span className="text-[9px] font-bold text-white">{pct}%</span>
                      </ProgressCircle>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold truncate max-w-[90px] text-white">{g.name}</span>
                        <span className="text-[10px] text-white/70">{fmt(parseFloat(g.target_amount)||0, currencySymbol)}</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
              <div className="md:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#312783] to-transparent rounded-r-xl" />
            </Card>
          )}
          {loans.length > 0 && (
            <Card className="bg-gradient-to-br from-[#5C4DFF] to-[#312783] relative">
              <CardContent className="p-3 sm:p-4 flex flex-row items-center gap-3 overflow-x-auto">
                <div className="text-xs font-bold text-white/70 uppercase whitespace-nowrap pr-2 border-r border-white/20 shrink-0">Loans</div>
                {loans.map(l => {
                  const total = parseFloat(l.total_amount)||0;
                  const paid  = total - (parseFloat(l.outstanding_amount)||0);
                  const pct   = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                  return (
                    <div key={l.id} className="flex items-center gap-2 min-w-max">
                      <ProgressCircle value={pct} size={34} strokeWidth={3} className="text-red-400">
                        <span className="text-[9px] font-bold text-white">{pct}%</span>
                      </ProgressCircle>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold truncate max-w-[90px] text-white">{l.name}</span>
                        <span className="text-[10px] text-white/70">{fmt(parseFloat(l.outstanding_amount)||0, currencySymbol)} left</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
              <div className="md:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#312783] to-transparent rounded-r-xl" />
            </Card>
          )}
        </div>
      )}

      {/* ── ACTIVITY FEED ── */}
      <Card className="bg-gradient-to-br from-[#5C4DFF] to-[#312783]">
        <CardContent className="p-0">
          <div className="p-3 sm:p-4 border-b border-white/10 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Activity</h3>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: '/money' })} className="text-xs py-1 h-7 border-white/20 text-white hover:bg-white/10">View All</Button>
          </div>
          <div className="p-2">
            {activityFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <FileText className="h-9 w-9 text-white/30 mb-2" />
                <p className="text-sm font-semibold text-white mb-1">No activity for this period</p>
                <p className="text-xs text-white/70 text-center px-4 mb-3">Try changing the filter or log a new transaction.</p>
                <Button size="sm" onClick={() => navigate({ to: '/money' })} className="bg-white text-indigo-900 hover:bg-white/90">Log Transaction</Button>
              </div>
            ) : (
              <div className="flex flex-col">
                {activityFeed.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-2 py-2.5 min-h-[44px] hover:bg-white/5 rounded-xl transition-colors">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${item.type === 'bill' ? 'bg-amber-500/20 text-amber-300' : item.isIncome ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {item.type === 'bill' ? <Receipt className="h-3.5 w-3.5" /> : item.isIncome ? <TrendingUp className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-white truncate">{item.title}</span>
                        <span className="text-xs text-white/70">{item.type === 'bill' ? <span className="text-amber-300 font-medium">Bill due · </span> : ''}{relDate(item.date)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold font-mono ${item.type === 'bill' ? 'text-amber-300' : item.isIncome ? 'text-green-300' : 'text-white'}`}>
                        {item.isIncome && item.type !== 'bill' ? '+' : '-'}{fmt(item.amount, currencySymbol)}
                      </span>
                      {item.type === 'bill' && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 py-0 border-white/20 text-white hover:bg-white/10" onClick={() => navigate({ to: '/bills' })}>Pay</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <PinSetupPrompt />

      <Dialog isOpen={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} title="Time period">
        <div className="flex flex-col gap-1">
          {TIME_FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setTimeFilter(opt.value);
                setFilterSheetOpen(false);
              }}
              className={`flex items-center justify-between min-h-[44px] px-3 py-2 rounded-xl text-sm font-medium cursor-pointer ${
                timeFilter === opt.value ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
              }`}
            >
              <span>{opt.label}</span>
              {timeFilter === opt.value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  );
};
