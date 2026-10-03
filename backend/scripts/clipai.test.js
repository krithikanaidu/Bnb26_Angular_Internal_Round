'use strict';
const assert = require('assert');
const { engagementScore, selectClips } = require('../src/clippedai/score');
const { assTime, buildCues, buildAss, isYellowWord } = require('../src/clippedai/subtitles');
const { safeFilename, heuristicTitle } = require('../src/clippedai/titles');

const mk = (n, pat) => Array.from({ length: n }, (_, i) => ({ word: pat(i), start: i * 0.4, end: i * 0.4 + 0.3 }));
const words = mk(200, (i) => (i % 10 === 0 ? '$100' : 'word'));
const s1 = engagementScore(words, 0, 80);
assert(s1 > 0.5 && s1 <= 1, `score range ${s1}`);
assert.strictEqual(engagementScore(words, 5, 5), 0, 'empty range');
assert.strictEqual(engagementScore([], 0, 10), 0, 'no words');

const sel = selectClips(
  { words, segments: [{ start: 0, end: 80, text: 'x' }] },
  { minLen: 20, maxLen: 60, maxClips: 3 },
);
assert(sel.length > 0 && sel.length <= 3, 'selection count');
assert(sel.every((c) => c.end_time - c.start_time >= 20 && c.end_time - c.start_time <= 60), 'durations in range');
assert(sel.every((c) => typeof c.score === 'number'), 'scores present');

const tiny = selectClips({ words: words.slice(0, 10), segments: [] }, { minLen: 45, maxLen: 120, maxClips: 2 });
assert(Array.isArray(tiny), 'fallback array');

assert.strictEqual(assTime(61.234), '0:01:01.23');
assert(isYellowWord('$100') === true && isYellowWord('abc') === false);
const cues = buildCues(
  [{ word: 'hello', start: 0, end: 0.5 }, { word: '$100', start: 0.6, end: 1.0 }],
  0, 2,
);
assert.strictEqual(cues.length, 1);
const ass = buildAss(cues);
assert(ass.includes('[V4+ Styles]'), 'ass styles block');
assert(ass.includes('Yellow'), 'ass yellow rule');

const cleaned = safeFilename('He made $1,000,000 in 1 hour');
assert(cleaned.includes('$1,000,000'), 'keeps currency/punct');
assert(!/[/\\:"<>|]/.test(safeFilename('a/b\\c:d*e?f"g<h>i|j')), 'strips Windows-illegal chars (keeps *? like main.py)');
assert(heuristicTitle('', 0).length > 0, 'fallback title');
assert(heuristicTitle('some words here today', 1).includes('...'), 'hook title');

// YouTube link validation (pure, no network)
const { isYouTubeUrl } = require('../src/clippedai/youtube');
assert(isYouTubeUrl('https://www.youtube.com/watch?v=BaW_jenozKc') === true, 'watch url');
assert(isYouTubeUrl('https://youtu.be/BaW_jenozKc') === true, 'short url');
assert(isYouTubeUrl('https://www.youtube.com/shorts/BaW_jenozKc') === true, 'shorts url');
assert(isYouTubeUrl('https://www.youtube.com/live/BaW_jenozKc') === true, 'live url');
assert(isYouTubeUrl('https://vimeo.com/12345') === false, 'non-youtube rejected');
assert(isYouTubeUrl('not a url') === false, 'garbage rejected');
assert(isYouTubeUrl('') === false, 'empty rejected');
assert(isYouTubeUrl('https://www.youtube.com/watch') === false, 'watch without id rejected');

// Key routing: gsk_ -> groq (either slot), sk- -> openai only
const { groqKey, openaiKey } = require('../src/clippedai/keys');
const savedGroq = process.env.GROQ_API_KEY;
const savedOpenai = process.env.OPENAI_API_KEY;
try {
  delete process.env.GROQ_API_KEY;
  process.env.OPENAI_API_KEY = 'gsk_test123';
  assert.strictEqual(groqKey(), 'gsk_test123', 'gsk_ in OPENAI slot routes to groq');
  assert.strictEqual(openaiKey(), '', 'gsk_ never routes to openai');
  process.env.OPENAI_API_KEY = 'sk-test123';
  assert.strictEqual(openaiKey(), 'sk-test123', 'sk- routes to openai');
  assert.strictEqual(groqKey(), '', 'no groq without gsk_');
  process.env.GROQ_API_KEY = 'gsk_real';
  assert.strictEqual(groqKey(), 'gsk_real', 'GROQ_API_KEY slot wins');
} finally {
  if (savedGroq === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = savedGroq;
  if (savedOpenai === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedOpenai;
}

console.log('ALL CLIPAI UNIT TESTS PASSED');
