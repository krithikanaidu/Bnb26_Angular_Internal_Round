'use strict';
// Renders a real clip through the full visual pipeline and proves the burn-in
// actually happened (not just that a file was produced):
//   - geometry is exactly 1080x1920
//   - the caption band and each overlay band contain drawn text
//   - the ASS file references the bundled font
//   - smart reframe produces a plausible crop plan
//   node scripts/clipai-render-test.js <video>
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');
const { FFMPEG, FFPROBE, probeStreams } = require('../src/clippedai/ffmpeg');
const { transcribe } = require('../src/clippedai/transcribe');
const { selectClips } = require('../src/clippedai/score');
const { writeClipCopy } = require('../src/clippedai/ai');
const { renderOne } = require('../src/clippedai/pipeline');
const { planReframe } = require('../src/clippedai/reframe');
const { buildCues, buildAss } = require('../src/clippedai/subtitles');

/**
 * Count drawn edges inside a horizontal band. Overlays are centre-anchored, so
 * sample the middle half of the frame rather than the left edge.
 */
function bandEdgeScore(file, y0, y1, at) {
  const w = 540; const h = y1 - y0; const x = 270;
  const raw = execFileSync(FFMPEG, [
    '-v', 'error', '-ss', String(at), '-i', file, '-frames:v', '1',
    '-vf', `crop=${w}:${h}:${x}:${y0},format=gray`, '-f', 'rawvideo', '-',
  ], { maxBuffer: 1 << 28 });
  let edges = 0;
  for (let y = 0; y < h; y += 1) {
    for (let i = 1; i < w; i += 1) {
      if (Math.abs(raw[y * w + i] - raw[y * w + i - 1]) > 40) edges += 1;
    }
  }
  return edges;
}

/**
 * Split caption pixels into white vs accent-yellow. The karaoke style fills the
 * spoken word with yellow as the line plays, so early in a cue it must still be
 * mostly white while a later frame has turned yellow — that colour change is
 * the animation, and edge counts cannot see it.
 */
function captionColours(file, y0, y1, at) {
  const w = 540; const h = y1 - y0;
  const raw = execFileSync(FFMPEG, [
    '-v', 'error', '-ss', String(at), '-i', file, '-frames:v', '1',
    '-vf', `crop=${w}:${h}:270:${y0},format=rgb24`, '-f', 'rawvideo', '-',
  ], { maxBuffer: 1 << 28 });
  let white = 0; let yellow = 0;
  for (let i = 0; i + 2 < raw.length; i += 3) {
    const r = raw[i]; const g = raw[i + 1]; const b = raw[i + 2];
    if (r > 190 && g > 190 && b > 190) white += 1;
    else if (r > 180 && g > 150 && b < 110) yellow += 1;
  }
  return { white, yellow };
}

(async () => {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('usage: node scripts/clipai-render-test.js <video>');
    process.exit(1);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipai-render-'));
  const fakeClip = { create: async (row) => ({ id: `clip-${row.startSec}`, ...row }) };

  // 1. Real transcript → real selection.
  const t = await transcribe(file, dir);
  assert(t.mode !== 'heuristic', 'refusing to render from a placeholder transcript');
  const selected = selectClips(t, { minLen: 12, maxLen: 30, maxClips: 1 });
  assert(selected.length === 1, 'expected one selected clip');
  const clip = selected[0];
  console.log(`SELECTED: ${clip.start_time}s–${clip.end_time}s score=${clip.score}`);
  console.log(`  "${clip.text.slice(0, 90)}…"`);

  // 2. Copy + overlays.
  const copy = await writeClipCopy({ text: clip.text, duration: clip.end_time - clip.start_time, index: 0 });
  console.log(`COPY (${copy.source}): title="${copy.title}" hook="${copy.hook}" poll="${copy.pollQuestion}"`);

  // 3. ASS contents.
  const cues = buildCues(t.words, clip.start_time, clip.end_time);
  assert(cues.length > 0, 'no caption cues built');
  const ass = buildAss(cues, {
    style: 'karaoke',
    overlays: { hook: copy.hook, poll: copy.pollQuestion, pollOptions: copy.pollOptions, cta: copy.cta, hashtags: copy.hashtags },
  });
  assert(ass.includes('Montserrat Extra Bold'), 'ASS must request the bundled font');
  assert(ass.includes('\\kf'), 'karaoke style must emit \\kf word timings');
  assert(ass.includes(',Hook,') && ass.includes(',Poll,') && ass.includes(',CTA,'), 'overlay events missing');
  // libass needs override blocks balanced and non-nested or the event is dropped.
  for (const line of ass.split('\n').filter((l) => l.startsWith('Dialogue'))) {
    let depth = 0;
    for (const ch of line.slice(line.indexOf(',,,') + 3)) {
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      assert(depth >= 0 && depth <= 1, `nested/unbalanced override block: ${line}`);
    }
    assert(depth === 0, `unbalanced override block: ${line}`);
  }
  fs.writeFileSync(path.join(dir, 'preview.ass'), ass);
  console.log(`ASS: ${cues.length} cues, ${(ass.split('\n').filter((l) => l.startsWith('Dialogue')).length)} events`);

  // 4. Reframe planning against the real source.
  const info = await probeStreams(file);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const plan = await planReframe(file, {
    start: clip.start_time, end: clip.end_time, width: v.width, height: v.height, mode: 'auto',
  });
  console.log(`REFRAME: mode=${plan.mode} crop=${plan.cropW}x${plan.cropH} note="${plan.note}"`);
  assert(plan.cropW / plan.cropH > 0.555 && plan.cropW / plan.cropH < 0.563, 'crop must be 9:16');
  assert(plan.cropW <= v.width && plan.cropH <= v.height, 'crop must fit inside the source');

  // 5. Full render, both caption styles.
  const colourRuns = {};
  for (const captionStyle of ['karaoke', 'classic']) {
    const out = await renderOne({
      Clip: fakeClip,
      job: { id: `render-${captionStyle}`, projectId: null, sourcePath: file, transcript: { mode: t.mode } },
      words: t.words,
      clip,
      index: 0,
      jobDir: dir,
      options: { subtitles: true, portrait: true, captionStyle, reframe: 'auto' },
      overrides: {
        title: `${captionStyle} test`,
        hook: copy.hook,
        poll: copy.pollQuestion,
        pollOptions: copy.pollOptions,
        cta: copy.cta,
        hashtags: copy.hashtags,
      },
    });
    const outPath = path.join(dir, decodeURIComponent(out.file.split('/').pop()));
    assert(fs.existsSync(outPath), 'rendered file missing');

    const outInfo = JSON.parse(execFileSync(FFPROBE, [
      '-v', 'quiet', '-print_format', 'json', '-show_streams', outPath,
    ], { maxBuffer: 1 << 26 }));
    const ov = outInfo.streams.find((s) => s.codec_type === 'video');
    assert(ov.width === 1080 && ov.height === 1920, `${captionStyle} geometry ${ov.width}x${ov.height}`);

    const dur = clip.end_time - clip.start_time;
    const mid = Math.max(1, dur * 0.5);
    // Sample each overlay while it is actually on screen.
    const captionEdges = bandEdgeScore(outPath, 40, 220, mid);
    const hookEdges = bandEdgeScore(outPath, 1180, 1300, Math.min(1.4, dur * 0.4));
    const pollEdges = bandEdgeScore(outPath, 1300, 1430, Math.max(0.5, dur - 2.2));
    const ctaEdges = bandEdgeScore(outPath, 1550, 1650, Math.max(0.5, dur - 1.0));
    const tagEdges = bandEdgeScore(outPath, 1650, 1730, Math.max(0.5, dur - 0.7));
    console.log(`  [${captionStyle}] ${ov.width}x${ov.height} ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB `
      + `edges caption=${captionEdges} hook=${hookEdges} poll=${pollEdges} cta=${ctaEdges} tags=${tagEdges}`);
    assert(captionEdges > 40, `${captionStyle}: captions were not burned into the caption band (${captionEdges})`);
    assert(hookEdges > 20, `${captionStyle}: hook card missing (${hookEdges})`);
    assert(pollEdges > 20, `${captionStyle}: poll sticker missing (${pollEdges})`);
    assert(ctaEdges > 10, `${captionStyle}: CTA missing (${ctaEdges})`);
    assert(tagEdges > 10, `${captionStyle}: hashtags missing (${tagEdges})`);

    // Sample two points inside a caption cue: the fill colour must advance.
    const cueMid = cues.find((c) => c.start > 0.5 && c.end - c.start > 1.2) || cues[0];
    const early = captionColours(outPath, 40, 220, cueMid.start + 0.15);
    const late = captionColours(outPath, 40, 220, cueMid.end - 0.15);
    colourRuns[captionStyle] = { early, late };
    console.log(`      caption colour @start: white=${early.white} yellow=${early.yellow} · `
      + `@end: white=${late.white} yellow=${late.yellow}`);
  }

  // Karaoke must show a growing yellow fill; classic keeps text white.
  const k = colourRuns.karaoke;
  const c = colourRuns.classic;
  assert(k.late.yellow > k.early.yellow + 40,
    `karaoke fill should advance across the cue (early=${k.early.yellow} late=${k.late.yellow})`);
  assert(k.late.yellow > c.late.yellow + 40,
    `karaoke should be yellower than classic at cue end (karaoke=${k.late.yellow} classic=${c.late.yellow})`);
  assert(c.late.white > c.late.yellow, `classic style should stay mostly white (white=${c.late.white} yellow=${c.late.yellow})`);
  assert(c.late.yellow < k.late.yellow, 'classic must not use the karaoke fill');

  console.log('\nRENDER TEST PASSED');
  fs.rmSync(dir, { recursive: true, force: true });
})().catch((e) => { console.error('RENDER_TEST_FAIL:', e.message); process.exit(1); });