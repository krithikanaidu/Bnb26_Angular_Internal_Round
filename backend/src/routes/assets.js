const router = require('express').Router();
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Asset } = require('../models');
const { supabase, BUCKET } = require('../config/supabase');
const { probeStreams } = require('../clippedai/ffmpeg');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

/** FormData stringifies missing values — never let "undefined" reach UUID columns. */
function cleanProjectId(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || s === 'undefined' || s === 'null') return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    throw new Error('Invalid project selected — please re-pick it from the list.');
  }
  return s;
}

/**
 * Read the real duration (and whether an audio stream exists) out of the uploaded
 * bytes with ffprobe.
 *
 * The client used to send a hardcoded `durationSec=120` for every file, which the
 * route stored verbatim — so every asset claimed to be two minutes long. The value
 * is now measured from the media itself and the client field is only a fallback for
 * the rare case ffprobe cannot parse the container.
 */
async function probeUpload(buffer, originalName) {
  const ext = path.extname(originalName || '') || '.bin';
  const tmp = path.join(os.tmpdir(), `asset-probe-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  try {
    fs.writeFileSync(tmp, buffer);
    const info = await probeStreams(tmp);
    const streams = Array.isArray(info?.streams) ? info.streams : [];
    const video = streams.find((s) => s.codec_type === 'video');
    const audio = streams.find((s) => s.codec_type === 'audio');
    const duration = Number(info?.format?.duration)
      || Number(video?.duration) || Number(audio?.duration) || 0;
    return {
      durationSec: Number.isFinite(duration) && duration > 0 ? duration : null,
      width: Number(video?.width) || null,
      height: Number(video?.height) || null,
      hasAudio: Boolean(audio),
      audioCodec: audio?.codec_name || null,
    };
  } catch {
    return { durationSec: null, width: null, height: null, hasAudio: false, audioCodec: null };
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
  }
}

router.get('/', async (req, res) => {
  const where = req.query.projectId ? { projectId: req.query.projectId } : {};
  res.json(await Asset.findAll({ where, order: [['createdAt', 'DESC']] }));
});

// Upload -> Supabase Storage (fallback: metadata-only if no Supabase configured)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { projectId, kind, durationSec } = req.body;
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const path = `${projectId || 'general'}/${Date.now()}-${req.file.originalname}`;
    let publicUrl = null;
    if (supabase) {
      const { error } = await supabase.storage.from(BUCKET).upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
      if (error) throw error;
      publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }
    const probed = await probeUpload(req.file.buffer, req.file.originalname);
    // Measured duration wins; the client value is only a fallback. Never invent one.
    const measuredDuration = probed.durationSec ?? (parseFloat(durationSec) || 0);
    const asset = await Asset.create({
      projectId: cleanProjectId(projectId), kind: kind || 'video',
      fileName: req.file.originalname, storagePath: path, publicUrl,
      sizeBytes: req.file.size, mimeType: req.file.mimetype,
      durationSec: measuredDuration,
      meta: {
        width: probed.width,
        height: probed.height,
        hasAudio: probed.hasAudio,
        audioCodec: probed.audioCodec,
      },
    });
    // No transcript is invented here. A real transcript is produced by the ClipAI
    // pipeline (real speech-to-text) or by POST /api/clippedai/jobs. Seeding
    // placeholder "Demo beat ..." rows here used to poison script alignment and
    // clip scoring, which then treated invented text as real speech.
    res.status(201).json(asset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  await Asset.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
