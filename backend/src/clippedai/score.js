// Clip candidate generation + scoring.
//
// Originally a naive sliding window over word timestamps, which produced
// arbitrary mid-sentence cuts. This version is built around real speech
// structure: sentences first, then windows anchored to sentence boundaries,
// then a multi-signal score. ClippedAI's engagement formula is preserved as
// one signal (same weights) so results stay in the spirit of the original,
// but topical cohesion and hook language now carry most of the decision.
//
// The final pick is re-ranked by an LLM in ai.js — this module is the cheap,
// deterministic candidate generator that makes that ranking possible.
'use strict';

const { isFillerLoop } = require('./transcribe');

const STOPWORDS = new Set(('a an the and or but if then than that this these those of in on at to for from by with without '
  + 'is are was were be been being am do does did doing have has had having i you he she it we they me him her us them '
  + 'my your his its our their as so not no nor too very can will just should now what which who whom when where why how '
  + 'all any both each few more most other some such only own same s t don t s re ve ll d m o y ain aren couldn didn '
  + 'doesn hadn hasn haven isn ma mightn mustn needn shan shouldn wasn weren won wouldn').split(' '));

const HOOK_PATTERNS = [
  /\?/,                                   // question
  /\d/,                                   // concrete numbers
  /[$£€₹%]/,                              // money / percentages
  /\b(how|why|what)\b.*\b(to|does|did|is|are|was|were|happened|works|actually|really)\b/i,
  /\b(secret|truth|proven|shocking|nobody (tells|talks)|everyone (ignores|forgets)|truth about)\b/i,
  /\b(mistake|mistakes|wrong|never|stop|avoid|warning|danger|risky|beware)\b/i,
  /\b(free|instant|overnight|guaranteed|literally|insane|crazy|wild|unreal|game.?changer)\b/i,
  /\b(this (changed|broke|fixed|saved|ruined)|changed everything|blew up|went viral)\b/i,
  /\b(you (won't|can't|shouldn't|need to)|we (tried|found)|it turns out)\b/i,
  /!$/,
];

/** Whack-a-mole hooks: strong openers that pull a viewer past the first second. */
const OPENER_PATTERNS = [
  /\b(here'?s|this is|what if|imagine|pay attention|listen|watch|stop)\b/i,
  /\b(never|always|every|none|only)\b/i,
  /\b(because|so that'?s why|the reason|the problem|the truth|the catch)\b/i,
  /\d/,
  /\?/,
];

const tokenize = (text) => String(text || '')
  .toLowerCase()
  .replace(/[^a-z0-9'\s$%]/g, ' ')
  .split(/\s+/)
  .map((t) => t.replace(/^['$]+|['%]+$/g, ''))
  .filter((t) => t.length >= 3 && !STOPWORDS.has(t));

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const overlapRatio = (a, b) => {
  const inter = Math.max(0, Math.min(a.end_time, b.end_time) - Math.max(a.start_time, b.start_time));
  const minLen = Math.min(a.end_time - a.start_time, b.end_time - b.start_time);
  return minLen > 0 ? inter / minLen : 0;
};

/**
 * Group words into sentences using punctuation and pauses. Real sentence
 * boundaries are what let us cut on a clean in/out instead of mid-word.
 */
function buildSentences(words, { pauseGap = 0.7 } = {}) {
  const sentences = [];
  let cur = null;
  for (const w of words) {
    if (!cur) {
      cur = { start: w.start, end: w.end, words: [w] };
    } else {
      const paused = w.start - cur.end > pauseGap;
      if (paused) {
        sentences.push(cur);
        cur = { start: w.start, end: w.end, words: [w] };
      } else {
        cur.end = w.end;
        cur.words.push(w);
      }
    }
    if (/[.!?]$/.test(w.word)) {
      sentences.push(cur);
      cur = null;
    }
  }
  if (cur && cur.words.length) sentences.push(cur);
  return sentences.map((s) => {
    const text = s.words.map((w) => w.word).join(' ').replace(/\s+([,.!?;:])/g, '$1').trim();
    return { start: s.start, end: s.end, text, words: s.words };
  }).filter((s) => s.text);
}

function wordsInRange(words, start, end) {
  return words.filter((w) => w.start >= start && w.end <= end);
}

function isEngagementWord(word) {
  return /\d/.test(word) || word.includes('$') || word.includes('!');
}

/**
 * ClippedAI's original engagement score, unchanged: word density 45%
 * (min(d/3,1)), engagement-word ratio 30%, duration balance 25% (min(dur/75,1)).
 */
function engagementScore(words, start, end) {
  const clipWords = wordsInRange(words, start, end);
  if (!clipWords.length) return 0;
  const duration = end - start;
  const density = duration > 0 ? clipWords.length / duration : 0;
  const densityScore = Math.min(density / 3.0, 1.0);
  const ratio = clipWords.filter((w) => isEngagementWord(w.word)).length / clipWords.length;
  const durationScore = Math.min(duration / 75.0, 1.0);
  return densityScore * 0.45 + ratio * 0.30 + durationScore * 0.25;
}

/** How hook-like the language is (0–1). */
function hookScore(text) {
  const t = String(text || '');
  if (!t) return 0;
  let hits = 0;
  for (const re of HOOK_PATTERNS) if (re.test(t)) hits += 1;
  // Longer windows dilute density, so normalise mildly by length.
  return clamp01(hits / 4) * clamp01(0.55 + t.length / 900);
}

/** Does the clip open strong? Viewers leave in the first ~2s. */
function openerScore(words, start) {
  const head = wordsInRange(words, start, Math.min(start + 4, start + 4)).map((w) => w.word).join(' ');
  if (!head) return 0;
  let hits = 0;
  for (const re of OPENER_PATTERNS) if (re.test(head)) hits += 1;
  return clamp01(hits / 3);
}

/** Speech density: penalise long silent stretches inside the clip. */
function speechScore(words, start, end) {
  const clipWords = wordsInRange(words, start, end);
  const duration = end - start;
  if (!clipWords.length || duration <= 0) return 0;
  let speech = 0;
  for (const w of clipWords) speech += Math.max(0, w.end - w.start);
  return clamp01((speech / duration) * 1.6);
}

/** Inverse document frequency over sentences, for topical cohesion. */
function buildIdf(sentences) {
  const df = new Map();
  for (const s of sentences) {
    for (const t of new Set(tokenize(s.text))) df.set(t, (df.get(t) || 0) + 1);
  }
  const n = Math.max(1, sentences.length);
  const idf = new Map();
  for (const [t, c] of df) idf.set(t, Math.log(1 + n / c) + 1);
  return idf;
}

function termVec(text, idf) {
  const vec = new Map();
  for (const t of tokenize(text)) vec.set(t, (vec.get(t) || 0) + (idf.get(t) || 1));
  return vec;
}

function cosine(a, b) {
  if (!a.size || !b.size) return 0;
  let dot = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [t, v] of small) {
    const w = large.get(t);
    if (w) dot += v * w;
  }
  if (!dot) return 0;
  let na = 0; let nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/**
 * Topical cohesion: cosine similarity between the window's term vector and
 * the whole video's. High = the window stays on one idea (a clean, self-
 * contained short). Low = it drifts across topics and will feel incoherent.
 */
function cohesionScore(text, idf, videoVec) {
  return clamp01(cosine(termVec(text, idf), videoVec));
}

/**
 * Candidate windows: sentence-anchored spans that fit the duration budget.
 * One candidate per sentence start, extended to the furthest sentence end
 * that still fits — guarantees clean in/out points on speech.
 */
function candidateWindows(words, segments, { minLen, maxLen } = {}) {
  const sentences = buildSentences(words);
  if (!sentences.length) return [];
  const lo = Number(minLen) > 0 ? Number(minLen) : 15;
  const hi = Number(maxLen) > 0 ? Number(maxLen) : 60;

  const windows = [];
  for (let i = 0; i < sentences.length; i += 1) {
    const from = sentences[i].start;
    let bestEnd = null;
    for (let j = i; j < sentences.length; j += 1) {
      const to = sentences[j].end;
      if (to - from > hi) break;
      if (to - from >= lo) bestEnd = to;
    }
    if (bestEnd === null) continue;
    windows.push({
      start_time: from,
      end_time: bestEnd,
      text: sentences.slice(i, sentences.findIndex((s, k) => k >= i && s.end === bestEnd) + 1).map((s) => s.text).join(' '),
      startSentence: i,
    });
  }
  return windows;
}

/**
 * Score every candidate and pick `maxClips` non-overlapping moments.
 * Deterministic and cheap — ai.js re-ranks the survivors with an LLM.
 */
function selectClips(transcript, { minLen, maxLen, maxClips }) {
  const { words = [], segments = [] } = transcript || {};
  if (!words.length) return [];

  // STT segment/word ends routinely overshoot the real video length (a 12.7s
  // file can come back as one segment ending at 29.98s). Clamp every window to
  // the last real word end so selection can never propose a range that ffmpeg
  // will refuse to render.
  const realEnd = words[words.length - 1].end;
  const clampEnd = (v) => Math.min(v, realEnd);

  const sentences = buildSentences(words);
  const idf = buildIdf(sentences);
  const videoVec = termVec(sentences.map((s) => s.text).join(' '), idf);

  let windows = candidateWindows(words, segments, { minLen, maxLen })
    .map((w) => ({ ...w, start_time: clampEnd(w.start_time), end_time: clampEnd(w.end_time) }))
    .filter((w) => w.end_time > w.start_time)
    // Dynamic only: never propose a clip whose words are just a hallucinated
    // filler loop (thank-you repeats from a silent gap), even if the rest of
    // the video has real speech. Only filler vocabulary is rejected — genuinely
    // repetitive real speech still passes.
    .filter((w) => !isFillerLoop(wordsInRange(words, w.start_time, w.end_time)));

  // Nothing fits the budget: derive a window from the densest speech region so
  // short sources still yield something real instead of nothing.
  if (!windows.length) {
    const total = realEnd - words[0].start;
    const from = words[0].start;
    const to = Math.min(realEnd, from + Math.min(maxLen, total));
    // Still nothing usable (single short utterance): fall back to the real
    // speech span rather than inventing a range.
    windows = to - from >= 1 ? [{ start_time: from, end_time: to, text: '', startSentence: 0 }] : [];
  }
  if (!windows.length) return [];

  const scored = windows.map((w) => {
    const text = w.text || wordsInRange(words, w.start_time, w.end_time).map((x) => x.word).join(' ');
    const parts = {
      engagement: engagementScore(words, w.start_time, w.end_time),
      cohesion: cohesionScore(text, idf, videoVec),
      hook: hookScore(text),
      opener: openerScore(words, w.start_time),
      speech: speechScore(words, w.start_time, w.end_time),
    };
    const score = parts.engagement * 0.28
      + parts.cohesion * 0.24
      + parts.hook * 0.24
      + parts.speech * 0.14
      + parts.opener * 0.10;
    return {
      start_time: +w.start_time.toFixed(2),
      end_time: +w.end_time.toFixed(2),
      text,
      parts,
      score: +score.toFixed(4),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Greedy non-overlap: separate shorts should barely share footage, so the
  // bar is deliberately stricter than ClippedAI's single-clip behaviour.
  const picked = [];
  for (const w of scored) {
    if (picked.every((p) => overlapRatio(p, w) < 0.3)) picked.push(w);
    if (picked.length >= maxClips * 2) break;
  }

  const out = picked.slice(0, maxClips).map((w) => ({
    start_time: w.start_time,
    end_time: w.end_time,
    text: w.text,
    score: w.score,
    parts: w.parts,
  }));

  if (!out.length && scored.length) out.push(scored[0]);
  return out;
}

module.exports = {
  engagementScore,
  selectClips,
  candidateWindows,
  buildSentences,
  hookScore,
  cohesionScore,
  speechScore,
  overlapRatio,
  tokenize,
};