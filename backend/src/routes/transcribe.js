'use strict';

// POST /api/transcribe — speech-to-text for the video editor's auto-captions.
//
// Accepts either a multipart upload (field "file") for local/blob media the
// backend cannot reach, or JSON { url } with an http(s) media URL. Both run
// the same Whisper pipeline as ClippedAI jobs (silence detection, hallucination
// scrubbing, word timestamps) and answer with:
//   { provider, model, duration, words: [{ word, start, end }], segments }

const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const multer = require('multer');
const { transcribe } = require('../clippedai/transcribe');

const router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

const MEDIA_EXT = /\.(mp3|wav|m4a|aac|ogg|flac|mp4|webm|mov|mkv|avi)$/i;

router.post('/', upload.single('file'), async (req, res) => {
  const jobDir = path.join(os.tmpdir(), `transcribe_${crypto.randomUUID()}`);
  let uploadedPath = null;
  try {
    fs.mkdirSync(jobDir, { recursive: true });

    if (req.file) {
      uploadedPath = req.file.path;
    } else if (req.body?.url && /^https?:\/\//i.test(req.body.url)) {
      const ext = (req.body.url.match(MEDIA_EXT) || ['.mp4'])[0];
      uploadedPath = path.join(jobDir, `source${ext}`);
      const response = await axios.get(req.body.url, {
        responseType: 'stream',
        timeout: 60000,
        maxContentLength: 500 * 1024 * 1024,
      });
      await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(uploadedPath);
        response.data.on('error', reject);
        ws.on('error', reject);
        ws.on('finish', resolve);
        response.data.pipe(ws);
      });
    } else {
      return res.status(400).json({
        error: 'Send a multipart "file" upload or JSON { url } with an http(s) media URL.',
      });
    }

    const result = await transcribe(uploadedPath, jobDir);
    return res.json({
      provider: result.provider,
      model: result.model,
      duration: result.duration,
      words: result.words,
      segments: result.segments,
    });
  } catch (e) {
    const actionable = e.code === 'NO_SPEECH' || e.code === 'NO_STT';
    if (!actionable) console.error('[transcribe]', e.message);
    return res.status(actionable ? 422 : 500).json({
      error: e.message || 'Transcription failed.',
    });
  } finally {
    try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch { /* noop */ }
    if (uploadedPath && !uploadedPath.startsWith(jobDir)) {
      try { fs.unlinkSync(uploadedPath); } catch { /* noop */ }
    }
  }
});

module.exports = router;
