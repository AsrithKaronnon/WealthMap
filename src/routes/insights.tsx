import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SEED } from '../lib/supabaseMock';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Card, CardContent } from '../components/ui/Card';
import { MobilePageHeader } from '../components/ui/MobilePageHeader';
import { TrendingUp, TrendingDown, Target, BarChart3 } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const fmt = (n: number, sym: string) =>
  `${sym}${n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const Insights: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [allCats, setAllCats] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('RS');
  const [selectedMonth, setSelectedMonth] = useState<'current' | 'last'>('current');
  const [isMobile, setIsMobile] = useState(false);

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
        const [
          { data: txData },
          { data: budgetData },
          { data: catData },
          { data: settings }
        ] = await Promise.all([
          supabase.from('transactions').select('*').order('date', { ascending: false }),
          supabase.from('budgets').select('*'),
          supabase.from('expense_categories').select('*').eq('is_active', true).order('name', { ascending: true }),
          supabase.from('user_settings').select('currencies(symbol)').maybeSingle()
        ]);
        if (txData) setTransactions(txData);
        if (budgetData) setBudgets(budgetData);
        if (catData) setAllCats(catData);
        if (settings?.currencies) {
          const sym = Array.isArray(settings.currencies)
            ? settings.currencies[0]?.symbol
            : (settings.currencies as any)?.symbol;
          if (sym) setCurrencySymbol(sym);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const inRange = (date: string, start: Date, end: Date) => {
    const d = new Date(date);
    return d >= start && d <= end;
  };

  const currentMonthTxs = transactions.filter(tx => inRange(tx.date, currentMonthStart, currentMonthEnd));
  const lastMonthTxs    = transactions.filter(tx => inRange(tx.date, lastMonthStart, lastMonthEnd));
  const displayTxs      = selectedMonth === 'current' ? currentMonthTxs : lastMonthTxs;

  const sumIncome  = (txs: any[]) => txs.filter(t => t.transaction_type_id === SEED.transaction_types.income).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const sumExpense = (txs: any[]) => txs.filter(t => t.transaction_type_id === SEED.transaction_types.expense).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  const curIncome   = sumIncome(currentMonthTxs);
  const curExpense  = sumExpense(currentMonthTxs);
  const lastIncome  = sumIncome(lastMonthTxs);
  const lastExpense = sumExpense(lastMonthTxs);
  const savingsRate    = curIncome > 0 ? Math.max(0, Math.round(((curIncome - curExpense) / curIncome) * 100)) : 0;
  const expenseChange  = lastExpense > 0 ? Math.round(((curExpense - lastExpense) / lastExpense) * 100) : 0;

  const spendingByCategory = useMemo(() => {
    const map = new Map<string, number>();
    displayTxs
      .filter(t => t.transaction_type_id === SEED.transaction_types.expense)
      .forEach(t => {
        const cat = allCats.find(c => c.id === t.category_id);
        const name = cat?.name || 'Other';
        map.set(name, (map.get(name) || 0) + (parseFloat(t.amount) || 0));
      });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [displayTxs, allCats]);

  const totalCatSpend = spendingByCategory.reduce((s, c) => s + c.value, 0);

  const cashFlowData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const txs = transactions.filter(t => inRange(t.date, start, end));
      const inc = sumIncome(txs);
      const exp = sumExpense(txs);
      data.push({ name: d.toLocaleString('default', { month: 'short' }), Income: Math.round(inc), Expenses: Math.round(exp), Net: Math.round(inc - exp) });
    }
    return data;
  }, [transactions]);

  const monthCompareData = useMemo(() => {
    const data = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = i === 0 ? 'This Month' : i === 1 ? 'Last Month' : d.toLocaleString('default', { month: 'short' });
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const txs = transactions.filter(t => inRange(t.date, start, end));
      data.push({ name: label, Income: Math.round(sumIncome(txs)), Expenses: Math.round(sumExpense(txs)) });
    }
    return data;
  }, [transactions]);

  const budgetPerf = useMemo(() => budgets.map(b => {
    const cat   = allCats.find(c => c.id === b.category_id);
    const limit = parseFloat(b.amount) || 0;
    const used  = currentMonthTxs
      .filter(t => t.transaction_type_id === SEED.transaction_types.expense && t.category_id === b.category_id)
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return { name: cat?.name || 'General', limit, used: Math.round(used), pct, over: used > limit };
  }), [budgets, allCats, currentMonthTxs]);

  // Tooltip style using inline object (no CSS vars issue in TSX)
  const ttStyle: React.CSSProperties = {
    backgroundColor: 'hsl(var(--card))',
    borderColor: 'hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
    border: '1px solid hsl(var(--border))'
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <MobilePageHeader title="Insights" />
        <div className="hidden md:block h-7 w-40 animate-pulse rounded bg-muted/40" />
        {[1,2,3].map(i => <div key={i} className="h-48 animate-pulse bg-card rounded-xl border border-border/50" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">

      <MobilePageHeader title="Insights" />

      {/* Header */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="page-title text-foreground m-0">Insights</h1>
          <p className="secondary-text mt-0.5">Your financial picture at a glance.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-secondary rounded-xl p-1 self-start sm:self-auto">
          <button
            onClick={() => setSelectedMonth('current')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${selectedMonth === 'current' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >This Month</button>
          <button
            onClick={() => setSelectedMonth('last')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${selectedMonth === 'last' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >Last Month</button>
        </div>
      </div>

      <div className="md:hidden flex clay-input-wrapper p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setSelectedMonth('current')}
          className={`flex-1 min-h-[44px] rounded-md text-xs font-semibold cursor-pointer ${selectedMonth === 'current' ? 'clay-btn text-foreground' : 'text-muted-foreground'}`}
        >This Month</button>
        <button
          type="button"
          onClick={() => setSelectedMonth('last')}
          className={`flex-1 min-h-[44px] rounded-md text-xs font-semibold cursor-pointer ${selectedMonth === 'last' ? 'clay-btn text-foreground' : 'text-muted-foreground'}`}
        >Last Month</button>
      </div>

      {/* Summary Pills */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4 flex flex-col gap-1.5">
            <div className="hidden md:flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Income</span>
              <div className="h-7 w-7 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              </div>
            </div>
            <span className="text-base md:text-2xl font-bold text-green-500 leading-none">{fmt(curIncome, currencySymbol)}</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider md:hidden">Income</span>
            <span className="hidden md:block text-xs text-muted-foreground">{lastIncome > 0 ? (curIncome >= lastIncome ? '↑' : '↓') + ' vs last month' : 'This month'}</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 flex flex-col gap-1.5">
            <div className="hidden md:flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spent</span>
              <div className="h-7 w-7 rounded-full bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              </div>
            </div>
            <span className="text-base md:text-2xl font-bold text-foreground leading-none">{fmt(curExpense, currencySymbol)}</span>
            <span className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider md:hidden">Spent</span>
            <span className={`hidden md:block text-xs font-medium ${expenseChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {lastExpense > 0 ? `${expenseChange > 0 ? '+' : ''}${expenseChange}% vs last` : 'No prior data'}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 flex flex-col gap-1.5">
            <div className="hidden md:flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saved</span>
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            <span className="text-base md:text-2xl font-bold text-foreground leading-none">{savingsRate}%</span>
            <span className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider md:hidden">Saved</span>
            <div className="hidden md:block w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${savingsRate >= 20 ? 'bg-green-500' : savingsRate >= 10 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(savingsRate, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spending by Category Donut */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Where You Spent</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Breakdown by category</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Total</span>
              <div className="text-sm font-bold text-foreground">{fmt(totalCatSpend, currencySymbol)}</div>
            </div>
          </div>
          {spendingByCategory.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-border rounded-xl">
              <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No expense data for this period</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-6 items-center">
              <div className="w-full sm:w-52 h-52 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={spendingByCategory} cx="50%" cy="50%" innerRadius="58%" outerRadius="82%" paddingAngle={2} dataKey="value" stroke="none">
                      {spendingByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip trigger={isMobile ? 'click' : 'hover'} contentStyle={ttStyle} formatter={(v: any) => [fmt(v, currencySymbol), 'Spent']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2.5 w-full min-w-0">
                {spendingByCategory.map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-foreground font-medium truncate flex-1">{cat.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0 w-8 text-right">{totalCatSpend > 0 ? Math.round((cat.value / totalCatSpend) * 100) : 0}%</span>
                    <span className="text-xs font-bold text-foreground shrink-0 min-w-[56px] text-right">{fmt(cat.value, currencySymbol)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3-Month Bar Comparison */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Month-on-Month</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Income vs Expenses — last 3 months</p>
          </div>
          {monthCompareData.every(d => d.Income === 0 && d.Expenses === 0) ? (
            <div className="py-10 text-center border border-dashed border-border rounded-xl">
              <p className="text-sm text-muted-foreground">No transaction data yet</p>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthCompareData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => fmt(v, currencySymbol)} />
                  <Tooltip trigger={isMobile ? 'click' : 'hover'} contentStyle={ttStyle} formatter={(v: any) => [fmt(v, currencySymbol), undefined]} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Income" fill="#10b981" radius={[4,4,0,0]} maxBarSize={40} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6-Month Cash Flow Area */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Cash Flow Trend</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Net savings over 6 months — are you growing?</p>
          </div>
          {cashFlowData.every(d => d.Net === 0) ? (
            <div className="py-10 text-center border border-dashed border-border rounded-xl">
              <p className="text-sm text-muted-foreground">Log income and expenses to see your trend</p>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => fmt(v, currencySymbol)} />
                  <Tooltip trigger={isMobile ? 'click' : 'hover'} contentStyle={ttStyle} formatter={(v: any) => [fmt(v, currencySymbol), undefined]} />
                  <Area type="monotone" dataKey="Net" stroke="#6366f1" strokeWidth={2} fill="url(#netGrad)" dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 5 }} name="Net Savings" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget Performance */}
      {budgetPerf.length > 0 && (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-foreground">Budget Performance</h3>
              <p className="text-xs text-muted-foreground mt-0.5">This month vs your set limits</p>
            </div>
            <div className="flex flex-col gap-3">
              {budgetPerf.map(b => (
                <div key={b.name} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-foreground">{b.name}</span>
                    <span className={`text-xs font-bold ${b.over ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {fmt(b.used, currencySymbol)} / {fmt(b.limit, currencySymbol)}{b.over && ' ↑ Over'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${b.over ? 'bg-red-500' : b.pct > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(b.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};
