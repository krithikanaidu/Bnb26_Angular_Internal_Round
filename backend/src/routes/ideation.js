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
router.post('/scripts/generate', async (req, res) => {
  try {
    const { project_id: projectId, hook_id: hookId, topic, tone = 'punchy', length_sec: lengthSec = 60, platforms } = req.body;
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

    const { engine, content, beats, supporting } = await ideation.generateScript({
      hook: effectiveHook,
      topic: subject,
      tone,
      lengthSec: Number(lengthSec) || 60,
      platforms: platforms || 'tiktok,reels,shorts',
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
    await s.update({
      body: req.body.content ?? req.body.body ?? s.body,
      title: req.body.title ?? s.title,
      tone: req.body.tone ?? s.tone,
      beats: req.body.beats ?? s.beats,
      supporting: req.body.supporting ?? s.supporting,
      version: (Number(s.version) || 1) + 1,
    });
    res.json({
      id: s.id,
      title: s.title,
      body: s.body,
      content: s.body,
      tone: s.tone,
      beats: s.beats,
      supporting: s.supporting,
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

module.exports = router;
