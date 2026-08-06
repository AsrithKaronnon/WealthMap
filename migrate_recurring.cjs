const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { error } = await supabase.rpc('run_sql', {
    sql: 'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS next_recurring_date DATE;'
  });
  if (error) {
    // If run_sql fails, we might just use the postgres connection string directly
    const { Client } = require('pg');
    const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres' });
    try {
      await client.connect();
      await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS next_recurring_date DATE;');
      console.log('Success via PG');
      client.end();
    } catch(e) {
      console.log('PG Error:', e);
    }
  } else {
    console.log('Success via RPC');
  }
}
run();
