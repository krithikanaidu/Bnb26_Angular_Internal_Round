// Dynamic 9:16 reframing.
//
// ClippedAI used clipsai's `resize()`, which leans on pyannote face tracking.
// Without pyannote we approximate it with signal we can actually compute:
// sample frames at low resolution, score each column for visual "interest"
// (edge energy + local detail, which is where faces and motion live), then
// pan a 9:16 crop window across the strongest region over time.
//
// The result is a crop expression ffmpeg evaluates per frame, so the framing
// gently follows the subject instead of sitting dead-centre.
'use strict';

const { sampleGrayFrames, probeStreams } = require('./ffmpeg');

const DEFAULTS = {
  samples: 14,       // frames sampled across the clip
  width: 64,         // analysis width (height derived for 16:9 source)
  centerBias: 0.25,  // how strongly to favour the middle of the frame
  pan: true,         // emit a moving crop vs. one static window
  smooth: 0.45,      // blend between consecutive targets (0 = no movement)
};

/** Column-wise interest: vertical edge energy + local variance per column. */
function columnInterest(frame, w, h) {
  const interest = new Float64Array(w);
  for (let y = 0; y < h; y += 1) {
    const row = y * w;
    for (let x = 0; x < w; x += 1) {
      const v = frame[row + x];
      // Horizontal gradient → edges, a cheap proxy for faces/text/motion.
      const gx = x < w - 1 ? Math.abs(v - frame[row + x + 1]) : 0;
      const gy = y < h - 1 ? Math.abs(v - frame[row + w + x]) : 0;
      interest[x] += Math.sqrt(gx * gx + gy * gy);
    }
  }
  for (let x = 0; x < w; x += 1) interest[x] /= h;
  return interest;
}

/** Best left-edge for a window of `winW` columns given per-column interest. */
function bestOffset(interest, winW, centerBias) {
  const w = interest.length;
  const half = (w - winW) / 2;
  let prefix = new Float64Array(w + 1);
  for (let x = 0; x < w; x += 1) {
    const centrePull = 1 - centerBias + centerBias * (1 - Math.abs((x - w / 2) / (w / 2 || 1)));
    prefix[x + 1] = prefix[x] + interest[x] * centrePull;
  }
  let bestScore = -Infinity;
  let bestX = Math.round(half);
  for (let x = 0; x <= w - winW; x += 1) {
    // Small penalty for jumping far from centre keeps framing sane.
    const score = prefix[x + winW] - prefix[x];
    if (score > bestScore) { bestScore = score; bestX = x; }
  }
  return Math.max(0, Math.min(w - winW, bestX));
}

/**
 * @returns {{mode:'auto'|'center', expr:string|null, cropW:number, cropH:number,
 *            centre:number, note:string}}
 *   `expr` is an ffmpeg crop-x expression in source pixels, or null when the
 *   caller should use a plain centred crop.
 */
async function planReframe(inputPath, { start, end, width, height, mode = 'auto', ...opts } = {}) {
  const o = { ...DEFAULTS, ...opts };
  const outW = 1080;
  const outH = 1920;

  // Resolve source dimensions before anything else so every return path can
  // report the crop geometry it implies.
  let srcW = Number(width) || 0;
  let srcH = Number(height) || 0;
  if (!srcW || !srcH) {
    const info = await probeStreams(inputPath);
    const v = info?.streams?.find((s) => s.codec_type === 'video');
    srcW = Number(v?.width) || 0;
    srcH = Number(v?.height) || 0;
  }
  if (!srcW || !srcH) {
    return { mode: 'center', expr: null, cropW: 0, cropH: 0, centre: 0, note: 'no video dimensions' };
  }

  // Largest 9:16 window that fits inside the source.
  const cropW = Math.round(Math.min(srcW, (srcH * outW) / outH) / 2) * 2;
  const cropH = Math.round((cropW * outH) / outW / 2) * 2;
  const maxX = Math.max(0, srcW - cropW);
  const centre = Math.round(maxX / 2);
  const centered = (note) => ({ mode: 'center', expr: null, cropW, cropH, centre, note });

  if (mode !== 'auto') return centered('centred crop');
  if (cropW < 16 || cropH < 16) return centered('source too small to crop');

  const aw = o.width;
  const ah = Math.max(2, Math.round((aw * srcH) / srcW));
  const frames = await sampleGrayFrames(inputPath, { start, end, count: o.samples, width: aw });
  if (!frames.length) return centered('no frames sampled');

  const winW = Math.max(2, Math.round((cropW / srcW) * aw));

  // Offset per sampled frame, in analysis-column space.
  const targets = frames.map((f) => bestOffset(columnInterest(f, aw, ah), winW, o.centerBias));
  // Analysis columns → source pixels.
  const px = targets.map((t) => Math.max(0, Math.min(maxX, Math.round((t / (aw - winW || 1)) * maxX))));

  // Temporal smoothing: average with the neighbour to avoid jitter.
  const smoothed = px.map((v, i) => {
    if (i === 0 || i === px.length - 1 || !o.pan) return v;
    const prev = px[i - 1];
    const next = px[i + 1];
    return Math.round(prev * o.smooth + v * (1 - 2 * o.smooth) + next * o.smooth);
  });

  const span = Math.max(0.1, end - start);
  const frameTimes = frames.length > 1
    ? smoothed.map((_, i) => (i / (frames.length - 1)) * span)
    : [0];

  // Nothing meaningful to track — don't add filter complexity.
  const spread = Math.max(...smoothed) - Math.min(...smoothed);
  if (!o.pan || spread < Math.max(12, maxX * 0.06)) {
    return centered('framing stable, centred crop');
  }

  // Piecewise-constant x(t) the crop filter evaluates per frame.
  let expr = String(smoothed[smoothed.length - 1]);
  for (let i = smoothed.length - 2; i >= 0; i -= 1) {
    const t = frameTimes[i];
    const x = smoothed[i];
    expr = `if(lt(t\\,${t.toFixed(2)})\\,${x}\\,${expr})`;
  }
  // Clamp so rounding can never push the window outside the frame.
  expr = `max(0\\,min(${maxX}\\,${expr}))`;

  return {
    mode: 'auto',
    expr,
    cropW,
    cropH,
    centre,
    note: `auto-reframe panning ${Math.round(spread)}px across ${frames.length} samples`,
  };
}

module.exports = { planReframe, columnInterest, bestOffset };