// AI decision layer: pick the best moments and write the copy that goes with
// them. This is the step that turns "a window that scored well" into "the
// part of the video a viewer would actually finish".
'use strict';

const { chatJson, hasLlm } = require('./llm');

// Keep the prompt small — long transcripts blow the context and slow every job.
const CLIP_BUDGET_CHARS = 400;
const RANK_POOL = 8;

const clipText = (c) => String(c.text || '').replace(/\s+/g, ' ').trim().slice(0, CLIP_BUDGET_CHARS);

/**
 * Ask the model to re-rank the deterministic candidates.
 * Returns the chosen moments (same shape as input, plus `reason`), or null so
 * callers can keep the heuristic ordering.
 */
async function rankMoments(candidates, count) {
  if (!hasLlm() || !candidates.length) return null;
  const pool = candidates.slice(0, RANK_POOL).map((c, i) => ({
    id: i,
    s: +c.start_time.toFixed(1),
    e: +c.end_time.toFixed(1),
    d: +(c.end_time - c.start_time).toFixed(1),
    sc: c.score,
    txt: clipText(c),
  }));

  const data = await chatJson([
    {
      role: 'system',
      content: 'Shorts editor. Pick viral moments. JSON only. No preamble.',
    },
    {
      role: 'user',
      content: `${JSON.stringify(pool)}\nPick best ${count}, non-overlapping. JSON {"picks":[{"id":0,"reason":"<=12 words"}]} desc.`,
    },
  ], { maxTokens: 300, temperature: 0.2, task: 'rank' });

  const picks = Array.isArray(data?.picks) ? data.picks : null;
  if (!picks || !picks.length) return null;

  const chosen = [];
  for (const p of picks) {
    const idx = Number(p?.id);
    if (!Number.isInteger(idx) || idx < 0 || idx >= pool.length) continue;
    const src = candidates[idx];
    if (!src) continue;
    if (chosen.some((c) => c.start_time === src.start_time && c.end_time === src.end_time)) continue;
    chosen.push({ ...src, reason: String(p.reason || '').slice(0, 200) });
    if (chosen.length >= count) break;
  }
  return chosen.length ? chosen : null;
}

const str = (v, max = 120) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Deterministic copy derived ONLY from the real transcript, used when no LLM.
 * Nothing static: every field comes from words actually spoken in this clip.
 * When the transcript is empty there is nothing to base copy on, so
 * interactive fields stay empty instead of inventing generic text that would
 * look the same on every short.
 */
function fallbackCopy(text, index) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const first = words.slice(0, 8).join(' ');
  const hook = str(words.slice(0, 10).join(' '), 70);
  const titleCore = first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
  // Dynamic hashtags from the clip's own longer words (no generic #shorts).
  const tags = [...new Set(
    words
      .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter((w) => w.length >= 5),
  )].slice(0, 3).map((w) => `#${w}`);
  return {
    title: titleCore ? `${titleCore}... 🔥`.slice(0, 70) : `Clip ${index + 1} 🔥`,
    hook: hook || titleCore,
    pollQuestion: '',
    pollOptions: [],
    cta: '',
    hashtags: tags,
    source: 'heuristic',
    index,
  };
}

const sanitize = (s, max) => str(s, max).replace(/^["'\s]+|["'\s]+$/g, '');

/**
 * Everything a finished short needs: title, on-screen hook, an interactive
 * poll, a CTA and hashtags — all grounded in what was actually said.
 */
async function writeClipCopy({ text, duration = 0, index = 0, titleHint = '' }) {
  if (!hasLlm()) return fallbackCopy(text, index);

  const data = await chatJson([
    {
      role: 'system',
      content: 'Shorts copywriter. Grounded in transcript only. JSON only. No preamble.',
    },
    {
      role: 'user',
      content: `"${clipText({ text })}"\n${Math.round(duration)}s${titleHint ? `|draft:${str(titleHint, 60)}` : ''}\n`
        + 'JSON {"title":"<=7w +1 emoji, no #","hook":"<=9w, no emoji","pollQuestion":"<=10w","pollOptions":["",""],'
        + '"cta":"<=4w","hashtags":["#","#","#","#"]}',
    },
  ], { maxTokens: 250, temperature: 0.4, task: 'clipCopy' });

  if (!data) return fallbackCopy(text, index);

  const fb = fallbackCopy(text, index);
  const options = (Array.isArray(data.pollOptions) ? data.pollOptions : []).map((o) => sanitize(o, 28)).filter(Boolean).slice(0, 3);
  const hashtags = (Array.isArray(data.hashtags) ? data.hashtags : [])
    .map((h) => sanitize(h, 24))
    .filter((h) => h && !/\s/.test(h))
    .slice(0, 5);

  const out = {
    title: sanitize(data.title, 70) || fb.title,
    hook: sanitize(data.hook, 70) || fb.hook,
    pollQuestion: sanitize(data.pollQuestion, 80) || fb.pollQuestion,
    pollOptions: options.length >= 2 ? options : fb.pollOptions,
    cta: sanitize(data.cta, 40) || fb.cta,
    hashtags: hashtags.length ? hashtags : fb.hashtags,
    source: 'llm',
    index,
  };
  // Viral titles must carry an emoji (ClippedAI rule); repair if dropped.
  if (!/\p{Extended_Pictographic}/u.test(out.title)) out.title = `${out.title} 🔥`;
  if (!Array.isArray(out.hashtags) || !out.hashtags.length) out.hashtags = fb.hashtags;
  return out;
}

// Merged single-call packaging: title + hook + poll + CTA + hashtags.
// Replaces separate viralTitle() + writeClipCopy() calls (saves ~1 call/clip).
async function writeClipPackage(args) {
  return writeClipCopy(args);
}

module.exports = { rankMoments, writeClipCopy, writeClipPackage, fallbackCopy };