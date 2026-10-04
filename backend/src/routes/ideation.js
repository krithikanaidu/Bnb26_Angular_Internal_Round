// Ideation routes (AGENT/API.md §5, FEATURES.md Domain 3).
// Mounted at /api and /api/content for full contract compatibility.
const router = require('express').Router();
const { Hook, Script, Project } = require('../models');
const ideation = require('../services/ideation.service');

// Helper to safely extract error message
const errMessage = (e) => (e && e.message) || 'Unknown server error';

// GET /api/hook-patterns (or /api/content/hook-patterns) (API.md §5, F3.2)
router.get(['/hook-patterns', '/patterns'], async (req, res) => {
  try {
    const list = await ideation.listPatterns({ category: req.query.category });
    res.json(list || []);
  } catch (err) {
    console.error('[ideation] listPatterns error:', err);
    res.status(500).json({ error: errMessage(err) });
  }
});

// POST /api/content/hooks/generate → { engine, hooks:[{id,text,category,score,pattern_id}] }
router.post('/hooks/generate', async (req, res) => {
  try {
    const { project_id: projectId, topic, tone = 'punchy', count = 8, niche } = req.body;
    if (!topic || !String(topic).trim()) {
      return res.status(400).json({ error: 'Topic is required to generate hooks.' });
    }
    const cleanTopic = String(topic).trim();
    const countNum = Math.min(12, Math.max(3, Number(count) || 8));

    const { engine, hooks, patterns } = await ideation.generateHooks({
      topic: cleanTopic,
      tone,
      count: countNum,
      niche,
    });

    const saved = [];
    for (const h of hooks) {
      try {
        const row = await Hook.create({
          projectId: projectId || null,
          text: h.text,
          score: h.score,
          style: h.style || h.category,
          category: h.category,
          patternId: h.patternId || null,
        });
        saved.push({
          id: row.id,
          text: row.text,
          category: row.category,
          score: row.score,
          pattern_id: row.patternId,
        });
      } catch (dbErr) {
        // Fallback: return ephemeral hook if db row creation fails
        saved.push({
          id: `hook-${Math.random().toString(36).slice(2, 9)}`,
          text: h.text,
          category: h.category,
          score: h.score,
          pattern_id: h.patternId,
        });
      }
    }

    res.json({
      engine,
      patterns: patterns || [],
      hooks: saved,
    });
  } catch (err) {
    console.error('[ideation] hooks/generate error:', err);
    res.status(500).json({ error: errMessage(err) });
  }
});

// POST /api/content/scripts/generate → { id, engine, content, beats, supporting, version }
// Rich brief accepted: audience, goal, language, cta, keyPoints, avoid, structure, persona, platforms
router.post('/scripts/generate', async (req, res) => {
  try {
    const { project_id: projectId, hook_id: hookId, topic, tone = 'punchy', length_sec: lengthSec = 60, platforms } = req.body;
    const { audience = '', goal = '', language = 'en', cta = '', keyPoints = [], avoid = [], structure, persona = '', workspaceKey = 'default', actor = 'creator' } = req.body;
    let hookText = req.body.hook || '';
    let hookPatternId = null;

    if (hookId) {
      try {
        const h = await Hook.findByPk(hookId);
        if (h) {
          hookText = h.text;
          hookPatternId = h.patternId;
        }
      } catch (findErr) {
        console.warn('[ideation] hook lookup failed, using body hook:', findErr.message);
      }
    }

    if (!hookText && !topic) {
      return res.status(400).json({ error: 'Hook or topic is required to generate script.' });
    }

    let subject = topic;
    if (!subject && projectId) {
      try {
        const p = await Project.findByPk(projectId);
        subject = p?.title;
      } catch (pErr) {
        console.warn('[ideation] project lookup warning:', pErr.message);
      }
    }

    // Default subject if not provided
    if (!subject) {
      subject = hookText ? hookText.replace(/[?!.]$/, '').slice(0, 45) : 'Content Strategy';
    }

    const effectiveHook = hookText || `Here is why ${subject} matters right now.`;

    const { engine, content, beats, supporting, visuals, shotList, teleprompter, meta, brief } = await ideation.generateScript({
      hook: effectiveHook,
      topic: subject,
      tone,
      lengthSec: Number(lengthSec) || 60,
      platforms: Array.isArray(platforms) ? platforms.join(',') : (platforms || 'tiktok,reels,shorts'),
      audience, goal, language, cta, keyPoints, avoid, structure, persona, workspaceKey,
    });

    let scriptRow;
    try {
      scriptRow = await Script.create({
        projectId: projectId || null,
        title: `${subject} script`,
        body: content,
        tone,
        hookPatternId,
        beats,
        supporting,
        visuals: visuals || [],
        shotList: shotList || [],
        teleprompter: teleprompter || '',
        meta: meta || {},
        brief: brief || {},
        audience, goal, language,
        version: 1,
      });

      // Update project status if project exists (idea → scripting)
      if (projectId) {
        try {
          const proj = await Project.findByPk(projectId);
          if (proj && proj.status === 'idea') {
            await proj.update({ status: 'scripting' });
          }
        } catch (statusErr) {
          console.warn('[ideation] project status advance warning:', statusErr.message);
        }
      }
      try {
        const { logFeedback } = require('../services/training.service');
        await logFeedback({ scriptId: scriptRow.id, projectId: projectId || null, eventType: 'generate', actor, meta: { brief } });
      } catch { /* non-blocking */ }
    } catch (saveErr) {
      console.warn('[ideation] script DB save warning:', saveErr.message);
    }

    res.status(201).json({
      id: scriptRow ? scriptRow.id : `script-${Date.now()}`,
      title: `${subject} script`,
      engine,
      content,
      body: content,
      beats,
      supporting,
      visuals: visuals || [],
      shotList: shotList || [],
      teleprompter: teleprompter || '',
      meta: meta || {},
      brief: brief || {},
      version: scriptRow ? scriptRow.version : 1,
    });
  } catch (err) {
    console.error('[ideation] scripts/generate error:', err);
    res.status(500).json({ error: errMessage(err) });
  }
});

// GET /api/content/scripts?projectId= | ?project_id=
router.get('/scripts', async (req, res) => {
  try {
    const id = req.query.project_id || req.query.projectId;
    const rows = await Script.findAll({
      where: id ? { projectId: id } : {},
      order: [['createdAt', 'DESC']],
    });
    res.json(rows || []);
  } catch (err) {
    console.error('[ideation] get scripts error:', err);
    res.status(500).json({ error: errMessage(err) });
  }
});

// PATCH /api/content/scripts/:id — inline editing (F3.3)
router.patch('/scripts/:id', async (req, res) => {
  try {
    const s = await Script.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Script not found' });
    const edited = req.body.content ?? req.body.body ?? s.body;
    const changed = edited !== s.body;
    await s.update({
      body: edited,
      title: req.body.title ?? s.title,
      tone: req.body.tone ?? s.tone,
      beats: req.body.beats ?? s.beats,
      supporting: req.body.supporting ?? s.supporting,
      visuals: req.body.visuals ?? s.visuals,
      shotList: req.body.shotList ?? s.shotList,
      teleprompter: req.body.teleprompter ?? s.teleprompter,
      brief: req.body.brief ?? s.brief,
      audience: req.body.audience ?? s.audience,
      goal: req.body.goal ?? s.goal,
      language: req.body.language ?? s.language,
      version: (Number(s.version) || 1) + 1,
    });
    if (changed) {
      try {
        const { logFeedback } = require('../services/training.service');
        await logFeedback({ scriptId: s.id, projectId: s.projectId, eventType: 'edit', editedBody: edited, meta: { title: s.title } });
      } catch { /* non-blocking */ }
    }
    res.json({
      id: s.id,
      title: s.title,
      body: s.body,
      content: s.body,
      tone: s.tone,
      beats: s.beats,
      supporting: s.supporting,
      visuals: s.visuals,
      shotList: s.shotList,
      teleprompter: s.teleprompter,
      brief: s.brief,
      version: s.version,
    });
  } catch (err) {
    console.error('[ideation] patch script error:', err);
    res.status(500).json({ error: errMessage(err) });
  }
});

// POST /api/content/scripts/:id/beats — split / regenerate beats (F3.4)
router.post('/scripts/:id/beats', async (req, res) => {
  try {
    const s = await Script.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Script not found' });
    const content = req.body.content || s.body;
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const beats = lines.map((line, idx) => ({
      idx,
      text: line.replace(/^[A-Z0-9\s()–-]+:\s*/i, '').trim() || line.trim(),
      importance: idx === 0 ? 1.0 : idx === lines.length - 1 ? 0.8 : 0.7,
    }));
    await s.update({ beats, version: s.version + 1 });
    res.json({ id: s.id, beats, version: s.version });
  } catch (err) {
    console.error('[ideation] beats error:', err);
    res.status(500).json({ error: errMessage(err) });
  }
});

// POST /api/content/scripts/:id/refine { instruction, filters{}, mode:'auto'|'custom', actor:'creator'|'manager', preview:true }
// → returns suggestion WITHOUT overwriting. Caller must PATCH to accept. Logged for training with actor.
router.post('/scripts/:id/refine', async (req, res) => {
  try {
    const s = await Script.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Script not found' });
    const { instruction = '', filters = {}, mode = 'custom', actor = 'creator', preview = true } = req.body;
    const briefOverrides = { ...req.body };
    delete briefOverrides.instruction; delete briefOverrides.filters; delete briefOverrides.mode; delete briefOverrides.actor; delete briefOverrides.preview; delete briefOverrides.content; delete briefOverrides.beats;
    if (mode !== 'auto' && !String(instruction).trim() && Object.keys(filters).length === 0) return res.status(400).json({ error: 'instruction or filters required (or use mode:auto)' });
    const brief = { ...(s.brief || {}), ...briefOverrides };
    const { engine, content, beats, teleprompter, changeSummary } = await ideation.refineScript({
      currentContent: req.body.content || s.body,
      beats: req.body.beats || s.beats || [],
      instruction: String(instruction).trim(),
      brief, filters, mode,
    });
    try {
      const { logFeedback } = require('../services/training.service');
      await logFeedback({ scriptId: s.id, projectId: s.projectId, eventType: mode === 'auto' ? 'auto_improve' : 'refine_preview', instruction, meta: { brief, filters, actor, changeSummary } });
    } catch { /* non-blocking */ }
    // preview-only by default: do NOT bump version until accepted via PATCH
    if (preview === false) {
      await s.update({ body: content, beats: beats?.length ? beats : s.beats, teleprompter: teleprompter || s.teleprompter, brief, version: (Number(s.version) || 1) + 1 });
      return res.json({ id: s.id, engine, content, body: content, beats: s.beats, teleprompter: s.teleprompter, brief, version: s.version, changeSummary, applied: true });
    }
    res.json({ id: s.id, engine, suggestion: content, beats, teleprompter: teleprompter || s.teleprompter, brief, version: s.version, changeSummary, applied: false });
  } catch (err) {
    console.error('[ideation] refine error:', err);
    res.status(500).json({ error: errMessage(err) });
  }
});

// POST /api/content/scripts/:id/feedback { rating, editedBody, instruction, eventType, actor }
// actor: creator|manager (manager weighs 2x). approve/reuse auto-promotes.
router.post('/scripts/:id/feedback', async (req, res) => {
  try {
    const s = await Script.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Script not found' });
    const { rating = null, editedBody = '', instruction = '', eventType = 'rate', actor = 'creator' } = req.body;
    const { logFeedback, promoteToExample } = require('../services/training.service');
    await logFeedback({ scriptId: s.id, projectId: s.projectId, eventType, actor, rating, instruction, editedBody, meta: { ...(req.body.meta || {}), actor } });
    if (eventType === 'edit' && editedBody) {
      await s.update({ body: editedBody, version: (Number(s.version) || 1) + 1 });
    }
    let promoted = false;
    const score = Number(rating);
    const isApprove = (score >= 4 || score === 1) || (['reuse', 'approve', 'auto_improve_accept', 'refine_accept'].includes(eventType));
    if (isApprove) {
      const q = score >= 5 ? 0.98 : score >= 4 || eventType.includes('accept') ? 0.92 : actor === 'manager' ? 0.9 : 0.85;
      await promoteToExample({
        topic: s.title?.replace(/ script$/i, '') || s.brief?.topic || 'untitled',
        brief: { ...(s.brief || {}), tone: s.tone, audience: s.audience, goal: s.goal, language: s.language, workspaceKey: req.body.workspaceKey || s.brief?.workspaceKey || 'default' },
        output: { content: editedBody || s.body, beats: s.beats, supporting: s.supporting, visuals: s.visuals },
        quality: actor === 'manager' ? Math.min(1, q + 0.03) : q, source: 'user-approved', actor,
        styleTags: { tone: s.tone, audience: s.audience },
      });
      promoted = true;
    }
    if (eventType === 'reject' || score === -1 || score === 1 && eventType === 'rate') {
      // down-rank: log only, retrieval penalizes via low approvalCount
    }
    res.json({ ok: true, promoted, version: s.version });
  } catch (err) {
    console.error('[ideation] feedback error:', err);
    res.status(500).json({ error: errMessage(err) });
  }
});

// GET /api/content/training/examples?limit= + GET /training/export.jsonl (fine-tune corpus)
router.get('/training/examples', async (req, res) => {
  try {
    const { ScriptExample } = require('../models');
    const rows = await ScriptExample.findAll({ order: [['quality', 'DESC']], limit: Math.min(100, Number(req.query.limit) || 20) });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: errMessage(err) }); }
});

router.get('/training/export.jsonl', async (req, res) => {
  try {
    const { exportJSONL } = require('../services/training.service');
    const rows = await exportJSONL({ limit: Math.min(500, Number(req.query.limit) || 200) });
    res.type('application/jsonl').send(rows.map((r) => JSON.stringify(r)).join('\n'));
  } catch (err) { res.status(500).json({ error: errMessage(err) }); }
});

// ML loop APIs: profile (style), insights (what learned), recompute (performance join)
router.get('/training/profile', async (req, res) => {
  try {
    const { getProfile } = require('../services/training.service');
    res.json(await getProfile(req.query.workspaceKey || 'default'));
  } catch (err) { res.status(500).json({ error: errMessage(err) }); }
});
router.get('/training/insights', async (req, res) => {
  try {
    const { getInsights } = require('../services/training.service');
    res.json(await getInsights(req.query.workspaceKey || 'default'));
  } catch (err) { res.status(500).json({ error: errMessage(err) }); }
});
router.post('/training/recompute', async (req, res) => {
  try {
    const { recomputePerformance, recomputeProfile } = require('../services/training.service');
    const perf = await recomputePerformance({ limit: 100 });
    const prof = await recomputeProfile(req.body.workspaceKey || 'default');
    res.json({ ok: true, perf, profile: prof });
  } catch (err) { res.status(500).json({ error: errMessage(err) }); }
});

module.exports = router;
