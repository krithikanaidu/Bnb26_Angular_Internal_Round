const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const { sequelize } = require('../backend/src/models');

(async () => {
  try {
    const [tables] = await sequelize.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables 
      WHERE table_name ILIKE '%script%'
    `);
    console.log('TABLES:', tables);

    console.log('Altering "scripts"...');
    await sequelize.query('ALTER TABLE "scripts" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1;');
    await sequelize.query('ALTER TABLE "scripts" ADD COLUMN IF NOT EXISTS "hook_pattern_id" uuid;');
    await sequelize.query('ALTER TABLE "scripts" ADD COLUMN IF NOT EXISTS "beats" jsonb DEFAULT \'[]\'::jsonb;');
    await sequelize.query('ALTER TABLE "scripts" ADD COLUMN IF NOT EXISTS "supporting" jsonb DEFAULT \'{}\'::jsonb;');

    console.log('Altering "Scripts"...');
    try {
      await sequelize.query('ALTER TABLE "Scripts" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1;');
      await sequelize.query('ALTER TABLE "Scripts" ADD COLUMN IF NOT EXISTS "hook_pattern_id" uuid;');
      await sequelize.query('ALTER TABLE "Scripts" ADD COLUMN IF NOT EXISTS "beats" jsonb DEFAULT \'[]\'::jsonb;');
      await sequelize.query('ALTER TABLE "Scripts" ADD COLUMN IF NOT EXISTS "supporting" jsonb DEFAULT \'{}\'::jsonb;');
    } catch(e) {
      console.log('"Scripts" (case-sensitive) error:', e.message);
    }

    const [cols] = await sequelize.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('scripts', 'Scripts')
    `);
    console.log('CONFIRMED COLS:', cols);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
})();
