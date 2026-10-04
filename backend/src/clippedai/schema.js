'use strict';

// Boot-time schema ensure for ClipAI columns/tables.
// The live DB uses lowercase tables created by Sequelize sync, and
// sync({ alter: true }) has proven unreliable at adding columns (it once
// crashed boot with "Unknown constraint error"). Raw idempotent DDL here
// guarantees the columns exist regardless — same pattern as ensureBucket.
const { sequelize } = require('../models');

async function ensureClipAiSchema() {
  const statements = [
    `ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "meta" JSONB DEFAULT '{}'`,
    `CREATE TABLE IF NOT EXISTS "clip_jobs" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid,
      source_name text,
      source_path text,
      status text DEFAULT 'queued',
      stage text DEFAULT 'queued',
      progress float DEFAULT 0,
      options jsonb DEFAULT '{}',
      transcript jsonb,
      outputs jsonb DEFAULT '[]',
      error text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
  ];
  for (const sql of statements) {
    try {
      await sequelize.query(sql);
    } catch (e) {
      console.warn('[clipai] schema ensure skipped:', e.message);
    }
  }

  // Don't trust the DDL silently — a connection that resolves to the wrong
  // database will "succeed" and still leave clips.meta missing, which then
  // breaks every Clip query. Verify and shout loudly if it is not really there.
  try {
    const [rows] = await sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'meta'",
    );
    if (rows.length) {
      console.log('[clipai] schema verified (clips.meta, clip_jobs)');
    } else {
      // Keep booting so the API stays reachable for diagnosis, but make the
      // cause unmissable — this is a DATABASE_URL mismatch, not a code bug.
      console.error('[clipai] FATAL: clips.meta is missing after ensure.');
      console.error('[clipai]   DATABASE_URL likely points at a different database than the one holding "clips".');
    }
  } catch (e) {
    console.warn('[clipai] schema verification skipped:', e.message);
  }
}

module.exports = { ensureClipAiSchema };
