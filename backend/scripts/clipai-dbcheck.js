require('dotenv').config();
const { ensureClipAiSchema } = require('../src/clippedai/schema');
const { sequelize } = require('../src/models');

const hasMeta = async () => {
  const [r] = await sequelize.query(
    "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='clips' AND column_name='meta'",
  );
  return r[0].n > 0;
};

(async () => {
  console.log('start:', await hasMeta());
  await ensureClipAiSchema();
  console.log('after ensure:', await hasMeta());

  // Step 1: does a plain sync({alter:true}) remove it?
  await sequelize.sync({ alter: true });
  console.log('after sync({alter:true}):', await hasMeta());

  await sequelize.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
