const router = require('express').Router();
const multer = require('multer');
const { Asset, TranscriptSegment } = require('../models');
const { supabase, BUCKET } = require('../config/supabase');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

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
    const asset = await Asset.create({
      projectId: projectId || null, kind: kind || 'video',
      fileName: req.file.originalname, storagePath: path, publicUrl,
      sizeBytes: req.file.size, mimeType: req.file.mimetype,
      durationSec: parseFloat(durationSec) || 0,
    });
    // Seed demo transcript segments so clip-gen works instantly
    const total = parseFloat(durationSec) || 120;
    const segs = [];
    for (let s = 0; s < total; s += 8) {
      segs.push({ assetId: asset.id, projectId: projectId || null, startSec: s, endSec: Math.min(s + 8, total), text: `Demo beat at ${s}s — hook, value, proof rotation with secret hack and proven truth.` });
    }
    await TranscriptSegment.bulkCreate(segs);
    res.status(201).json(asset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  await Asset.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
