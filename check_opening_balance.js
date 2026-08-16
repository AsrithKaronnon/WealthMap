import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set DATABASE_URL in the environment (do not hardcode DB passwords in this file).');
  process.exit(1);
}

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
