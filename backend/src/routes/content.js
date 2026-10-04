const router = require('express').Router();
const { Script, Hook, TranscriptSegment, Clip, Asset, EditProject, PublishJob, PlatformVariant, Metric, ConnectedAccount } = require('../models');
const { generateHooks, generateScript } = require('../services/ai.service');
const { alignScriptToTranscript, generateClips, adaptClip, PLATFORM_PRESETS } = require('../services/content.service');
const { adaptMany, validateVariant, readEdl, PRESETS, DEFAULT_PLATFORMS } = require('../services/adaptation.service');
const { getTagsForTopic } = require('../services/trends.service');
const { fetchVideoStats } = require('../services/youtube.service');

// Every handler below try/catches: a bare `await` that throws inside an
// Express 4 async handler never reaches error middleware — it becomes an
// unhandled rejection that hangs the request (and on older boot code killed
// the whole process). Studio fires several of these in parallel, so one
// throw used to blank the entire page.
const errMessage = (e) => (e && e.message) || 'Unknown server error';

// --- Scripts & hooks ---
router.post('/generate-hooks', async (req, res) => {
  try {
    const { topic, count = 5, scriptId, projectId } = req.body;
    const hooks = await generateHooks(topic, count);
    if (scriptId || projectId) {
      for (const h of hooks) await Hook.create({ scriptId: scriptId || null, projectId: projectId || null, text: h.text, style: h.style, score: h.score });
    }
    res.json(hooks);
  } catch (e) {
    console.error('[content] generate-hooks error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});

router.post('/generate-script', async (req, res) => {
  try {
    const { topic, tone = 'energetic', platforms = ['tiktok'], projectId, title } = req.body;
    const body = await generateScript(topic, tone, platforms.join(','));
    const script = await Script.create({ projectId: projectId || null, title: title || `${topic} script`, body: typeof body === 'string' ? body : body.body, tone, targetPlatforms: platforms });
    res.status(201).json(script);
  } catch (e) {
    console.error('[content] generate-script error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});

router.get('/scripts', async (req, res) => {
  try {
    const where = req.query.projectId || req.query.project_id ? { projectId: req.query.projectId || req.query.project_id } : {};
    res.json(await Script.findAll({ where, order: [['createdAt', 'DESC']] }));
  } catch (e) {
    // Same stale-table fallback as the ideation router (this legacy handler
    // answers the same Studio/Scripts calls when mounted second).
    const { isMissingColumnError, listScriptsResilient } = require('../config/ideationSchema');
    if (isMissingColumnError(e)) {
      try {
        const pid = req.query.projectId || req.query.project_id || undefined;
        console.warn('[content] get scripts served via base-column fallback.');
        return res.json(await listScriptsResilient({ projectId: pid }));
      } catch (fallbackErr) {
        console.error('[content] get scripts fallback error:', fallbackErr);
      }
    }
    console.error('[content] get scripts error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});

// --- Script-to-video understanding ---
router.post('/align', async (req, res) => {
  try {
    const { scriptBody, assetId, projectId } = req.body;
    if (!String(scriptBody || '').trim()) {
      return res.status(400).json({ error: 'scriptBody is required — load or write a script before aligning.' });
    }
    const where = assetId ? { assetId } : projectId ? { projectId } : {};
    const segments = await TranscriptSegment.findAll({ where, order: [['startSec', 'ASC']] });
    if (!segments.length) return res.status(400).json({ error: 'No transcript segments for this asset. Upload footage and run transcription first (ClipAI or the Video Editor).' });
    res.json({ alignment: alignScriptToTranscript(scriptBody, segments), segments });
  } catch (e) {
    console.error('[content] align error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});

// --- Automated clip generation ---
router.post('/clips/generate', async (req, res) => {
  try {
    const { assetId, projectId } = req.body;
    const where = assetId ? { assetId } : projectId ? { projectId } : {};
    const segments = await TranscriptSegment.findAll({ where, order: [['startSec', 'ASC']] });
    if (!segments.length) {
      return res.status(400).json({ error: 'No transcript segments to generate from. Upload footage with speech and transcribe it first.' });
    }
    const cands = generateClips(segments);
    const saved = [];
    for (const [i, c] of cands.entries()) {
      saved.push(await Clip.create({ projectId: projectId || segments[0]?.projectId || null, assetId: assetId || segments[0]?.assetId || null, title: `Clip ${i + 1} — ${c.hookText.slice(0, 40)}`, startSec: c.startSec, endSec: c.endSec, viralityScore: c.viralityScore, hookText: c.hookText, captions: [{ t: c.startSec, text: c.hookText }] }));
    }
    res.status(201).json(saved);
  } catch (e) {
    console.error('[content] clips/generate error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});

router.get('/clips', async (req, res) => {
  try {
    const where = req.query.projectId ? { projectId: req.query.projectId } : {};
    res.json(await Clip.findAll({ where, order: [['viralityScore', 'DESC']] }));
  } catch (e) {
    console.error('[content] get clips error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});

// --- AI-assisted editable edits (EDL stays editable) ---
router.post('/edits', async (req, res) => {
  try {
    const { projectId, clipId, platform = 'tiktok', tweaks = {} } = req.body;
    if (!clipId) {
      return res.status(400).json({ error: 'clipId is required — pick the clip this edit is for.' });
    }
    const clip = await Clip.findByPk(clipId);
    if (!clip) return res.status(404).json({ error: 'clip not found' });
    if (!PLATFORM_PRESETS[platform]) {
      return res.status(400).json({ error: `platform must be one of: ${Object.keys(PLATFORM_PRESETS).join(', ')}` });
    }
    const edl = {
      tracks: [{ type: 'video', cuts: [{ start: clip?.startSec ?? 0, end: clip?.endSec ?? 30, speed: 1.1 }] }],
      captions: clip?.captions || [{ t: 0, text: clip?.hookText || 'Hook here' }],
      overlays: [{ type: 'hookTitle', text: clip?.hookText || 'Hook', style: platform }],
      hook: clip?.hookText || '',
      // Empty until the creator writes one: adapt falls back to the platform
      // preset default, so a hardcoded string here would never be honest.
      cta: '',
      ...tweaks,
    };
    const edit = await EditProject.create({ projectId: projectId || null, clipId, edl, platform, aspect: (PLATFORM_PRESETS[platform] || {}).aspect || '9:16' });
    res.status(201).json(edit);
  } catch (e) {
    console.error('[content] create edit error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});
router.get('/edits', async (req, res) => {
  try {
    const where = req.query.projectId ? { projectId: req.query.projectId } : {};
    res.json(await EditProject.findAll({ where, order: [['createdAt', 'DESC']] }));
  } catch (e) {
    console.error('[content] get edits error:', e);
    res.status(500).json({ error: errMessage(e) });
  }
});
router.patch('/edits/:id', async (req, res) => {
  try {
    const e = await EditProject.findByPk(req.params.id);
    if (!e) return res.status(404).json({ error: 'not found' });
    const next = req.body.edl ?? e.edl;
    // An EDL must stay an EDL: tracks/captions arrays are the contract the
    // timeline, adapt and render all read. A bare {} would save fine and break
    // the next read, so reject it with a message instead.
    if (!next || typeof next !== 'object' || !Array.isArray(next.tracks) || !Array.isArray(next.captions)) {
      return res.status(400).json({ error: 'edl must be an object with tracks[] and captions[] arrays.' });
    }
    const changed = JSON.stringify(next) !== JSON.stringify(e.edl);
    await e.update({ edl: next, version: changed ? (Number(e.version) || 1) + 1 : e.version });
    res.json(e);
  } catch (err) {
    console.error('[content] patch edit error:', err);
    res.status(500).json({ error: errMessage(err) });
  }
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
  const { platforms = DEFAULT_PLATFORMS, baseTags = [], cta } = req.body;
  let { topicTags = [], topic = '', niche = '', geo = 'IN' } = req.body;
  const unknown = (platforms || []).filter((p) => !PRESETS[p]);
  if (unknown.length) {
    return res.status(400).json({ error: `unknown platform(s): ${unknown.join(', ')}. Valid: ${Object.keys(PRESETS).join(', ')}` });
  }
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

  // 3. Trend + ROI tags from the internet (skipped when caller supplies tags)
  let trendsMeta = { source: 'caller-supplied', tags: topicTags };
  if (!topicTags.length) {
    const subject = topic || clip.title || '';
    try {
      const { analyzeTrends } = require('../services/trends.service');
      const t = await analyzeTrends({ topic: subject, niche, geo });
      topicTags = t.tags;
      trendsMeta = {
        source: t.source, tags: t.tags, trends: t.trendsScored || t.trends,
        regionInterest: t.regionInterest || null, geo: t.geo || geo,
      };
    } catch (e) {
      console.warn('[adapt] trends failed, continuing tagless:', e.message);
    }
  }

  const adapted = await adaptMany(clip, platforms, {
    baseTags, topicTags, cta,
    edlInfo, edlVersion: edit?.version ?? null, sourceW, sourceH,
    regionInterest: trendsMeta.regionInterest || null, geo,
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

// GET /api/content/trends?topic=&niche=&geo=&regions=IN,US,GB — live trends +
// scored ranking + ROI. Legacy fields (source, trends, tags) preserved.
router.get('/trends', async (req, res) => {
  try {
    const { topic = '', niche = '', geo = 'IN', regions } = req.query;
    const { analyzeTrends } = require('../services/trends.service');
    const list = regions ? String(regions).split(/[^A-Za-z]+/).filter(Boolean) : undefined;
    res.json(await analyzeTrends({ topic, niche, geo, regions: list }));
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
// Accepts accountId: the creator's connected platform identity the post goes out as.
router.post('/publish', async (req, res) => {
  const clipId = req.body.clip_id || req.body.clipId;
  const variantId = req.body.variant_id || req.body.variantId;
  const { projectId, platform, scheduledAt, scheduled_at, caption, hashtags, accountId } = req.body;
  let finalCaption = caption;
  let finalTags = hashtags;
  let project = projectId;
  if (variantId) {
    const v = await PlatformVariant.findByPk(variantId);
    if (!v) return res.status(404).json({ error: 'variant not found' });
    finalCaption = finalCaption ?? v.caption;
    finalTags = finalTags ?? v.hashtags;
  }
  if (!platform || !PRESETS[platform]) {
    return res.status(400).json({ error: `platform must be one of: ${Object.keys(PRESETS).join(', ')}` });
  }
  let account = null;
  if (accountId) {
    account = await ConnectedAccount.findByPk(accountId);
    if (!account) return res.status(404).json({ error: 'connected account not found' });
    if (account.provider !== platform) {
      return res.status(400).json({ error: `account ${account.handle} is a ${account.provider} account, not ${platform}` });
    }
  }
  const at = scheduledAt || scheduled_at;
  // Caption/hashtags come from the variant or the caller. If neither supplied
  // them, store empty and let the UI prompt — do not invent a caption or tag.
  const job = await PublishJob.create({
    projectId: project || null, clipId: clipId || null, variantId: variantId || null,
    accountId: account ? account.id : null,
    platform,
    scheduledAt: at || null,
    caption: finalCaption || '',
    status: at ? 'scheduled' : 'draft',
    hashtags: Array.isArray(finalTags) ? finalTags : [],
  });
  // mode is always 'record': no platform connector is wired up, so this row is
  // a scheduling record, not a published post. Reporting 'simulated' implied a
  // post attempt happened; this says plainly that nothing was uploaded.
  res.status(201).json({ ...job.toJSON(), mode: 'record', posted: false });
});
router.get('/publish', async (req, res) => {
  const where = req.query.projectId ? { projectId: req.query.projectId } : {};
  const jobs = await PublishJob.findAll({ where, order: [['createdAt', 'DESC']] });
  const accounts = await ConnectedAccount.findAll();
  const byId = Object.fromEntries(accounts.map((a) => [a.id, a]));
  // Attach the posting identity (handle) without leaking tokens to the client.
  res.json(jobs.map((j) => {
    const a = byId[j.accountId];
    return {
      ...j.toJSON(),
      account: a ? { id: a.id, provider: a.provider, handle: a.handle, displayName: a.displayName } : null,
    };
  }));
});

// --- Connected platform accounts ---
// The creator links each platform identity once (handle/channel + optional
// token); publish jobs then reference the account instead of hardcoding "me".
router.get('/accounts', async (req, res) => {
  const rows = await ConnectedAccount.findAll({ order: [['provider', 'ASC']] });
  res.json(rows.map((r) => {
    const { accessToken, refreshToken, ...safe } = r.toJSON();
    return safe;
  }));
});

router.post('/accounts', async (req, res) => {
  const { provider, handle, displayName, accessToken, refreshToken, expiresAt } = req.body || {};
  if (!provider || !PRESETS[provider]) {
    return res.status(400).json({ error: `provider must be one of: ${Object.keys(PRESETS).join(', ')}` });
  }
  const cleanHandle = String(handle || '').trim();
  if (!cleanHandle) return res.status(400).json({ error: 'handle is required (e.g. @yourname or channel id).' });
  const [row, created] = await ConnectedAccount.findOrCreate({
    where: { provider, handle: cleanHandle },
    defaults: { displayName: displayName || null, accessToken: accessToken || null, refreshToken: refreshToken || null, expiresAt: expiresAt || null },
  });
  if (!created) {
    await row.update({
      displayName: displayName ?? row.displayName,
      accessToken: accessToken ?? row.accessToken,
      refreshToken: refreshToken ?? row.refreshToken,
      expiresAt: expiresAt ?? row.expiresAt,
    });
  }
  const { accessToken: _a, refreshToken: _r, ...safe } = row.toJSON();
  res.status(created ? 201 : 200).json(safe);
});

router.delete('/accounts/:id', async (req, res) => {
  const a = await ConnectedAccount.findByPk(req.params.id);
  if (!a) return res.status(404).json({ error: 'account not found' });
  await a.destroy();
  res.json({ ok: true });
});

// POST /api/content/publish/:id/retry — clone a failed job as scheduled-now
router.post('/publish/:id/retry', async (req, res) => {
  const j = await PublishJob.findByPk(req.params.id);
  if (!j) return res.status(404).json({ error: 'job not found' });
  const clone = await PublishJob.create({
    projectId: j.projectId, clipId: j.clipId, variantId: j.variantId, accountId: j.accountId, platform: j.platform,
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

// --- Creator intelligence (analytics + trends + ROI + growth loop) ---
// Backwards-compatible: legacy fields (totals, topClips, productionPatterns,
// series) are preserved; new blocks (platforms, regions/ROI, hookCategories,
// trends, growth, personalization) are additive.
router.get('/insights', async (req, res) => {
  try {
    const analytics = require('../services/analytics.service');
    const { projectId, project_id, platform, region, geo, days, topic, niche } = req.query;
    const agg = await analytics.aggregateMetrics({
      projectId: projectId || project_id || undefined,
      platform: platform || undefined,
      region: region || geo || undefined,
      days: days ? Number(days) : 30,
    });
    const subject = topic || '';
    let trendsScored = [], regionInterest = null, tags = [];
    try {
      const trendsSvc = require('../services/trends.service');
      if (subject || region || geo) {
        const t = await trendsSvc.analyzeTrends({ topic: subject, niche: niche || '', geo: region || geo || 'IN' });
        trendsScored = t.trendsScored || [];
        regionInterest = t.regionInterest || null;
        tags = t.tags || [];
      }
    } catch (e) { console.warn('[insights] trends failed:', e.message); }
    let growth = { recommendations: [], narrative: null, engine: 'heuristic' };
    try {
      growth = await analytics.growthRecommendations({ aggregate: agg, trends: trendsScored, regionInterest, topic: subject });
    } catch (e) { console.warn('[insights] growth failed:', e.message); }
    const bestPlatform = agg.platforms[0] ? { platform: agg.platforms[0].platform, views: agg.platforms[0].views } : null;
    const suggestion = agg.clipCount
      ? `Based on ${agg.clipCount} clip${agg.clipCount === 1 ? '' : 's'}: average length ${agg.avgClipLen}s`
        + `${bestPlatform ? `, most views on ${bestPlatform.platform} (${bestPlatform.views.toLocaleString()})` : ''}`
        + `${regionInterest?.topRegion ? `, top ROI: ${regionInterest.topRegion.label}` : ''}.`
      : null;
    res.json({
      totals: agg.totals,
      topClips: agg.topClips,
      productionPatterns: {
        avgClipLen: agg.avgClipLen,
        clipCount: agg.clipCount,
        metricCount: agg.metricCount,
        bestPlatform,
        bestHookStyle: agg.hookCategories[0] || null,
        bestPostWindow: agg.bestHour,
        suggestion,
      },
      // New growth blocks:
      platforms: agg.platforms,
      regions: agg.regions, // ROI from real performance
      hookCategories: agg.hookCategories,
      durations: agg.durations,
      trends: trendsScored,
      regionInterest, // ROI from live topic interest
      tags,
      growth,
      sampleNote: agg.sampleNote,
      series: [], // filled below for compat (metrics list)
      _seriesNote: 'series omitted by default; pass ?series=1 (caps at 100 rows)',
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'insights unavailable' });
  }
});

// GET /api/content/analytics/summary?projectId=&platform=&region=&days=30 —
// machine-readable aggregate for dashboards (same queries as the script).
router.get('/analytics/summary', async (req, res) => {
  try {
    const analytics = require('../services/analytics.service');
    const { projectId, project_id, platform, region, geo, days } = req.query;
    res.json(await analytics.aggregateMetrics({
      projectId: projectId || project_id || undefined,
      platform: platform || undefined,
      region: region || geo || undefined,
      days: days ? Number(days) : 30,
    }));
  } catch (e) { res.status(500).json({ error: e.message || 'analytics unavailable' }); }
});

// GET /api/content/analytics/growth?topic=&niche=&projectId=&region= —
// heuristic recs + 1 cheap LLM narrative (cascade, cached 1h).
router.get('/analytics/growth', async (req, res) => {
  try {
    const analytics = require('../services/analytics.service');
    const trendsSvc = require('../services/trends.service');
    const { projectId, project_id, platform, region, geo, days, topic = '', niche = '' } = req.query;
    const aggregate = await analytics.aggregateMetrics({
      projectId: projectId || project_id || undefined,
      platform: platform || undefined,
      region: region || geo || undefined,
      days: days ? Number(days) : 30,
    });
    const t = await trendsSvc.analyzeTrends({ topic, niche, geo: region || geo || 'IN' });
    res.json({
      ...(await analytics.growthRecommendations({ aggregate, trends: t.trendsScored, regionInterest: t.regionInterest, topic })),
      trends: t.trendsScored, regionInterest: t.regionInterest, tags: t.tags,
    });
  } catch (e) { res.status(500).json({ error: e.message || 'growth unavailable' }); }
});

// POST /api/content/feedback — creator feedback loop signal.
// Body: { projectId?, clipId?, variantId?, hookId?, scriptId?, kind: accept|reject|edit|regenerate|up|down, score?, region?, payload? }
router.post('/feedback', async (req, res) => {
  try {
    const analytics = require('../services/analytics.service');
    const row = await analytics.recordFeedback({
      projectId: req.body.projectId || req.body.project_id,
      clipId: req.body.clipId || req.body.clip_id,
      variantId: req.body.variantId || req.body.variant_id,
      hookId: req.body.hookId || req.body.hook_id,
      scriptId: req.body.scriptId || req.body.script_id,
      kind: req.body.kind || 'up',
      score: req.body.score,
      region: req.body.region || req.body.geo,
      payload: req.body.payload || { note: req.body.note },
    });
    res.status(201).json({ ok: true, id: row.id, kind: row.kind, score: row.score });
  } catch (e) { res.status(500).json({ error: e.message || 'feedback unavailable' }); }
});

// POST /content/metrics — record real numbers for a post (manual bridge until
// each platform has an importer). Body: { platform*, views, likes, comments,
// shares, retentionPct, clipId?, projectId?, region? (IN/US/GB…), source='manual', externalId? }
router.post('/metrics', async (req, res) => {
  const { platform, views, likes, comments, shares, retentionPct, clipId, projectId, region, geo, source = 'manual', externalId } = req.body || {};
  if (!platform || !PRESETS[platform]) {
    return res.status(400).json({ error: `platform must be one of: ${Object.keys(PRESETS).join(', ')}` });
  }
  const { normalizeRegion } = require('../services/geo.service');
  const num = (v) => (v == null || v === '' ? 0 : Math.max(0, Number(v) || 0));
  const row = await Metric.create({
    platform,
    region: region || geo ? normalizeRegion(region || geo) : null,
    views: num(views), likes: num(likes), comments: num(comments),
    shares: num(shares), retentionPct: num(retentionPct),
    clipId: clipId || null, projectId: projectId || null,
    source, externalId: externalId || null,
  });
  res.status(201).json(row);
});

// GET /content/youtube/status — is the dynamic source configured?
router.get('/youtube/status', (req, res) => {
  res.json({ configured: !!process.env.YOUTUBE_API_KEY });
});

// POST /content/youtube/stats { url|videoId, clipId?, projectId? } — pull REAL
// public stats for a YouTube video via Data API v3 and store them as a Metric
// (platform 'shorts', source 'youtube'). Re-syncing the same video updates the
// row instead of duplicating it.
router.post('/youtube/stats', async (req, res) => {
  try {
    const { url, videoId, clipId, projectId } = req.body || {};
    const stats = await fetchVideoStats(url || videoId || '');
    const [row, created] = await Metric.findOrCreate({
      where: { source: 'youtube', externalId: stats.videoId },
      defaults: {
        platform: 'shorts', views: stats.views, likes: stats.likes, comments: stats.comments,
        shares: 0, retentionPct: 0, clipId: clipId || null, projectId: projectId || null,
      },
    });
    if (!created) {
      await row.update({
        views: stats.views, likes: stats.likes, comments: stats.comments,
        clipId: clipId || row.clipId, projectId: projectId || row.projectId,
      });
    }
    res.status(created ? 201 : 200).json({ metric: row, stats });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

module.exports = router;
