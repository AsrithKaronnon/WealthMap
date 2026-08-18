// Simulated Supabase Database Engine running on browser localStorage

// Helper to generate UUIDs
const uuid = () => crypto.randomUUID();

// Define hardcoded UUID keys for consistent seeding and foreign-key links
export const SEED = {
  currencies: {
    usd: 'c0000000-0000-0000-0000-000000000001',
    inr: 'c0000000-0000-0000-0000-000000000002',
    eur: 'c0000000-0000-0000-0000-000000000003',
  },
  priorities: {
    high: 'p0000000-0000-0000-0000-000000000001',
    medium: 'p0000000-0000-0000-0000-000000000002',
    low: 'p0000000-0000-0000-0000-000000000003',
  },
  recurrences: {
    monthly: 'r0000000-0000-0000-0000-000000000001',
    yearly: 'r0000000-0000-0000-0000-000000000002',
    weekly: 'r0000000-0000-0000-0000-000000000003',
    one_time: 'r0000000-0000-0000-0000-000000000004',
    biweekly: 'r0000000-0000-0000-0000-000000000005',
    quarterly: 'r0000000-0000-0000-0000-000000000006',
  },
  statuses: {
    active: 's0000000-0000-0000-0000-000000000001',
    completed: 's0000000-0000-0000-0000-000000000002',
    pending: 's0000000-0000-0000-0000-000000000003',
    overdue: 's0000000-0000-0000-0000-000000000004',
    paid: 's0000000-0000-0000-0000-000000000005',
  },
  account_types: {
    checking: 'a0000000-0000-0000-0000-000000000001',
    savings: 'a0000000-0000-0000-0000-000000000002',
    credit_card: 'a0000000-0000-0000-0000-000000000003',
    investment: 'a0000000-0000-0000-0000-000000000004',
  },
  transaction_types: {
    income: 't0000000-0000-0000-0000-000000000001',
    expense: 't0000000-0000-0000-0000-000000000002',
    transfer: 't0000000-0000-0000-0000-000000000003',
  },
  expense_categories: {
    food: 'e0000000-0000-0000-0000-000000000001',
    utilities: 'e0000000-0000-0000-0000-000000000002',
    housing: 'e0000000-0000-0000-0000-000000000003',
    transport: 'e0000000-0000-0000-0000-000000000004',
    entertainment: 'e0000000-0000-0000-0000-000000000005',
    shopping: 'e0000000-0000-0000-0000-000000000006',
    health: 'e0000000-0000-0000-0000-000000000007',
    travel: 'e0000000-0000-0000-0000-000000000008',
  },
  income_categories: {
    salary: 'i0000000-0000-0000-0000-000000000001',
    freelance: 'i0000000-0000-0000-0000-000000000002',
    investments: 'i0000000-0000-0000-0000-000000000003',
  },
  payment_methods: {
    bank_transfer: 'm0000000-0000-0000-0000-000000000001',
    credit_card: 'm0000000-0000-0000-0000-000000000002',
    debit_card: 'm0000000-0000-0000-0000-000000000003',
    cash: 'm0000000-0000-0000-0000-000000000004',
  },
  loan_types: {
    home: 'l0000000-0000-0000-0000-000000000001',
    car: 'l0000000-0000-0000-0000-000000000002',
    personal: 'l0000000-0000-0000-0000-000000000003',
  },
  goal_types: {
    savings: 'g0000000-0000-0000-0000-000000000001',
    purchase: 'g0000000-0000-0000-0000-000000000002',
    emergency: 'g0000000-0000-0000-0000-000000000003',
  },
  investment_types: {
    stocks: 'in000000-0000-0000-0000-000000000001',
    mutual_funds: 'in000000-0000-0000-0000-000000000002',
    crypto: 'in000000-0000-0000-0000-000000000003',
    gold: 'in000000-0000-0000-0000-000000000004',
  },
  bill_types: {
    electricity: 'b0000000-0000-0000-0000-000000000001',
    internet: 'b0000000-0000-0000-0000-000000000002',
    water: 'b0000000-0000-0000-0000-000000000003',
    gas: 'b0000000-0000-0000-0000-000000000004',
    rent: 'b0000000-0000-0000-0000-000000000005',
    subscription: 'b0000000-0000-0000-0000-000000000006',
  },
  room_types: {
    living: 'ro000000-0000-0000-0000-000000000001',
    bedroom: 'ro000000-0000-0000-0000-000000000002',
    kitchen: 'ro000000-0000-0000-0000-000000000003',
    office: 'ro000000-0000-0000-0000-000000000004',
  },
  furniture_types: {
    sofa: 'f0000000-0000-0000-0000-000000000001',
    bed: 'f0000000-0000-0000-0000-000000000002',
    desk: 'f0000000-0000-0000-0000-000000000003',
    chair: 'f0000000-0000-0000-0000-000000000004',
    cabinet: 'f0000000-0000-0000-0000-000000000005',
  },
  accounts: {
    chase: 'ac000000-0000-0000-0000-000000000001',
    savings: 'ac000000-0000-0000-0000-000000000002',
    sapphire: 'ac000000-0000-0000-0000-000000000003',
    robinhood: 'ac000000-0000-0000-0000-000000000004',
  },
  projects: {
    house: 'proj0000-0000-0000-0000-000000000001',
  },
};

// Seeding implementation
export function initializeMockDatabase() {
  const seedTable = (key: string, data: any[]) => {
    const fullKey = `financeos_${key}`;
    if (!localStorage.getItem(fullKey)) {
      const now = new Date().toISOString();
      const processed = data.map((item, idx) => ({
        id: item.id || uuid(),
        created_at: now,
        updated_at: now,
        created_by: 'mock-user-id',
        updated_by: 'mock-user-id',
        is_active: true,
        is_deleted: false,
        remarks: item.remarks || '',
        sort_order: item.sort_order || idx,
        ...item,
      }));
      localStorage.setItem(fullKey, JSON.stringify(processed));
    }
  };

  // Master: Currencies
  seedTable('currencies', [
    { id: SEED.currencies.usd, code: 'USD', name: 'US Dollar', symbol: '$' },
    { id: SEED.currencies.inr, code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { id: SEED.currencies.eur, code: 'EUR', name: 'Euro', symbol: '€' },
  ]);

  // Master: Priorities
  seedTable('priorities', [
    { id: SEED.priorities.high, name: 'High' },
    { id: SEED.priorities.medium, name: 'Medium' },
    { id: SEED.priorities.low, name: 'Low' },
  ]);

  // Master: Recurrence Types
  seedTable('recurrence_types', [
    { id: SEED.recurrences.weekly, name: 'Weekly' },
    { id: SEED.recurrences.monthly, name: 'Monthly' },
    { id: SEED.recurrences.yearly, name: 'Yearly' },
    { id: SEED.recurrences.one_time, name: 'One-time' },
  ]);

  // Master: Statuses
  seedTable('statuses', [
    { id: SEED.statuses.active, name: 'Active' },
    { id: SEED.statuses.completed, name: 'Completed' },
    { id: SEED.statuses.pending, name: 'Pending' },
    { id: SEED.statuses.overdue, name: 'Overdue' },
    { id: SEED.statuses.paid, name: 'Paid' },
  ]);

  // Master: Account Types
  seedTable('account_types', [
    { id: SEED.account_types.checking, name: 'Checking' },
    { id: SEED.account_types.savings, name: 'Savings' },
    { id: SEED.account_types.credit_card, name: 'Credit Card' },
    { id: SEED.account_types.investment, name: 'Investment Account' },
  ]);

  // Master: Transaction Types
  seedTable('transaction_types', [
    { id: SEED.transaction_types.income, name: 'Income' },
    { id: SEED.transaction_types.expense, name: 'Expense' },
    { id: SEED.transaction_types.transfer, name: 'Transfer' },
  ]);

  // Master: Payment Methods
  seedTable('payment_methods', [
    { id: SEED.payment_methods.bank_transfer, name: 'Bank Transfer' },
    { id: SEED.payment_methods.credit_card, name: 'Credit Card' },
    { id: SEED.payment_methods.debit_card, name: 'Debit Card' },
    { id: SEED.payment_methods.cash, name: 'Cash' },
  ]);

  // Master: Loan Types
  seedTable('loan_types', [
    { id: SEED.loan_types.home, name: 'Home Loan' },
    { id: SEED.loan_types.car, name: 'Car Loan' },
    { id: SEED.loan_types.personal, name: 'Personal Loan' },
  ]);

  // Master: Goal Types
  seedTable('goal_types', [
    { id: SEED.goal_types.savings, name: 'Savings Target' },
    { id: SEED.goal_types.purchase, name: 'Major Purchase' },
    { id: SEED.goal_types.emergency, name: 'Emergency Fund' },
  ]);

  // Master: Investment Types
  seedTable('investment_types', [
    { id: SEED.investment_types.stocks, name: 'Stocks' },
    { id: SEED.investment_types.mutual_funds, name: 'Mutual Funds' },
    { id: SEED.investment_types.crypto, name: 'Cryptocurrency' },
    { id: SEED.investment_types.gold, name: 'Gold' },
  ]);

  // Master: Bill Types
  seedTable('bill_types', [
    { id: SEED.bill_types.electricity, name: 'Electricity' },
    { id: SEED.bill_types.internet, name: 'Internet' },
    { id: SEED.bill_types.water, name: 'Water Utility' },
    { id: SEED.bill_types.gas, name: 'Gas & Power' },
    { id: SEED.bill_types.rent, name: 'Rent/Lease' },
    { id: SEED.bill_types.subscription, name: 'Subscription Service' },
  ]);

  // Master: Room Types
  seedTable('room_types', [
    { id: SEED.room_types.living, name: 'Living Room' },
    { id: SEED.room_types.bedroom, name: 'Master Bedroom' },
    { id: SEED.room_types.kitchen, name: 'Kitchen Space' },
    { id: SEED.room_types.office, name: 'Home Office' },
  ]);

  // Master: Furniture Types
  seedTable('furniture_types', [
    { id: SEED.furniture_types.sofa, name: 'Sofa/Couch' },
    { id: SEED.furniture_types.bed, name: 'Bed & Frame' },
    { id: SEED.furniture_types.desk, name: 'Study Desk' },
    { id: SEED.furniture_types.chair, name: 'Office Chair' },
    { id: SEED.furniture_types.cabinet, name: 'Storage Cabinet' },
  ]);

  // Master: Tags
  seedTable('tags', [
    { name: 'Essential' },
    { name: 'Leisure' },
    { name: 'Tax-Deductible' },
    { name: 'Business' },
  ]);

  // Master: Languages
  seedTable('languages', [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'hi', name: 'Hindi' },
  ]);

  // Master: Expense Categories
  seedTable('expense_categories', [
    { id: SEED.expense_categories.food, name: 'Food & Dining', icon: 'Utensils', color: 'emerald', is_system: true },
    { id: SEED.expense_categories.utilities, name: 'Bills & Utilities', icon: 'Zap', color: 'amber', is_system: true },
    { id: SEED.expense_categories.housing, name: 'Housing & Rent', icon: 'Home', color: 'blue', is_system: true },
    { id: SEED.expense_categories.transport, name: 'Auto & Transport', icon: 'Car', color: 'cyan', is_system: true },
    { id: SEED.expense_categories.shopping, name: 'Shopping', icon: 'ShoppingBag', color: 'fuchsia', is_system: true },
    { id: SEED.expense_categories.entertainment, name: 'Entertainment', icon: 'Tv', color: 'purple', is_system: true },
    { id: SEED.expense_categories.health, name: 'Health & Fitness', icon: 'Activity', color: 'rose', is_system: true },
    { id: SEED.expense_categories.travel, name: 'Travel', icon: 'Plane', color: 'sky', is_system: true },
  ]);

  // Master: Expense Subcategories
  seedTable('expense_subcategories', [
    { category_id: SEED.expense_categories.food, name: 'Groceries' },
    { category_id: SEED.expense_categories.food, name: 'Dining Out' },
    { category_id: SEED.expense_categories.food, name: 'Coffee Shops' },
    { category_id: SEED.expense_categories.utilities, name: 'Electricity Bill' },
    { category_id: SEED.expense_categories.utilities, name: 'Internet Subscription' },
    { category_id: SEED.expense_categories.transport, name: 'Fuel' },
    { category_id: SEED.expense_categories.transport, name: 'Public Transit' },
  ]);

  // Master: Income Categories
  seedTable('income_categories', [
    { id: SEED.income_categories.salary, name: 'Salary Paycheck', icon: 'Briefcase', color: 'emerald' },
    { id: SEED.income_categories.freelance, name: 'Freelance & Side Gigs', icon: 'Laptop', color: 'teal' },
    { id: SEED.income_categories.investments, name: 'Dividends & Interest', icon: 'TrendingUp', color: 'indigo' },
  ]);

  // User Data: Accounts
  seedTable('accounts', [
    { id: SEED.accounts.chase, name: 'Chase Checking', type_id: SEED.account_types.checking, balance: 5420.50, currency_id: SEED.currencies.usd },
    { id: SEED.accounts.savings, name: 'Marcus High-Yield Savings', type_id: SEED.account_types.savings, balance: 45000.00, currency_id: SEED.currencies.usd },
    { id: SEED.accounts.sapphire, name: 'Chase Sapphire Preferred Credit Card', type_id: SEED.account_types.credit_card, balance: -1250.75, currency_id: SEED.currencies.usd },
    { id: SEED.accounts.robinhood, name: 'Robinhood Portfolio', type_id: SEED.account_types.investment, balance: 28350.00, currency_id: SEED.currencies.usd },
  ]);

  // User Data: Transactions
  const parseDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().split('T')[0];
  };

  seedTable('transactions', [
    {
      date: parseDate(0),
      amount: 15.45,
      transaction_type_id: SEED.transaction_types.expense,
      category_id: SEED.expense_categories.food,
      account_id: SEED.accounts.sapphire,
      payment_method_id: SEED.payment_methods.credit_card,
      merchant: 'Starbucks Coffee',
      notes: 'Morning latte and croissant',
      tags: ['Leisure'],
      is_recurring: false,
    },
    {
      date: parseDate(1),
      amount: 82.50,
      transaction_type_id: SEED.transaction_types.expense,
      category_id: SEED.expense_categories.food,
      account_id: SEED.accounts.chase,
      payment_method_id: SEED.payment_methods.debit_card,
      merchant: 'Whole Foods Market',
      notes: 'Weekly groceries run',
      tags: ['Essential'],
      is_recurring: false,
    },
    {
      date: parseDate(2),
      amount: 5200.00,
      transaction_type_id: SEED.transaction_types.income,
      category_id: SEED.income_categories.salary,
      account_id: SEED.accounts.chase,
      payment_method_id: SEED.payment_methods.bank_transfer,
      merchant: 'Stripe Inc',
      notes: 'Bi-weekly tech payroll',
      tags: ['Essential'],
      is_recurring: true,
    },
    {
      date: parseDate(3),
      amount: 120.00,
      transaction_type_id: SEED.transaction_types.expense,
      category_id: SEED.expense_categories.utilities,
      account_id: SEED.accounts.chase,
      payment_method_id: SEED.payment_methods.bank_transfer,
      merchant: 'Comcast Internet',
      notes: 'Gigabit fiber monthly bill',
      tags: ['Essential'],
      is_recurring: true,
    },
    {
      date: parseDate(5),
      amount: 450.00,
      transaction_type_id: SEED.transaction_types.expense,
      category_id: SEED.expense_categories.shopping,
      account_id: SEED.accounts.sapphire,
      payment_method_id: SEED.payment_methods.credit_card,
      merchant: 'Apple Store',
      notes: 'Apple Watch Series 10 replacement',
      tags: ['Leisure'],
      is_recurring: false,
    },
    {
      date: parseDate(10),
      amount: 1500.00,
      transaction_type_id: SEED.transaction_types.expense,
      category_id: SEED.expense_categories.housing,
      account_id: SEED.accounts.chase,
      payment_method_id: SEED.payment_methods.bank_transfer,
      merchant: 'Avalon Apartments',
      notes: 'Monthly rent payment',
      tags: ['Essential'],
      is_recurring: true,
    },
    {
      date: parseDate(12),
      amount: 650.00,
      transaction_type_id: SEED.transaction_types.income,
      category_id: SEED.income_categories.freelance,
      account_id: SEED.accounts.chase,
      payment_method_id: SEED.payment_methods.bank_transfer,
      merchant: 'Upwork Client',
      notes: 'React web application consulting',
      tags: ['Business'],
      is_recurring: false,
    },
    {
      date: parseDate(14),
      amount: 45.00,
      transaction_type_id: SEED.transaction_types.expense,
      category_id: SEED.expense_categories.transport,
      account_id: SEED.accounts.sapphire,
      payment_method_id: SEED.payment_methods.credit_card,
      merchant: 'Shell Gas Station',
      notes: 'Sedan refuel',
      tags: ['Essential'],
      is_recurring: false,
    }
  ]);

  // User Data: Budgets
  seedTable('budgets', [
    { category_id: SEED.expense_categories.food, amount: 600.00, budget_type_id: SEED.recurrences.monthly, sort_order: 1 },
    { category_id: SEED.expense_categories.utilities, amount: 250.00, budget_type_id: SEED.recurrences.monthly, sort_order: 2 },
    { category_id: SEED.expense_categories.entertainment, amount: 150.00, budget_type_id: SEED.recurrences.monthly, sort_order: 3 },
    { category_id: SEED.expense_categories.shopping, amount: 500.00, budget_type_id: SEED.recurrences.monthly, sort_order: 4 },
    { category_id: SEED.expense_categories.transport, amount: 200.00, budget_type_id: SEED.recurrences.monthly, sort_order: 5 },
  ]);

  // User Data: Goals
  seedTable('goals', [
    {
      name: 'Emergency Reserve Fund',
      target_amount: 30000.00,
      current_amount: 25000.00,
      monthly_contribution: 500.00,
      priority_id: SEED.priorities.high,
      category_id: SEED.goal_types.emergency,
      due_date: '2027-06-30',
      notes: '6 months of standard living expenses'
    },
    {
      name: 'Europe Wedding Trip',
      target_amount: 12000.00,
      current_amount: 4800.00,
      monthly_contribution: 400.00,
      priority_id: SEED.priorities.medium,
      category_id: SEED.goal_types.savings,
      due_date: '2027-09-15',
      notes: 'Flight, hotel, activities budget'
    },
    {
      name: 'MacBook Pro M5 Max',
      target_amount: 3500.00,
      current_amount: 1200.00,
      monthly_contribution: 250.00,
      priority_id: SEED.priorities.low,
      category_id: SEED.goal_types.purchase,
      due_date: '2026-12-10',
      notes: 'Workstation upgrade'
    }
  ]);

  // User Data: Loans & EMIs
  seedTable('loans', [
    {
      name: 'Tesla Model Y Auto Loan',
      loan_type_id: SEED.loan_types.car,
      total_amount: 45000.00,
      interest_rate: 4.8,
      duration_months: 60,
      start_date: '2024-01-15',
      monthly_emi: 845.50,
      outstanding_amount: 32120.00,
      remaining_emis: 38
    },
    {
      name: 'Downtown Condo Mortgage',
      loan_type_id: SEED.loan_types.home,
      total_amount: 350000.00,
      interest_rate: 6.2,
      duration_months: 360,
      start_date: '2022-08-01',
      monthly_emi: 2143.00,
      outstanding_amount: 328000.00,
      remaining_emis: 312
    }
  ]);

  // User Data: Bills & Subscriptions
  seedTable('bills', [
    { name: 'Netflix Premium Plan', bill_type_id: SEED.bill_types.subscription, amount: 22.99, due_date: '2026-07-15', status_id: SEED.statuses.pending, recurrence_type_id: SEED.recurrences.monthly },
    { name: 'PG&E Electric Utility', bill_type_id: SEED.bill_types.electricity, amount: 112.45, due_date: '2026-07-18', status_id: SEED.statuses.pending, recurrence_type_id: SEED.recurrences.monthly },
    { name: 'Geico Car Insurance', bill_type_id: SEED.bill_types.subscription, amount: 145.00, due_date: '2026-07-20', status_id: SEED.statuses.paid, recurrence_type_id: SEED.recurrences.monthly },
    { name: 'Youtube Premium Family', bill_type_id: SEED.bill_types.subscription, amount: 22.99, due_date: '2026-07-22', status_id: SEED.statuses.pending, recurrence_type_id: SEED.recurrences.monthly },
    { name: 'Apartment Monthly Rent', bill_type_id: SEED.bill_types.rent, amount: 1500.00, due_date: '2026-08-01', status_id: SEED.statuses.pending, recurrence_type_id: SEED.recurrences.monthly }
  ]);

  // User Data: Investments
  seedTable('investments', [
    { name: 'Vanguard S&P 500 ETF (VOO)', investment_type_id: SEED.investment_types.stocks, current_value: 18500.00, total_invested: 15200.00, allocation_pct: 65, monthly_contribution: 400.00 },
    { name: 'Fidelity Freedom Fund 2055', investment_type_id: SEED.investment_types.mutual_funds, current_value: 8250.00, total_invested: 7800.00, allocation_pct: 29, monthly_contribution: 200.00 },
    { name: 'Ethereum Portfolio', investment_type_id: SEED.investment_types.crypto, current_value: 1600.00, total_invested: 2000.00, allocation_pct: 6, monthly_contribution: 50.00 },
  ]);

  // User Data: House Furnishing Project Rooms
  const roomLivingId = 'room-living-0001';
  const roomBedId = 'room-bedroom-0002';
  seedTable('house_furnishing_rooms', [
    { id: roomLivingId, name: 'Modern Living Room Decor', room_type_id: SEED.room_types.living, budget: 8000.00 },
    { id: roomBedId, name: 'Minimalist Master Bedroom', room_type_id: SEED.room_types.bedroom, budget: 4500.00 },
  ]);

  // User Data: House Furnishing Checklist Items
  seedTable('house_furnishing_items', [
    { room_id: roomLivingId, name: 'L-Shaped Fabric Sofa', furniture_type_id: SEED.furniture_types.sofa, estimated_cost: 2500.00, actual_cost: 2200.00, vendor: 'West Elm', status_id: SEED.statuses.completed, priority_id: SEED.priorities.high, warranty: '3 Years', install_date: '2026-02-15' },
    { room_id: roomLivingId, name: 'Solid Oak Coffee Table', furniture_type_id: SEED.furniture_types.cabinet, estimated_cost: 600.00, actual_cost: null, vendor: 'Crate & Barrel', status_id: SEED.statuses.pending, priority_id: SEED.priorities.medium, warranty: '1 Year', install_date: null },
    { room_id: roomLivingId, name: 'OLED 65 Inch TV Console', furniture_type_id: SEED.furniture_types.cabinet, estimated_cost: 1200.00, actual_cost: 1350.00, vendor: 'Best Buy', status_id: SEED.statuses.completed, priority_id: SEED.priorities.high, warranty: '2 Years', install_date: '2026-03-01' },
    { room_id: roomBedId, name: 'King Platform Bed Frame', furniture_type_id: SEED.furniture_types.bed, estimated_cost: 1500.00, actual_cost: 1400.00, vendor: 'Article', status_id: SEED.statuses.completed, priority_id: SEED.priorities.high, warranty: '5 Years', install_date: '2026-01-20' },
    { room_id: roomBedId, name: 'Ergonomic Desk & Stand', furniture_type_id: SEED.furniture_types.desk, estimated_cost: 800.00, actual_cost: null, vendor: 'Fully Jarvis', status_id: SEED.statuses.pending, priority_id: SEED.priorities.high, warranty: '10 Years', install_date: null }
  ]);

  // User Data: Notifications
  seedTable('notifications', [
    { title: 'Upcoming Rent Payment Due', message: 'Your monthly condo rent of $1500 is due in 3 days.', notification_type_id: 'due-alert', is_read: false },
    { title: 'Goal 80% Completed!', message: 'Congratulations! You are close to hitting your Emergency Reserve Fund goal.', notification_type_id: 'goal-alert', is_read: false },
    { title: 'Budget Warning', message: 'You have spent 92% of your Food & Dining budget for this month.', notification_type_id: 'budget-warning', is_read: false }
  ]);

  // User Data: Settings
  seedTable('user_settings', [
    {
      id: 's0000000-0000-0000-0000-000000000001',
      user_id: 'u0000000-0000-0000-0000-000000000001',
      base_currency_id: SEED.currencies.inr,
      theme_preference: 'system',
      dashboard_layout: [
        { id: 'cash-flow', w: 'large', pinned: true },
        { id: 'recent-transactions', w: 'medium', pinned: true },
        { id: 'upcoming-bills', w: 'medium', pinned: true },
        { id: 'goals-progress', w: 'small', pinned: false },
        { id: 'investments-allocation', w: 'small', pinned: false },
        { id: 'net-worth-trend', w: 'large', pinned: true }
      ]
    }
  ]);

  seedTable('projects', [
    {
      id: SEED.projects.house,
      name: 'Home Renovation',
      emoji: '🏠',
      color: 'amber',
      project_type: 'general',
      budget: 500000,
      status: 'active',
      start_date: '2026-01-01',
      description: 'Full interior renovation of new flat',
      exclude_from_charts: true,
      track_expenses: true,
    },
  ]);
}

// Fluent Mock Query Engine
class MockQueryBuilder {
  private tableName: string;
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private values: any = null;
  private filters: Array<(row: any) => boolean> = [];
  private sortCol: string | null = null;
  private sortAscending = true;
  private limitCount: number | null = null;
  private isSingle = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(_columns: string = '*') {
    if (!this.operation) {
      this.operation = 'select';
    }
    return this;
  }

  insert(values: any | any[]) {
    this.operation = 'insert';
    this.values = values;
    return this;
  }

  upsert(values: any, _options?: any) {
    this.operation = 'insert';
    const tableKey = `financeos_${this.tableName}`;
    const tableData = JSON.parse(localStorage.getItem(tableKey) || '[]');
    const existingIndex = tableData.findIndex((row: any) => !row.is_deleted && row.created_by === 'mock-user-id');
    if (existingIndex !== -1) {
      tableData[existingIndex] = { ...tableData[existingIndex], ...values, updated_at: new Date().toISOString() };
      localStorage.setItem(tableKey, JSON.stringify(tableData));
      this.operation = 'select';
      this.filters.push((row) => row.created_by === 'mock-user-id');
      this.isSingle = true;
    } else {
      this.values = values;
    }
    return this;
  }

  update(values: any) {
    this.operation = 'update';
    this.values = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row) => {
      if (column.includes('.')) {
        const parts = column.split('.');
        let current = row;
        for (const part of parts) {
          if (current == null) return false;
          current = current[part];
        }
        return current === value;
      }
      return row[column] === value;
    });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  order(column: string, { ascending = true } = {}) {
    this.sortCol = column;
    this.sortAscending = ascending;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  async then(onfulfilled?: (value: any) => any) {
    let result: { data: any; error: any } = { data: null, error: null };
    try {
      const data = this.execute();
      result = { data, error: null };
    } catch (err: any) {
      result = { data: null, error: err };
    }
    if (onfulfilled) {
      return onfulfilled(result);
    }
    return result;
  }

  private execute() {
    const tableKey = `financeos_${this.tableName}`;
    const tableData = JSON.parse(localStorage.getItem(tableKey) || '[]');
    const now = new Date().toISOString();

    if (this.operation === 'select') {
      let filtered = tableData.filter((row: any) => !row.is_deleted);
      for (const filter of this.filters) {
        filtered = filtered.filter(filter);
      }
      if (this.sortCol) {
        filtered.sort((a: any, b: any) => {
          const valA = a[this.sortCol!];
          const valB = b[this.sortCol!];
          if (valA < valB) return this.sortAscending ? -1 : 1;
          if (valA > valB) return this.sortAscending ? 1 : -1;
          return 0;
        });
      }
      if (this.limitCount !== null) {
        filtered = filtered.slice(0, this.limitCount);
      }
      if (this.isSingle) {
        return filtered[0] || null;
      }
      return filtered;
    }

    if (this.operation === 'insert') {
      const rows = Array.isArray(this.values) ? this.values : [this.values];
      const newRows = rows.map((row) => ({
        id: row.id || uuid(),
        created_at: now,
        updated_at: now,
        created_by: 'mock-user-id',
        updated_by: 'mock-user-id',
        is_active: true,
        is_deleted: false,
        remarks: row.remarks || '',
        sort_order: row.sort_order || tableData.length,
        ...row,
      }));
      const updatedTable = [...tableData, ...newRows];
      localStorage.setItem(tableKey, JSON.stringify(updatedTable));
      return this.isSingle ? newRows[0] : newRows;
    }

    if (this.operation === 'update' || this.operation === 'delete') {
      const updateValues = this.operation === 'delete' ? { is_deleted: true } : this.values;
      const updatedTable = tableData.map((row: any) => {
        let matches = true;
        for (const filter of this.filters) {
          if (!filter(row)) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return {
            ...row,
            ...updateValues,
            updated_at: now,
            updated_by: 'mock-user-id',
          };
        }
        return row;
      });
      localStorage.setItem(tableKey, JSON.stringify(updatedTable));
      const finalData = updatedTable.filter((row: any) => {
        let matches = true;
        for (const filter of this.filters) {
          if (!filter(row)) {
            matches = false;
            break;
          }
        }
        return matches;
      });
      return this.isSingle ? finalData[0] || null : finalData;
    }

    return null;
  }
}

// Simulated Auth Controller
const mockAuth = {
  signUp: async ({ email, options }: { email: string; options?: { data?: any } }) => {
    const session = { 
      user: { 
        id: 'mock-user-id', 
        email, 
        user_metadata: options?.data || {} 
      }, 
      access_token: 'mock-auth-token-123' 
    };
    localStorage.setItem('financeos_session', JSON.stringify(session));
    return { data: session, error: null };
  },
  signInWithPassword: async ({ email, phone }: { email?: string; phone?: string }) => {
    const ident = email || phone || 'user@example.com';
    const session = { user: { id: 'mock-user-id', email: ident, user_metadata: { first_name: 'John', last_name: 'Doe', phone: phone || '+1 555-555-5555' } }, access_token: 'mock-auth-token-123' };
    const sessionStr = localStorage.getItem('financeos_session');
    const currentSession = sessionStr ? JSON.parse(sessionStr) : session;
    localStorage.setItem('financeos_session', JSON.stringify(currentSession));
    return { data: currentSession, error: null };
  },
  signOut: async () => {
    localStorage.removeItem('financeos_session');
    return { error: null };
  },
  resetPasswordForEmail: async (email: string, _options?: { redirectTo?: string }) => {
    console.log('[Mock Auth] resetPasswordForEmail called for:', email);
    return { data: {}, error: null };
  },
  getSession: async () => {
    const sessionStr = localStorage.getItem('financeos_session');
    return { data: { session: sessionStr ? JSON.parse(sessionStr) : null }, error: null };
  },
  getUser: async () => {
    const sessionStr = localStorage.getItem('financeos_session');
    return { data: { user: sessionStr ? JSON.parse(sessionStr).user : null }, error: null };
  },
  updateUser: async ({ data, password, email, phone }: { data?: any; password?: string; email?: string; phone?: string }) => {
    if (password) console.log('[Mock Auth] Mock updated user password');
    const sessionStr = localStorage.getItem('financeos_session');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      if (data) {
        session.user.user_metadata = {
          ...session.user.user_metadata,
          ...data
        };
      }
      if (email) session.user.email = email;
      if (phone) session.user.phone = phone;
      localStorage.setItem('financeos_session', JSON.stringify(session));
      return { data: { user: session.user }, error: null };
    }
    return { data: { user: null }, error: new Error('No session active') };
  },
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    const sessionStr = localStorage.getItem('financeos_session');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    setTimeout(() => {
      callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
    }, 0);
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};

// Mock Supabase Client API
export function createMockSupabaseClient() {
  initializeMockDatabase();
  return {
    auth: mockAuth,
    from: (tableName: string) => new MockQueryBuilder(tableName),
    functions: {
      invoke: async (functionName: string, options?: any) => {
        console.log(`[Mock Supabase] Invoked function: ${functionName}`, options);
        return { data: { error: 'Mock functions not implemented' }, error: null };
      }
    }
  };
}
