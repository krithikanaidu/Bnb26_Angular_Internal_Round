'use strict';
// Proves the selection + AI layer works on a real transcript:
// transcribe -> score candidates -> LLM re-rank -> clip copy.
//   node scripts/clipai-analyze-test.js <video> [maxClips] [minLen] [maxLen]
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { transcribe } = require('../src/clippedai/transcribe');
const { selectClips } = require('../src/clippedai/score');
const { rankMoments, writeClipCopy } = require('../src/clippedai/ai');

(async () => {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('usage: node scripts/clipai-analyze-test.js <video> [maxClips] [minLen] [maxLen]');
    process.exit(1);
  }
  const maxClips = Number(process.argv[3]) || 3;
  const minLen = Number(process.argv[4]) || 20;
  const maxLen = Number(process.argv[5]) || 60;

  const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipai-analyze-'));
  const t = await transcribe(file, jobDir);
  console.log(`TRANSCRIPT: mode=${t.mode} words=${t.words.length} duration=${(t.duration || 0).toFixed(1)}s`);
  assert(t.mode !== 'heuristic', 'refusing to analyze a placeholder transcript');
  assert(t.words.length > 20, 'transcript too thin to select from');

  const scored = selectClips(t, { minLen, maxLen, maxClips });
  console.log(`\nCANDIDATES (${scored.length} scored):`);
  for (const c of scored) {
    console.log(`  ${c.start_time}s–${c.end_time}s score=${c.score} `
      + `[hook=${c.parts.hook.toFixed(2)} coh=${c.parts.cohesion.toFixed(2)} eng=${c.parts.engagement.toFixed(2)}] `
      + `"${c.text.slice(0, 70)}…"`);
  }
  assert(scored.length > 0, 'no candidates');
  assert(scored.every((c) => c.end_time > c.start_time), 'all candidates must have positive duration');

  const ranked = await rankMoments(scored, maxClips);
  const chosen = ranked || scored.slice(0, maxClips);
  console.log(`\nCHOSEN (${chosen.length}) ${ranked ? '— LLM re-ranked' : '— heuristic order (no LLM)'}`);
  for (const c of chosen) {
    console.log(`  ${c.start_time}s–${c.end_time}s score=${c.score} ${c.reason ? `— ${c.reason}` : ''}`);
  }

  console.log('\nCLIP COPY:');
  for (const [i, c] of chosen.entries()) {
    const copy = await writeClipCopy({
      text: c.text, duration: c.end_time - c.start_time, index: i,
    });
    console.log(`  [${c.start_time}s–${c.end_time}s] (${copy.source})`);
    console.log(`    title : ${copy.title}`);
    console.log(`    hook  : ${copy.hook}`);
    console.log(`    poll  : ${copy.pollQuestion} [${copy.pollOptions.join(' | ')}]`);
    console.log(`    cta   : ${copy.cta}`);
    console.log(`    tags  : ${copy.hashtags.join(' ')}`);
    assert(copy.title && copy.title.length > 0, 'title present');
    assert(/\p{Extended_Pictographic}/u.test(copy.title), `title needs an emoji: ${copy.title}`);
    assert(Array.isArray(copy.pollOptions) && copy.pollOptions.length >= 2, 'poll options');
    assert(Array.isArray(copy.hashtags) && copy.hashtags.length >= 2, 'hashtags');
  }

  // Chosen clips must be real, distinct moments of the actual video.
  const starts = new Set(chosen.map((c) => c.start_time));
  assert(starts.size === chosen.length, 'clips must be distinct moments');
  for (const c of chosen) {
    assert(c.end_time <= (t.duration || Infinity) + 1, 'clip must stay inside the source');
  }

  console.log('\nANALYZE TEST PASSED');
  fs.rmSync(jobDir, { recursive: true, force: true });
})().catch((e) => { console.error('ANALYZE_TEST_FAIL:', e.message); process.exit(1); });