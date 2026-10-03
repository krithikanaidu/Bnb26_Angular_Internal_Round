const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const { sequelize } = require('../backend/src/models');

(async () => {
  try {
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('TABLES:', tables);

    const [cols] = await sequelize.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name ILIKE '%hook%'
    `);
    console.log('HOOK COLS:', cols);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
})();
