// Settings Page
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Sun, Moon, Monitor, ShieldCheck, 
  User, 
  Trash2, ChevronDown, Plus, Sliders, X, ChevronUp, KeyRound
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SEED } from '../lib/supabaseMock';
import { registerBiometrics } from '../lib/webauthn';

export const Settings: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [currency, setCurrency] = useState('USD');
  const [currencies, setCurrencies] = useState<any[]>([]);
  // App Lock State
  const [appPin, setAppPin] = useState(localStorage.getItem('app_pin') || '');
  const [pinInput, setPinInput] = useState('');
  const [bioEnabled, setBioEnabled] = useState(!!localStorage.getItem('biometric_id'));
  const [securityMsg, setSecurityMsg] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Update State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');

  // Collapsible Accordion State
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Budgets Configuration State
  const [categories, setCategories] = useState<any[]>([]);
  const [userBudgets, setUserBudgets] = useState<any[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetsMsg, setBudgetsMsg] = useState('');

  // Budget Add Mode
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetCustomName, setNewBudgetCustomName] = useState('');
  const [newBudgetAmount, setNewBudgetAmount] = useState<number>(0);




  useEffect(() => {
    // Load initial settings theme
    
    // AI NLP features disabled temporarily for security reasons (needs Edge Function)
    // Removed gemini API key load from localStorage

    const savedTheme = window.localStorage.getItem('theme') || 'system';
    setTheme(savedTheme as any);

    // Fetch master currencies
    supabase.from('currencies').select('*').order('code', { ascending: true }).then(({ data }) => {
      if (data) setCurrencies(data);
    });

    // Fetch user settings base currency
    supabase.from('user_settings').select('*').maybeSingle().then(({ data }) => {
      if (data && data.base_currency_id) {
        setCurrency(data.base_currency_id);
      }
    });



    // Fetch logged-in user profile metadata
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {

        if (user.user_metadata) {
          setFirstName(user.user_metadata.first_name || '');
          setLastName(user.user_metadata.last_name || '');
          setPhone(user.user_metadata.phone || '');
        }
      }
    });

    // Fetch expense categories & user budgets in parallel
    const fetchBudgets = async () => {
      const [{ data: catData }, { data: budgetData }] = await Promise.all([
        supabase.from('expense_categories').select('*').eq('is_active', true).order('name', { ascending: true }),
        supabase.from('budgets').select('*').order('sort_order', { ascending: true })
      ]);
      if (catData) {
        setCategories(catData);
        if (budgetData) {
          const mapped = budgetData.map((b: any, index: number) => ({
            id: b.id,
            category_id: b.category_id,
            amount: parseFloat(b.amount) || 0,
            sort_order: b.sort_order ?? index,
            name: catData.find((c: any) => c.id === b.category_id)?.name || 'Unknown',
            is_system: catData.find((c: any) => c.id === b.category_id)?.is_system !== false
          })).sort((a: any, b: any) => a.sort_order - b.sort_order);
          setUserBudgets(mapped);
        }
      }
    };
    fetchBudgets();
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setPasswordMsg('Error: All password fields are required.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg('Error: New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg('Error: New password must be at least 6 characters.');
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg('');
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const email = user?.email;
      const phone = user?.phone;
      
      const credentials = email 
        ? { email, password: oldPassword }
        : { phone, password: oldPassword };
        
      const { error: signInErr } = await supabase.auth.signInWithPassword(credentials as any);
      if (signInErr) {
        throw new Error('Incorrect previous password.');
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (updateErr) throw updateErr;

      setPasswordMsg('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordMsg(''), 4000);
    } catch (err: any) {
      setPasswordMsg(`Error: ${err.message}`);
    } finally {
      setPasswordLoading(false);
    }
  };



  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg('');
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone
        }
      });
      if (error) throw error;
      setProfileMsg('Profile updated successfully!');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err: any) {
      setProfileMsg(`Error: ${err.message}`);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    window.localStorage.setItem('theme', newTheme);
    
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(newTheme);
    }
  };



  const moveBudget = (index: number, direction: 'up' | 'down') => {
    const newBudgets = [...userBudgets];
    if (direction === 'up' && index > 0) {
      [newBudgets[index - 1], newBudgets[index]] = [newBudgets[index], newBudgets[index - 1]];
    } else if (direction === 'down' && index < newBudgets.length - 1) {
      [newBudgets[index + 1], newBudgets[index]] = [newBudgets[index], newBudgets[index + 1]];
    }
    newBudgets.forEach((b, i) => { b.sort_order = i; });
    setUserBudgets(newBudgets);
  };

  const removeBudget = (index: number) => {
    const newBudgets = userBudgets.filter((_, i) => i !== index);
    newBudgets.forEach((b, i) => { b.sort_order = i; });
    setUserBudgets(newBudgets);
  };

  const updateBudgetAmount = (index: number, amt: number) => {
    const newBudgets = [...userBudgets];
    newBudgets[index].amount = amt;
    setUserBudgets(newBudgets);
  };

  


  const handleAddBudgetSubmit = async () => {
    if (newBudgetAmount < 0) {
      setBudgetsMsg('Error: Amount cannot be negative');
      setTimeout(() => setBudgetsMsg(''), 3000);
      return;
    }
    
    let catId = newBudgetCategory;
    let catName = '';
    
    if (catId === 'custom') {
      if (!newBudgetCustomName.trim()) {
        setBudgetsMsg('Error: Custom name required');
        setTimeout(() => setBudgetsMsg(''), 3000);
        return;
      }
      if (categories.some(c => c.name.toLowerCase() === newBudgetCustomName.trim().toLowerCase())) {
        setBudgetsMsg('Error: Category already exists');
        setTimeout(() => setBudgetsMsg(''), 3000);
        return;
      }
      const newCatId = 'cat_' + Date.now().toString();
      await supabase.from('expense_categories').insert([{
        id: newCatId,
        name: newBudgetCustomName.trim(),
        icon: 'Tag',
        color: 'gray',
        is_system: false
      }]);
      catId = newCatId;
      catName = newBudgetCustomName.trim();
      setCategories([...categories, { id: newCatId, name: catName, is_system: false }]);
    } else {
      if (!catId) return;
      catName = categories.find(c => c.id === catId)?.name || 'Unknown';
    }

    if (userBudgets.some(b => b.category_id === catId)) {
      setBudgetsMsg('Error: Budget for this category already exists');
      setTimeout(() => setBudgetsMsg(''), 3000);
      return;
    }

    const newBudget = {
      category_id: catId,
      amount: newBudgetAmount,
      budget_type_id: SEED.recurrences.monthly,
      sort_order: userBudgets.length
    };
    
    let budgetId;
    try {
      const { data: insertedBudget } = await supabase.from('budgets').insert([newBudget]).select().single();
      budgetId = insertedBudget ? insertedBudget.id : undefined;
    } catch (err) {
      console.error('Failed to auto-save new budget:', err);
    }

    setUserBudgets([
      ...userBudgets,
      { id: budgetId, category_id: catId, amount: newBudgetAmount, sort_order: userBudgets.length, name: catName, is_system: catId !== 'custom' && categories.find(c => c.id === catId)?.is_system !== false }
    ]);
    
    setIsAddingBudget(false);
    setNewBudgetCategory('');
    setNewBudgetCustomName('');
    setNewBudgetAmount(0);

    setBudgetsMsg('Category added and saved successfully!');
    setTimeout(() => setBudgetsMsg(''), 3000);
  };

  const handleSaveBudgets = async (e: React.FormEvent) => {
    e.preventDefault();
    setBudgetsLoading(true);
    setBudgetsMsg('');
    try {
      const promises = userBudgets.map(async (b) => {
        if (b.id) {
          await supabase.from('budgets').update({ amount: b.amount, sort_order: b.sort_order }).eq('id', b.id);
        } else {
          await supabase.from('budgets').insert([{
            category_id: b.category_id,
            amount: b.amount,
            budget_type_id: SEED.recurrences.monthly,
            sort_order: b.sort_order
          }]);
        }
      });
      await Promise.all(promises);

      // Batch delete removed budgets in a single query instead of N+1 loop
      const { data: currentBudgets } = await supabase.from('budgets').select('id');
      if (currentBudgets) {
        const keptIds = userBudgets.map((b: any) => b.id).filter(Boolean);
        const toDeleteIds = currentBudgets
          .filter((cb: any) => !keptIds.includes(cb.id))
          .map((cb: any) => cb.id);
        if (toDeleteIds.length > 0) {
          await supabase.from('budgets').delete().in('id', toDeleteIds);
        }
      }

      setBudgetsMsg('Budget limits updated successfully!');
      setTimeout(() => setBudgetsMsg(''), 3000);
      
      supabase.from('budgets').select('*').order('sort_order', { ascending: true }).then(({ data: budgetData }) => {
        if (budgetData) {
          const mapped = budgetData.map((b: any, index: number) => ({
            id: b.id,
            category_id: b.category_id,
            amount: parseFloat(b.amount) || 0,
            sort_order: b.sort_order ?? index,
            name: categories.find((c: any) => c.id === b.category_id)?.name || 'Unknown',
            is_system: categories.find((c: any) => c.id === b.category_id)?.is_system !== false
          }));
          setUserBudgets(mapped);
        }
      });

    } catch (err: any) {
      setBudgetsMsg(`Error: ${err.message || 'Failed to save'}`);
    } finally {
      setBudgetsLoading(false);
    }
  };


  return (
    <div className="flex flex-col gap-6">
      
      {/* Title */}
      <div className="select-none mb-2">
        <h1 className="text-[22px] font-bold text-foreground tracking-tight">Settings</h1>
      </div>

      <div className="flex flex-col gap-2 max-w-2xl">
        {/* PROFILE HEADER CARD */}
        <div className="clay rounded-[1.5rem] p-4 flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center overflow-hidden border-2 border-white/10">
               <User className="h-6 w-6 text-white/50" />
            </div>
            <div className="flex flex-col">
              <span className="text-[16px] font-bold text-foreground">{firstName || 'User'} {lastName}</span>
              <span className="text-[12px] text-muted-foreground">{phone || 'user@example.com'}</span>
            </div>
          </div>
          <ChevronDown className="h-5 w-5 text-muted-foreground/50 -rotate-90" />
        </div>

        {/* PROFILE SETTINGS */}
        <div className="clay rounded-[1.2rem] overflow-hidden flex flex-col transition-colors">
          <div onClick={() => setActiveSection(activeSection === 'profile' ? null : 'profile')} className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-foreground">Profile Settings</span>
                <span className="text-[11px] font-medium text-muted-foreground/60">Manage your personal information</span>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${activeSection === 'profile' ? '' : '-rotate-90'}`} />
          </div>
          {activeSection === 'profile' && (
            <div className="p-4 border-t border-border/50 bg-muted/10">
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                {profileMsg && (
                  <div className={`p-3 rounded-lg border text-xs font-semibold ${
                    profileMsg.startsWith('Error') 
                      ? 'bg-destructive/10 border-destructive/25 text-destructive' 
                      : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
                  }`}>
                    {profileMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted-foreground">First Name</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted-foreground">Last Name</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                  />
                </div>

                <Button type="submit" loading={profileLoading} className="py-2 px-4 text-xs font-bold cursor-pointer">
                  Save Profile Details
                </Button>
              </form>
            </div>
          )}
        </div>

        {/* MONTHLY BUDGET */}
        <div className="clay rounded-[1.2rem] overflow-hidden flex flex-col transition-colors">
          <div onClick={() => setActiveSection(activeSection === 'budgets' ? null : 'budgets')} className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Sliders className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-foreground">Monthly Budget</span>
                <span className="text-[11px] font-medium text-muted-foreground/60">Set your budget and spending limits</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" className="h-[28px] text-[10px] px-2 py-0 gap-1 rounded-md cursor-pointer border-white/10" onClick={(e) => { e.stopPropagation(); setIsAddingBudget(true); setActiveSection('budgets'); }}>
                <Plus className="h-3 w-3" /> Add
              </Button>
              <ChevronDown className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${activeSection === 'budgets' ? '' : '-rotate-90'}`} />
            </div>
          </div>
          {activeSection === 'budgets' && (
            <div className="p-4 border-t border-border/50 bg-muted/10">
              <form onSubmit={handleSaveBudgets} className="space-y-4">
                {budgetsMsg && (
                  <div className={`p-3 rounded-lg border text-xs font-semibold ${budgetsMsg.includes('Error') ? 'bg-destructive/10 border-destructive/25 text-destructive' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'}`}>
                    {budgetsMsg}
                  </div>
                )}
                
                {isAddingBudget && (
                  <div className="p-3 mb-4 rounded-xl border border-border bg-muted/20 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-foreground">Add Budget Category</span>
                      <button type="button" onClick={() => setIsAddingBudget(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <select 
                        value={newBudgetCategory} 
                        onChange={(e) => setNewBudgetCategory(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-[11px] font-medium"
                      >
                        <option value="">-- Select Category --</option>
                        <optgroup label="System Categories">
                          {categories.filter((c: any) => c.is_system !== false && !userBudgets.some(b => b.category_id === c.id)).map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Custom Categories">
                          {categories.filter((c: any) => c.is_system === false && !userBudgets.some(b => b.category_id === c.id)).map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                        <option value="custom">+ Create New Custom Category</option>
                      </select>
                      {newBudgetCategory === 'custom' && (
                        <input
                          type="text"
                          placeholder="Category Name"
                          value={newBudgetCustomName}
                          onChange={(e) => setNewBudgetCustomName(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-[11px] font-medium"
                        />
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-medium text-muted-foreground">Monthly Limit:</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={newBudgetAmount || ''}
                          onChange={(e) => setNewBudgetAmount(parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 rounded border border-border bg-background text-xs font-bold font-mono focus:outline-none focus:ring-2 focus:ring-primary/45 text-right"
                        />
                      </div>
                      <Button type="button" size="sm" onClick={handleAddBudgetSubmit} className="h-8 mt-1 text-[11px]">
                        Add to Budget
                      </Button>
                    </div>
                  </div>
                )}

                {userBudgets.length === 0 && !isAddingBudget && (
                  <div className="py-8 text-center border border-dashed border-border/60 rounded-xl">
                    <p className="text-xs text-muted-foreground">No categories tracked.</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">Click Add to begin budgeting.</p>
                  </div>
                )}

                <div className="space-y-2">
                  {userBudgets.map((b, index) => {
                    const activeCurrencySymbol = currencies.find((c: any) => c.id === currency)?.symbol || '₹';
                    return (
                      <div key={b.category_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/10 transition-colors group">
                        <div className="flex items-center gap-3 select-none">
                          <div className="flex flex-col items-center">
                            <button type="button" onClick={() => moveBudget(index, 'up')} className="text-muted-foreground/40 hover:text-foreground cursor-pointer disabled:opacity-20" disabled={index === 0}>
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => moveBudget(index, 'down')} className="text-muted-foreground/40 hover:text-foreground cursor-pointer disabled:opacity-20" disabled={index === userBudgets.length - 1}>
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
                              {b.name}
                              {b.is_system === false && <span className="px-1 py-[1px] bg-primary/10 text-primary rounded text-[8px] uppercase tracking-wide">Custom</span>}
                            </span>
                            <span className="text-[10px] text-muted-foreground">Monthly Limit</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-muted-foreground select-none font-semibold">{activeCurrencySymbol}</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={b.amount}
                              onChange={(e) => updateBudgetAmount(index, parseFloat(e.target.value) || 0)}
                              className="w-[100px] px-2 py-1.5 rounded-lg border border-border bg-muted/20 text-[13px] font-bold font-mono focus:outline-none focus:ring-2 focus:ring-primary/45 text-right"
                            />
                          </div>
                          <button type="button" onClick={() => removeBudget(index)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer" aria-label="Remove Budget">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-border/50 flex justify-end">
                  <Button type="submit" loading={budgetsLoading} className="py-2 px-6 text-xs font-bold cursor-pointer">
                    Save Budget Settings
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* THEME PREFERENCE */}
        <div className="clay rounded-[1.2rem] overflow-hidden flex flex-col transition-colors">
          <div onClick={() => setActiveSection(activeSection === 'theme' ? null : 'theme')} className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                <Sun className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-foreground">Theme Preference</span>
                <span className="text-[11px] font-medium text-muted-foreground/60">Dark Mode</span>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${activeSection === 'theme' ? '' : '-rotate-90'}`} />
          </div>
          {activeSection === 'theme' && (
            <div className="p-4 border-t border-border/50 bg-muted/10 flex flex-col sm:flex-row gap-3">
              {[
                { id: 'light', label: 'Light Mode', icon: Sun },
                { id: 'dark', label: 'Dark Mode', icon: Moon },
                { id: 'system', label: 'System Default', icon: Monitor }
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = theme === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleThemeChange(item.id as any)}
                    className={`
                      flex-1 py-3 px-4 rounded-xl border flex items-center justify-between font-bold text-xs select-none transition-all cursor-pointer
                      ${isSelected 
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400' 
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      }
                    `}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4.5 w-4.5" />
                      {item.label}
                    </span>
                    {isSelected && <ShieldCheck className="h-4.5 w-4.5 text-purple-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* APP LOCK & SECURITY */}
        <div className="clay rounded-[1.2rem] overflow-hidden flex flex-col transition-colors">
          <div onClick={() => setActiveSection(activeSection === 'security' ? null : 'security')} className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-pink-500/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-pink-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-foreground">App Lock & Security</span>
                <span className="text-[11px] font-medium text-muted-foreground/60">PIN, Biometrics & Security</span>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${activeSection === 'security' ? '' : '-rotate-90'}`} />
          </div>
          {activeSection === 'security' && (
            <div className="p-4 border-t border-border/50 bg-muted/10 flex flex-col gap-4">
              {securityMsg && (
                <div className="p-3 bg-primary/10 text-primary text-xs font-bold rounded-lg text-center">
                  {securityMsg}
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {appPin ? 'Change PIN (4 Digits)' : 'Set 4-Digit PIN'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 1234"
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono tracking-[0.2em]"
                  />
                  <Button 
                    onClick={() => {
                      const isWeakPin = (p: string) => {
                        if (/^(\d)\1{3}$/.test(p)) return true;
                        if (p === '1234' || p === '2345' || p === '3456' || p === '4567' || p === '5678' || p === '6789') return true;
                        if (p === '4321' || p === '5432' || p === '6543' || p === '7654' || p === '8765' || p === '9876') return true;
                        return false;
                      };

                      if (pinInput.length === 4) {
                        if (isWeakPin(pinInput)) {
                          setSecurityMsg('PIN is too easy to guess');
                          setTimeout(() => setSecurityMsg(''), 3000);
                          return;
                        }
                        localStorage.setItem('app_pin', pinInput);
                        setAppPin(pinInput);
                        setPinInput('');
                        setSecurityMsg('PIN saved successfully');
                        setTimeout(() => setSecurityMsg(''), 3000);
                      } else {
                        setSecurityMsg('PIN must be exactly 4 digits');
                        setTimeout(() => setSecurityMsg(''), 3000);
                      }
                    }}
                    disabled={pinInput.length !== 4}
                    variant="primary"
                    className="h-auto"
                  >
                    Save PIN
                  </Button>
                </div>
              </div>

              {appPin && (
                <>
                  <div className="flex flex-col gap-2 pt-2 border-t border-border">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Biometrics (FaceID / Fingerprint)
                    </label>
                    <Button 
                      onClick={async () => {
                        if (bioEnabled) {
                          localStorage.removeItem('biometric_id');
                          setBioEnabled(false);
                          setSecurityMsg('Biometrics disabled');
                        } else {
                          try {
                            const credId = await registerBiometrics();
                            localStorage.setItem('biometric_id', credId);
                            setBioEnabled(true);
                            setSecurityMsg('Biometrics configured successfully');
                          } catch (e: any) {
                            setSecurityMsg(e.message || 'Failed to register biometrics');
                          }
                        }
                        setTimeout(() => setSecurityMsg(''), 3000);
                      }}
                      variant={bioEnabled ? "outline" : "primary"}
                      className="w-full"
                    >
                      {bioEnabled ? 'Disable Biometrics' : 'Enable Biometrics'}
                    </Button>
                  </div>
                  
                  <div className="pt-2 border-t border-border">
                    <Button 
                      onClick={() => {
                        localStorage.removeItem('app_pin');
                        localStorage.removeItem('biometric_id');
                        setAppPin('');
                        setBioEnabled(false);
                        setSecurityMsg('App Lock disabled completely');
                        setTimeout(() => setSecurityMsg(''), 3000);
                      }}
                      variant="outline"
                      className="w-full text-rose-500 border-rose-500/20 hover:bg-rose-500/10"
                    >
                      Remove Lock Completely
                    </Button>
                  </div>
                </>
              )}

              <div className="pt-6 mt-2 border-t border-border">
                <h3 className="text-sm font-bold flex items-center gap-1.5 mb-1"><KeyRound className="h-4 w-4 text-primary" /> Change Password</h3>
                <p className="text-xs text-muted-foreground mb-4">Update your Supabase authentication password</p>
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  {passwordMsg && (
                    <div className={`p-3 rounded-lg border text-xs font-semibold ${
                      passwordMsg.startsWith('Error') 
                        ? 'bg-destructive/10 border-destructive/25 text-destructive' 
                        : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
                    }`}>
                      {passwordMsg}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted-foreground">Previous Password</label>
                    <input
                      type="password"
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                      placeholder="Enter previous password"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-muted-foreground">New Password</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                        placeholder="Min 6 characters"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-muted-foreground">Confirm New Password</label>
                      <input
                        type="password"
                        required
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                        placeholder="Repeat new password"
                      />
                    </div>
                  </div>

                  <Button type="submit" loading={passwordLoading} className="py-2 px-4 text-xs font-bold cursor-pointer">
                    Change Password
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
