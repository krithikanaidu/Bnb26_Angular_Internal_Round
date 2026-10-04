'use strict';

// Boot-time schema ensure for the content/publish/intelligence tables.
// Same pattern as clippedai/schema.js: sync({ alter:true }) has proven
// unreliable at adding columns (it once crashed boot with "Unknown constraint
// error", and an older boot died on `column "meta" does not exist`). Raw
// idempotent DDL here guarantees the tables/columns exist regardless.
//
// NOTE: the live database uses lowercase snake_case tables (what Sequelize
// sync actually created: connected_accounts, publish_jobs, metrics) — the
// DDL below matches that reality, not the PascalCase names in the older
// schema.sql lines.
const { sequelize } = require('../models');

async function ensureContentSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "connected_accounts" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider text NOT NULL,
      handle text NOT NULL,
      display_name text,
      access_token text,
      refresh_token text,
      expires_at timestamptz,
      meta jsonb DEFAULT '{}',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    `ALTER TABLE "publish_jobs" ADD COLUMN IF NOT EXISTS "account_id" uuid`,
    `ALTER TABLE "metrics" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'manual'`,
    `ALTER TABLE "metrics" ADD COLUMN IF NOT EXISTS "external_id" text`,
  ];
  for (const sql of statements) {
    try {
      await sequelize.query(sql);
    } catch (e) {
      console.warn('[content] schema ensure skipped:', e.message);
    }
  }

  try {
    const [rows] = await sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'publish_jobs' AND column_name = 'account_id'",
    );
    if (rows.length) {
      console.log('[content] schema verified (connected_accounts, publish_jobs.account_id, metrics.source)');
    } else {
      console.error('[content] FATAL: publish_jobs.account_id is missing after ensure.');
      console.error('[content]   DATABASE_URL likely points at a different database than the app data.');
    }
  } catch (e) {
    console.warn('[content] schema verification skipped:', e.message);
  }
}

module.exports = { ensureContentSchema };
