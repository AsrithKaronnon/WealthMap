import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SEED } from '../lib/supabaseMock';
import { computeAccountBalances, totalLiquidBalance } from '../lib/accountUtils';
import { computeNetWorth } from '../lib/netWorth';
import { useNavigate } from '@tanstack/react-router';
import { Wallet, TrendingUp, Loader2, FileText, Filter, ArrowDownToLine, CreditCard, Check, Plus, BarChart3, ArrowLeftRight, ChevronDown, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { NotificationsBell } from '../components/NotificationsBell';
import { MobileProfileButton } from '../components/ui/MobileProfileButton';
import { Card, CardContent } from '../components/ui/Card';
import { ProgressCircle } from '../components/ui/ProgressCircle';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { PinSetupPrompt } from '../components/PinSetupPrompt';
import { MoveMoneySheet, type MoveMoneyPrefill } from '../components/MoveMoneySheet';
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

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
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
  const [moveMoneyOpen, setMoveMoneyOpen] = useState(false);
  const [movePrefill, setMovePrefill] = useState<MoveMoneyPrefill | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showReconcileNudge, setShowReconcileNudge] = useState(false);
  const [nwBreakdownOpen, setNwBreakdownOpen] = useState(false);
  const [nwVisible, setNwVisible] = useState(() => {
    try {
      return localStorage.getItem('wealthmap_nw_visible') !== '0';
    } catch {
      return true;
    }
  });

  const toggleNwVisible = () => {
    setNwVisible((v) => {
      const next = !v;
      try {
        localStorage.setItem('wealthmap_nw_visible', next ? '1' : '0');
      } catch { /* ignore */ }
      return next;
    });
  };

  const hideAmt = (shown: string) => (nwVisible ? shown : '••••••');

  const navigate = useNavigate();

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
        const [{ data: accountsData }, { data: txData }, { data: goalsData }, { data: loansData }, { data: catData }, { data: invData }, { data: settingsData }, { data: assetsData }, { data: nwHistoryData }] = await Promise.all([
          supabase.from('accounts').select('*').order('name', { ascending: true }),
          supabase.from('transactions').select('*').eq('is_deleted', false).order('date', { ascending: false }),
          supabase.from('goals').select('*'),
          supabase.from('loans').select('*').eq('is_deleted', false),
          supabase.from('expense_categories').select('*').eq('is_active', true).order('name', { ascending: true }),
          supabase.from('investments').select('*'),
          supabase.from('user_settings').select('base_currency_id, hidden_asset_account_ids, currencies(symbol)').maybeSingle(),
          supabase.from('assets').select('*').eq('is_deleted', false),
          supabase.from('networth_history').select('*').order('date', { ascending: true })
        ]);

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
  }, [refreshKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('wealthmap_reconcile_nudge_at');
      const last = raw ? parseInt(raw, 10) : 0;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (!last || Date.now() - last > thirtyDays) {
        setShowReconcileNudge(accounts.length > 0);
      }
    } catch {
      /* ignore */
    }
  }, [accounts.length]);

  const dismissReconcileNudge = () => {
    try {
      localStorage.setItem('wealthmap_reconcile_nudge_at', String(Date.now()));
    } catch {
      /* ignore */
    }
    setShowReconcileNudge(false);
  };

  const openMoveMoney = (prefill?: MoveMoneyPrefill) => {
    setMovePrefill(prefill);
    setMoveMoneyOpen(true);
  };

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
  const totalLoans = loans.reduce((s, l) => s + parseFloat(l.outstanding_amount || 0), 0);
  const totalNetWorth = computeNetWorth({
    liquidCash: totalBalance,
    investments: totalInvestments,
    otherAssets: totalAssets,
    creditCardUsage,
    loansOutstanding: totalLoans,
  });
  const totalDebt = creditCardUsage + totalLoans;
  const earmarkedGoals = goals.reduce((s, g) => s + (parseFloat(g.current_amount) || 0), 0);
  const freeCash = Math.max(0, totalBalance - earmarkedGoals);

  const showHomeEmpty =
    accounts.length === 0 ||
    (transactions.length === 0 && goals.length === 0 && loans.length === 0);

  const UPCOMING_DAYS = 5;

  const upcomingItems = useMemo(() => {
    type Urgency = 'overdue' | 'today' | 'soon' | 'later';
    type Item = {
      id: string;
      label: string;
      sub: string;
      kind: 'recurring' | 'emi' | 'sip';
      amount?: number;
      daysUntil: number;
      urgency: Urgency;
      action: () => void;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const nextDayOfMonth = (dom: number) => {
      const clamped = Math.max(1, Math.min(28, Math.round(dom) || 1));
      let candidate = new Date(today.getFullYear(), today.getMonth(), Math.min(clamped, daysInMonth(today.getFullYear(), today.getMonth())));
      candidate.setHours(0, 0, 0, 0);
      if (candidate < today) {
        const nm = today.getMonth() + 1;
        const ny = today.getFullYear() + (nm > 11 ? 1 : 0);
        const m = nm % 12;
        candidate = new Date(ny, m, Math.min(clamped, daysInMonth(ny, m)));
        candidate.setHours(0, 0, 0, 0);
      }
      return candidate;
    };

    const urgencyFor = (daysUntil: number): Urgency => {
      if (daysUntil < 0) return 'overdue';
      if (daysUntil === 0) return 'today';
      if (daysUntil <= 2) return 'soon';
      return 'later';
    };

    const subFor = (daysUntil: number, due: Date) => {
      if (daysUntil < 0) return `Overdue · ${due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
      if (daysUntil === 0) return 'Due today';
      if (daysUntil === 1) return 'Due tomorrow';
      return `In ${daysUntil} days · ${due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    };

    const items: Item[] = [];

    // Recurring transaction templates — next_recurring_date within window / overdue ≤2 days
    transactions
      .filter((t) => t.is_recurring && t.next_recurring_date)
      .forEach((t) => {
        const due = new Date(t.next_recurring_date);
        due.setHours(0, 0, 0, 0);
        const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);
        if (daysUntil < -2 || daysUntil > UPCOMING_DAYS) return;
        items.push({
          id: `recurring-${t.id}`,
          label: t.merchant || 'Recurring',
          sub: subFor(daysUntil, due),
          kind: 'recurring',
          amount: parseFloat(t.amount) || 0,
          daysUntil,
          urgency: urgencyFor(daysUntil),
          action: () =>
            openMoveMoney({
              type: 'recurring',
              recurringId: t.id,
              amount: parseFloat(t.amount) || 0,
            }),
        });
      });

    // Loan EMIs — next payment day = day-of-month from start_date (no separate EMI due field)
    loans
      .filter((l) => (parseFloat(l.outstanding_amount) || 0) > 0 && (parseFloat(l.monthly_emi) || 0) > 0)
      .forEach((l) => {
        const start = l.start_date ? new Date(l.start_date) : null;
        const dom = start && !Number.isNaN(start.getTime()) ? start.getDate() : 1;
        const due = nextDayOfMonth(dom);
        const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);
        if (daysUntil < 0 || daysUntil > UPCOMING_DAYS) return;
        items.push({
          id: `loan-${l.id}`,
          label: `EMI · ${l.name}`,
          sub: subFor(daysUntil, due),
          kind: 'emi',
          amount: parseFloat(l.monthly_emi) || 0,
          daysUntil,
          urgency: urgencyFor(daysUntil),
          action: () => openMoveMoney({ type: 'emi', loanId: l.id, amount: parseFloat(l.monthly_emi) || 0 }),
        });
      });

    // SIP investments — sip_date is day of month
    investments
      .filter((i) => i.is_sip && i.sip_date)
      .forEach((i) => {
        const due = nextDayOfMonth(Number(i.sip_date));
        const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);
        if (daysUntil < 0 || daysUntil > UPCOMING_DAYS) return;
        items.push({
          id: `sip-${i.id}`,
          label: `SIP · ${i.name || i.symbol}`,
          sub: subFor(daysUntil, due),
          kind: 'sip',
          amount: parseFloat(i.sip_amount) || 0,
          daysUntil,
          urgency: urgencyFor(daysUntil),
          action: () => navigate({ to: '/investments' }),
        });
      });

    return items.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 6);
  }, [transactions, loans, investments]);


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
  
  // Spending by category (donut) — top categories + Other so total matches Spent card
  const spendByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredTxs
      .filter((t) => t.transaction_type_id === SEED.transaction_types.expense)
      .forEach((t) => {
        const cat = allCats.find((c) => c.id === t.category_id);
        const name = cat?.name || 'Other';
        map.set(name, (map.get(name) || 0) + (parseFloat(t.amount) || 0));
      });

    const sorted = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const fullTotal = sorted.reduce((s, c) => s + c.value, 0);

    if (sorted.length <= 6) {
      return sorted.map((c) => ({ name: c.name, value: Math.round(c.value) }));
    }

    const top = sorted.slice(0, 5).map((c) => ({ name: c.name, value: Math.round(c.value) }));
    const topSum = top.reduce((s, c) => s + c.value, 0);
    const otherValue = Math.max(0, Math.round(fullTotal) - topSum);
    if (otherValue > 0) top.push({ name: 'Other', value: otherValue });
    return top;
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
    filteredTxs.slice(0, 15).forEach(t => items.push({
      type: 'tx', id: `tx-${t.id}`, date: new Date(t.date), title: t.merchant || 'Transaction',
      amount: parseFloat(t.amount) || 0, isIncome: t.transaction_type_id === SEED.transaction_types.income
    }));
    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 15);
  }, [filteredTxs]);

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

      {/* Mobile header: profile left, actions right */}
      <div className="md:hidden sticky -top-3 z-30 -mx-3 px-3 pb-3 -mt-3 mb-2 flex items-center justify-between gap-2 bg-background/95 backdrop-blur-md border-b border-border/40" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
        <MobileProfileButton />
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
            aria-label="Move money"
            onClick={() => openMoveMoney()}
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
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => openMoveMoney()} className="gap-1.5">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Move money
            </Button>
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
        </div>
        <p className="secondary-text">Your financial picture at a glance.</p>
      </div>

      {showHomeEmpty && (
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <p className="text-sm text-muted-foreground max-w-sm">
              {accounts.length === 0
                ? 'Add an account to start tracking cash and net worth.'
                : 'Log your first transaction or set a goal to see your month here.'}
            </p>
            <Button
              onClick={() => {
                if (accounts.length === 0) navigate({ to: '/investments' });
                else if (transactions.length === 0) openMoveMoney();
                else navigate({ to: '/goals' });
              }}
            >
              {accounts.length === 0 ? 'Add account' : transactions.length === 0 ? 'Move money' : 'Add goal'}
            </Button>
          </CardContent>
        </Card>
      )}

      {showReconcileNudge && accounts.length > 0 && !showHomeEmpty && (
        <Card>
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Do your account balances still match the bank? A quick check keeps net worth honest.
            </p>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={dismissReconcileNudge}>
                Later
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  dismissReconcileNudge();
                  navigate({ to: '/investments' });
                }}
              >
                Review accounts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 4 STAT CARDS ── */}
      <div className="flex flex-col gap-2">
        {/* Top: Net Worth */}
        <Card className="transition-all duration-200 relative overflow-hidden">
          <CardContent className="p-4 sm:p-6 min-h-[120px] sm:min-h-[140px] h-full flex flex-col relative">
            <div className="flex flex-row items-center justify-between relative flex-1 min-h-[88px]">
              <div className="flex flex-col gap-2 relative z-20 w-1/2 sm:w-1/3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNwBreakdownOpen((o) => !o)}
                    className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-fit cursor-pointer"
                    aria-expanded={nwBreakdownOpen}
                    aria-label={nwBreakdownOpen ? 'Hide net worth breakdown' : 'Show net worth breakdown'}
                  >
                    Net Worth
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${nwBreakdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={toggleNwVisible}
                    className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted/60 cursor-pointer"
                    aria-label={nwVisible ? 'Hide net worth' : 'Show net worth'}
                    title={nwVisible ? 'Hide amounts' : 'Show amounts'}
                  >
                    {nwVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {isFetchingPrices ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Updating...</span>
                  </div>
                ) : (
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-none tracking-tight z-20">
                    {hideAmt(fmt(totalNetWorth, currencySymbol))}
                  </span>
                )}
                {!isFetchingPrices && (
                  <div className="flex items-center gap-1 mt-1 z-20">
                    <span className="text-[10px] sm:text-xs font-bold" style={{ color: nwVisible ? nwPercentColor : 'hsl(var(--muted-foreground))' }}>
                      {nwVisible ? nwPercentText : '••••'}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground/70">vs history</span>
                  </div>
                )}
              </div>

              {/* Net Worth Chart — shape stays; muted when amounts hidden */}
              {isFetchingPrices ? (
                <div className="h-full w-1/2 sm:w-2/3 absolute right-0 bottom-0 flex items-center justify-end pr-8 pb-4 opacity-50 z-0">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/20" />
                </div>
              ) : (
                <div className={`h-[70%] max-h-[70%] sm:h-full sm:max-h-none w-1/2 sm:w-2/3 absolute right-0 bottom-0 pointer-events-none pt-4 z-0 ${nwVisible ? 'opacity-80' : 'opacity-25'}`}>
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
            </div>

            {!isFetchingPrices && nwBreakdownOpen && (
              <div className="relative z-20 flex flex-wrap gap-1.5 pt-3 mt-1 border-t border-border/40">
                {/* <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                  Cash {hideAmt(fmt(totalBalance, currencySymbol))}
                </span> */}
                {totalInvestments > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                    Invested {hideAmt(fmt(totalInvestments, currencySymbol))}
                  </span>
                )}
                {totalAssets > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                    Assets {hideAmt(fmt(totalAssets, currencySymbol))}
                  </span>
                )}
                {totalDebt > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
                    −Debt {hideAmt(fmt(totalDebt, currencySymbol))}
                  </span>
                )}
                {earmarkedGoals > 0 && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium"
                    title="Liquid cash minus amounts marked toward goals (cash still sits in your accounts)"
                  >
                    Free {hideAmt(fmt(freeCash, currencySymbol))}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Cards Group */}
        <div className="flex flex-col gap-2 sm:gap-3">
          {/* Bottom: 3 Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Cash */}
            <Card className="transition-all duration-200 relative overflow-hidden flex flex-col justify-center items-center text-center p-3 sm:p-5 gap-1.5 sm:gap-3">
            <div className="hidden md:flex items-center justify-center gap-2 sm:gap-3">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#4ADE80]" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Cash</span>
            </div>
            <span className="text-lg sm:text-2xl font-bold text-foreground leading-none tracking-tight text-center">
              {fmt(totalBalance, currencySymbol)}
            </span>
            <span className="md:hidden text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cash</span>
          </Card>

          {/* Income */}
          <Card className="transition-all duration-200 relative overflow-hidden flex flex-col justify-center items-center text-center p-3 sm:p-5 gap-1.5 sm:gap-3">
            <div className="hidden md:flex items-center justify-center gap-2 sm:gap-3">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#60A5FA]" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Income</span>
            </div>
            <span className="text-lg sm:text-2xl font-bold text-foreground leading-none tracking-tight text-center">
              {fmt(curIncome, currencySymbol)}
            </span>
            <span className="md:hidden text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Income</span>
          </Card>

          {/* Spent */}
          <Card className="transition-all duration-200 relative overflow-hidden flex flex-col justify-center items-center text-center p-3 sm:p-5 gap-1.5 sm:gap-3">
            <div className="hidden md:flex items-center justify-center gap-2 sm:gap-3">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <ArrowDownToLine className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#F87171]" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Spent</span>
            </div>
            <span className="text-lg sm:text-2xl font-bold text-foreground leading-none tracking-tight text-center">
              {fmt(curExpense, currencySymbol)}
            </span>
            <span className="md:hidden text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Spent</span>
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

        {upcomingItems.length > 0 && (
          <Card>
            <CardContent className="p-3 sm:p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Due soon</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Next {UPCOMING_DAYS} days · recurring, EMIs, SIPs</p>
                </div>
                <button
                  type="button"
                  onClick={() => openMoveMoney()}
                  className="text-[11px] font-semibold text-primary flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeftRight className="h-3 w-3" /> Move money
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {upcomingItems.map((item) => {
                  const rowTone =
                    item.urgency === 'overdue' || item.urgency === 'today'
                      ? 'bg-rose-500/10 hover:bg-rose-500/15'
                      : item.urgency === 'soon'
                        ? 'bg-amber-500/10 hover:bg-amber-500/15'
                        : 'hover:bg-muted/50';
                  const labelTone =
                    item.urgency === 'overdue' || item.urgency === 'today'
                      ? 'text-rose-700 dark:text-rose-300'
                      : item.urgency === 'soon'
                        ? 'text-amber-800 dark:text-amber-200'
                        : 'text-foreground';
                  const subTone =
                    item.urgency === 'overdue' || item.urgency === 'today'
                      ? 'text-rose-600/90 dark:text-rose-400'
                      : item.urgency === 'soon'
                        ? 'text-amber-700/90 dark:text-amber-400'
                        : 'text-muted-foreground';
                  const kindBadge =
                    item.kind === 'recurring'
                      ? 'Recur'
                      : item.kind === 'emi'
                        ? 'EMI'
                        : 'SIP';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.action}
                      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 min-h-[44px] text-left transition-colors cursor-pointer ${rowTone}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${subTone}`}>{kindBadge}</span>
                          <span className={`text-sm font-medium truncate ${labelTone}`}>{item.label.replace(/^(EMI|SIP) · /, '')}</span>
                        </div>
                        <div className={`text-[11px] ${subTone}`}>{item.sub}</div>
                      </div>
                      {item.amount != null && item.amount > 0 && (
                        <span className={`text-xs font-semibold shrink-0 ${labelTone}`}>
                          {fmt(item.amount, currencySymbol)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>

      {/* ── CHART ROW: Donut + Bar side by side on desktop, stacked on mobile ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">

          {/* Spending by Category Donut */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Where You Spent</h3>
                  <p className="text-xs text-muted-foreground">For selected period</p>
                </div>
                <span className="text-xs font-bold text-foreground">{fmt(totalSpend, currencySymbol)}</span>
              </div>
              {spendByCategory.length === 0 ? (
                <div className="h-40 flex items-center justify-center border border-dashed border-border rounded-xl">
                  <p className="text-xs text-muted-foreground">No expenses logged in this period</p>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="h-36 w-36 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={spendByCategory} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                          {spendByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip trigger={isMobile ? 'click' : 'hover'} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px', color: 'hsl(var(--foreground))' }} formatter={(v: any) => [fmt(v, currencySymbol), 'Spent']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    {spendByCategory.map((cat, i) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-foreground truncate flex-1">{cat.name}</span>
                        <span className="text-xs font-semibold text-foreground shrink-0">{fmt(cat.value, currencySymbol)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 6-Month Income vs Expenses Line Chart */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-foreground">Income vs Expenses</h3>
                <p className="text-xs text-muted-foreground">Last 6 months trend</p>
              </div>
              {sixMonthData.every(d => d.Income === 0 && d.Expenses === 0) ? (
                <div className="h-40 flex items-center justify-center border border-dashed border-border rounded-xl">
                  <p className="text-xs text-muted-foreground">No data in last 6 months</p>
                </div>
              ) : (
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sixMonthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => fmt(v, currencySymbol)} />
                      <Tooltip trigger={isMobile ? 'click' : 'hover'} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px', color: 'hsl(var(--foreground))' }} formatter={(v: any) => [fmt(v, currencySymbol), undefined]} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: 'hsl(var(--foreground))' }} />
                      <Line type="monotone" dataKey="Income" stroke="#10b981" strokeWidth={3} dot={{ r: 3, strokeWidth: 2, fill: '#10b981' }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={3} dot={{ r: 3, strokeWidth: 2, fill: '#ef4444' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
      </div>

      {/* ── GOALS & LOANS ── */}
      {(goals.length > 0 || loans.length > 0) && (
        <div className="flex flex-col gap-3">
          {goals.length > 0 && (
            <Card className="relative">
              <CardContent className="p-3 sm:p-4 flex flex-row items-center gap-3 overflow-x-auto">
                <div className="text-xs font-bold text-muted-foreground uppercase whitespace-nowrap pr-2 border-r border-border shrink-0">Goals</div>
                {goals.map(g => {
                  const pct = Math.min(100, Math.round(((parseFloat(g.current_amount)||0) / (parseFloat(g.target_amount)||1)) * 100));
                  return (
                    <div key={g.id} className="flex items-center gap-2 min-w-max cursor-pointer" onClick={() => navigate({ to: '/goals' })}>
                      <ProgressCircle value={pct} size={34} strokeWidth={3} className="text-emerald-500">
                        <span className="text-[9px] font-bold text-foreground">{pct}%</span>
                      </ProgressCircle>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold truncate max-w-[90px] text-foreground">{g.name}</span>
                        <span className="text-[10px] text-muted-foreground">{fmt(parseFloat(g.target_amount)||0, currencySymbol)}</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
              <div className="md:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-card to-transparent rounded-r-xl" />
            </Card>
          )}
          {loans.length > 0 && (
            <Card className="relative w-full overflow-hidden">
              <CardContent className="p-3 sm:p-4 flex flex-col gap-2.5">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Loans</span>
                <div className="flex flex-col gap-2 w-full">
                  {loans.map(l => {
                    const total = parseFloat(l.total_amount) || 0;
                    const paid = Math.max(0, total - (parseFloat(l.outstanding_amount) || 0));
                    const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => navigate({ to: '/goals' })}
                        className="relative w-full overflow-hidden rounded-xl border border-border/40 bg-muted/15 text-left min-h-[60px] cursor-pointer hover:border-primary/25 transition-colors"
                      >
                        {/* Soft sprayed fill — feathered edge, no hard line */}
                        {pct > 0 && (
                          <div
                            className="absolute inset-y-0 left-0 pointer-events-none"
                            style={{
                              width: `${Math.min(100, pct + 18)}%`,
                              background: `linear-gradient(90deg,
                                hsl(var(--primary) / 0.28) 0%,
                                hsl(var(--primary) / 0.2) ${Math.max(20, pct * 0.55)}%,
                                hsl(var(--primary) / 0.1) ${Math.max(35, pct * 0.75)}%,
                                hsl(var(--primary) / 0.04) ${Math.max(50, pct * 0.9)}%,
                                transparent 100%)`,
                            }}
                            aria-hidden
                          />
                        )}

                        <div className="relative z-10 flex items-center justify-between gap-3 px-3 py-2.5 w-full">
                          <div className="flex flex-col min-w-0 flex-1 text-left">
                            <span className="text-xs font-bold truncate text-foreground">{l.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {fmt(parseFloat(l.outstanding_amount) || 0, currencySymbol)} left
                            </span>
                          </div>
                          <ProgressCircle value={pct} size={36} strokeWidth={3} className="text-primary shrink-0">
                            <span className="text-[9px] font-bold text-foreground">{pct}%</span>
                          </ProgressCircle>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── ACTIVITY FEED ── */}
      <div className="md:hidden grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: '/money', search: { tab: 'recurring' } })}
          className="clay-btn min-h-[44px] rounded-xl px-3 text-sm font-semibold text-foreground flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" /> Recurring
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: '/insights' })}
          className="clay-btn min-h-[44px] rounded-xl px-3 text-sm font-semibold text-foreground flex items-center justify-center gap-2 cursor-pointer"
        >
          <BarChart3 className="h-4 w-4" /> Insights
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-3 sm:p-4 border-b border-border flex justify-between items-center">
            <h3 className="text-sm font-bold text-foreground">Activity</h3>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: '/money' })} className="text-xs py-1 min-h-[44px] md:min-h-0 md:!h-7">View All</Button>
          </div>
          <div className="p-2">
            {activityFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <FileText className="h-9 w-9 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-semibold text-foreground mb-1">No activity for this period</p>
                <p className="text-xs text-muted-foreground text-center px-4 mb-3">Try changing the filter or log a new transaction.</p>
                <Button size="sm" onClick={() => navigate({ to: '/money' })}>Log Transaction</Button>
              </div>
            ) : (
              <div className="flex flex-col">
                {activityFeed.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-2 py-2.5 min-h-[44px] hover:bg-muted/50 rounded-xl transition-colors">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${item.isIncome ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'}`}>
                        {item.isIncome ? <TrendingUp className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-foreground truncate">{item.title}</span>
                        <span className="text-xs text-muted-foreground">{relDate(item.date)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold font-mono ${item.isIncome ? 'text-emerald-600 dark:text-emerald-300' : 'text-foreground'}`}>
                        {item.isIncome ? '+' : '-'}{fmt(item.amount, currencySymbol)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <PinSetupPrompt />

      <MoveMoneySheet
        isOpen={moveMoneyOpen}
        onClose={() => {
          setMoveMoneyOpen(false);
          setMovePrefill(undefined);
        }}
        onSuccess={() => setRefreshKey((k) => k + 1)}
        currencySymbol={currencySymbol}
        prefill={movePrefill}
      />

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
