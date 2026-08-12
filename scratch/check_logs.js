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
    const res = await client.query("SELECT * FROM automation_logs ORDER BY created_at DESC LIMIT 5;");
    console.log("Recent Logs:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
