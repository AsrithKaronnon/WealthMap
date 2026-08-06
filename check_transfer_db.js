import pg from 'pg';

const connectionString = `postgresql://postgres.viefdnbijxsasfdjpusb:Zb1HvBIAj1b9XnXP@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`;

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_to_account_id UUID REFERENCES accounts(id)');
    console.log('Successfully added transfer_to_account_id column to transactions');

    await client.query('ALTER TABLE transactions ALTER COLUMN category_id DROP NOT NULL');
    console.log('Successfully dropped NOT NULL constraint from category_id in transactions');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
