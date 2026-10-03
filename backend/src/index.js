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

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'creatorai-backend', ai: process.env.OPENAI_API_KEY ? 'openai' : 'heuristic' }));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/content', require('./routes/content'));

const PORT = process.env.PORT || 5000;
(async () => {
  await sequelize.sync({ alter: true });
  console.log('[db] synced');
  await ensureBucket().catch((e) => console.warn('[supabase]', e.message));
  app.listen(PORT, () => console.log(`CreatorAI backend on :${PORT}`));
})();
