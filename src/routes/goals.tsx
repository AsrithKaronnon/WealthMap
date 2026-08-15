import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from '../lib/useToastStore';
import { confirm } from '../lib/useConfirmStore';
import { SEED } from '../lib/supabaseMock';
import { 
  Plus, Target, Calendar, Trash2, Sparkles, Building, Edit2, Shield, Plane, Laptop
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Skeleton } from '../components/ui/Skeleton';
import { MobilePageHeader, mobileHeaderIconBtn } from '../components/ui/MobilePageHeader';

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
  const [depositAccountId, setDepositAccountId] = useState<string>('');

  // Pay EMI Modal State (Loans)
  const [payEmiLoan, setPayEmiLoan] = useState<any | null>(null);
  const [emiAmount, setEmiAmount] = useState<number>(0);
  const [emiAccountId, setEmiAccountId] = useState<string>('');

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
    if (!depositAccountId) {
      toast.error('Select an account to fund from');
      return;
    }
    const newCurrent = depositGoal.current_amount + depositAmount;
    try {
      const { error: updateError } = await supabase.from('goals').update({ current_amount: newCurrent }).eq('id', depositGoal.id);
      if (updateError) throw updateError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      // Expense from funding account so the DB trigger reduces cash
      const newTx = {
        date: new Date().toISOString().split('T')[0],
        amount: depositAmount,
        transaction_type_id: SEED.transaction_types.expense,
        category_id: SEED.expense_categories.shopping,
        account_id: depositAccountId,
        payment_method_id: SEED.payment_methods.bank_transfer,
        merchant: `Goal: ${depositGoal.name}`,
        notes: `Savings contribution to goal "${depositGoal.name}"`,
        tags: ['Goal', 'Savings'],
        is_recurring: false,
        created_by: user.id
      };
      const { error: txError } = await supabase.from('transactions').insert([newTx]);
      if (txError) throw txError;
      setDepositGoal(null);
      setDepositAmount(0);
      setDepositAccountId('');
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
    if (!emiAccountId) {
      toast.error('Select an account to pay from');
      return;
    }

    const newOutstanding = Math.max(0, parseFloat(payEmiLoan.outstanding_amount) - emiAmount);
    const newRemaining = Math.max(0, (parseInt(payEmiLoan.remaining_emis, 10) || 0) - 1);

    try {
      const { error: updateError } = await supabase.from('loans').update({
        outstanding_amount: newOutstanding,
        remaining_emis: newRemaining
      }).eq('id', payEmiLoan.id);
      if (updateError) throw updateError;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const newTx = {
        date: new Date().toISOString().split('T')[0],
        amount: emiAmount,
        transaction_type_id: SEED.transaction_types.expense,
        category_id: SEED.expense_categories.housing,
        account_id: emiAccountId,
        payment_method_id: SEED.payment_methods.bank_transfer,
        merchant: `EMI Payment: ${payEmiLoan.name}`,
        notes: `EMI for ${payEmiLoan.name}`,
        tags: ['Loan', 'EMI'],
        is_recurring: false,
        created_by: user.id
      };
      const { error: txError } = await supabase.from('transactions').insert([newTx]);
      if (txError) throw txError;

      setPayEmiLoan(null);
      setEmiAmount(0);
      setEmiAccountId('');
      fetchData();
      toast.success('EMI paid successfully');
    } catch (err) {
      toast.error('Error processing EMI');
    }
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Mobile sticky page header */}
      <MobilePageHeader title="Goals & Loans">
        <button
          onClick={handleOpenLoanAdd}
          aria-label="Add loan"
          className={`${mobileHeaderIconBtn} clay-btn`}
        >
          <Building className="h-4 w-4" />
        </button>
        <button
          onClick={handleOpenGoalAdd}
          aria-label="Add goal"
          className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white cursor-pointer clay-btn"
        >
          <Plus className="h-5 w-5" />
        </button>
      </MobilePageHeader>

      {/* HEADER: Title & Actions */}
      <div className="hidden md:flex flex-col sm:flex-row justify-between items-start sm:items-center w-full select-none gap-4">
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
        <div className="flex flex-col gap-8">
        
        {/* TOTAL GOALS BANNER */}
        {goals.length > 0 && (
          <div className="clay rounded-[1.5rem] p-5 sm:p-6 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-muted-foreground mb-1">Total Goals Value</span>
              <span className="text-3xl font-extrabold text-foreground mb-2 tracking-tight">
                {currencySymbol}{goals.reduce((acc, g) => acc + (Number(g.current_amount) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                {goals.length} Active Goal{goals.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center">
              <div className="relative h-20 w-20 flex items-center justify-center">
                <svg className="h-full w-full -rotate-90 transform">
                  <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-muted" />
                  <circle cx="40" cy="40" r="34" stroke="url(#progressGradient)" strokeWidth="6" fill="transparent" strokeDasharray="213.6" strokeDashoffset={213.6 - (213.6 * Math.min(100, Math.round((goals.reduce((acc, g) => acc + (Number(g.current_amount) || 0), 0) / Math.max(1, goals.reduce((acc, g) => acc + (Number(g.target_amount) || 1), 0))) * 100)) / 100)} strokeLinecap="round" />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[15px] font-bold">
                  {Math.min(100, Math.round((goals.reduce((acc, g) => acc + (Number(g.current_amount) || 0), 0) / Math.max(1, goals.reduce((acc, g) => acc + (Number(g.target_amount) || 1), 0))) * 100))}%
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground mt-2 font-medium">Overall Progress</span>
            </div>
          </div>
        )}

        {/* SAVINGS GOALS SECTION */}
        <div className="flex flex-col gap-4">
          <h2 className="text-[15px] font-bold text-foreground">Active Goals</h2>
        {goals.length === 0 ? (
            <div onClick={handleOpenGoalAdd} className="flex items-center gap-4 p-4 rounded-[1.5rem] clay cursor-pointer hover:opacity-90 transition-opacity mt-2">
              <div className="h-10 w-10 rounded-full clay-btn flex items-center justify-center shrink-0">
                <Plus className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-bold text-foreground">Create New Goal</span>
                <span className="text-xs font-medium text-muted-foreground/60 mt-0.5">Start saving for something great</span>
              </div>
            </div>
        ) : (
          <div className="flex flex-col gap-4">
            {goals.map((goal) => {
              const current = Number(goal.current_amount) || 0;
              const target = Number(goal.target_amount) || 1;
              const pct = Math.min(100, Math.round((current / target) * 100));

              // Determine icon based on goal name
              const lowerName = goal.name.toLowerCase();
              let Icon = Target;
              let iconColor = "text-indigo-400";
              let iconBg = "bg-muted";
              
              if (lowerName.includes('trip') || lowerName.includes('travel') || lowerName.includes('europe')) {
                Icon = Plane;
                iconColor = "text-blue-400";
              }
              else if (lowerName.includes('macbook') || lowerName.includes('laptop')) {
                Icon = Laptop;
                iconColor = "text-cyan-400";
              }
              else if (lowerName.includes('emergency') || lowerName.includes('fund')) {
                Icon = Shield;
                iconColor = "text-purple-400";
              }

              return (
                <div key={goal.id} className="clay rounded-[1.5rem] p-5 flex flex-col gap-4 relative group">
                  
                  {/* Delete / Deposit Buttons (Hidden until hover) */}
                  <div className="absolute top-4 right-4 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => {
                      setDepositGoal(goal);
                      setDepositAmount(0);
                      setDepositAccountId(accounts.find((a: any) => a.account_type !== 'Credit Card')?.id || accounts[0]?.id || '');
                    }} className="p-2 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center rounded-full bg-green-500/10 text-green-500" title="Add Money">
                      <Plus className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleGoalDelete(goal.id)} className="p-2 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center rounded-full bg-red-500/10 text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className={`h-11 w-11 rounded-full ${iconBg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${iconColor}`} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[15px] font-bold text-foreground">{goal.name}</span>
                      <div className="text-[13px] font-semibold mt-0.5 flex gap-1">
                        <span className="text-indigo-400">{currencySymbol}{current.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        <span className="text-muted-foreground/40">/</span>
                        <span className="text-muted-foreground/60">{currencySymbol}{target.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-foreground w-8 text-right">{pct}%</span>
                  </div>

                  <div className="text-xs font-medium text-muted-foreground/60">
                    Target: {new Date(goal.due_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                </div>
              );
            })}

            {/* CREATE NEW GOAL BUTTON */}
            <div onClick={handleOpenGoalAdd} className="flex items-center gap-4 p-4 rounded-[1.5rem] clay cursor-pointer hover:opacity-90 transition-opacity mt-2">
              <div className="h-10 w-10 rounded-full clay-btn flex items-center justify-center shrink-0">
                <Plus className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-bold text-foreground">Create New Goal</span>
                <span className="text-xs font-medium text-muted-foreground/60 mt-0.5">Start saving for something great</span>
              </div>
            </div>

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
                      <button onClick={() => handleOpenLoanEdit(loan)} className="p-2 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:p-1 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors" title="Edit Loan">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleLoanDelete(loan.id)} className="p-2 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:p-1 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-colors" title="Delete Loan">
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
                    <Button onClick={() => {
                      setPayEmiLoan(loan);
                      setEmiAmount(Number(loan.monthly_emi) || 0);
                      setEmiAccountId(accounts.find((a: any) => a.account_type !== 'Credit Card')?.id || accounts[0]?.id || '');
                    }} className="w-full py-1 text-xs cursor-pointer bg-background hover:bg-muted text-foreground border border-border/50 shadow-sm" variant="outline">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Target Amount ({currencySymbol})</label>
              <input type="number" inputMode="numeric" required value={goalFormData.target_amount || ''} onChange={e => setGoalFormData({ ...goalFormData, target_amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Already Saved ({currencySymbol})</label>
              <input type="number" inputMode="numeric" value={goalFormData.current_amount || ''} onChange={e => setGoalFormData({ ...goalFormData, current_amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Monthly Plan ({currencySymbol})</label>
              <input type="number" inputMode="numeric" value={goalFormData.monthly_contribution || ''} onChange={e => setGoalFormData({ ...goalFormData, monthly_contribution: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">Total Amount ({currencySymbol})</label>
              <input type="number" inputMode="numeric" required value={loanFormData.total_amount || ''} onChange={e => setLoanFormData({ ...loanFormData, total_amount: parseFloat(e.target.value) || 0, outstanding_amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">Outstanding ({currencySymbol})</label>
              <input type="number" inputMode="numeric" required value={loanFormData.outstanding_amount || ''} onChange={e => setLoanFormData({ ...loanFormData, outstanding_amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">Monthly EMI ({currencySymbol})</label>
              <input type="number" inputMode="numeric" value={loanFormData.monthly_emi || ''} onChange={e => setLoanFormData({ ...loanFormData, monthly_emi: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">Interest Rate (%)</label>
              <input type="number" inputMode="numeric" step="0.1" value={loanFormData.interest_rate || ''} onChange={e => setLoanFormData({ ...loanFormData, interest_rate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45" />
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
            <input type="number" inputMode="numeric" required autoFocus step="0.01" value={depositAmount || ''} onChange={e => setDepositAmount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45 font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Pay From Account</label>
            <select required value={depositAccountId} onChange={e => setDepositAccountId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45">
              <option value="">Select account</option>
              {accounts.filter((a: any) => a.account_type !== 'Credit Card').map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
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
            <input type="number" inputMode="numeric" required autoFocus step="0.01" value={emiAmount || ''} onChange={e => setEmiAmount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45 font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Pay From Account</label>
            <select required value={emiAccountId} onChange={e => setEmiAccountId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/45">
              <option value="">Select account</option>
              {accounts.filter((a: any) => a.account_type !== 'Credit Card').map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
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
