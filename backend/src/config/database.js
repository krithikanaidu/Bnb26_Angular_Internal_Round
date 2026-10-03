require('dotenv').config();
const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    '[db] Missing DATABASE_URL. Supabase-only mode: set DATABASE_URL in backend/.env\n' +
      '  Example (Supabase → Connect → Transaction pooler):\n' +
      '  DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres'
  );
  throw new Error('DATABASE_URL is required (Supabase-only mode). No localhost fallback.');
}

// Supabase-only: always SSL, works for both pooler (:6543) and direct (:5432)
const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
});

module.exports = sequelize;
