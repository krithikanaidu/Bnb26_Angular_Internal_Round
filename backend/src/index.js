require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { sequelize } = require('./models');
const { ensureBucket } = require('./config/supabase');

const app = express();
app.use(cors({ origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// A rejected promise inside an async route must not take the whole process
// down (one bad query used to crash the server and stall every job).
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err?.message || err);
});

// Rendered shorts + uploads served for preview/download
app.use('/media', express.static(path.join(__dirname, '..', 'media')));

app.get('/api/health', (req, res) => {
  const { sttProvider, hasStt, groqKey, openaiKey } = require('./clippedai/keys');
  const stt = sttProvider();
  const llm = groqKey() ? 'groq' : (openaiKey() ? 'openai' : 'heuristic');
  res.json({
    ok: true,
    service: 'creatorai-backend',
    ai: llm,
    engines: {
      whisper: hasStt(),
      // Name + model only — never the key itself.
      stt: stt ? { name: stt.name, model: stt.model } : null,
      copy: llm,
      reframe: 'auto',
    },
  });
});
app.use('/api/projects', require('./routes/projects'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/content', require('./routes/content'));
app.use('/api/clippedai', require('./routes/clippedai'));

const PORT = process.env.PORT || 5000;
(async () => {
  try {
    await sequelize.authenticate();
    console.log('[db] connected to Supabase Postgres');
    // Add clips.meta BEFORE sync: sync({alter:true}) diffs the DB against the
    // model, and if the column is missing it rebuilds the table — which drops
    // existing Clip rows and leaves the long-lived process resolving a schema
    // that no longer matches the model's expectations.
    await require('./clippedai/schema').ensureClipAiSchema();
    try {
      await sequelize.sync({ alter: true });
      console.log('[db] synced');
    } catch (e) {
      // alter:true occasionally fails on pre-existing constraints/enums
      // ("Unknown constraint error") — fall back to create-missing-only so
      // boot survives; feature schemas are ensured explicitly below.
      console.warn('[db] sync alter failed, retrying plain sync:', e.message);
      await sequelize.sync();
      console.log('[db] synced (plain)');
    }
    await ensureBucket().catch((e) => console.warn('[supabase]', e.message));
    await require('./clippedai/schema').ensureClipAiSchema();
    await require('./clippedai/jobs').recoverStuckJobs();
    app.listen(PORT, () => console.log(`CreatorAI backend on :${PORT}`));
  } catch (e) {
    console.error('[fatal] Could not connect to Supabase Postgres.');
    console.error('  1. Copy backend/.env.example -> backend/.env');
    console.error('  2. Set DATABASE_URL from Supabase Dashboard > Project Settings > Database > Connection string (pooler :6543).');
    console.error('  3. Run supabase/schema.sql once in Supabase SQL editor.');
    console.error(`  Details: ${e.message}`);
    process.exit(1);
  }
})();
