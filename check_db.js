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
    await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS next_recurring_date DATE');
    console.log('Successfully added next_recurring_date column to transactions');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
