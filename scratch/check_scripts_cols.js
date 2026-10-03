const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const { sequelize } = require('../backend/src/models');

(async () => {
  try {
    const [cols] = await sequelize.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name ILIKE '%script%'
      ORDER BY table_name, ordinal_position
    `);
    console.log('SCRIPTS COLS:', cols);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
})();
