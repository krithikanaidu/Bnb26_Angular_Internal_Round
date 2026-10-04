// ClipAI routes: upload a long video → background job renders viral shorts,
// plus the interactive per-clip controls that let you steer a result after the
// fact (change the in/out points, rewrite the hook, restyle captions, re-render
// one clip) without paying for a whole new job.
'use strict';

const path = require('path');
const fs = require('fs');
const router = require('express').Router();
const multer = require('multer');
const { ClipJob, Clip } = require('../models');
const { enqueue, MEDIA_ROOT, resolveOptions } = require('../clippedai/jobs');
const { isYouTubeUrl, inspect: inspectYouTube } = require('../clippedai/youtube');
const { renderOne, CAPTION_STYLES, normaliseStyle } = require('../clippedai/pipeline');
const { writeClipCopy } = require('../clippedai/ai');
const { safeFilename } = require('../clippedai/titles');
const { selectClips } = require('../clippedai/score');
const { scrubRange } = require('../clippedai/transcribe');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(MEDIA_ROOT, 'uploads');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const safe = path.basename(file.originalname).replace(/[^\w\-. ()]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB source videos
  fileFilter: (req, file, cb) => {
    if (/^video\//.test(file.mimetype) || /\.(mp4|mov|mkv|webm|avi)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only video files are accepted'));
  },
});

/** projectId arrives as string|null|undefined (FormData stringifies!) — normalize to UUID-or-null. */
function cleanProjectId(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || s === 'undefined' || s === 'null') return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    throw new Error('Invalid project selected — please re-pick it from the list.');
  }
  return s;
}

const toBool = (v, d) => (v === undefined || v === null ? d : v === true || v === 'true' || v === '1');

/** Trim + bound any free-text field the UI can edit. */
function text(v, max) {
  if (v === undefined) return undefined;
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

function list(v, max, per) {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return undefined;
  return v.map((x) => text(x, per)).filter(Boolean).slice(0, max);
}

/** Word timings for a finished job (transcription is cached on disk). */
function loadWords(job) {
  const p = path.join(MEDIA_ROOT, job.id, 'transcription.json');
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(data.words) ? data : null;
  } catch {
    return null;
  }
}

async function findJob(req, res) {
  const job = await ClipJob.findByPk(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'job not found' });
    return null;
  }
  return job;
}

// Pre-flight: title/duration/thumbnail for a YouTube link (no download).
router.post('/inspect', async (req, res) => {
  try {
    res.json(await inspectYouTube(req.body?.url));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Create job: EITHER multipart { video } OR JSON { youtubeUrl } (+ options).
router.post('/jobs', upload.single('video'), async (req, res) => {
  try {
    const b = req.body || {};
    const options = {
      maxClips: Math.max(1, Math.min(12, parseInt(b.maxClips, 10) || 4)),
      minLen: Math.max(5, parseInt(b.minLen, 10) || 20),
      maxLen: Math.max(10, parseInt(b.maxLen, 10) || 60),
      subtitles: toBool(b.subtitles, true),
      portrait: toBool(b.portrait, true),
      captionStyle: normaliseStyle(b.captionStyle || 'karaoke'),
      reframe: b.reframe === 'center' || b.reframe === 'off' ? b.reframe : 'auto',
    };
    if (options.maxLen <= options.minLen) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch { /* noop */ } }
      return res.status(400).json({ error: 'maxLen must be greater than minLen' });
    }

    let sourceName = null;
    let sourcePath = null;
    if (req.file) {
      sourceName = req.file.originalname;
      sourcePath = req.file.path;
    } else if (typeof b.youtubeUrl === 'string' && b.youtubeUrl.trim()) {
      if (!isYouTubeUrl(b.youtubeUrl)) {
        return res.status(400).json({ error: 'That does not look like a YouTube link (watch / shorts / youtu.be).' });
      }
      options.youtubeUrl = b.youtubeUrl.trim();
      // Friendly name now; real title lands after inspect/download.
      sourceName = 'YouTube video';
    } else {
      return res.status(400).json({ error: 'video file or youtubeUrl required' });
    }

    const job = await ClipJob.create({
      projectId: cleanProjectId(b.projectId),
      sourceName,
      sourcePath,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      options,
      outputs: [],
    });
    enqueue(job.id);
    res.status(201).json(job);
  } catch (e) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch { /* noop */ } }
    const status = e.message && e.message.startsWith('Invalid project') ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

router.get('/jobs', async (req, res) => {
  const where = req.query.projectId ? { projectId: req.query.projectId } : {};
  const jobs = await ClipJob.findAll({ where, order: [['createdAt', 'DESC']], limit: 50 });
  res.json(jobs.map(annotateFiles));
});

router.get('/jobs/:id', async (req, res) => {
  const job = await findJob(req, res);
  if (!job) return;
  res.json(annotateFiles(job));
});

router.delete('/jobs/:id', async (req, res) => {
  const job = await findJob(req, res);
  if (!job) return;
  const dir = path.join(MEDIA_ROOT, job.id);
  try {
    if (job.sourcePath && fs.existsSync(job.sourcePath)) fs.unlinkSync(job.sourcePath);
  } catch { /* noop */ }
  // Drop the Clip rows this job produced so Studio doesn't show dead entries.
  try {
    const rows = await Clip.findAll({ where: { status: 'rendered' } });
    for (const row of rows) {
      if (row.meta?.jobId === job.id) await row.destroy();
    }
  } catch (e) {
    console.warn('[clipai] could not clear clip rows:', e.message);
  }
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* noop */ }
  await job.destroy();
  res.json({ ok: true });
});

/**
 * Transcript + every scored candidate for a finished job.
 * The UI uses this to show what was actually said and to let the creator pick
 * a different moment than the AI chose.
 */
router.get('/jobs/:id/transcript', async (req, res) => {
  const job = await findJob(req, res);
  if (!job) return;
  const cached = loadWords(job);
  const t = job.transcript || {};
  res.json({
    mode: t.mode || (cached ? cached.mode : null),
    provider: t.provider || null,
    model: t.model || null,
    warning: t.warning || null,
    duration: cached?.duration || 0,
    language: process.env.CLIPAI_LANGUAGE || 'auto',
    segments: t.segments || [],
    candidates: t.candidates || [],
    hasWords: !!cached,
  });
});

/** Recompute candidates for a fresh in/out + duration range, without rendering. */
router.post('/jobs/:id/candidates', async (req, res) => {
  const job = await findJob(req, res);
  if (!job) return;
  const cached = loadWords(job);
  if (!cached) return res.status(409).json({ error: 'No transcript for this job yet — run it first.' });
  const b = req.body || {};
  const opts = resolveOptions(job);
  const minLen = Math.max(5, parseInt(b.minLen, 10) || opts.minLen || 20);
  const maxLen = Math.max(minLen + 1, parseInt(b.maxLen, 10) || opts.maxLen || 60);
  res.json({
    candidates: selectClips({ words: cached.words, segments: job.transcript?.segments || [] }, {
      minLen, maxLen, maxClips: 12,
    }),
  });
});

/** Turn a free-text edit set into safe render overrides. */
function overridesFrom(body, base = {}) {
  const o = { ...base };
  const put = (key, value) => { if (value !== undefined) o[key] = value; };
  put('title', text(body.title, 80));
  put('hook', text(body.hook, 80));
  put('poll', text(body.poll, 90));
  put('cta', text(body.cta, 50));
  put('pollOptions', list(body.pollOptions, 3, 28));
  put('hashtags', list(body.hashtags, 5, 24));
  if (body.captionStyle !== undefined) o.captionStyle = normaliseStyle(body.captionStyle);
  if (body.reframe !== undefined) o.reframe = body.reframe === 'center' || body.reframe === 'off' ? body.reframe : 'auto';
  if (body.portrait !== undefined) o.portrait = toBool(body.portrait, true);
  if (body.subtitles !== undefined) o.subtitles = toBool(body.subtitles, true);
  const num = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
  put('startSec', num(body.startSec));
  put('endSec', num(body.endSec));
  return o;
}

/**
 * Render one clip from scratch — used for a manual pick ("clip THIS part") and
 * as the re-render path when a clip's look changes.
 */
async function renderAndStore({ job, words, index, overrides, append = false }) {
  const jobDir = path.join(MEDIA_ROOT, job.id);
  const options = resolveOptions(job);
  const start = Number(overrides.startSec);
  const end = Number(overrides.endSec);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 1) {
    const err = new Error('Provide a valid in/out range of at least 1 second.');
    err.status = 400;
    throw err;
  }
  // Keep manual picks inside the source.
  const duration = Number(job.transcript?.duration) || 0;
  const maxEnd = duration ? duration + 1 : Infinity;
  const safeEnd = Math.min(end, start + 600, maxEnd);
  if (safeEnd - start < 1) {
    const err = new Error('That range is outside the video.');
    err.status = 400;
    throw err;
  }

  // Dynamic only: copy/titles derive from spoken words minus hallucinated loops.
  const clipText = scrubRange(words, start, safeEnd).map((w) => w.word).join(' ');
  const clip = {
    start_time: start,
    end_time: safeEnd,
    text: clipText,
    score: 0.5,
    reason: append ? 'manually picked' : '',
  };

  const out = await renderOne({
    Clip, job, words, clip, index, jobDir, options, overrides,
  });
  return out;
}

/**
 * Add a clip for an arbitrary in/out range. This is the escape hatch that makes
 * the tool interactive rather than one-shot: the creator can cut any moment the
 * transcript contains.
 */
router.post('/jobs/:id/clips', async (req, res) => {
  const job = await findJob(req, res);
  if (!job) return;
  try {
    const cached = loadWords(job);
    if (!cached) return res.status(409).json({ error: 'No transcript for this job yet — run it first.' });
    if (!job.sourcePath || !fs.existsSync(job.sourcePath)) {
      return res.status(409).json({ error: 'Source video is gone — re-upload it.' });
    }
    const body = req.body || {};
    const start = Number(body.startSec);
    const end = Number(body.endSec);

    // No explicit copy supplied → let the AI write it for this exact range.
    let overrides = overridesFrom(body);
    if (!overrides.title && !overrides.hook) {
      const copy = await writeClipCopy({
        text: scrubRange(cached.words, start, end).map((w) => w.word).join(' '),
        duration: end - start,
        index: (job.outputs || []).length,
      });
      overrides = {
        ...overrides,
        title: copy.title,
        hook: copy.hook,
        poll: copy.pollQuestion,
        pollOptions: copy.pollOptions,
        cta: copy.cta,
        hashtags: copy.hashtags,
      };
    }

    const outputs = [...(job.outputs || [])];
    const out = await renderAndStore({
      job, words: cached.words, index: outputs.length, overrides, append: true,
    });
    outputs.push(out);
    await job.update({ outputs });
    res.status(201).json({ output: out, outputs });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

/** Update a clip's copy instantly (no re-render). */
router.patch('/jobs/:id/clips/:index', async (req, res) => {
  const job = await findJob(req, res);
  if (!job) return;
  const index = Number(req.params.index);
  const outputs = [...(job.outputs || [])];
  if (!Number.isInteger(index) || index < 0 || index >= outputs.length) {
    return res.status(404).json({ error: 'clip not found' });
  }
  const prev = outputs[index];
  const next = { ...prev, ...overridesFrom(req.body || {}, {}) };

  // Keep the stored copy and the rendered filename in sync so downloads match.
  // Only move the pointer when the file actually landed: a failed rename used
  // to update `file` anyway, leaving a dangling pointer (download 404).
  if (next.title && next.title !== prev.title) {
    const dir = path.join(MEDIA_ROOT, job.id);
    const oldPath = path.join(dir, decodeURIComponent(String(prev.file).split('/').pop()));
    const newName = `${safeFilename(next.title).trim() || `clip-${index + 1}`}.mp4`;
    const newPath = path.join(dir, newName);
    if (oldPath !== newPath) {
      let moved = fs.existsSync(newPath);
      try { if (fs.existsSync(oldPath) && !moved) { fs.renameSync(oldPath, newPath); moved = true; } } catch { /* noop */ }
      if (moved) {
        next.file = `/media/clippedai/${job.id}/${encodeURIComponent(newName)}`;
      }
    }
    if (next.copy) next.copy = { ...next.copy, title: next.title };
  }
  if (next.copy) {
    next.copy = {
      ...next.copy,
      hook: next.hook ?? next.copy.hook,
      pollQuestion: next.poll ?? next.copy.pollQuestion,
      pollOptions: next.pollOptions ?? next.copy.pollOptions,
      cta: next.cta ?? next.copy.cta,
      hashtags: next.hashtags ?? next.copy.hashtags,
    };
  }

  outputs[index] = next;
  await job.update({ outputs });

  if (next.clipId) {
    try {
      const row = await Clip.findByPk(next.clipId);
      if (row) {
        await row.update({
          title: next.title,
          hookText: next.hook || row.hookText,
          meta: { ...(row.meta || {}), file: next.file, overlays: { hook: next.hook, poll: next.poll, pollOptions: next.pollOptions, cta: next.cta }, hashtags: next.hashtags || [] },
        });
      }
    } catch (e) {
      console.warn('[clipai] clip row update failed:', e.message);
    }
  }
  res.json(next);
});

/**
 * Re-render one clip with new settings (caption style, framing, in/out points).
 * This is the expensive one — it runs ffmpeg again for that clip only.
 */
router.post('/jobs/:id/clips/:index/rerender', async (req, res) => {
  const job = await findJob(req, res);
  if (!job) return;
  const index = Number(req.params.index);
  const outputs = [...(job.outputs || [])];
  if (!Number.isInteger(index) || index < 0 || index >= outputs.length) {
    return res.status(404).json({ error: 'clip not found' });
  }
  try {
    const cached = loadWords(job);
    if (!cached) return res.status(409).json({ error: 'No transcript for this job yet.' });
    if (!job.sourcePath || !fs.existsSync(job.sourcePath)) {
      return res.status(409).json({ error: 'Source video is gone — re-upload it.' });
    }
    const prev = outputs[index];
    const body = req.body || {};
    // Reuse the stored copy unless the request overrides it.
    const base = {
      title: prev.copy?.title || prev.title,
      hook: prev.hook ?? prev.copy?.hook,
      poll: prev.poll ?? prev.copy?.pollQuestion,
      pollOptions: prev.pollOptions ?? prev.copy?.pollOptions,
      cta: prev.cta ?? prev.copy?.cta,
      hashtags: prev.hashtags ?? prev.copy?.hashtags,
      startSec: prev.startSec,
      endSec: prev.endSec,
      captionStyle: prev.captionStyle,
    };
    const overrides = overridesFrom(body, base);

    const out = await renderAndStore({ job, words: cached.words, index, overrides });
    if (out.copy) out.copy = prev.copy;
    outputs[index] = out;

    // Replace the old file, drop the superseded Clip row.
    const dir = path.join(MEDIA_ROOT, job.id);
    const oldPath = path.join(dir, decodeURIComponent(String(prev.file).split('/').pop()));
    if (oldPath !== path.join(dir, decodeURIComponent(out.file.split('/').pop()))) {
      try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch { /* noop */ }
    }
    if (prev.clipId && prev.clipId !== out.clipId) {
      try {
        const old = await Clip.findByPk(prev.clipId);
        if (old) await old.destroy();
      } catch { /* noop */ }
    }
    await job.update({ outputs });
    res.json({ output: out, outputs });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

/** Rewrite the AI copy for every clip (new titles/hooks/polls), no re-render. */
router.post('/jobs/:id/recopy', async (req, res) => {
  const job = await findJob(req, res);
  if (!job) return;
  try {
    const cached = loadWords(job);
    if (!cached) return res.status(409).json({ error: 'No transcript for this job yet.' });
    const outputs = [...(job.outputs || [])];
    for (let i = 0; i < outputs.length; i += 1) {
      const o = outputs[i];
      const copy = await writeClipCopy({
        text: scrubRange(cached.words, o.startSec, o.endSec).map((w) => w.word).join(' '),
        duration: o.endSec - o.startSec,
        index: i,
      });
      const dir = path.join(MEDIA_ROOT, job.id);
      const oldPath = path.join(dir, decodeURIComponent(String(o.file).split('/').pop()));
      const newName = `${safeFilename(copy.title).trim() || `clip-${i + 1}`}.mp4`;
      const newPath = path.join(dir, newName);
      let file = o.file;
      if (oldPath !== newPath) {
        let moved = fs.existsSync(newPath);
        try { if (fs.existsSync(oldPath) && !moved) { fs.renameSync(oldPath, newPath); moved = true; } } catch { /* noop */ }
        if (moved) file = `/media/clippedai/${job.id}/${encodeURIComponent(newName)}`;
      }
      outputs[i] = {
        ...o,
        title: copy.title,
        hookText: copy.hook,
        copy,
        file,
      };
      if (o.clipId) {
        try {
          const row = await Clip.findByPk(o.clipId);
          if (row) await row.update({ title: copy.title, hookText: copy.hook, meta: { ...(row.meta || {}), file: outputs[i].file } });
        } catch { /* noop */ }
      }
    }
    await job.update({ outputs });
    res.json({ outputs });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

/** Remove one rendered clip (file + Clip row) from a job. */
router.delete('/jobs/:id/clips/:index', async (req, res) => {
  const job = await findJob(req, res);
  if (!job) return;
  const index = Number(req.params.index);
  const outputs = [...(job.outputs || [])];
  if (!Number.isInteger(index) || index < 0 || index >= outputs.length) {
    return res.status(404).json({ error: 'clip not found' });
  }
  const gone = outputs[index];
  outputs.splice(index, 1);
  // Renumber so the UI indices stay contiguous.
  const renumbered = outputs.map((o, i) => ({ ...o, index: i + 1 }));
  await job.update({ outputs: renumbered });
  try {
    const p = path.join(MEDIA_ROOT, job.id, decodeURIComponent(String(gone.file).split('/').pop()));
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch { /* noop */ }
  try {
    if (gone.clipId) {
      const row = await Clip.findByPk(gone.clipId);
      if (row) await row.destroy();
    }
  } catch { /* noop */ }
  res.json({ outputs: renumbered });
});

/**
 * Same-origin file download for one rendered clip.
 * The UI used to link straight at /media/… with a cross-origin `download`
 * attribute, which browsers ignore cross-origin (frontend :5173 vs media
 * :5000) — the "download" navigated instead, and ad-blockers/CORS failures
 * looked like broken downloads. This endpoint answers from the API origin
 * with Content-Disposition: attachment, so the save dialog always appears.
 */
router.get('/jobs/:id/clips/:index/file', async (req, res) => {
  const job = await findJob(req, res);
  if (!job) return;
  const index = Number(req.params.index);
  const outputs = job.outputs || [];
  if (!Number.isInteger(index) || index < 0 || index >= outputs.length) {
    return res.status(404).json({ error: 'clip not found' });
  }
  const out = outputs[index];
  const name = decodeURIComponent(String(out.file || '').split('/').pop() || '');
  const abs = path.join(MEDIA_ROOT, job.id, name);
  if (!name || !fs.existsSync(abs)) {
    return res.status(404).json({ error: 'Render file is gone (disk was cleared or the server restarted) — re-render this clip.' });
  }
  const downloadName = out.title ? `${safeFilename(out.title).trim() || `clip-${index + 1}`}.mp4` : name;
  res.download(abs, downloadName);
});

/** Flag outputs whose files no longer exist (ephemeral disk / restart). */
function annotateFiles(job) {
  const json = job.toJSON();
  const dir = path.join(MEDIA_ROOT, job.id);
  let lost = 0;
  json.outputs = (json.outputs || []).map((o) => {
    const name = decodeURIComponent(String(o.file || '').split('/').pop() || '');
    const missing = !name || !fs.existsSync(path.join(dir, name));
    if (missing) lost += 1;
    return { ...o, fileMissing: missing };
  });
  json.filesLost = lost > 0 && lost === (json.outputs || []).length && (json.outputs || []).length > 0;
  return json;
}

module.exports = router;