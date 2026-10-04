'use strict';

// Boot-time schema ensure for the ideation tables (scripts, hooks, hook_patterns).
//
// WHY THIS EXISTS — the `column "version" does not exist` crash:
// The Sequelize models use lowercase snake_case tables (`scripts`, `hooks`,
// `hook_patterns` — see Script.getTableName()). Databases created by an older
// `sync()` therefore hold a `scripts` table WITHOUT the ideation columns
// (version, hook_pattern_id, beats, supporting) added to the model later, and
// likewise a `hooks` table without (pattern_id, category).
// `sequelize.sync({ alter: true })` has proven unreliable at adding those
// columns (it once crashed boot with "Unknown constraint error" and once
// rebuilt a table and dropped its rows), and supabase/schema.sql only backfills
// the PascalCase twins ("Scripts", "Hooks") — a DIFFERENT set of tables in
// Postgres — so the live lowercase tables never got the columns. Every
// Script.findAll then fails with 42703 `column "version" does not exist`,
// which empties Saved Scripts, the Studio script picker and the Ideation
// history in one go. Raw idempotent DDL here guarantees the columns exist
// regardless — same pattern as clippedai/schema.js and config/contentSchema.js.
const { sequelize } = require('../models');

async function ensureIdeationSchema() {
  const statements = [
    // Fresh databases get the full shape up front (IF NOT EXISTS never
    // touches existing tables, so this is safe on live databases too).
    `CREATE TABLE IF NOT EXISTS "hook_patterns" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pattern text NOT NULL,
      category text NOT NULL,
      example text,
      source text DEFAULT 'viral-hooks',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "scripts" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid,
      title text,
      body text NOT NULL,
      tone text DEFAULT 'energetic',
      target_platforms jsonb DEFAULT '[]',
      version int DEFAULT 1,
      hook_pattern_id uuid,
      beats jsonb DEFAULT '[]',
      supporting jsonb DEFAULT '{}',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "hooks" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      script_id uuid,
      project_id uuid,
      text text NOT NULL,
      score float DEFAULT 0,
      style text DEFAULT 'curiosity',
      pattern_id uuid,
      category text DEFAULT 'statement',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    // Live databases created before the ideation columns existed: add them.
    `ALTER TABLE "scripts" ADD COLUMN IF NOT EXISTS "version" int DEFAULT 1`,
    `ALTER TABLE "scripts" ADD COLUMN IF NOT EXISTS "hook_pattern_id" uuid`,
    `ALTER TABLE "scripts" ADD COLUMN IF NOT EXISTS "beats" jsonb DEFAULT '[]'`,
    `ALTER TABLE "scripts" ADD COLUMN IF NOT EXISTS "supporting" jsonb DEFAULT '{}'`,
    `ALTER TABLE "scripts" ADD COLUMN IF NOT EXISTS "target_platforms" jsonb DEFAULT '[]'`,
    `ALTER TABLE "hooks" ADD COLUMN IF NOT EXISTS "pattern_id" uuid`,
    `ALTER TABLE "hooks" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'statement'`,
    `ALTER TABLE "hooks" ADD COLUMN IF NOT EXISTS "project_id" uuid`,
    `ALTER TABLE "hooks" ADD COLUMN IF NOT EXISTS "script_id" uuid`,
  ];
  for (const sql of statements) {
    try {
      await sequelize.query(sql);
    } catch (e) {
      console.warn('[ideation] schema ensure skipped:', e.message);
    }
  }

  // Don't trust the DDL silently — verify the columns the routes actually
  // select, and say plainly if they are still missing (usually a DATABASE_URL
  // pointing at a different database than the app data).
  try {
    const [rows] = await sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name IN ('scripts', 'hooks', 'hook_patterns')
       AND column_name IN ('version', 'beats', 'supporting', 'hook_pattern_id', 'pattern_id', 'category', 'pattern')`,
    );
    const found = new Set(rows.map((r) => r.column_name));
    const need = ['version', 'beats', 'supporting', 'hook_pattern_id', 'pattern_id', 'category', 'pattern'];
    const missing = need.filter((c) => !found.has(c));
    if (!missing.length) {
      console.log('[ideation] schema verified (scripts.version/beats/supporting, hooks.pattern_id/category, hook_patterns)');
    } else {
      console.error(`[ideation] FATAL: still missing after ensure: ${missing.join(', ')}.`);
      console.error('[ideation]   DATABASE_URL likely points at a different database than the one holding your data.');
    }
  } catch (e) {
    console.warn('[ideation] schema verification skipped:', e.message);
  }
}

module.exports = { ensureIdeationSchema, isMissingColumnError, listScriptsResilient };

// True when a Sequelize error is Postgres 42703 "column does not exist" —
// the stale-`scripts`/`hooks` table shape described above.
function isMissingColumnError(err) {
  const code = err?.parent?.code || err?.original?.code;
  if (code === '42703') return true;
  return /column .* does not exist/i.test(err?.message || '');
}

// Last-resort reader: selects only the base columns every `scripts` table has
// ever had, then pads the ideation fields with defaults so the Studio script
// picker, Saved Scripts and Ideation history still render instead of 500ing
// while the schema ensure catches up.
async function listScriptsResilient({ projectId } = {}) {
  const where = projectId ? 'WHERE project_id = :projectId' : '';
  const [rows] = await sequelize.query(
    `SELECT id, project_id, title, body, tone, created_at, updated_at
     FROM "scripts" ${where} ORDER BY created_at DESC`,
    projectId ? { replacements: { projectId } } : {},
  );
  return (rows || []).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    project_id: r.project_id,
    title: r.title,
    body: r.body,
    content: r.body,
    tone: r.tone,
    targetPlatforms: [],
    version: 1,
    hookPatternId: null,
    hook_pattern_id: null,
    beats: [],
    supporting: {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
