import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    console.log("Adding credit_limit column to accounts table...");
    await client.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15, 2) DEFAULT 0.00;");
    
    // Also, if there are existing credit cards, let's set their credit limit to their current balance just in case.
    await client.query("UPDATE accounts SET credit_limit = balance WHERE account_type = 'Credit Card' AND (credit_limit = 0.00 OR credit_limit IS NULL);");

    console.log("Database updated successfully.");
  } catch (err) {
    console.error("Database update error:", err);
  } finally {
    await client.end();
  }
}

main();
