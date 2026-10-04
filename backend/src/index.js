const path = require('path');
// Load .env from the backend folder even when started from the repo root, so
// the merged services (llmProvider, trends, database) always see the keys.
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { sequelize } = require('./models');
const { ensureBucket } = require('./config/supabase');
const { requireAuth, optionalAuth } = require('./middleware/auth');

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

app.get('/api/health', optionalAuth, (req, res) => {
  const { sttProvider, hasStt } = require('./clippedai/keys');
  const { resolveProvider } = require('./services/llmProvider');
  const { CLIPAI_SCORE_WEIGHTS } = require('./clippedai/score');
  const stt = sttProvider();
  const p = resolveProvider();
  res.json({
    ok: true,
    service: 'creatorai-backend',
    // One LLM engine for every feature (Groq > OpenAI > heuristic).
    ai: p.provider,
    model: p.model || null,
    engines: {
      whisper: hasStt(),
      // Name + model only — never the key itself.
      stt: stt ? { name: stt.name, model: stt.model } : null,
      copy: p.provider,
      // Titles/hooks/scripts all run through the same copy engine. The frontend
      // used to read a non-existent `engines.titles`, so it always rendered
      // "Heuristic titles" even when Groq/OpenAI was live.
      titles: p.provider,
      trends: p.provider,
      reframe: 'auto',
    },
    // The real blend, so the UI can describe the algorithm it actually runs
    // instead of hardcoded percentages describing a different one.
    scoreWeights: CLIPAI_SCORE_WEIGHTS,
    // Tells the marketing page whether this install has any accounts yet, so a
    // fresh database can say "create the first one" instead of pretending a
    // login form alone is enough.
    accounts: require('./models').User.count().catch(() => null),
    signedInAs: req.user ? { email: req.user.email, name: req.user.name } : null,
  });
});

// Auth is public by definition: you cannot present a token before you have one.
app.use('/api/auth', require('./routes/auth'));

// Everything below is workspace data and now requires a live session.
app.use('/api/projects', requireAuth, require('./routes/projects'));
app.use('/api/assets', requireAuth, require('./routes/assets'));
// Ideation (AGENT/API.md §5) mounts before legacy /content so its
// /hooks/generate + /scripts/* paths win over the older handlers.
app.use('/api', requireAuth, require('./routes/ideation'));
app.use('/api/content', requireAuth, require('./routes/ideation'));
app.use('/api/content', requireAuth, require('./routes/content'));
app.use('/api/clippedai', requireAuth, require('./routes/clippedai'));

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
    // Same guarantee for the content/publish/intelligence tables (accounts,
    // publish_jobs.account_id, metrics.source/external_id) — see config/contentSchema.js.
    await require('./config/contentSchema').ensureContentSchema();
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
    // Same reason as clipai above: `users` is created with idempotent DDL so a
    // database that predates auth can still register its first account.
    await require('./config/authSchema').ensureAuthSchema();
    await ensureBucket().catch((e) => console.warn('[supabase]', e.message));
    await require('./clippedai/schema').ensureClipAiSchema();
    await require('./clippedai/jobs').recoverStuckJobs();
    const server = app.listen(PORT, () => console.log(`CreatorAI backend on :${PORT}`));
    // A busy port used to surface as a bare "[uncaughtException] listen
    // EADDRINUSE" with the process lingering half-dead. Say plainly what
    // happened and exit so nodemon / the terminal shows a clean failure.
    server.on('error', (e) => {
      if (e && e.code === 'EADDRINUSE') {
        console.error(`[fatal] Port ${PORT} is already in use — another CreatorAI backend is running.`);
        console.error(`  Stop it first (or set PORT=5001 in backend/.env), then retry.`);
        process.exit(1);
      }
      throw e;
    });
  } catch (e) {
    console.error('[fatal] Could not connect to Supabase Postgres.');
    console.error('  1. Copy backend/.env.example -> backend/.env');
    console.error('  2. Set DATABASE_URL from Supabase Dashboard > Project Settings > Database > Connection string (pooler :6543).');
    console.error('  3. Run supabase/schema.sql once in Supabase SQL editor.');
    console.error(`  Details: ${e.message}`);
    process.exit(1);
  }
})();
