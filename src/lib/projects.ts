import { supabase } from './supabaseClient';
import { SEED } from './supabaseMock';

export type ProjectStatus = 'active' | 'completed' | 'paused';

export const PROJECT_EMOJIS = [
  '🏠', '🏡', '🏗️', '🌾', '💍', '💒', '✈️', '🏖️', '🎉', '🎓',
  '🚗', '💻', '🏥', '🎨', '⛺', '🛠️', '📦', '📁', '💡', '🌱',
];

export const PROJECT_COLOR_STYLES: Record<string, { bg: string; text: string; bar: string; ring: string }> = {
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', bar: 'bg-indigo-500', ring: 'ring-indigo-500/40' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500', ring: 'ring-amber-500/40' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', ring: 'ring-emerald-500/40' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500', ring: 'ring-rose-500/40' },
  sky: { bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', bar: 'bg-sky-500', ring: 'ring-sky-500/40' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', bar: 'bg-violet-500', ring: 'ring-violet-500/40' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500', ring: 'ring-orange-500/40' },
  teal: { bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', bar: 'bg-teal-500', ring: 'ring-teal-500/40' },
};

export const PROJECT_COLOR_IDS = Object.keys(PROJECT_COLOR_STYLES);

export function projectColor(color?: string) {
  return PROJECT_COLOR_STYLES[color || ''] || PROJECT_COLOR_STYLES.indigo;
}

export function projectStatusLabel(status?: string) {
  if (status === 'paused') return 'Paused';
  if (status === 'completed') return 'Completed';
  return 'Active';
}

/** Defaults on when the column is missing (older DB / mock). */
export function tracksExpenses(project?: any | null): boolean {
  if (!project) return true;
  return project.track_expenses !== false;
}

export function untrackedProjectIdSet(projects: any[]): Set<string> {
  return new Set((projects || []).filter((p) => !tracksExpenses(p)).map((p) => p.id));
}

/** Project-only spend (no account) never hits Money, balances, or net worth. */
export function isLedgerTransaction(tx: any, untrackedIds: Set<string>): boolean {
  if (!tx?.project_id) return true;
  if (!tx.account_id) return false;
  if (untrackedIds.has(tx.project_id)) return false;
  return true;
}

export function spentByProjectId(transactions: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (!t?.project_id) continue;
    if (t.transaction_type_id !== SEED.transaction_types.expense) continue;
    map[t.project_id] = (map[t.project_id] || 0) + (Math.abs(parseFloat(t.amount) || 0));
  }
  return map;
}

export function projectIdSet(projects: any[]): Set<string> {
  return new Set((projects || []).map((p) => p.id));
}

/** Fetch projects. If the table is missing (migration not applied), returns empty and available=false. */
export async function fetchProjectsSafe(): Promise<{ projects: any[]; available: boolean }> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[projects]', error.message);
      return { projects: [], available: false };
    }
    return { projects: data || [], available: true };
  } catch (err) {
    console.warn('[projects]', err);
    return { projects: [], available: false };
  }
}

/** Insert or update a project. Retries without track_expenses if the column is not on the live DB yet. */
export async function saveProjectRow(payload: Record<string, any>, id?: string) {
  const run = (body: Record<string, any>) =>
    id
      ? supabase.from('projects').update(body).eq('id', id)
      : supabase.from('projects').insert([body]);

  let { error } = await run(payload);
  if (error && /track_expenses/i.test(error.message || '')) {
    const { track_expenses: _ignored, ...rest } = payload;
    ({ error } = await run(rest));
  }
  return error;
}
