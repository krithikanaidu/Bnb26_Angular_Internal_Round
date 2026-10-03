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

// Multi-platform adaptation presets
const PLATFORM_PRESETS = {
  tiktok: { aspect: '9:16', maxSec: 180, captionMax: 2200, hashtags: 5, safeZones: 'top 150px / bottom 300px', notes: 'Loud hook in 1s, captions burned-in, trending sound.' },
  reels: { aspect: '9:16', maxSec: 90, captionMax: 2200, hashtags: 8, safeZones: 'bottom 350px UI', notes: 'Trial reels to non-followers first.' },
  shorts: { aspect: '9:16', maxSec: 180, captionMax: 5000, hashtags: 4, safeZones: 'title-safe center', notes: '#Shorts in title/desc boosts shelf.' },
  x: { aspect: '16:9 or 1:1', maxSec: 140, captionMax: 280, hashtags: 2, safeZones: 'center', notes: 'Front-load punchline, subtitles essential (muted autoplay).' },
  linkedin: { aspect: '1:1 or 16:9', maxSec: 600, captionMax: 3000, hashtags: 5, safeZones: 'center', notes: 'Professional tone, add 3-line lesson + CTA.' },
  youtube: { aspect: '16:9', maxSec: 7200, captionMax: 5000, hashtags: 6, safeZones: 'full bleed ok', notes: 'Chapters from clip boundaries.' },
};

function adaptClip(clip, platform) {
  const p = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.tiktok;
  const dur = (clip.endSec ?? 30) - (clip.startSec ?? 0);
  const actions = [];
  if (dur > p.maxSec) actions.push(`Trim ${dur.toFixed(0)}s → ${p.maxSec}s (keep highest-energy window)`);
  actions.push(`Reframe to ${p.aspect}, keep faces in center-safe zone`);
  actions.push(`Rewrite caption ≤ ${p.captionMax} chars, ${p.hashtags} hashtags`);
  return { platform, preset: p, actions, caption: `${clip.hookText || clip.title || 'New drop'} 🔥`, hashtags: ['#creatorai', `#${platform}`, '#shorts', '#contentops'].slice(0, p.hashtags) };
}

module.exports = { alignScriptToTranscript, generateClips, PLATFORM_PRESETS, adaptClip };
