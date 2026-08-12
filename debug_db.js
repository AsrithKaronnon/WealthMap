import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');

const getEnv = (key) => {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : process.env[key];
};

const client = new pg.Client({ connectionString: getEnv('DATABASE_URL') });

async function run() {
  await client.connect();
  const txs = await client.query(`SELECT amount, transaction_type_id, date FROM transactions WHERE created_by = '61072d57-b21e-4ecf-be88-5ab8dc83d5c5' AND date >= '2026-08-01'`);
  console.table(txs.rows);
  await client.end();
}
run();
