import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { confirm } from '../lib/useConfirmStore';
import { SEED } from '../lib/supabaseMock';
import { 
  Plus, Target, Calendar, Trash2, Sparkles, Building, Edit2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Skeleton } from '../components/ui/Skeleton';

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  priority_id: string;
  category_id: string;
  due_date: string;
  notes: string;
  created_by?: string;
}

export interface Loan {
  id: string;
  name: string;
  loan_type_id: string;
  total_amount: number;
  outstanding_amount: number;
  interest_rate: number;
  duration_months: number;
  monthly_emi: number;
  remaining_emis: number;
  start_date: string;
  is_deleted?: boolean;
  created_by?: string;
}

export const Goals: React.FC = () => {
  const [loading, setLoading] = useState(true);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  
  // Goals Add / Edit Modal state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalFormData, setGoalFormData] = useState({
    name: '',
    target_amount: 0,
    current_amount: 0,
    monthly_contribution: 0,
    priority_id: SEED.priorities.medium,
    category_id: SEED.goal_types.savings,
    due_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Loans Add Modal state
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanFormData, setLoanFormData] = useState<any>({
    id: undefined,
    name: '',
    loan_type_id: SEED.loan_types.personal,
    total_amount: 0,
    outstanding_amount: 0,
    interest_rate: 0,
    duration_months: 12,
    monthly_emi: 0,
    remaining_emis: 12,
    start_date: new Date().toISOString().split('T')[0]
  });

  // Deposit Modal State (Goals)
  const [depositGoal, setDepositGoal] = useState<any | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(0);

  // Pay EMI Modal State (Loans)
  const [payEmiLoan, setPayEmiLoan] = useState<any | null>(null);
  const [emiAmount, setEmiAmount] = useState<number>(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      let [
        { data: goalsData },
        { data: loansData },
        { data: accData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('goals').select('*'),
        supabase.from('loans').select('*').eq('is_deleted', false),
        supabase.from('accounts').select('*').order('name', { ascending: true }),
        supabase.from('user_settings').select('base_currency_id, currencies(symbol)').maybeSingle()
      ]);

      if (accData && accData.length === 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: newAcc } = await supabase.from('accounts').insert([{
            name: 'Primary Checking',
            balance: 0.00,
            account_type: 'Checking',
            currency_id: SEED.currencies.usd,
            created_by: user.id
          }]).select();
          if (newAcc) accData = newAcc;
        }
      }

      if (settingsData && settingsData.currencies) {
        const sym = Array.isArray(settingsData.currencies)
          ? settingsData.currencies[0]?.symbol
          : (settingsData.currencies as any)?.symbol;
        if (sym) setCurrencySymbol(sym);
      }

      if (goalsData) setGoals(goalsData);
      if (loansData) setLoans(loansData);
      if (accData) setAccounts(accData);


    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- GOALS LOGIC ---
  const handleOpenGoalAdd = () => {
    setGoalFormData({
      name: '',
      target_amount: 0,
      current_amount: 0,
      monthly_contribution: 100,
      priority_id: SEED.priorities.medium,
      category_id: SEED.goal_types.savings,
      due_date: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
      notes: ''
    });
    setIsGoalModalOpen(true);
  };

  const handleGoalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");
      
      const { error } = await supabase.from('goals').insert([{...goalFormData, created_by: user.id}]);
      if (error) throw error;
      setIsGoalModalOpen(false);
      fetchData();
      toast.success('Goal saved');
    } catch (err: any) {
      console.error('Error saving goal:', err);
      toast.error(err.message || 'Error saving goal');
    }
  };

  const handleGoalDelete = (id: string) => {
    confirm({
      title: 'Delete Goal',
      description: 'Are you sure you want to delete this savings goal?',
      destructive: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await supabase.from('goals').delete().eq('id', id);
          fetchData();
          toast.success('Goal deleted');
        } catch (err) {
          toast.error('Error deleting goal');
        }
      }
    });
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0 || !depositGoal) return;
    const newCurrent = depositGoal.current_amount + depositAmount;
    try {
      const { error: updateError } = await supabase.from('goals').update({ current_amount: newCurrent }).eq('id', depositGoal.id);
      if (updateError) throw updateError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const newTx = {
        date: new Date().toISOString().split('T')[0],
        amount: depositAmount,
        transaction_type_id: SEED.transaction_types.transfer,
        category_id: SEED.expense_categories.health, // Using health since there's no native transfer category
        account_id: accounts[0].id,
        payment_method_id: SEED.payment_methods.bank_transfer,
        merchant: `Goal Transfer: ${depositGoal.name}`,
        notes: `Savings contribution to goal "${depositGoal.name}"`,
        tags: ['Essential'],
        is_recurring: false,
        created_by: user.id
      };
      const { error: txError } = await supabase.from('transactions').insert([newTx]);
      if (txError) throw txError;
      setDepositGoal(null);
      setDepositAmount(0);
      fetchData();
      toast.success('Contribution added');
    } catch (err) {
      toast.error('Error processing contribution');
    }
  };

  // --- LOANS LOGIC ---
  const handleOpenLoanAdd = () => {
    setLoanFormData({
      id: undefined,
      name: '',
      loan_type_id: SEED.loan_types.personal,
      total_amount: 0,
      outstanding_amount: 0,
      interest_rate: 0,
      duration_months: 12,
      monthly_emi: 0,
      remaining_emis: 12,
      start_date: new Date().toISOString().split('T')[0]
    });
    setIsLoanModalOpen(true);
  };

  const handleOpenLoanEdit = (loan: any) => {
    setLoanFormData({
      id: loan.id,
      name: loan.name,
      loan_type_id: loan.loan_type_id || SEED.loan_types.personal,
      total_amount: loan.total_amount,
      outstanding_amount: loan.outstanding_amount,
      interest_rate: loan.interest_rate,
      duration_months: loan.duration_months,
      monthly_emi: loan.monthly_emi,
      remaining_emis: loan.remaining_emis || loan.duration_months,
      start_date: loan.start_date || new Date().toISOString().split('T')[0]
    });
    setIsLoanModalOpen(true);
  };

  const handleLoanSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (loanFormData.id) {
        const { id, ...updateData } = loanFormData;
        const { error } = await supabase.from('loans').update(updateData).eq('id', id);
        if (error) throw error;
        toast.success('Loan updated');
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Authentication required");

        const { id, ...insertData } = loanFormData;
        const { error } = await supabase.from('loans').insert([{ ...insertData, created_by: user.id }]);
        if (error) throw error;
        toast.success('Loan added');
      }
      setIsLoanModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving loan:', err);
      toast.error(err.message || 'Error saving loan');
    }
  };

  const handleLoanDelete = (id: string) => {
    confirm({
      title: 'Delete Loan',
      description: 'Remove this loan record?',
      destructive: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await supabase.from('loans').update({ is_deleted: true }).eq('id', id);
          fetchData();
          toast.success('Loan removed');
        } catch (err) {
          toast.error('Error removing loan');
        }
      }
    });
  };

  const handlePayEmi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emiAmount <= 0 || !payEmiLoan) return;
    
    // Simple principal reduction for this example
    const newOutstanding = Math.max(0, parseFloat(payEmiLoan.outstanding_amount) - emiAmount);

    try {
      const { error: updateError } = await supabase.from('loans').update({ outstanding_amount: newOutstanding }).eq('id', payEmiLoan.id);
      if (updateError) throw updateError;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const newTx = {
        date: new Date().toISOString().split('T')[0],
        amount: emiAmount,
        transaction_type_id: SEED.transaction_types.expense,
        category_id: SEED.expense_categories.housing, // Adjust depending on loan type
        account_id: accounts[0].id,
        payment_method_id: SEED.payment_methods.bank_transfer,
        merchant: `EMI Payment: ${payEmiLoan.name}`,
        notes: `EMI for ${payEmiLoan.name}`,
        tags: ['Essential'],
        is_recurring: false,
        created_by: user.id
      };
      const { error: txError } = await supabase.from('transactions').insert([newTx]);
      if (txError) throw txError;

      setPayEmiLoan(null);
      setEmiAmount(0);
      fetchData();
      toast.success('EMI paid successfully');
    } catch (err) {
      toast.error('Error processing EMI');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER: Title & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full select-none gap-4">
        <div>
          <h1 className="page-title text-foreground">Goals</h1>
          <p className="secondary-text">Track your savings targets and manage active debt.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={handleOpenLoanAdd} variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Plus className="icon-inline mr-1" /> Add Loan
          </Button>
          <Button onClick={handleOpenGoalAdd} size="sm" className="flex-1 sm:flex-none">
            <Plus className="icon-inline mr-1" /> Add Goal
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full skeleton" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-10">
        {/* SAVINGS GOALS SECTION */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4">Savings Goals</h2>
        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-xl">
            <Target className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium text-foreground">No Goals Set Yet</p>
            <Button size="sm" onClick={handleOpenGoalAdd} className="mt-4">Create My First Goal</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {goals.map((goal) => {
              const current = Number(goal.current_amount) || 0;
              const target = Number(goal.target_amount) || 1;
              const pct = Math.min(100, Math.round((current / target) * 100));

              return (
                <Card key={goal.id} className="flex flex-col h-full hoverEffect">
                  <CardHeader className="pb-3 flex-row justify-between items-start">
                    <div className="flex flex-col">
                      <CardTitle className="text-sm">{goal.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5 font-medium text-foreground/80">
                        {currencySymbol}{current.toLocaleString('en-IN', { maximumFractionDigits: 0 })} of {currencySymbol}{target.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </CardDescription>
                    </div>
                    <button onClick={() => handleGoalDelete(goal.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </CardHeader>
                  <CardContent className="flex-1 py-2 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-foreground">{pct}%</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex justify-between items-center select-none">
                      <span>{currencySymbol}{Number(goal.monthly_contribution).toLocaleString('en-IN')}/month</span>
                      <span className="flex items-center gap-1 text-[11px]"><Calendar className="h-3 w-3" /> {new Date(goal.due_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="p-3 bg-muted/10 border-t border-border/40 select-none">
                    <Button onClick={() => { setDepositGoal(goal); setDepositAmount(0); }} className="w-full py-1 text-xs cursor-pointer bg-background hover:bg-muted text-foreground border border-border/50 shadow-sm" variant="outline">
                      Add Money
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
        </div>

        {/* DEBT PAYOFF SECTION */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4">Debt Payoff</h2>
        {loans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-xl">
            <Building className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium text-foreground">No Loans Active</p>
            <Button size="sm" onClick={handleOpenLoanAdd} className="mt-4">Add a Liability</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loans.map((loan) => {
              const outstanding = Number(loan.outstanding_amount) || 0;
              const total = Number(loan.total_amount) || 1;
              const paid = total - outstanding;
              const pct = Math.min(100, Math.round((paid / total) * 100));

              return (
                <Card key={loan.id} className="flex flex-col h-full hoverEffect">
                  <CardHeader className="pb-3 flex-row justify-between items-start">
                    <div className="flex flex-col">
                      <CardTitle className="text-sm">{loan.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5 font-medium text-foreground/80">
                        {currencySymbol}{outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })} remaining
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleOpenLoanEdit(loan)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors" title="Edit Loan">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleLoanDelete(loan.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-colors" title="Delete Loan">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 py-2 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-foreground">{pct}% paid</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex justify-between items-center select-none">
                      <span>{currencySymbol}{Number(loan.monthly_emi).toLocaleString('en-IN')} next payment</span>
                    </div>
                  </CardContent>
                  <CardFooter className="p-3 bg-muted/10 border-t border-border/40 select-none">
                    <Button onClick={() => { setPayEmiLoan(loan); setEmiAmount(Number(loan.monthly_emi) || 0); }} className="w-full py-1 text-xs cursor-pointer bg-background hover:bg-muted text-foreground border border-border/50 shadow-sm" variant="outline">
                      Pay EMI
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
        </div>
        </div>
      )}

      {/* CREATE GOAL DIALOG */}
      <Dialog isOpen={isGoalModalOpen} onClose={() => setIsGoalModalOpen(false)} title="Create a Savings Goal">
        <form onSubmit={handleGoalSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">What are you saving for?</label>
            <input type="text" required value={goalFormData.name} onChange={e => setGoalFormData({ ...goalFormData, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" placeholder="e.g. New Bike, Wedding Fund" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Target Amount ({currencySymbol})</label>
              <input type="number" required value={goalFormData.target_amount || ''} onChange={e => setGoalFormData({ ...goalFormData, target_amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Already Saved ({currencySymbol})</label>
              <input type="number" value={goalFormData.current_amount || ''} onChange={e => setGoalFormData({ ...goalFormData, current_amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Monthly Plan ({currencySymbol})</label>
              <input type="number" value={goalFormData.monthly_contribution || ''} onChange={e => setGoalFormData({ ...goalFormData, monthly_contribution: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Target Date</label>
              <input type="date" required value={goalFormData.due_date} onChange={e => setGoalFormData({ ...goalFormData, due_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Note (Optional)</label>
            <textarea value={goalFormData.notes} onChange={e => setGoalFormData({ ...goalFormData, notes: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45 h-16 resize-none" />
          </div>
          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4">
            <Button type="button" variant="outline" onClick={() => setIsGoalModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Goal</Button>
          </div>
        </form>
      </Dialog>

      {/* CREATE LOAN DIALOG */}
      <Dialog isOpen={isLoanModalOpen} onClose={() => setIsLoanModalOpen(false)} title="Add a Liability">
        <form onSubmit={handleLoanSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Loan Name / Bank</label>
            <input type="text" required value={loanFormData.name} onChange={e => setLoanFormData({ ...loanFormData, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" placeholder="e.g. Chase Auto Loan" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Total Loan Amount ({currencySymbol})</label>
              <input type="number" required value={loanFormData.total_amount || ''} onChange={e => setLoanFormData({ ...loanFormData, total_amount: parseFloat(e.target.value) || 0, outstanding_amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Current Outstanding ({currencySymbol})</label>
              <input type="number" required value={loanFormData.outstanding_amount || ''} onChange={e => setLoanFormData({ ...loanFormData, outstanding_amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Monthly EMI ({currencySymbol})</label>
              <input type="number" value={loanFormData.monthly_emi || ''} onChange={e => setLoanFormData({ ...loanFormData, monthly_emi: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Interest Rate (%)</label>
              <input type="number" step="0.1" value={loanFormData.interest_rate || ''} onChange={e => setLoanFormData({ ...loanFormData, interest_rate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4">
            <Button type="button" variant="outline" onClick={() => setIsLoanModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Loan</Button>
          </div>
        </form>
      </Dialog>

      {/* ALLOCATE GOAL DIALOG */}
      <Dialog isOpen={!!depositGoal} onClose={() => setDepositGoal(null)} title={depositGoal ? `Add Savings: ${depositGoal.name}` : ''}>
        <form onSubmit={handleDeposit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Amount to Add ({currencySymbol})</label>
            <input type="number" required autoFocus step="0.01" value={depositAmount || ''} onChange={e => setDepositAmount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45 font-mono" />
          </div>
          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4">
            <Button type="button" variant="outline" onClick={() => setDepositGoal(null)}>Cancel</Button>
            <Button type="submit" disabled={depositAmount <= 0}>Complete Deposit</Button>
          </div>
        </form>
      </Dialog>

      {/* PAY EMI LOAN DIALOG */}
      <Dialog isOpen={!!payEmiLoan} onClose={() => setPayEmiLoan(null)} title={payEmiLoan ? `Pay EMI: ${payEmiLoan.name}` : ''}>
        <form onSubmit={handlePayEmi} className="flex flex-col gap-4">
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3 text-xs text-foreground items-start select-none">
            <Sparkles className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Automated Ledger</span>
              <p className="text-muted-foreground mt-0.5">Paying this EMI will log a transaction in your feed and reduce your outstanding loan balance.</p>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">EMI Amount ({currencySymbol})</label>
            <input type="number" required autoFocus step="0.01" value={emiAmount || ''} onChange={e => setEmiAmount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45 font-mono" />
          </div>
          <div className="flex justify-end gap-2 border-t border-border/40 pt-4 mt-4">
            <Button type="button" variant="outline" onClick={() => setPayEmiLoan(null)}>Cancel</Button>
            <Button type="submit" disabled={emiAmount <= 0}>Pay EMI</Button>
          </div>
        </form>
      </Dialog>

    </div>
  );
};
