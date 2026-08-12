import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://viefdnbijxsasfdjpusb.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseAnonKey) {
  console.error("VITE_SUPABASE_ANON_KEY is not set");
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

    const headers = `{"Content-Type": "application/json", "Authorization": "Bearer ${supabaseAnonKey}"}`;

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

    // Verify
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
