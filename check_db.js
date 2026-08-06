import pg from 'pg';

const connectionString = `postgresql://postgres.viefdnbijxsasfdjpusb:Zb1HvBIAj1b9XnXP@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`;

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS next_recurring_date DATE');
    console.log('Successfully added next_recurring_date column to transactions');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
