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
    const ext = await client.query("SELECT extname FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');");
    console.log("Installed Extensions:", ext.rows);

    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'automation_logs';
    `);
    console.log("Automation Logs Table Exists:", tables.rows.length > 0);

    const jobs = await client.query("SELECT jobname, schedule, command FROM cron.job;").catch(e => ({ rows: [], error: e.message }));
    console.log("Cron Jobs:", jobs.rows, jobs.error || "");

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
