import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set DATABASE_URL in the environment (do not hardcode DB passwords in this file).');
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log('Running Assets migration...');
  try {

    // 1. Create assets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        asset_category VARCHAR(50) NOT NULL,
        current_value DECIMAL(15,2) NOT NULL DEFAULT 0,
        purchase_value DECIMAL(15,2) DEFAULT 0,
        purchase_date DATE DEFAULT NULL,
        notes TEXT DEFAULT '',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('Created assets table');

    // 2. Enable RLS
    await client.query(`ALTER TABLE assets ENABLE ROW LEVEL SECURITY;`);
    console.log('Enabled RLS on assets');

    // 3. RLS Policies
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assets' AND policyname = 'Users can insert assets') THEN
          CREATE POLICY "Users can insert assets" ON assets FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assets' AND policyname = 'Users can read own assets') THEN
          CREATE POLICY "Users can read own assets" ON assets FOR SELECT TO authenticated USING (auth.uid() = created_by);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assets' AND policyname = 'Users can update own assets') THEN
          CREATE POLICY "Users can update own assets" ON assets FOR UPDATE TO authenticated USING (auth.uid() = created_by);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assets' AND policyname = 'Users can delete own assets') THEN
          CREATE POLICY "Users can delete own assets" ON assets FOR DELETE TO authenticated USING (auth.uid() = created_by);
        END IF;
      END $$;
    `);
    console.log('Created RLS policies for assets');

    // 4. Add columns to user_settings
    await client.query(`
      ALTER TABLE user_settings
      ADD COLUMN IF NOT EXISTS enabled_asset_tabs TEXT[] DEFAULT '{"stocks_mf","bank_cash","gold","fd"}',
      ADD COLUMN IF NOT EXISTS hidden_asset_account_ids UUID[] DEFAULT '{}';
    `);
    console.log('Updated user_settings columns');

    console.log('Assets migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

main();
