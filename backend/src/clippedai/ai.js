// AI decision layer: pick the best moments and write the copy that goes with
// them. This is the step that turns "a window that scored well" into "the
// part of the video a viewer would actually finish".
'use strict';

const { chatJson, hasLlm } = require('./llm');

// Keep the prompt small — long transcripts blow the context and slow every job.
const CLIP_BUDGET_CHARS = 1200;
const RANK_POOL = 14;

const clipText = (c) => String(c.text || '').replace(/\s+/g, ' ').slice(0, CLIP_BUDGET_CHARS);

/**
 * Ask the model to re-rank the deterministic candidates.
 * Returns the chosen moments (same shape as input, plus `reason`), or null so
 * callers can keep the heuristic ordering.
 */
async function rankMoments(candidates, count) {
  if (!hasLlm() || !candidates.length) return null;
  const pool = candidates.slice(0, RANK_POOL).map((c, i) => ({
    id: i,
    start: +c.start_time.toFixed(1),
    end: +c.end_time.toFixed(1),
    duration: +(c.end_time - c.start_time).toFixed(1),
    score: c.score,
    transcript: clipText(c),
  }));

  const data = await chatJson([
    {
      role: 'system',
      content: 'You are a short-form video editor who decides which moments of a long video become viral Shorts. '
        + 'You favour: a strong hook in the first seconds, one clear idea that stands alone without context, '
        + 'emotional or surprising content, concrete numbers, and a satisfying payoff. '
        + 'Reject rambling, housekeeping, repetition, and anything that starts or ends mid-thought. '
        + 'Reply with JSON only.',
    },
    {
      role: 'user',
      content: `Here are candidate moments from one video:\n${JSON.stringify(pool)}\n\n`
        + `Choose the best ${count} for separate Shorts. They must not overlap much. `
        + 'Return JSON: {"picks":[{"id":0,"reason":"why this works in under 12 words"}]} '
        + 'List ids in descending order of strength and include exactly the number you asked for when enough good options exist.',
    },
  ], { maxTokens: 600 });

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

/** Deterministic copy derived from the real transcript, used when no LLM. */
function fallbackCopy(text, index) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const first = words.slice(0, 8).join(' ') || 'Untitled Clip';
  const hook = str(words.slice(0, 10).join(' '), 70) || 'Watch this';
  return {
    title: `${first.charAt(0).toUpperCase() + first.slice(1)}`.slice(0, 70),
    hook,
    pollQuestion: 'Did this make sense?',
    pollOptions: ['Yes, totally', 'Nah, explain'],
    cta: 'Follow for more',
    hashtags: ['#shorts', '#viral'],
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
      content: 'You write packaging for short vertical videos that must stop the scroll. '
        + 'Be specific to the transcript — never invent facts that were not said. '
        + 'Reply with JSON only.',
    },
    {
      role: 'user',
      content: `Transcript of a ${Math.round(duration)}s short:\n"""\n${clipText({ text })}\n"""\n\n`
        + (titleHint ? `Draft title: ${titleHint}\n\n` : '')
        + 'Return JSON with exactly these keys:\n'
        + '  "title": viral title, max 7 words, MUST contain one emoji, no hashtags, no quotes\n'
        + '  "hook": on-screen hook line, max 9 words, punchy, no emoji\n'
        + '  "pollQuestion": one short question a viewer would answer, max 10 words\n'
        + '  "pollOptions": exactly 2 very short answer options\n'
        + '  "cta": short call to action, max 4 words\n'
        + '  "hashtags": exactly 4 short relevant hashtags starting with #',
    },
  ], { maxTokens: 500 });

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

module.exports = { rankMoments, writeClipCopy, fallbackCopy };