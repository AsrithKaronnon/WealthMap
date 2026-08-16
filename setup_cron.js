import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const cronSecret = process.env.CRON_SECRET;
if (!supabaseUrl) {
  console.error("VITE_SUPABASE_URL (or SUPABASE_URL) is not set");
  process.exit(1);
}
if (!anonKey) {
  console.error("VITE_SUPABASE_ANON_KEY is not set (needed for Supabase gateway JWT check)");
  process.exit(1);
}
if (!cronSecret) {
  console.error("CRON_SECRET is not set — use the same value configured on the Edge Functions");
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    console.log("Enabling pg_cron and pg_net extensions...");
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_cron;");
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_net;");

    console.log("Unscheduling existing jobs...");
    await client.query("SELECT cron.unschedule('networth-cron-job');").catch(() => {});
    await client.query("SELECT cron.unschedule('process-sips-job');").catch(() => {});
    await client.query("SELECT cron.unschedule('recurring-transactions-job');").catch(() => {});

    console.log("Scheduling new jobs at 1 AM...");

    // Authorization = anon JWT for Supabase gateway; x-cron-secret = app secret
    const headers = JSON.stringify({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anonKey}`,
      "x-cron-secret": cronSecret,
    }).replace(/'/g, "''");

    const scheduleJob = async (jobName, functionName) => {
      const sql = `
        SELECT cron.schedule(
            '${jobName}',
            '0 1 * * *',
            $$
            SELECT net.http_post(
                url:='${supabaseUrl}/functions/v1/${functionName}',
                headers:='${headers}'::jsonb,
                body:=concat('{"time": "', current_timestamp, '"}')::jsonb
            ) as request_id;
            $$
        );
      `;
      await client.query(sql);
      console.log(`Scheduled ${jobName} for function ${functionName}`);
    };

    await scheduleJob('networth-cron-job', 'networth-cron');
    await scheduleJob('process-sips-job', 'process-sips');
    await scheduleJob('recurring-transactions-job', 'process-recurring-transactions');

    console.log("All cron jobs successfully configured!");

    const jobs = await client.query("SELECT jobname, schedule, command FROM cron.job;");
    console.log("Current Cron Jobs:");
    for (const j of jobs.rows) {
      console.log(`- ${j.jobname} (${j.schedule})`);
    }
  } catch (err) {
    console.error("Error setting up cron jobs:", err);
  } finally {
    await client.end();
  }
}

main();
