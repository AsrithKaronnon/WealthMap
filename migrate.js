import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: DATABASE_URL environment variable is missing.');
  console.error('Please define DATABASE_URL in a local .env file and run the migration using:');
  console.error('\x1b[36m%s\x1b[0m', '  node --env-file=.env migrate.js\n');
  process.exit(1);
}

// Hardcoded seed IDs matching SEED values in supabaseMock.ts
const SEED_DATA = {
  currencies: [
    { id: 'c0000000-0000-0000-0000-000000000001', name: 'US Dollar', symbol: '$' },
    { id: 'c0000000-0000-0000-0000-000000000002', name: 'Indian Rupee', symbol: '₹' },
    { id: 'c0000000-0000-0000-0000-000000000003', name: 'Euro', symbol: '€' }
  ],
  expense_categories: [
    { id: 'e0000000-0000-0000-0000-000000000001', name: 'Food & Dining', color: '#f59e0b', icon: 'Burger' },
    { id: 'e0000000-0000-0000-0000-000000000004', name: 'Transport & Uber', color: '#3b82f6', icon: 'Car' },
    { id: 'e0000000-0000-0000-0000-000000000003', name: 'Housing & Rent', color: '#10b981', icon: 'Home' },
    { id: 'e0000000-0000-0000-0000-000000000002', name: 'Utilities & SaaS', color: '#6366f1', icon: 'Zap' },
    { id: 'e0000000-0000-0000-0000-000000000005', name: 'Entertainment', color: '#ec4899', icon: 'Heart' },
    { id: 'e0000000-0000-0000-0000-000000000006', name: 'Shopping', color: '#8b5cf6', icon: 'Shopping' }
  ],
  income_categories: [
    { id: 'i0000000-0000-0000-0000-000000000001', name: 'Salary Paycheck', color: '#10b981', icon: 'Wallet' },
    { id: 'i0000000-0000-0000-0000-000000000002', name: 'Side Job', color: '#3b82f6', icon: 'Sparkles' },
    { id: 'i0000000-0000-0000-0000-000000000003', name: 'Investments', color: '#8b5cf6', icon: 'TrendingUp' }
  ],
  payment_methods: [
    { id: 'm0000000-0000-0000-0000-000000000004', name: 'Cash', icon: 'Wallet' },
    { id: 'm0000000-0000-0000-0000-000000000003', name: 'Debit Card', icon: 'CreditCard' },
    { id: 'm0000000-0000-0000-0000-000000000002', name: 'Credit Card', icon: 'CreditCard' },
    { id: 'm0000000-0000-0000-0000-000000000001', name: 'Bank Transfer', icon: 'ArrowLeftRight' }
  ],
  goal_types: [
    { id: 'g0000000-0000-0000-0000-000000000001', name: 'Savings target' },
    { id: 'g0000000-0000-0000-0000-000000000003', name: 'Emergency Reserve' },
    { id: 'g0000000-0000-0000-0000-000000000002', name: 'Large Purchase' }
  ],
  loan_types: [
    { id: 'l0000000-0000-0000-0000-000000000001', name: 'Condo Mortgage' },
    { id: 'l0000000-0000-0000-0000-000000000002', name: 'Car Auto Loan' },
    { id: 'l0000000-0000-0000-0000-000000000003', name: 'Personal Loan' }
  ],
  recurrence_types: [
    { id: 'r0000000-0000-0000-0000-000000000001', name: 'Monthly' },
    { id: 'r0000000-0000-0000-0000-000000000002', name: 'Yearly' },
    { id: 'r0000000-0000-0000-0000-000000000003', name: 'Weekly' },
    { id: 'r0000000-0000-0000-0000-000000000004', name: 'One-Time' }
  ],
  statuses: [
    { id: 's0000000-0000-0000-0000-000000000001', name: 'Active' },
    { id: 's0000000-0000-0000-0000-000000000002', name: 'Completed' },
    { id: 's0000000-0000-0000-0000-000000000003', name: 'Pending' },
    { id: 's0000000-0000-0000-0000-000000000004', name: 'Overdue' },
    { id: 's0000000-0000-0000-0000-000000000005', name: 'Paid' }
  ]
};

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL. Running UUID-aligned migrations...');

  try {
    // 1. Drop existing tables if they exist
    console.log('Dropping existing tables to start clean...');
    await client.query(`
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS bills CASCADE;
      DROP TABLE IF EXISTS loans CASCADE;
      DROP TABLE IF EXISTS goals CASCADE;
      DROP TABLE IF EXISTS transactions CASCADE;
      DROP TABLE IF EXISTS accounts CASCADE;
      DROP TABLE IF EXISTS user_settings CASCADE;
      DROP TABLE IF EXISTS expense_categories CASCADE;
      DROP TABLE IF EXISTS income_categories CASCADE;
      DROP TABLE IF EXISTS payment_methods CASCADE;
      DROP TABLE IF EXISTS currencies CASCADE;
      DROP TABLE IF EXISTS goal_types CASCADE;
      DROP TABLE IF EXISTS loan_types CASCADE;
      DROP TABLE IF EXISTS recurrence_types CASCADE;
      DROP TABLE IF EXISTS statuses CASCADE;
      DROP TABLE IF EXISTS budgets CASCADE;
    `);

    // 2. Create master configuration tables
    console.log('Creating master lookup tables...');
    await client.query(`
      CREATE TABLE currencies (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        symbol VARCHAR(10) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE expense_categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(50) DEFAULT '#cccccc',
        icon VARCHAR(50) DEFAULT 'Tag',
        is_system BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE income_categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(50) DEFAULT '#cccccc',
        icon VARCHAR(50) DEFAULT 'Tag',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE payment_methods (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(50) DEFAULT 'CreditCard',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE goal_types (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE loan_types (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE recurrence_types (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE statuses (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Create User data tables
    console.log('Creating user data tables with auth.users references...');
    await client.query(`
      CREATE TABLE user_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        theme VARCHAR(20) DEFAULT 'system',
        base_currency_id VARCHAR(50) REFERENCES currencies(id) DEFAULT 'c0000000-0000-0000-0000-000000000001',
        dashboard_layout JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid() UNIQUE
      );

      CREATE TABLE accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        account_type VARCHAR(50) NOT NULL DEFAULT 'Checking',
        currency_id VARCHAR(50) REFERENCES currencies(id) DEFAULT 'c0000000-0000-0000-0000-000000000001',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
        is_active BOOLEAN DEFAULT TRUE,
        is_deleted BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        amount DECIMAL(15, 2) NOT NULL,
        transaction_type_id VARCHAR(50) NOT NULL,
        category_id VARCHAR(50),
        account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
        transfer_to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
        payment_method_id VARCHAR(50) REFERENCES payment_methods(id) ON DELETE SET NULL,
        merchant VARCHAR(200) NOT NULL,
        notes TEXT DEFAULT '',
        tags TEXT[] DEFAULT '{}',
        receipt_url VARCHAR(500) DEFAULT NULL,
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence_interval VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
        is_deleted BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        target_amount DECIMAL(15, 2) NOT NULL,
        current_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        monthly_contribution DECIMAL(15, 2) DEFAULT 0.00,
        priority_id VARCHAR(50) NOT NULL,
        category_id VARCHAR(50) REFERENCES goal_types(id) ON DELETE SET NULL,
        due_date DATE NOT NULL,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
        is_deleted BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE loans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        loan_type_id VARCHAR(50) REFERENCES loan_types(id) ON DELETE SET NULL,
        total_amount DECIMAL(15, 2) NOT NULL,
        interest_rate DECIMAL(5, 2) NOT NULL,
        duration_months INTEGER NOT NULL,
        start_date DATE NOT NULL,
        monthly_emi DECIMAL(15, 2) NOT NULL,
        outstanding_amount DECIMAL(15, 2) NOT NULL,
        remaining_emis INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
        is_deleted BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE bills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        bill_type_id VARCHAR(50) REFERENCES expense_categories(id) ON DELETE SET NULL,
        amount DECIMAL(15, 2) NOT NULL,
        due_date DATE NOT NULL,
        status_id VARCHAR(50) REFERENCES statuses(id) ON DELETE SET NULL,
        recurrence_type_id VARCHAR(50) REFERENCES recurrence_types(id) ON DELETE SET NULL,
        end_date DATE DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
        is_deleted BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        notification_type_id VARCHAR(50) NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid()
      );

      CREATE TABLE budgets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id VARCHAR(50) REFERENCES expense_categories(id) ON DELETE CASCADE,
        amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        budget_type_id VARCHAR(50) REFERENCES recurrence_types(id) ON DELETE SET NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
        is_deleted BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        error_message TEXT NOT NULL,
        error_stack TEXT DEFAULT '',
        component_stack TEXT DEFAULT '',
        url VARCHAR(500) DEFAULT NULL,
        user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Enable Row Level Security (RLS)
    console.log('Enabling Row Level Security (RLS)...');
    await client.query(`
      ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
      ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
      ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
      ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
      ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
      ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
      ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
      
      ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
      ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
      ALTER TABLE income_categories ENABLE ROW LEVEL SECURITY;
      ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
      ALTER TABLE goal_types ENABLE ROW LEVEL SECURITY;
      ALTER TABLE loan_types ENABLE ROW LEVEL SECURITY;
      ALTER TABLE recurrence_types ENABLE ROW LEVEL SECURITY;
      ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
    `);

    // 5. Create RLS Policies
    console.log('Creating RLS security policies...');
    await client.query(`
      -- User Settings Policies
      CREATE POLICY "Users can insert settings" ON user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
      CREATE POLICY "Users can read own settings" ON user_settings FOR SELECT TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can delete own settings" ON user_settings FOR DELETE TO authenticated USING (auth.uid() = created_by);

      -- Accounts Policies
      CREATE POLICY "Users can insert accounts" ON accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
      CREATE POLICY "Users can read own accounts" ON accounts FOR SELECT TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can update own accounts" ON accounts FOR UPDATE TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can delete own accounts" ON accounts FOR DELETE TO authenticated USING (auth.uid() = created_by);

      -- Transactions Policies
      CREATE POLICY "Users can insert transactions" ON transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
      CREATE POLICY "Users can read own transactions" ON transactions FOR SELECT TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE TO authenticated USING (auth.uid() = created_by);

      -- Goals Policies
      CREATE POLICY "Users can insert goals" ON goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
      CREATE POLICY "Users can read own goals" ON goals FOR SELECT TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can update own goals" ON goals FOR UPDATE TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can delete own goals" ON goals FOR DELETE TO authenticated USING (auth.uid() = created_by);

      -- Loans Policies
      CREATE POLICY "Users can insert loans" ON loans FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
      CREATE POLICY "Users can read own loans" ON loans FOR SELECT TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can update own loans" ON loans FOR UPDATE TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can delete own loans" ON loans FOR DELETE TO authenticated USING (auth.uid() = created_by);

      -- Bills Policies
      CREATE POLICY "Users can insert bills" ON bills FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
      CREATE POLICY "Users can read own bills" ON bills FOR SELECT TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can update own bills" ON bills FOR UPDATE TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can delete own bills" ON bills FOR DELETE TO authenticated USING (auth.uid() = created_by);

      -- Notifications Policies
      CREATE POLICY "Users can insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
      CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE TO authenticated USING (auth.uid() = created_by);

      -- Budgets Policies
      CREATE POLICY "Users can insert budgets" ON budgets FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
      CREATE POLICY "Users can read own budgets" ON budgets FOR SELECT TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can update own budgets" ON budgets FOR UPDATE TO authenticated USING (auth.uid() = created_by);
      CREATE POLICY "Users can delete own budgets" ON budgets FOR DELETE TO authenticated USING (auth.uid() = created_by);

      -- Logs Policies
      CREATE POLICY "Anyone can insert logs" ON logs FOR INSERT WITH CHECK (true);
      CREATE POLICY "Users can read own logs" ON logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

      -- Master tables read access for everyone
      CREATE POLICY "Anyone can read currencies" ON currencies FOR SELECT TO authenticated, anon USING (true);
      CREATE POLICY "Anyone can read expense_categories" ON expense_categories FOR SELECT TO authenticated, anon USING (true);
      CREATE POLICY "Users can insert custom expense_categories" ON expense_categories FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Anyone can read income_categories" ON income_categories FOR SELECT TO authenticated, anon USING (true);
      CREATE POLICY "Anyone can read payment_methods" ON payment_methods FOR SELECT TO authenticated, anon USING (true);
      CREATE POLICY "Anyone can read goal_types" ON goal_types FOR SELECT TO authenticated, anon USING (true);
      CREATE POLICY "Anyone can read loan_types" ON loan_types FOR SELECT TO authenticated, anon USING (true);
      CREATE POLICY "Anyone can read recurrence_types" ON recurrence_types FOR SELECT TO authenticated, anon USING (true);
      CREATE POLICY "Anyone can read statuses" ON statuses FOR SELECT TO authenticated, anon USING (true);
    `);

    // 6. Seed configurations
    console.log('Seeding currencies lookup...');
    for (const item of SEED_DATA.currencies) {
      await client.query('INSERT INTO currencies (id, name, symbol) VALUES ($1, $2, $3)', [item.id, item.name, item.symbol]);
    }

    console.log('Seeding expense_categories lookup...');
    for (const item of SEED_DATA.expense_categories) {
      await client.query('INSERT INTO expense_categories (id, name, color, icon) VALUES ($1, $2, $3, $4)', [item.id, item.name, item.color, item.icon]);
    }

    console.log('Seeding income_categories lookup...');
    for (const item of SEED_DATA.income_categories) {
      await client.query('INSERT INTO income_categories (id, name, color, icon) VALUES ($1, $2, $3, $4)', [item.id, item.name, item.color, item.icon]);
    }

    console.log('Seeding payment_methods lookup...');
    for (const item of SEED_DATA.payment_methods) {
      await client.query('INSERT INTO payment_methods (id, name, icon) VALUES ($1, $2, $3)', [item.id, item.name, item.icon]);
    }

    console.log('Seeding goal_types lookup...');
    for (const item of SEED_DATA.goal_types) {
      await client.query('INSERT INTO goal_types (id, name) VALUES ($1, $2)', [item.id, item.name]);
    }

    console.log('Seeding loan_types lookup...');
    for (const item of SEED_DATA.loan_types) {
      await client.query('INSERT INTO loan_types (id, name) VALUES ($1, $2)', [item.id, item.name]);
    }

    console.log('Seeding recurrence_types lookup...');
    for (const item of SEED_DATA.recurrence_types) {
      await client.query('INSERT INTO recurrence_types (id, name) VALUES ($1, $2)', [item.id, item.name]);
    }

    console.log('Seeding statuses lookup...');
    for (const item of SEED_DATA.statuses) {
      await client.query('INSERT INTO statuses (id, name) VALUES ($1, $2)', [item.id, item.name]);
    }

    console.log('UUID-ALIGNED MIGRATION SUCCESSFULLY COMPLETED!');

  } catch (err) {
    console.error('Migration failed with error:', err.message);
  } finally {
    await client.end();
  }
}

main();
