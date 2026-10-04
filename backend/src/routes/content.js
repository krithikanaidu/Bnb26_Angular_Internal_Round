const router = require('express').Router();
const { Script, Hook, TranscriptSegment, Clip, Asset, EditProject, PublishJob, PlatformVariant, Metric } = require('../models');
const { generateHooks, generateScript } = require('../services/ai.service');
const { alignScriptToTranscript, generateClips, adaptClip, PLATFORM_PRESETS } = require('../services/content.service');
const { adaptMany, validateVariant, readEdl, PRESETS } = require('../services/adaptation.service');
const { getTagsForTopic } = require('../services/trends.service');

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
// NOTE: content-only pipeline. No MP4 is rendered here — output is timestamps +
// EDL JSON (editable plan). Real video render (FFmpeg, F6.9) is planned, not live.
router.post('/align', async (req, res) => {
  try {
    const { scriptBody, assetId, projectId } = req.body;
    if (!scriptBody || !String(scriptBody).trim()) return res.status(400).json({ error: 'scriptBody is required. Paste a script first.' });
    const where = assetId ? { assetId } : projectId ? { projectId } : {};
    const segments = await TranscriptSegment.findAll({ where, order: [['startSec', 'ASC']] });
    if (!segments.length) return res.status(400).json({ error: 'No transcript segments. Upload footage first (demo segments auto-seed on upload).', code: 'NO_TRANSCRIPT' });
    res.json({ alignment: alignScriptToTranscript(scriptBody, segments), segments, mode: 'content-only' });
  } catch (e) { res.status(500).json({ error: e.message || 'align failed' }); }
});

// --- Automated clip generation ---
router.post('/clips/generate', async (req, res) => {
  try {
    const { assetId, projectId } = req.body;
    const where = assetId ? { assetId } : projectId ? { projectId } : {};
    const segments = await TranscriptSegment.findAll({ where, order: [['startSec', 'ASC']] });
    if (!segments.length) return res.status(400).json({ error: 'No transcript segments. Upload a video first — transcript auto-seeds on upload.', code: 'NO_TRANSCRIPT' });
    const cands = generateClips(segments);
    if (!cands.length) return res.status(400).json({ error: 'Footage too short for a 20s+ clip. Upload a longer video or lower minLen.', code: 'TOO_SHORT' });
    const saved = [];
    for (const [i, c] of cands.entries()) {
      saved.push(await Clip.create({ projectId: projectId || segments[0]?.projectId || null, assetId: assetId || segments[0]?.assetId || null, title: `Clip ${i + 1} — ${(c.hookText || 'highlight').slice(0, 40)}`, startSec: c.startSec, endSec: c.endSec, viralityScore: c.viralityScore, hookText: c.hookText, captions: [{ t: c.startSec, text: c.hookText }] }));
    }
    res.status(201).json(saved);
  } catch (e) { res.status(500).json({ error: e.message || 'clip generation failed' }); }
});

router.get('/clips', async (req, res) => {
  try {
    const where = req.query.projectId ? { projectId: req.query.projectId } : {};
    res.json(await Clip.findAll({ where, order: [['viralityScore', 'DESC']] }));
  } catch (e) { res.status(500).json({ error: e.message || 'list clips failed' }); }
});

// --- AI-assisted editable edits (EDL stays editable) ---
router.post('/edits', async (req, res) => {
  try {
    const { projectId, clipId, platform = 'tiktok', tweaks = {} } = req.body;
    const clip = clipId ? await Clip.findByPk(clipId).catch(() => null) : null;
    const edl = {
      tracks: [{ type: 'video', cuts: [{ start: clip?.startSec ?? 0, end: clip?.endSec ?? 30, speed: 1.1 }] }],
      captions: clip?.captions || [{ t: 0, text: clip?.hookText || 'Hook here' }],
      overlays: [{ type: 'hookTitle', text: clip?.hookText || 'Hook', style: platform }],
      hook: clip?.hookText || '',
      cta: 'Follow for part 2',
      ...tweaks,
    };
    const edit = await EditProject.create({ projectId: projectId || clip?.projectId || null, clipId: clip?.id || null, edl, platform, aspect: (PLATFORM_PRESETS[platform] || {}).aspect || '9:16' });
    res.status(201).json(edit);
  } catch (e) { res.status(500).json({ error: e.message || 'edit creation failed' }); }
});
router.get('/edits', async (req, res) => {
  try {
    const where = req.query.projectId ? { projectId: req.query.projectId } : {};
    res.json(await EditProject.findAll({ where, order: [['createdAt', 'DESC']] }));
  } catch (e) { res.status(500).json({ error: e.message || 'list edits failed' }); }
});
router.patch('/edits/:id', async (req, res) => {
  try {
    const e = await EditProject.findByPk(req.params.id);
    if (!e) return res.status(404).json({ error: 'not found' });
    await e.update({ edl: req.body.edl ?? e.edl, version: e.version + 1 });
    res.json(e);
  } catch (e2) { res.status(500).json({ error: e2.message || 'edit update failed' }); }
});

// --- Multi-platform adaptation (Domain 7: F7.1–F7.4) ---
// POST /api/content/adapt { clip_id|clipId, platforms[], baseTags[], topicTags[],
//   topic, niche, geo, cta }
// → { engine, variants: [...], edl: {version, ctaSource, captionStyle}|null,
//     trends: {source, tags} }
// EDL: reads the clip's LATEST EditProject (CTA, caption style, crop focus) but
// never writes it — re-adapting after a Studio edit picks up the new version.
// Tags: explicit topicTags win; else auto-fetched from the internet (Google
// Trends + Groq niche tags) for the given topic/niche.
router.post('/adapt', async (req, res) => {
  const clipId = req.body.clip_id || req.body.clipId;
  const { platforms = ['tiktok', 'reels', 'shorts'], baseTags = [], cta } = req.body;
  let { topicTags = [], topic = '', niche = '', geo = 'IN' } = req.body;
  const clip = await Clip.findByPk(clipId);
  if (!clip) return res.status(404).json({ error: 'clip not found' });

  // 1. EDL — latest version for this clip (assumes another feature owns clips/EDLs)
  const edit = await EditProject.findOne({ where: { clipId: clip.id }, order: [['version', 'DESC']] });
  const edlInfo = readEdl(edit?.edl || {});
  const edlMeta = edit ? { version: edit.version, ctaSource: edlInfo.cta ? `EDL v${edit.version}` : 'preset default', captionStyle: edlInfo.captionStyle || null } : null;

  // 2. Source footage dimensions for the reframe plan (asset meta → else 16:9)
  let sourceW = 1920, sourceH = 1080;
  try {
    if (clip.assetId) {
      const asset = await Asset.findByPk(clip.assetId);
      const mw = Number(asset?.meta?.width), mh = Number(asset?.meta?.height);
      if (mw > 0 && mh > 0) { sourceW = mw; sourceH = mh; }
    }
  } catch { /* meta optional */ }

  // 3. Trend + niche tags from the internet (skipped when caller supplies tags)
  let trendsMeta = { source: 'caller-supplied', tags: topicTags };
  if (!topicTags.length) {
    const subject = topic || clip.title || '';
    try {
      const t = await getTagsForTopic({ topic: subject, niche, geo });
      topicTags = t.tags;
      trendsMeta = { source: t.source, tags: t.tags, trends: t.trends };
    } catch (e) {
      console.warn('[adapt] trends failed, continuing tagless:', e.message);
    }
  }

  const adapted = await adaptMany(clip, platforms, {
    baseTags, topicTags, cta,
    edlInfo, edlVersion: edit?.version ?? null, sourceW, sourceH,
  });
  const saved = [];
  for (const v of adapted) {
    const existing = await PlatformVariant.findOne({ where: { clipId: clip.id, platform: v.platform } });
    const row = existing
      ? await existing.update({ ...v, clipId: clip.id })
      : await PlatformVariant.create({ ...v, clipId: clip.id });
    saved.push({ ...row.toJSON(), preset: PRESETS[v.platform], actions: v.actions });
  }
  res.json({ engine: adapted[0]?.engine || 'heuristic', variants: saved, edl: edlMeta, trends: trendsMeta });
});

// GET /api/content/trends?topic=&niche=&geo= — live trend titles + suggested tags
router.get('/trends', async (req, res) => {
  try {
    const { topic = '', niche = '', geo = 'IN' } = req.query;
    res.json(await getTagsForTopic({ topic, niche, geo }));
  } catch (e) {
    res.status(500).json({ error: e.message || 'trends unavailable' });
  }
});

// Legacy shape compat: some callers expect a bare array
router.post('/adapt-legacy', async (req, res) => {
  const { clipId, platforms = ['tiktok', 'reels', 'shorts'] } = req.body;
  const clip = await Clip.findByPk(clipId);
  if (!clip) return res.status(404).json({ error: 'clip not found' });
  res.json(platforms.map((p) => adaptClip(clip, p)));
});

// GET /api/content/clips/:id/variants — list variants for a clip
router.get('/clips/:id/variants', async (req, res) => {
  const rows = await PlatformVariant.findAll({ where: { clipId: req.params.id }, order: [['platform', 'ASC']] });
  res.json(rows.map((r) => ({ ...r.toJSON(), preset: PRESETS[r.platform] })));
});

// PATCH /api/content/variants/:id — edit caption/title/hashtags/cta, revalidate (F7.3)
router.patch('/variants/:id', async (req, res) => {
  const v = await PlatformVariant.findByPk(req.params.id);
  if (!v) return res.status(404).json({ error: 'variant not found' });
  const preset = PRESETS[v.platform];
  const next = {
    title: req.body.title ?? v.title,
    caption: req.body.caption ?? v.caption,
    hashtags: req.body.hashtags ?? v.hashtags,
    cta: req.body.cta ?? v.cta,
  };
  const warnings = validateVariant({ ...next, duration: v.duration }, preset);
  await v.update({ ...next, warnings, status: warnings.some((w) => ['DURATION_OVER', 'CAPTION_OVER'].includes(w.code)) ? 'needs_attention' : 'ready' });
  res.json({ ...v.toJSON(), preset });
});

// --- Publish workflow ---
// Accepts variant_id|variantId: caption/hashtags default from the variant (F7.3 → F8.1)
router.post('/publish', async (req, res) => {
  const clipId = req.body.clip_id || req.body.clipId;
  const variantId = req.body.variant_id || req.body.variantId;
  const { projectId, platform, scheduledAt, scheduled_at, caption, hashtags } = req.body;
  let finalCaption = caption;
  let finalTags = hashtags;
  let project = projectId;
  if (variantId) {
    const v = await PlatformVariant.findByPk(variantId);
    if (!v) return res.status(404).json({ error: 'variant not found' });
    finalCaption = finalCaption ?? v.caption;
    finalTags = finalTags ?? v.hashtags;
  }
  const at = scheduledAt || scheduled_at;
  const job = await PublishJob.create({
    projectId: project || null, clipId: clipId || null, variantId: variantId || null,
    platform, scheduledAt: at || null, caption: finalCaption || 'New drop',
    status: at ? 'scheduled' : 'draft', hashtags: finalTags || ['#creatorai', `#${platform}`],
  });
  res.status(201).json({ ...job.toJSON(), mode: 'simulated' });
});
router.get('/publish', async (req, res) => {
  const where = req.query.projectId ? { projectId: req.query.projectId } : {};
  res.json(await PublishJob.findAll({ where, order: [['createdAt', 'DESC']] }));
});

// POST /api/content/publish/:id/retry — clone a failed job as scheduled-now
router.post('/publish/:id/retry', async (req, res) => {
  const j = await PublishJob.findByPk(req.params.id);
  if (!j) return res.status(404).json({ error: 'job not found' });
  const clone = await PublishJob.create({
    projectId: j.projectId, clipId: j.clipId, variantId: j.variantId, platform: j.platform,
    scheduledAt: new Date(), caption: j.caption, status: 'scheduled', hashtags: j.hashtags,
  });
  res.status(201).json(clone);
});

// DELETE /api/content/publish/:id — cancel a scheduled/draft job
router.delete('/publish/:id', async (req, res) => {
  const j = await PublishJob.findByPk(req.params.id);
  if (!j) return res.status(404).json({ error: 'job not found' });
  if (!['scheduled', 'draft'].includes(j.status)) return res.status(409).json({ error: `cannot cancel a ${j.status} job` });
  await j.destroy();
  res.json({ ok: true });
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
