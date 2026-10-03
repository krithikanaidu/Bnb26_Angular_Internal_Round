'use strict';
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const tables = await client.query(
    `select table_name from information_schema.tables where table_schema='public' order by table_name`,
  );
  console.log('TABLES:', tables.rows.map((r) => r.table_name).join(', '));
  for (const t of ['clips', 'Clips', 'ClipJobs', 'clip_jobs', 'Clipjobs']) {
    try {
      const cols = await client.query(
        `select column_name from information_schema.columns where table_name=$1 order by column_name`,
        [t],
      );
      if (cols.rows.length) console.log(`COLS ${t}:`, cols.rows.map((r) => r.column_name).join(', '));
    } catch { /* ignore */ }
  }
  await client.end();
})().catch((e) => { console.error('INSPECT_FAIL:', e.message); process.exit(1); });
