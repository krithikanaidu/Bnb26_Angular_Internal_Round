'use strict';

const { sequelize } = require('../models');

/**
 * Boot-time schema ensure for the auth tables.
 *
 * `sync({ alter: true })` has already proven unreliable on this database
 * (it rebuilds tables and drops rows when it meets a column it did not
 * expect). So the `users` table is created with idempotent raw DDL — the same
 * approach as clippedai/schema.js — and then verified. Registration failing
 * with "relation users does not exist" is otherwise a very confusing first
 * run.
 */
async function ensureAuthSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "users" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      name text DEFAULT '',
      password_hash text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" text DEFAULT ''`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text`,
    // Older databases may have the table from a partial run without the unique
    // index, which would let two accounts share an email.
    `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users" (lower(email))`,
  ];
  for (const sql of statements) {
    try {
      await sequelize.query(sql);
    } catch (e) {
      console.warn('[auth] schema ensure skipped:', e.message);
    }
  }

  try {
    const [rows] = await sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash'",
    );
    if (rows.length) {
      console.log('[auth] schema verified (users)');
    } else {
      console.error('[auth] FATAL: users.password_hash is missing after ensure.');
      console.error('[auth]   DATABASE_URL likely points at a different database than the one holding your data.');
    }
  } catch (e) {
    console.warn('[auth] schema verification skipped:', e.message);
  }
}

module.exports = { ensureAuthSchema };
