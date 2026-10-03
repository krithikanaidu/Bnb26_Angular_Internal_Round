'use strict';
// One-shot: ensure ClipAI schema on the configured database.
const { sequelize } = require('../src/models');

(async () => {
  await sequelize.authenticate();
  console.log('[db] connected');
  const { ensureClipAiSchema } = require('../src/clippedai/schema');
  await ensureClipAiSchema();
  // Prove the previously-crashing query now works (content.js insights).
  const { Clip } = require('../src/models');
  const rows = await Clip.findAll({ order: [['viralityScore', 'DESC']], limit: 5 });
  console.log(`[db] Clip.findAll OK (${rows.length} rows, meta selectable)`);
  await sequelize.close();
})().catch((e) => { console.error('MIGRATE_FAIL:', e.message); process.exit(1); });
