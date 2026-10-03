const router = require('express').Router();
const { Script, Hook, TranscriptSegment, Clip, EditProject, PublishJob, Metric } = require('../models');
const { generateHooks, generateScript } = require('../services/ai.service');
const { alignScriptToTranscript, generateClips, adaptClip, PLATFORM_PRESETS } = require('../services/content.service');

// --- Scripts & hooks ---
router.post('/generate-hooks', async (req, res) => {
  const { topic, count = 5, scriptId, projectId } = req.body;
  const hooks = await generateHooks(topic, count);
  if (scriptId || projectId) {
    for (const h of hooks) await Hook.create({ scriptId: scriptId || null, projectId: projectId || null, text: h.text, style: h.style, score: h.score });
  }
  res.json(hooks);
});

router.post('/generate-script', async (req, res) => {
  const { topic, tone = 'energetic', platforms = ['tiktok'], projectId, title } = req.body;
  const body = await generateScript(topic, tone, platforms.join(','));
  const script = await Script.create({ projectId: projectId || null, title: title || `${topic} script`, body: typeof body === 'string' ? body : body.body, tone, targetPlatforms: platforms });
  res.status(201).json(script);
});

router.get('/scripts', async (req, res) => {
  const where = req.query.projectId ? { projectId: req.query.projectId } : {};
  res.json(await Script.findAll({ where, order: [['createdAt', 'DESC']] }));
});

// --- Script-to-video understanding ---
router.post('/align', async (req, res) => {
  const { scriptBody, assetId, projectId } = req.body;
  const where = assetId ? { assetId } : projectId ? { projectId } : {};
  const segments = await TranscriptSegment.findAll({ where, order: [['startSec', 'ASC']] });
  if (!segments.length) return res.status(400).json({ error: 'No transcript segments. Upload footage first (demo segments auto-seed).' });
  res.json({ alignment: alignScriptToTranscript(scriptBody, segments), segments });
});

// --- Automated clip generation ---
router.post('/clips/generate', async (req, res) => {
  const { assetId, projectId } = req.body;
  const where = assetId ? { assetId } : projectId ? { projectId } : {};
  const segments = await TranscriptSegment.findAll({ where, order: [['startSec', 'ASC']] });
  const cands = generateClips(segments);
  const saved = [];
  for (const [i, c] of cands.entries()) {
    saved.push(await Clip.create({ projectId: projectId || segments[0]?.projectId || null, assetId: assetId || segments[0]?.assetId || null, title: `Clip ${i + 1} — ${c.hookText.slice(0, 40)}`, startSec: c.startSec, endSec: c.endSec, viralityScore: c.viralityScore, hookText: c.hookText, captions: [{ t: c.startSec, text: c.hookText }] }));
  }
  res.status(201).json(saved);
});

router.get('/clips', async (req, res) => {
  const where = req.query.projectId ? { projectId: req.query.projectId } : {};
  res.json(await Clip.findAll({ where, order: [['viralityScore', 'DESC']] }));
});

// --- AI-assisted editable edits (EDL stays editable) ---
router.post('/edits', async (req, res) => {
  const { projectId, clipId, platform = 'tiktok', tweaks = {} } = req.body;
  const clip = clipId ? await Clip.findByPk(clipId) : null;
  const edl = {
    tracks: [{ type: 'video', cuts: [{ start: clip?.startSec ?? 0, end: clip?.endSec ?? 30, speed: 1.1 }] }],
    captions: clip?.captions || [{ t: 0, text: clip?.hookText || 'Hook here' }],
    overlays: [{ type: 'hookTitle', text: clip?.hookText || 'Hook', style: platform }],
    hook: clip?.hookText || '',
    cta: 'Follow for part 2',
    ...tweaks,
  };
  const edit = await EditProject.create({ projectId, clipId, edl, platform, aspect: (PLATFORM_PRESETS[platform] || {}).aspect || '9:16' });
  res.status(201).json(edit);
});
router.get('/edits', async (req, res) => {
  const where = req.query.projectId ? { projectId: req.query.projectId } : {};
  res.json(await EditProject.findAll({ where, order: [['createdAt', 'DESC']] }));
});
router.patch('/edits/:id', async (req, res) => {
  const e = await EditProject.findByPk(req.params.id);
  if (!e) return res.status(404).json({ error: 'not found' });
  await e.update({ edl: req.body.edl ?? e.edl, version: e.version + 1 });
  res.json(e);
});

// --- Multi-platform adaptation ---
router.post('/adapt', async (req, res) => {
  const { clipId, platforms = ['tiktok', 'reels', 'shorts'] } = req.body;
  const clip = await Clip.findByPk(clipId);
  if (!clip) return res.status(404).json({ error: 'clip not found' });
  res.json(platforms.map((p) => adaptClip(clip, p)));
});

// --- Publish workflow ---
router.post('/publish', async (req, res) => {
  const { projectId, clipId, platform, scheduledAt, caption } = req.body;
  const job = await PublishJob.create({ projectId, clipId, platform, scheduledAt, caption, status: scheduledAt ? 'scheduled' : 'draft', hashtags: ['#creatorai', `#${platform}`] });
  res.status(201).json(job);
});
router.get('/publish', async (req, res) => {
  const where = req.query.projectId ? { projectId: req.query.projectId } : {};
  res.json(await PublishJob.findAll({ where, order: [['createdAt', 'DESC']] }));
});

// --- Creator intelligence ---
router.get('/insights', async (req, res) => {
  const clips = await Clip.findAll({ order: [['viralityScore', 'DESC']], limit: 20 });
  const metrics = await Metric.findAll({ limit: 100 });
  const totals = metrics.reduce((a, m) => ({ views: a.views + m.views, likes: a.likes + m.likes, comments: a.comments + m.comments, shares: a.shares + m.shares }), { views: 0, likes: 0, comments: 0, shares: 0 });
  res.json({
    totals,
    topClips: clips.slice(0, 5),
    productionPatterns: {
      avgClipLen: clips.length ? +(clips.reduce((a, c) => a + (c.endSec - c.startSec), 0) / clips.length).toFixed(1) : 0,
      bestHookStyle: 'shock',
      bestPostWindow: '18:00–21:00 IST',
      suggestion: 'Hooks with a number + stakes (“3 mistakes…”) score 12% higher. Keep clips 24–34s for Reels.',
    },
    series: metrics.map((m) => ({ platform: m.platform, views: m.views, likes: m.likes })),
  });
});

// Seed demo metrics
router.post('/insights/seed', async (req, res) => {
  const { projectId } = req.body;
  const plats = ['tiktok', 'reels', 'shorts', 'x'];
  const rows = plats.map((p, i) => ({ projectId, platform: p, views: 5000 + i * 3700 + Math.floor(Math.random() * 2000), likes: 300 + i * 180, comments: 20 + i * 12, shares: 15 + i * 9, retentionPct: 42 + i * 3 }));
  await Metric.bulkCreate(rows);
  res.status(201).json(rows);
});

module.exports = router;
