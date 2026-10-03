const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const { sequelize } = require('../backend/src/models');

(async () => {
  try {
    console.log('Altering hooks table...');
    await sequelize.query(`
      ALTER TABLE "hooks" 
      ADD COLUMN IF NOT EXISTS "pattern_id" uuid,
      ADD COLUMN IF NOT EXISTS "category" character varying(255) DEFAULT 'statement';
    `);

    console.log('Altering scripts table...');
    await sequelize.query(`
      ALTER TABLE "scripts" 
      ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "hook_pattern_id" uuid,
      ADD COLUMN IF NOT EXISTS "beats" jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "supporting" jsonb DEFAULT '{}'::jsonb;
    `);

    console.log('Tables successfully altered!');
  } catch (err) {
    console.error('Error altering tables:', err);
  } finally {
    await sequelize.close();
  }
})();
