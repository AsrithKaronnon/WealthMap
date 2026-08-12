import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const res = await client.query("SELECT trigger_name, action_statement FROM information_schema.triggers WHERE event_object_table = 'transactions';");
  console.log(res.rows);
  await client.end();
}
main();
