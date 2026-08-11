import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env.local for credentials
const envPath = path.join(__dirname, '.env.local');
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

const getEnv = (key) => {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : process.env[key];
};

const connectionString = getEnv('DATABASE_URL');
const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const serviceRoleKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');

if (!connectionString) {
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: DATABASE_URL environment variable is missing.');
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL. Creating networth_history table...');

  try {
    // 1. Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS networth_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        networth DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        cash DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        income DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        spent DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(date, user_id)
      );
    `);

    // 2. Enable RLS and create policies
    await client.query(`
      ALTER TABLE networth_history ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Users can read own networth history" ON networth_history;
      DROP POLICY IF EXISTS "Users can insert own networth history" ON networth_history;
      
      CREATE POLICY "Users can read own networth history" ON networth_history 
        FOR SELECT TO authenticated USING (auth.uid() = user_id);
        
      CREATE POLICY "Users can insert own networth history" ON networth_history 
        FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    `);
    
    // 3. Setup pg_cron trigger to hit edge function if pg_cron and pg_net are available
    if (supabaseUrl && serviceRoleKey) {
      console.log('Setting up pg_cron schedule...');
      try {
        await client.query(`SELECT cron.unschedule('networth-cron-job');`);
      } catch (e) {
        // Ignore if job doesn't exist
      }
      try {
        const cronSql = `
          SELECT cron.schedule(
            'networth-cron-job',
            '0 0 * * *',
            $$
              SELECT net.http_post(
                  url:='${supabaseUrl}/functions/v1/networth-cron',
                  headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceRoleKey}"}'::jsonb
              ) as request_id;
            $$
          );
        `;
        await client.query(cronSql);
        console.log('Successfully configured pg_cron job for networth-cron edge function.');
      } catch (cronErr) {
        console.warn('Could not set up pg_cron. The pg_cron/pg_net extensions might not be enabled on this database. Error:', cronErr.message);
      }
    } else {
      console.warn('Skipping pg_cron setup because VITE_SUPABASE_URL or anon key is missing from .env.local');
    }

    console.log('MIGRATION SUCCESSFULLY COMPLETED!');
  } catch (err) {
    console.error('Migration failed with error:', err.message);
  } finally {
    await client.end();
  }
}

main();
