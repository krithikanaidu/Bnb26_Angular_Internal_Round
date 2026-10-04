// Script-to-video understanding: aligns script sentences to transcript segments
// via keyword overlap + position prior. Lightweight, explainable, no GPU needed.
function tokenize(s = '') {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2);
}

function scoreOverlap(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.sqrt(A.size * B.size);
}

function alignScriptToTranscript(scriptBody, segments) {
  const sentences = String(scriptBody || '').split(/(?<=[.!?\n])\s+/).filter(Boolean);
  return sentences.map((sentence, i) => {
    const scored = segments.map((seg, j) => {
      const overlap = scoreOverlap(sentence, seg.text);
      const positionPrior = 1 - Math.abs(i / sentences.length - j / Math.max(segments.length, 1)) * 0.5;
      return { seg, score: +(overlap * 0.8 + positionPrior * 0.2).toFixed(3), overlap: +overlap.toFixed(3) };
    }).sort((a, b) => b.score - a.score);
    const best = scored[0] || null;
    // Explain the match so a weak one never looks as confident as a strong one:
    // keyword hits name the evidence, a pure position fallback says so openly.
    let reason = 'no footage segments to compare against';
    if (best) {
      const shared = sharedKeywords(sentence, best.seg.text);
      reason = shared.length
        ? `${shared.length} shared keyword${shared.length === 1 ? '' : 's'} (${shared.slice(0, 5).join(', ')})`
        : 'position fallback only — no shared keywords, verify before shooting';
    }
    return { sentence, best, alternatives: scored.slice(1, 3), reason };
  });
}

// Keywords both sides share, for the alignment reason string above.
function sharedKeywords(a, b) {
  const B = new Set(tokenize(b));
  return [...new Set(tokenize(a))].filter((w) => B.has(w));
}

// Cut text on a word boundary so hooks never end mid-word ("...content crea").
function cutWords(s = '', max = 90) {
  const t = String(s).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.4 ? cut.slice(0, sp) : cut).trimEnd() + '…';
}

// Auto clip generation: sliding window over transcript, scores virality.
// Deterministic: the same transcript always yields the same scores and order,
// so a demo run is repeatable. Every clip carries plain-language reasons.
function generateClips(segments, { minLen = 20, maxLen = 45 } = {}) {
  if (!segments.length) return [];
  const energyWords = ['secret', 'mistake', 'free', 'stop', 'proven', 'hack', 'shocking', 'truth', 'never', 'always', 'how', 'why'];
  const clips = [];
  for (let i = 0; i < segments.length; i++) {
    let dur = 0, texts = [];
    for (let j = i; j < segments.length && dur < maxLen; j++) {
      dur = segments[j].endSec - segments[i].startSec;
      texts.push(segments[j].text);
      if (dur >= minLen) {
        const joined = texts.join(' ');
        const lowered = joined.toLowerCase();
        const questions = (joined.match(/[?!]/g) || []).length;
        const energyHits = energyWords.filter((w) => lowered.includes(w));
        const reasons = [];
        if (questions) reasons.push(`${questions} question/exclamation mark${questions === 1 ? '' : 's'} — opening curiosity`);
        if (energyHits.length) reasons.push(`high-energy words: ${energyHits.slice(0, 4).join(', ')}`);
        reasons.push(`${Math.round(dur)}s window, snapped to sentence boundaries`);
        if (!reasons.length) reasons.push('steady informative passage');
        const score = Math.min(0.99, 0.55 + questions * 0.06 + energyHits.length * 0.07);
        clips.push({
          startSec: segments[i].startSec, endSec: segments[j].endSec,
          text: joined.slice(0, 220), viralityScore: +score.toFixed(2),
          hookText: cutWords(texts[0], 90),
          reasons,
        });
        break;
      }
    }
  }
  return clips.sort((a, b) => b.viralityScore - a.viralityScore).slice(0, 6);
}

// Multi-platform adaptation presets — full schema lives in config/platformPresets.js
// (PUBLISHING.md §2). Legacy aliases (maxSec/captionMax/notes/safeZones) are kept
// so existing callers keep working.
const PRESETS = require('../config/platformPresets');

function withLegacy(p) {
  return {
    ...p,
    maxSec: p.duration.max,
    captionMax: p.caption.max_chars,
    hashtagsCount: p.hashtags.max,
    safeZones: `top ${(p.safe_zone.top * 100).toFixed(0)}% / bottom ${(p.safe_zone.bottom * 100).toFixed(0)}%`,
  };
}

const PLATFORM_PRESETS = Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, withLegacy(p)]));

// Legacy single-platform adapter, kept for /content/adapt-legacy.
// It derives everything it can from the clip and returns nulls for what it
// cannot know. It previously invented a caption, three hashtags and an emoji
// for every clip, including ones with no text at all.
function adaptClip(clip, platform) {
  const p = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.tiktok;
  const hasBounds = Number.isFinite(clip.startSec) && Number.isFinite(clip.endSec);
  const dur = hasBounds ? clip.endSec - clip.startSec : null;
  const maxTags = p.hashtagsCount ?? p.hashtags?.max ?? 5;
  const actions = [];
  if (dur == null) actions.push('Duration unknown — set in/out points before trimming');
  else if (dur > p.maxSec) actions.push(`Trim ${dur.toFixed(0)}s → ${p.maxSec}s (keep highest-energy window)`);
  actions.push(`Reframe to ${p.aspect}, keep faces in center-safe zone`);
  actions.push(`Rewrite caption ≤ ${p.captionMax} chars, up to ${maxTags} hashtags`);

  const subject = (clip.hookText || clip.title || '').trim();
  const clipTags = Array.isArray(clip.hashtags) ? clip.hashtags : [];
  return {
    platform,
    preset: p,
    actions,
    duration: dur == null ? null : +dur.toFixed(1),
    caption: subject || null,
    hashtags: clipTags.length ? clipTags.slice(0, maxTags) : [],
  };
}

module.exports = { alignScriptToTranscript, generateClips, PLATFORM_PRESETS, adaptClip };
