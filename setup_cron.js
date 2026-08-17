import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local / .env if present (does not override existing env vars)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const name of ['.env.local', '.env']) {
  const p = path.join(__dirname, name);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
if (connectionString.includes('REGION') || connectionString.includes('your-')) {
  console.error("DATABASE_URL still has a placeholder (e.g. REGION). Copy the real pooler host from Supabase → Project Settings → Database.");
  process.exit(1);
}
// '#' in the password must be %23 or the URL parser truncates it
if (/postgresql:\/\/[^:]+:[^@]*#[^@]*@/i.test(connectionString)) {
  console.error("DATABASE_URL password contains '#'. Encode it as %23, e.g. Maruthiyodan#123 → Maruthiyodan%23123");
  process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const cronSecret = process.env.CRON_SECRET;
if (!supabaseUrl || supabaseUrl.includes('your-project-ref')) {
  console.error("VITE_SUPABASE_URL (or SUPABASE_URL) is not set to a real project URL");
  process.exit(1);
}
if (!cronSecret || cronSecret.includes('PASTE_') || cronSecret.length < 16) {
  console.error("CRON_SECRET is missing or looks like a placeholder — set the same value as in Edge Function secrets");
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

    // Cron functions are deployed with --no-verify-jwt; auth is x-cron-secret only.
    // Schedule: 1:00 Asia/Kolkata ≈ 19:30 UTC previous day... use 19:30 UTC for ~1 AM IST
    // Keep 0 1 * * * (01:00 UTC = 06:30 IST) unless you prefer IST midnight.
    console.log("Scheduling jobs daily at 01:00 UTC (06:30 IST)...");

    const headers = JSON.stringify({
      "Content-Type": "application/json",
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
      console.log(`Scheduled ${jobName} → ${functionName}`);
    };

    await scheduleJob('networth-cron-job', 'networth-cron');
    await scheduleJob('process-sips-job', 'process-sips');
    await scheduleJob('recurring-transactions-job', 'process-recurring-transactions');

    console.log("All cron jobs successfully configured!");

    const jobs = await client.query("SELECT jobname, schedule, command FROM cron.job;");
    console.log("Current Cron Jobs:");
    for (const j of jobs.rows) {
      console.log(`- ${j.jobname} (${j.schedule})`);
      // Sanity: do not print secrets; just confirm header key exists
      if (!String(j.command).includes('x-cron-secret')) {
        console.warn(`  WARNING: ${j.jobname} command may be missing x-cron-secret`);
      }
      if (String(j.command).includes('PASTE_')) {
        console.error(`  ERROR: ${j.jobname} still contains a placeholder — re-run with real env vars`);
      }
    }
  } catch (err) {
    console.error("Error setting up cron jobs:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
