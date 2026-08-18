import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Plus, Pencil } from 'lucide-react';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import { SEED } from '../lib/supabaseMock';
import { toast } from '../lib/useToastStore';
import { useAppRefresh } from '../lib/refresh';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { HeaderWash } from '../components/ui/SprayFlow';
import { projectColor, projectStatusLabel, tracksExpenses } from '../lib/projects';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];
const inp =
  'w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45';

export const ProjectDetail: React.FC = () => {
  const { projectId } = useParams({ from: '/projects/$projectId' });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [completeOpen, setCompleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    amount: '',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
    category_id: '',
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [{ data: proj, error }, { data: txData }, { data: catData }, { data: settingsData }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).eq('is_deleted', false).maybeSingle(),
        supabase.from('transactions').select('*').eq('is_deleted', false).eq('project_id', projectId).order('date', { ascending: false }),
        supabase.from('expense_categories').select('*').eq('is_active', true),
        supabase.from('user_settings').select('currencies(symbol)').maybeSingle(),
      ]);
      if (error) throw error;
      setProject(proj || null);
      setTransactions(txData || []);
      setCategories(catData || []);
      const sym = Array.isArray(settingsData?.currencies)
        ? settingsData?.currencies[0]?.symbol
        : (settingsData?.currencies as any)?.symbol;
      if (sym) setCurrencySymbol(sym);
    } catch (err) {
      console.error(err);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  useAppRefresh(() => load(true));

  const expenseTxs = useMemo(
    () => transactions.filter((t) => t.transaction_type_id === SEED.transaction_types.expense),
    [transactions]
  );
  const spent = expenseTxs.reduce((s, t) => s + (Math.abs(parseFloat(t.amount) || 0)), 0);
  const budget = parseFloat(project?.budget) || 0;
  const remaining = budget > 0 ? budget - spent : 0;
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const tone = projectColor(project?.color);

  const daysActive = useMemo(() => {
    if (!project?.start_date) return 0;
    const start = new Date(project.start_date);
    const end = project.status === 'completed' && project.end_date ? new Date(project.end_date) : new Date();
    const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [project]);

  const catChart = useMemo(() => {
    const map = new Map<string, number>();
    expenseTxs.forEach((t) => {
      const name = categories.find((c) => c.id === t.category_id)?.name || 'Other';
      map.set(name, (map.get(name) || 0) + (Math.abs(parseFloat(t.amount) || 0)));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [expenseTxs, categories]);

  const timeline = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...expenseTxs].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let running = 0;
    for (const t of sorted) {
      running += Math.abs(parseFloat(t.amount) || 0);
      const label = new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      map.set(label, running);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [expenseTxs]);

  const fmt = (n: number) =>
    `${currencySymbol}${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const markGeneralComplete = async () => {
    if (!project) return;
    const { error } = await supabase.from('projects').update({
      status: 'completed',
      end_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }).eq('id', project.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCompleteOpen(false);
    toast.success('Project marked complete');
    load(true);
  };

  const addPrivateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    const amount = parseFloat(addForm.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter an amount');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('transactions').insert([{
        date: addForm.date || new Date().toISOString().split('T')[0],
        amount,
        transaction_type_id: SEED.transaction_types.expense,
        category_id: addForm.category_id || null,
        account_id: null,
        payment_method_id: SEED.payment_methods.debit_card,
        merchant: addForm.merchant.trim() || project.name,
        notes: null,
        project_id: project.id,
        created_by: user.id,
        is_recurring: false,
      }]);
      if (error) throw error;
      setAddOpen(false);
      setAddForm({
        amount: '',
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        category_id: '',
      });
      toast.success('Expense added to this project');
      load(true);
    } catch (err: any) {
      toast.error(err.message || 'Could not add expense');
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading project…</div>;
  }
  if (!project) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted-foreground">This project was not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: '/projects' })}>Back to Projects</Button>
      </div>
    );
  }

  const recent = expenseTxs.slice(0, tracksExpenses(project) ? 5 : 40);
  const ledgerOn = tracksExpenses(project);

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div
        className="md:hidden sticky top-0 z-30 -mx-3 px-3 flex items-center gap-2 relative"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', height: 'calc(3rem + env(safe-area-inset-top, 0px))' }}
      >
        <HeaderWash />
        <button
          type="button"
          onClick={() => navigate({ to: '/projects' })}
          aria-label="Back"
          className="relative z-10 flex items-center justify-center h-10 w-10 rounded-full text-muted-foreground cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="relative z-10 min-w-0 flex-1 text-[17px] font-semibold truncate">
          {project.emoji} {project.name}
        </span>
      </div>

      <div className="hidden md:flex items-start justify-between gap-3">
        <div>
          <button type="button" onClick={() => navigate({ to: '/projects' })} className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2 cursor-pointer">
            <ArrowLeft className="h-3.5 w-3.5" /> Projects
          </button>
          <h1 className="page-title text-foreground m-0">{project.emoji} {project.name}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{projectStatusLabel(project.status)}</span>
            {!ledgerOn && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Projects only</span>
            )}
            {project.start_date && (
              <span className="text-[11px] text-muted-foreground">
                Started {new Date(project.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate({ to: '/projects' })} className="gap-1">
          <Pencil className="h-3.5 w-3.5" /> Edit from list
        </Button>
      </div>

      <div className={`grid gap-2 ${budget > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
        <Card>
          <CardContent className="p-3 flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Spent</span>
            <span className="text-lg font-bold">{fmt(spent)}</span>
          </CardContent>
        </Card>
        {budget > 0 && (
          <>
            <Card>
              <CardContent className="p-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Budget</span>
                <span className="text-lg font-bold">{fmt(budget)}</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Remaining</span>
                <span className={`text-lg font-bold ${remaining < 0 ? 'text-rose-500' : ''}`}>{fmt(remaining)}</span>
              </CardContent>
            </Card>
          </>
        )}
        <Card>
          <CardContent className="p-3 flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Days active</span>
            <span className="text-lg font-bold">{daysActive}</span>
          </CardContent>
        </Card>
      </div>

      {budget > 0 && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
        </div>
      )}

      <Button
        onClick={() => {
          if (ledgerOn) {
            navigate({ to: '/money', search: { add: '1', project: project.id } });
          } else {
            setAddForm({
              amount: '',
              merchant: '',
              date: new Date().toISOString().split('T')[0],
              category_id: categories[0]?.id || '',
            });
            setAddOpen(true);
          }
        }}
        className="gap-1.5"
      >
        <Plus className="h-4 w-4" /> Add expense to this project
      </Button>

      <Card>
        <CardContent className="p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent expenses</h3>
            {ledgerOn && expenseTxs.length > 0 && (
              <button
                type="button"
                className="text-[11px] font-semibold text-primary cursor-pointer"
                onClick={() => navigate({ to: '/money', search: { project: project.id } })}
              >
                View all {expenseTxs.length} expenses →
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No expenses yet. Add the first one for this project.</p>
          ) : (
            <div className={`flex flex-col ${!ledgerOn ? 'max-h-72 overflow-y-auto' : ''}`}>
              {recent.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{tx.merchant || 'Expense'}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {tx.date ? new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-rose-500 shrink-0">
                    −{fmt(Math.abs(parseFloat(tx.amount) || 0))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {catChart.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Spending by category</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={catChart} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                      {catChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(Number(v) || 0)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          {timeline.length > 1 && (
            <Card>
              <CardContent className="p-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Cumulative spend</h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={40} />
                      <Tooltip formatter={(v: any) => fmt(Number(v) || 0)} />
                      <Area type="monotone" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {project.status !== 'completed' && (
        <Button variant="outline" onClick={() => setCompleteOpen(true)}>Mark complete</Button>
      )}

      <Dialog isOpen={completeOpen} onClose={() => setCompleteOpen(false)} title="Mark project complete?">
        <p className="text-sm text-muted-foreground mb-4">
          {ledgerOn
            ? 'Expenses stay in Money. The project will be frozen as completed.'
            : 'Expenses stay on this project only. The project will be frozen as completed.'}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCompleteOpen(false)}>Cancel</Button>
          <Button onClick={markGeneralComplete}>Mark complete</Button>
        </div>
      </Dialog>

      <Dialog isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add expense">
        <form onSubmit={addPrivateExpense} className="flex flex-col gap-3">
          <p className="text-[12px] text-muted-foreground -mt-1">
            This stays in the project. It will not change Money, balances, or net worth.
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Amount</label>
            <input
              type="number"
              inputMode="decimal"
              required
              min="0"
              step="any"
              value={addForm.amount}
              onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
              className={inp}
              placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">What for</label>
            <input
              required
              value={addForm.merchant}
              onChange={(e) => setAddForm({ ...addForm, merchant: e.target.value })}
              className={inp}
              placeholder="e.g. Cement, Catering"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Date</label>
              <input
                type="date"
                required
                value={addForm.date}
                onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                className={inp}
              />
            </div>
            {categories.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-muted-foreground">Category</label>
                <select
                  value={addForm.category_id}
                  onChange={(e) => setAddForm({ ...addForm, category_id: e.target.value })}
                  className={inp}
                >
                  <option value="">Other</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
