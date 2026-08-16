import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set DATABASE_URL in the environment (do not hardcode DB passwords in this file).');
  process.exit(1);
}

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
