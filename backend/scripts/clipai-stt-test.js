'use strict';
// Verify real speech-to-text: extracts audio from a video and prints the
// transcript the pipeline will actually use.
//   node scripts/clipai-stt-test.js <video> [startSec] [durSec]
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sttProvider } = require('../src/clippedai/keys');
const { transcribe } = require('../src/clippedai/transcribe');

(async () => {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('usage: node scripts/clipai-stt-test.js <video> [startSec] [durSec]');
    process.exit(1);
  }
  const p = sttProvider();
  console.log(`STT PROVIDER: ${p.name}${p.model ? ` (${p.model})` : ' — NONE CONFIGURED'}`);

  // Trim first so the test is fast; the pipeline transcribes the full file.
  let target = file;
  if (process.argv[3]) {
    const { FFMPEG, run } = require('../src/clippedai/ffmpeg');
    target = path.join(os.tmpdir(), `clipai-stt-${Date.now()}.mp4`);
    const args = ['-y', '-ss', process.argv[3], '-i', file, '-t', process.argv[4] || '90', '-c', 'copy', target];
    await run(FFMPEG, args).catch(async () => {
      await run(FFMPEG, ['-y', '-ss', process.argv[3], '-i', file, '-t', process.argv[4] || '90', target]);
    });
    console.log(`SAMPLE: ${target}`);
  }

  const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipai-stt-'));
  const t = await transcribe(target, jobDir, (f, label) => console.log(`  progress ${(f * 100).toFixed(0)}% — ${label}`));

  console.log(`\nMODE: ${t.mode}${t.cached ? ' (cached)' : ''}`);
  console.log(`DURATION: ${(t.duration || 0).toFixed(1)}s`);
  console.log(`WORDS: ${t.words.length}   SEGMENTS: ${t.segments.length}`);
  if (t.warning) console.log(`WARNING: ${t.warning}`);
  console.log('\nFIRST WORDS:');
  console.log(t.words.slice(0, 12).map((w) => `[${w.start.toFixed(2)}-${w.end.toFixed(2)}] ${w.word}`).join('\n'));
  console.log('\nSEGMENTS:');
  for (const s of t.segments.slice(0, 8)) {
    console.log(`  ${s.start.toFixed(1)}-${s.end.toFixed(1)}  ${s.text}`);
  }
  const bad = t.words.filter((w) => !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.end < w.start);
  if (bad.length) { console.error(`\nFAIL: ${bad.length} malformed word timings`); process.exit(1); }
  if (!t.words.length) { console.error('\nFAIL: no words produced'); process.exit(1); }
  // A heuristic transcript means the pipeline would build clips on fabricated
  // timings — that is the "static output" bug, so treat it as a failure here.
  if (t.mode === 'heuristic') {
    console.error('\nFAIL: fell back to the placeholder transcript — no real STT provider.');
    process.exit(1);
  }
  console.log('\nSTT TEST PASSED');
})().catch((e) => { console.error('STT_TEST_FAIL:', e.message); process.exit(1); });