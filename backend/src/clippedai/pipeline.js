// Clip render pipeline — port of ClippedAI main.py stages 4–8:
// trim → 9:16 → captions/overlays → viral title → final mp4.
//
// What changed from the original port: the crop follows the subject instead of
// sitting dead-centre (reframe.js), captions can animate word-by-word, and the
// interactive overlays are burned in the same pass.
'use strict';

const fs = require('fs');
const path = require('path');
const { FFMPEG, run, assFilterWithFonts, assFilterPath, probeDuration, probeAudio } = require('./ffmpeg');
const { buildCues, buildAss } = require('./subtitles');
const { scrubRange } = require('./transcribe');
const { planReframe } = require('./reframe');
const { viralTitle, safeFilename } = require('./titles');

const FONTS_DIR = path.join(__dirname, 'fonts');
const OUT_W = 1080;
const OUT_H = 1920;

const CAPTION_STYLES = ['classic', 'karaoke', 'none'];

/**
 * Single-pass render: seek/trim, 9:16 crop (static or panning), scale, and the
 * ASS burn-in.
 *
 * @param reframe  result of planReframe(); `expr` is an ffmpeg crop-x expression
 */
async function renderClip({
  inputPath, start, end, assPath, outputPath, withSubs, portrait, reframe = null, fps = 30,
}) {
  const vf = [];
  if (portrait) {
    // Cropping to 9:16 then scaling up is what produces the vertical short.
    // Panning reframe supplies its own x expression; otherwise centre it.
    if (reframe?.mode === 'auto' && reframe.expr) {
      vf.push(`crop=${reframe.cropW}:${reframe.cropH}:x='${reframe.expr}':y=0`);
    } else {
      vf.push('crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9):(iw-ow)/2:(ih-oh)/2');
    }
    vf.push(`scale=${OUT_W}:${OUT_H}`);
  }
  if (withSubs && assPath && fs.existsSync(assPath)) {
    vf.push(
      fs.existsSync(FONTS_DIR) ? assFilterWithFonts(assPath, FONTS_DIR) : assFilterPath(assPath),
    );
  }

  const args = ['-y', '-ss', String(start), '-to', String(end), '-i', inputPath];
  if (vf.length) args.push('-vf', vf.join(','));
  args.push(
    '-c:v', 'libx264', '-preset', process.env.CLIPAI_PRESET || 'veryfast',
    '-crf', process.env.CLIPAI_CRF || '20', '-pix_fmt', 'yuv420p',
    '-r', String(fps), '-c:a', 'aac', '-b:a', '128k',
    // +faststart so the preview/download starts playing before it finishes.
    '-movflags', '+faststart',
    outputPath,
  );
  await run(FFMPEG, args);
  return outputPath;
}

/** Render entry (kept for a stable import surface). */
const renderClipWithFonts = (opts) => renderClip(opts);

function clipText(words, start, end) {
  return words.filter((w) => w.start >= start && w.end <= end).map((w) => w.word).join(' ');
}

/** Clamp a caption style name to something we know how to render. */
const normaliseStyle = (s) => (CAPTION_STYLES.includes(s) ? s : 'classic');

/**
 * Render one selected clip and persist a Clip row so Studio / Publish pick the
 * result up like any other clip.
 *
 * @param overrides per-clip tweaks from the UI (caption style, hook, poll,
 *                  custom in/out points) — merged over the job defaults.
 */
async function renderOne({
  Clip, job, words, clip, index, jobDir, options = {}, overrides = {},
}) {
  const n = index + 1;
  const tmpPath = path.join(jobDir, `yt_short_${n}.mp4`);

  // Per-clip overrides win over job-wide options.
  const captionStyle = normaliseStyle(overrides.captionStyle ?? options.captionStyle);
  const withSubs = captionStyle !== 'none' && overrides.subtitles !== false && options.subtitles !== false;
  const portrait = overrides.portrait !== undefined ? overrides.portrait : options.portrait !== false;

  const start = Number.isFinite(+overrides.startSec) ? Math.max(0, +overrides.startSec) : clip.start_time;
  const end = Number.isFinite(+overrides.endSec) ? Math.min(+overrides.endSec, +overrides.startSec + 600) : clip.end_time;

  // Clamp to the real source duration: ffmpeg happily exits 0 and writes NO
  // output file when asked for a range past the end, which used to surface as a
  // baffling ENOENT on the yt_short_N.mp4 copy step below.
  const srcDuration = await probeDuration(job.sourcePath);
  const safeStart = srcDuration ? Math.min(start, Math.max(0, srcDuration - 0.5)) : start;
  const safeEnd = srcDuration ? Math.min(end, srcDuration) : end;
  if (safeEnd - safeStart < 1) {
    throw new Error(`Clip range ${start}-${end}s is outside the source video (${srcDuration?.toFixed?.(1) || '?'}s).`);
  }

  // Dynamic only: captions come strictly from words actually spoken inside
  // this clip's range, minus hallucinated filler loops (thank-you repeats).
  // When nothing real was said there, render with NO captions rather than
  // burning invented text.
  const cleanWords = scrubRange(words, safeStart, safeEnd);
  const text = cleanWords.map((w) => w.word).join(' ');
  let effSubs = withSubs && cleanWords.length > 0;

  let assPath = null;
  if (effSubs) {
    const cues = buildCues(cleanWords, safeStart, safeEnd);
    if (!cues.length) {
      effSubs = false;
    } else {
      const overlays = {
        hook: null,
        poll: null,
        pollOptions: null,
        cta: null,
        hashtags: null,
      };
      assPath = path.join(jobDir, `clip_${n}.ass`);
      fs.writeFileSync(assPath, buildAss(cues, { style: captionStyle, overlays }), 'utf8');
    }
  }

  // Dynamic reframe (falls back to a centred crop when it can't plan).
  let reframe = null;
  let reframeNote = 'off';
  if (portrait) {
    const mode = overrides.reframe ?? options.reframe ?? 'auto';
    reframe = await planReframe(job.sourcePath, { start: safeStart, end: safeEnd, mode });
    reframeNote = reframe.note || reframe.mode;
  }

  await renderClipWithFonts({
    inputPath: job.sourcePath,
    start: safeStart,
    end: safeEnd,
    assPath,
    outputPath: tmpPath,
    withSubs: effSubs,
    portrait,
    reframe,
  });

  if (!fs.existsSync(tmpPath) || fs.statSync(tmpPath).size < 1024) {
    throw new Error(`Render produced no output for ${safeStart.toFixed(1)}-${safeEnd.toFixed(1)}s — check the clip range.`);
  }

  const title = (overrides.title && String(overrides.title).trim())
    || clip.title
    || await viralTitle(text, index);
  // Unique on disk: two clips with the same viral title (common with the
  // heuristic fallback) used to overwrite each other, and the loser's
  // outputs[].file then pointed at the winner's bytes — or at nothing.
  const baseName = safeFilename(title).trim() || `clip-${n}`;
  let finalName = `${baseName}.mp4`;
  for (let dup = 2; fs.existsSync(path.join(jobDir, finalName)); dup += 1) {
    finalName = `${baseName}-clip${n}-${dup}.mp4`;
  }
  const finalPath = path.join(jobDir, finalName);
  fs.copyFileSync(tmpPath, finalPath);

  const hookText = (overrides.hook || text.split(/\s+/).slice(0, 18).join(' ')).slice(0, 200);
  const file = `/media/clippedai/${job.id}/${encodeURIComponent(finalName)}`;

  // Keep the whole editable copy on the output so the UI can restyle/re-copy a
  // single clip later without re-running the AI or re-reading the transcript.
  const copy = {
    title,
    hook: overrides.hook ?? options.hook ?? null,
    pollQuestion: overrides.poll ?? options.poll ?? null,
    pollOptions: overrides.pollOptions ?? options.pollOptions ?? null,
    cta: overrides.cta ?? options.cta ?? null,
    hashtags: overrides.hashtags ?? options.hashtags ?? [],
  };

  const meta = {
    jobId: job.id,
    file,
    transcriptMode: job.transcript?.mode || 'unknown',
    captionStyle,
    reframe: reframeNote,
    overlays: {
      hook: copy.hook,
      poll: copy.pollQuestion,
      pollOptions: copy.pollOptions,
      cta: copy.cta,
    },
    hashtags: copy.hashtags,
    reason: clip.reason || '',
    scores: clip.parts || null,
  };

  const row = await Clip.create({
    projectId: job.projectId || null,
    assetId: null,
    title,
    startSec: safeStart,
    endSec: safeEnd,
    viralityScore: clip.score,
    hookText,
    captions: [{ t: safeStart, text: hookText }],
    status: 'rendered',
    meta,
  });

  try { fs.unlinkSync(tmpPath); } catch { /* keep final only */ }
  if (assPath) { try { fs.unlinkSync(assPath); } catch { /* noop */ } }

  return {
    index: n,
    clipId: row.id,
    title,
    file,
    startSec: safeStart,
    endSec: safeEnd,
    score: clip.score,
    text,
    hookText,
    hook: copy.hook,
    poll: copy.pollQuestion,
    pollOptions: copy.pollOptions,
    cta: copy.cta,
    hashtags: copy.hashtags,
    copy,
    portrait,
    reason: clip.reason || '',
    captionStyle,
    reframe: reframeNote,
    scores: clip.parts || null,
  };
}

module.exports = { renderOne, renderClip, clipText, normaliseStyle, CAPTION_STYLES };