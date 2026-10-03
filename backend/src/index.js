const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { sequelize } = require('./models');
const { ensureBucket } = require('./config/supabase');

const app = express();
app.use(cors({ origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  const { resolveProvider } = require('./services/llmProvider');
  const p = resolveProvider();
  res.json({ ok: true, service: 'creatorai-backend', ai: p.provider, model: p.model || null });
});
app.use('/api/projects', require('./routes/projects'));
app.use('/api/assets', require('./routes/assets'));
// Ideation (AGENT/API.md §5) must mount before legacy /content so its paths win
app.use('/api', require('./routes/ideation'));          // GET /api/hook-patterns
app.use('/api/content', require('./routes/ideation'));  // /api/content/hooks/generate, /api/content/scripts/*
app.use('/api/content', require('./routes/content'));

const PORT = process.env.PORT || 5000;
(async () => {
  try {
    await sequelize.authenticate();
    console.log('[db] connected to Supabase Postgres');
    await sequelize.sync({ alter: true });
    console.log('[db] synced');
    await ensureBucket().catch((e) => console.warn('[supabase]', e.message));
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
