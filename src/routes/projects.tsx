import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FolderKanban, Plus, Pause, Play, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { confirm } from '../lib/useConfirmStore';
import { useAppRefresh } from '../lib/refresh';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Skeleton } from '../components/ui/Skeleton';
import { MobilePageHeader, mobileHeaderIconBtn } from '../components/ui/MobilePageHeader';
import { EmojiPicker } from '../components/ui/EmojiPicker';
import {
  fetchProjectsSafe,
  projectColor,
  projectStatusLabel,
  spentByProjectId,
  tracksExpenses,
  saveProjectRow,
  PROJECT_COLOR_IDS,
} from '../lib/projects';

const emptyForm = () => ({
  id: '',
  name: '',
  description: '',
  emoji: '📁',
  color: PROJECT_COLOR_IDS[Math.floor(Math.random() * PROJECT_COLOR_IDS.length)],
  budget: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  status: 'active' as 'active' | 'completed' | 'paused',
  track_expenses: true,
});

const inp =
  'w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45';

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [{ projects: rows }, { data: txData }, { data: settingsData }] = await Promise.all([
        fetchProjectsSafe(),
        supabase.from('transactions').select('id, project_id, amount, transaction_type_id, is_deleted').eq('is_deleted', false),
        supabase.from('user_settings').select('currencies(symbol)').maybeSingle(),
      ]);
      setProjects(rows);
      if (txData) setTransactions(txData);
      const sym = Array.isArray(settingsData?.currencies)
        ? settingsData?.currencies[0]?.symbol
        : (settingsData?.currencies as any)?.symbol;
      if (sym) setCurrencySymbol(sym);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAppRefresh(() => load(true));

  const spentMap = useMemo(() => spentByProjectId(transactions), [transactions]);

  const visible = projects.filter((p) =>
    tab === 'completed' ? p.status === 'completed' : p.status !== 'completed'
  );

  const fmt = (n: number) =>
    `${currencySymbol}${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const openCreate = () => {
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (p: any) => {
    setForm({
      id: p.id,
      name: p.name || '',
      description: p.description || '',
      emoji: p.emoji || '📁',
      color: p.color || 'indigo',
      budget: p.budget != null && p.budget !== '' ? String(p.budget) : '',
      start_date: p.start_date || new Date().toISOString().split('T')[0],
      end_date: p.end_date || '',
      status: p.status || 'active',
      track_expenses: tracksExpenses(p),
    });
    setModalOpen(true);
  };

  const saveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Give the project a name');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const payload: any = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        emoji: form.emoji || '📁',
        color: form.color || 'indigo',
        budget: form.budget === '' ? null : parseFloat(form.budget) || 0,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        track_expenses: form.track_expenses !== false,
        updated_at: new Date().toISOString(),
      };
      if (!form.id) {
        payload.created_by = user.id;
        payload.exclude_from_charts = true;
        payload.project_type = 'general';
      }
      const error = await saveProjectRow(payload, form.id || undefined);
      if (error) throw error;
      setModalOpen(false);
      toast.success(form.id ? 'Project updated' : 'Project created');
      load(true);
    } catch (err: any) {
      toast.error(err.message || 'Could not save project');
    }
  };

  const setStatus = async (p: any, status: string) => {
    const { error } = await supabase.from('projects').update({ status, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load(true);
  };

  const finishDelete = async (keepExpenses: boolean) => {
    const p = deleteTarget;
    if (!p) return;
    setDeleteTarget(null);
    try {
      const linked = transactions.filter((t) => t.project_id === p.id);
      if (keepExpenses) {
        if (tracksExpenses(p) && linked.length > 0) {
          await supabase.from('transactions').update({ project_id: null }).eq('project_id', p.id);
        }
      } else {
        for (const t of linked) {
          await supabase.from('transactions').update({ is_deleted: true }).eq('id', t.id);
        }
      }
      const { error } = await supabase.from('projects').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', p.id);
      if (error) throw error;
      toast.success('Project deleted');
      load(true);
    } catch (err: any) {
      toast.error(err.message || 'Could not delete project');
    }
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <MobilePageHeader title="Projects">
        <button
          type="button"
          onClick={openCreate}
          aria-label="New project"
          className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white cursor-pointer clay-btn"
        >
          <Plus className="h-5 w-5" />
        </button>
      </MobilePageHeader>

      <div className="hidden md:flex justify-between items-center gap-3">
        <div>
          <h1 className="page-title text-foreground m-0">Projects</h1>
          <p className="secondary-text mt-1">Track a house, wedding, trip — anything with many expenses.</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Project
        </Button>
      </div>

      <div className="flex clay-input-wrapper p-1 w-full select-none gap-0.5">
        {([
          { id: 'active' as const, label: 'Active' },
          { id: 'completed' as const, label: 'Completed' },
        ]).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 text-[12px] sm:text-[13px] font-medium rounded-full py-2 px-1 transition-all duration-300 ${
              tab === id
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="p-8 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <FolderKanban className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Start your first Project</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Track a house build, wedding, renovation, trip — anything with many expenses.
            </p>
            <Button size="sm" onClick={openCreate} className="mt-1">Create your first Project</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((p) => {
            const spent = spentMap[p.id] || 0;
            const budget = parseFloat(p.budget) || 0;
            const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            const tone = projectColor(p.color);
            return (
              <Card
                key={p.id}
                className="cursor-pointer"
                onClick={() => navigate({ to: '/projects/$projectId', params: { projectId: p.id } })}
              >
                <CardContent className="p-3.5 sm:p-4 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl leading-none">{p.emoji || '📁'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[15px] font-semibold text-foreground truncate">{p.name}</h3>
                          {!tracksExpenses(p) && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              Projects only
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {p.start_date ? new Date(p.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                          {' · '}
                          {projectStatusLabel(p.status)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {p.status !== 'completed' && (
                        <button
                          type="button"
                          className={mobileHeaderIconBtn}
                          aria-label={p.status === 'paused' ? 'Resume' : 'Pause'}
                          onClick={() => setStatus(p, p.status === 'paused' ? 'active' : 'paused')}
                        >
                          {p.status === 'paused' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <button type="button" className={mobileHeaderIconBtn} aria-label="Edit" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" className={mobileHeaderIconBtn} aria-label="Delete" onClick={() => {
                        if (p.linked_asset_id) {
                          confirm({
                            title: 'Delete this project?',
                            description: 'This project is linked to an asset. Deleting it will unlink that asset. You can keep the expenses in Money.',
                            confirmText: 'Continue',
                            onConfirm: () => setDeleteTarget(p),
                          });
                        } else {
                          setDeleteTarget(p);
                        }
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[12px] font-medium">
                    <span className="text-muted-foreground">Spent {fmt(spent)}</span>
                    {budget > 0 && <span className="text-muted-foreground">Budget {fmt(budget)}</span>}
                  </div>
                  {budget > 0 && (
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog isOpen={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Edit Project' : 'New Project'}>
        <form onSubmit={saveProject} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Emoji</label>
            <EmojiPicker value={form.emoji} onChange={(emoji) => setForm({ ...form, emoji })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Project name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} placeholder="e.g. Home renovation" />
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.track_expenses}
            onClick={() => setForm({ ...form, track_expenses: !form.track_expenses })}
            className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-left cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground">Track expenses</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {form.track_expenses
                  ? 'Spend shows in Money, updates balances, and counts toward net worth.'
                  : 'Spend stays only in this project. Nothing else changes.'}
              </div>
            </div>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                form.track_expenses ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  form.track_expenses ? 'translate-x-5' : ''
                }`}
              />
            </span>
          </button>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Budget (optional)</label>
            <input type="number" inputMode="numeric" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className={inp} placeholder="0" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Start date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inp} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">End date</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inp} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inp} h-16 resize-none`} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete project?">
        <p className="text-sm text-muted-foreground mb-4">
          {tracksExpenses(deleteTarget)
            ? 'Keep the expenses in Money as regular transactions, or remove them too?'
            : 'These expenses stay out of Money. Delete them too, or leave them attached to nothing?'}
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => finishDelete(true)}>
            {tracksExpenses(deleteTarget) ? 'Keep expenses' : 'Delete project only'}
          </Button>
          <Button variant="danger" onClick={() => finishDelete(false)}>Delete expenses too</Button>
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </div>
      </Dialog>
    </div>
  );
};
