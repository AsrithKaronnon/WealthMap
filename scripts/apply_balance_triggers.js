/**
 * Apply balance-trigger migration to the linked DATABASE_URL (.env).
 * Safe to re-run (CREATE OR REPLACE / DROP IF EXISTS).
 *
 * Does NOT rewrite historical non-CC balances (some accounts were never
 * double-counted). Only drops the duplicate trigger and normalizes negative CC usage.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const sqlPath = path.join(root, 'supabase', 'migrations', '20260815_balance_triggers.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('Applying', sqlPath);
try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('Migration applied.');

  const triggers = await client.query(`
    SELECT trigger_name, action_statement
    FROM information_schema.triggers
    WHERE event_object_schema = 'public' AND event_object_table = 'transactions'
    ORDER BY trigger_name
  `);
  console.log('transactions triggers:');
  for (const r of triggers.rows) console.log(' -', r.trigger_name, '→', r.action_statement);

  const cc = await client.query(`
    SELECT name, balance FROM accounts
    WHERE account_type = 'Credit Card' AND COALESCE(is_deleted,false)=false
  `);
  console.log('CC balances after normalize:', cc.rows);
} catch (e) {
  await client.query('ROLLBACK');
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
