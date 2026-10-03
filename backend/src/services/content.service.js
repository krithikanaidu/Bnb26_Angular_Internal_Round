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
  const sentences = scriptBody.split(/(?<=[.!?\n])\s+/).filter(Boolean);
  return sentences.map((sentence, i) => {
    const scored = segments.map((seg, j) => {
      const overlap = scoreOverlap(sentence, seg.text);
      const positionPrior = 1 - Math.abs(i / sentences.length - j / Math.max(segments.length, 1)) * 0.5;
      return { seg, score: +(overlap * 0.8 + positionPrior * 0.2).toFixed(3), overlap: +overlap.toFixed(3) };
    }).sort((a, b) => b.score - a.score);
    return { sentence, best: scored[0] || null, alternatives: scored.slice(1, 3) };
  });
}

// Auto clip generation: sliding window over transcript, scores virality
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
        const q = joined.split(/\?|!/).length;
        const energy = energyWords.filter((w) => joined.toLowerCase().includes(w)).length;
        const score = Math.min(0.99, 0.55 + q * 0.06 + energy * 0.07 + Math.random() * 0.05);
        clips.push({
          startSec: segments[i].startSec, endSec: segments[j].endSec,
          text: joined.slice(0, 220), viralityScore: +score.toFixed(2),
          hookText: texts[0].slice(0, 90),
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

function adaptClip(clip, platform) {
  const p = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.tiktok;
  const dur = (clip.endSec ?? 30) - (clip.startSec ?? 0);
  const actions = [];
  if (dur > p.maxSec) actions.push(`Trim ${dur.toFixed(0)}s → ${p.maxSec}s (keep highest-energy window)`);
  actions.push(`Reframe to ${p.aspect}, keep faces in center-safe zone`);
  actions.push(`Rewrite caption ≤ ${p.captionMax} chars, ${p.hashtagsCount ?? p.hashtags?.max ?? 5} hashtags`);
  return { platform, preset: p, actions, caption: `${clip.hookText || clip.title || 'New drop'} 🔥`, hashtags: ['#creatorai', `#${platform}`, '#shorts', '#contentops'].slice(0, p.hashtagsCount ?? 5) };
}

module.exports = { alignScriptToTranscript, generateClips, PLATFORM_PRESETS, adaptClip };
