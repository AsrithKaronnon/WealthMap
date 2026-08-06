import pg from 'pg';

const connectionString = `postgresql://postgres.viefdnbijxsasfdjpusb:Zb1HvBIAj1b9XnXP@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`;

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log('Running opening_balance migration...');
  try {
    // Add opening_balance column — copies existing balance value as the starting point
    await client.query(`
      ALTER TABLE accounts
      ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0;
    `);
    console.log('Added opening_balance column');

    // Copy existing balance values into opening_balance
    await client.query(`
      UPDATE accounts SET opening_balance = balance WHERE opening_balance = 0;
    `);
    console.log('Copied balance -> opening_balance for existing accounts');

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

main();
