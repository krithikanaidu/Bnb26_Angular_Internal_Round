const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });
const { Script, sequelize } = require('../backend/src/models');

(async () => {
  try {
    console.log('Testing Script.findAll()...');
    const rows = await Script.findAll();
    console.log('Found rows:', rows.length);
  } catch (err) {
    console.error('Script.findAll error:', err);
  } finally {
    await sequelize.close();
  }
})();
