const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const { sequelize } = require('../backend/src/models');

(async () => {
  try {
    console.log('Running ALTER TABLE hooks...');
    const res1 = await sequelize.query(`
      ALTER TABLE hooks ADD COLUMN IF NOT EXISTS pattern_id uuid;
    `);
    console.log('Result 1:', res1);

    const res2 = await sequelize.query(`
      ALTER TABLE hooks ADD COLUMN IF NOT EXISTS category character varying(255) DEFAULT 'statement';
    `);
    console.log('Result 2:', res2);

    const res3 = await sequelize.query(`
      ALTER TABLE scripts ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
    `);
    console.log('Result 3:', res3);

    const res4 = await sequelize.query(`
      ALTER TABLE scripts ADD COLUMN IF NOT EXISTS hook_pattern_id uuid;
    `);
    console.log('Result 4:', res4);

    const res5 = await sequelize.query(`
      ALTER TABLE scripts ADD COLUMN IF NOT EXISTS beats jsonb DEFAULT '[]'::jsonb;
    `);
    console.log('Result 5:', res5);

    const res6 = await sequelize.query(`
      ALTER TABLE scripts ADD COLUMN IF NOT EXISTS supporting jsonb DEFAULT '{}'::jsonb;
    `);
    console.log('Result 6:', res6);

    const [cols] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'hooks'
    `);
    console.log('NEW HOOKS COLS:', cols);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
})();
