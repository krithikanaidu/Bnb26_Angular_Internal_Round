// Ideation domain (AGENT/AI_PIPELINE.md §3.1–3.2, FEATURES.md Domain 3)
// - Hook generation: retrieve patterns → LLM (or heuristic template fill) → deterministic score
// - Script generation: Hook → Problem → 2–3 value beats → CTA, word budget = length_sec × 2.5
const axios = require('axios');
const { HookPattern } = require('../models');
const SEED = require('../data/hookPatterns.seed');

const CATEGORIES = ['question', 'statement', 'story', 'stat', 'contrarian'];
const CONTRAST = /\b(but|however|instead|unlike|actually|nobody|never|wrong|stop)\b/i;
const VIEWER = /\b(you|your|you're|you've|yours)\b/i;
const CURIOSITY = /(\?|\bwhy\b|\bhow\b|\bsecret\b|\breason\b|\bhere's\b|\btill\b|\bbefore\b|\bactually\b|…|\.\.\.)/i;

// ---------- engine ----------
function engine() { return require('./llmProvider').resolveProvider().provider; }

async function llmJson(system, user, fallbackFn) {
  const { chatJson } = require('./llmProvider');
  const { engine: eng, data } = await chatJson({ system, user, temperature: 0.8, json: true });
  if (data) return { engine: eng, data };
  return { engine: 'heuristic', data: fallbackFn() };
}

// ---------- hook pattern library (F3.2) ----------
async function listPatterns({ category, limit = 50 } = {}) {
  try {
    let rows = await HookPattern.findAll({ order: [['category', 'ASC'], ['createdAt', 'ASC']] });
    if (!rows.length) rows = await HookPattern.bulkCreate(SEED);
    if (category) rows = rows.filter((r) => r.category === category);
    return rows.slice(0, limit);
  } catch (e) { // DB down → static seed so the feature still works
    console.warn('[ideation] patterns from static seed:', e.message);
    return SEED.filter((s) => !category || s.category === category).slice(0, limit).map((s, i) => ({ id: `seed-${i}`, ...s }));
  }
}

async function retrievePatterns(count = 6) {
  const all = await listPatterns({ limit: 100 });
  // round-robin across categories for variety
  const byCat = {};
  for (const p of all) (byCat[p.category] ||= []).push(p);
  const out = [];
  let i = 0;
  while (out.length < Math.min(count, all.length)) {
    const cat = CATEGORIES[i % CATEGORIES.length];
    const bucket = byCat[cat];
    if (bucket && bucket.length) out.push(bucket.shift());
    i++;
    if (i > 200) break;
  }
  return out;
}

// ---------- deterministic hook strength score (AI_PIPELINE §3.1) ----------
function scoreHook(text, { performerPattern = false } = {}) {
  const words = (text || '').trim().split(/\s+/);
  let s = 0;
  if (words.length >= 6 && words.length <= 14) s += 0.2;
  if (/\d/.test(text) || text.includes('?') || CONTRAST.test(text)) s += 0.25;
  if (VIEWER.test(text)) s += 0.15;
  if (CURIOSITY.test(text)) s += 0.25;
  if (performerPattern) s += 0.15;
  return Math.round(Math.min(1, s) * 100) / 100;
}

function fillTemplate(template, topic) {
  return template
    .replace(/\{topic\}/g, topic || 'this video')
    .replace(/\{number\}/g, String([3, 5, 7, 10][Math.floor(Math.random() * 4)]))
    .replace(/\{audience\}/g, 'creators');
}

// ---------- hook generation (F3.1) ----------
async function generateHooks({ topic, tone = 'punchy', count = 8, niche = '', topCategories = [] }) {
  const patterns = await retrievePatterns(Math.max(5, Math.ceil(count * 0.75)));
  const fallback = () => {
    const out = [];
    for (let i = 0; i < count; i++) {
      const p = patterns[i % patterns.length];
      const text = fillTemplate(p.pattern, topic);
      out.push({ text, category: p.category, pattern_id: String(p.id) });
    }
    return { hooks: out };
  };
  const prompt = `Topic: ${topic}. Niche: ${niche}. Tone: ${tone}.
Use these proven patterns as inspiration (do not copy): ${patterns.map((p) => `[${p.category}] ${p.pattern}`).join(' | ')}
Return {"hooks":[{"text":"","category":"question|statement|story|stat|contrarian","pattern_id":""}]} — exactly ${count} hooks, each 6–14 words.`;
  const { engine: eng, data } = await llmJson('You write short-form video hooks. Return JSON only.', prompt, fallback);

  const raw = Array.isArray(data?.hooks) ? data.hooks : Array.isArray(data) ? data : [];
  const hooks = raw.slice(0, count).map((h) => {
    const patternId = h.pattern_id || h.patternId || null;
    return {
      text: h.text || fillTemplate(patterns[0].pattern, topic),
      category: CATEGORIES.includes(h.category) ? h.category : 'statement',
      patternId,
      style: h.category || 'statement', // legacy alias used by existing Hook model/pages
      score: scoreHook(h.text, { performerPattern: topCategories.includes(h.category) }),
    };
  });
  return { engine: eng, patterns, hooks };
}

// ---------- script generation (F3.3) + supporting (F3.5) ----------
// Rich brief: { hook, topic, tone, lengthSec, platforms, audience, goal,
//   language, cta, keyPoints[], avoid[], structure, persona }
// Rich output: { content, beats[{idx,text,importance,startSec,endSec,direction,broll}],
//   visuals[], shotList[], teleprompter, supporting{title,titleVariants,caption,hashtags,cta,ctaVariants}, meta{} }
function parseList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  return String(v).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

function heuristicScript({ hook, topic, tone, lengthSec, audience = '', goal = '', cta = '', keyPoints = [], avoid = [], language = 'en', platforms = 'tiktok,reels,shorts' }) {
  const t = topic || 'this topic';
  const aud = audience || 'creators';
  const kp = parseList(keyPoints);
  const budget = Math.max(30, Math.round(lengthSec * 2.5)); // ~150 wpm
  const ctaText = cta || `follow for part 2 and comment "${(t || '').split(' ')[0] || 'guide'}" for the template`;
  const valueBeats = [
    kp[0] ? `Value 1: ${kp[0]} — framed for ${aud}.` : `Value 1: the one change to ${t} you can make today (for ${aud}).`,
    kp[1] ? `Value 2: ${kp[1]}.` : `Value 2: a concrete example of ${t} working in the wild.`,
    kp[2] ? `Value 3: ${kp[2]}.` : `Value 3: the mistake to avoid and the fix${avoid.length ? ` (skip: ${avoid.slice(0, 2).join(', ')})` : ''}.`,
  ];
  if (goal) valueBeats.push(`Payoff tied to goal: ${goal}.`);
  const beats = [
    { idx: 0, text: hook, importance: 1.0, direction: 'Close-up, direct eye contact, fast hook text on screen', broll: 'Zoom-in + bold captions' },
    { idx: 1, text: `Problem: most ${aud} fumble ${t} because they skip the setup.`, importance: 0.8, direction: 'B-roll of messy workflow, red X overlays', broll: 'Screen recording / stock struggle clip' },
    ...valueBeats.map((text, i) => ({ idx: i + 2, text, importance: i === 0 ? 0.9 : 0.7, direction: 'Jump-cut every 2s, captions on keywords', broll: 'Demo / before-after / example clip' })),
  ];
  // time-box beats across lengthSec
  const per = lengthSec / (beats.length + 1);
  beats.forEach((b, i) => { b.startSec = +(i * per).toFixed(1); b.endSec = +((i + 1) * per).toFixed(1); });
  const ctaIdx = beats.length;
  beats.push({ idx: ctaIdx, text: `CTA: ${ctaText}.`, importance: 0.8, startSec: +(ctaIdx * per).toFixed(1), endSec: +lengthSec.toFixed(1), direction: 'Point to caption + end card', broll: 'End card / follow animation' });

  const perBeat = Math.max(4, Math.floor(budget / beats.length));
  const content = [
    `HOOK (0–3s): ${hook}`,
    `PROBLEM (3–10s): ${beats[1].text}`,
    `VALUE (10–${Math.round(lengthSec * 0.7)}s): ${valueBeats.join(' ')}`,
    `CTA (${Math.round(lengthSec * 0.85)}–${lengthSec}s): ${beats[beats.length - 1].text}`,
  ].join('\n\n');
  const words = content.split(/\s+/).length;
  return {
    content, beats,
    visuals: beats.map((b) => ({ beatIdx: b.idx, direction: b.direction, broll: b.broll })),
    shotList: beats.map((b) => ({ beatIdx: b.idx, shot: b.direction, audio: b.idx === 0 ? 'Hook SFX + fast VO' : 'VO, jump-cuts' })),
    teleprompter: content.replace(/^[A-Z ]+\([\d–\-s]+\):\s*/gm, ''),
    supporting: {
      title: `${t} — ${tone} cut`,
      titleVariants: [`${t} in ${lengthSec}s`, `${aud}: stop doing ${t} wrong`, `${t} — ${tone} breakdown`],
      caption: `${hook} Full breakdown inside. ${t} for ${aud} who want the shortcut.${goal ? ` Goal: ${goal}.` : ''}`,
      hashtags: ['#creatorai', '#creatoreconomy', `#${(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18) || 'content'}`],
      cta: ctaText,
      ctaVariants: [ctaText, 'Comment GUIDE for the template', 'Follow for part 2'],
    },
    meta: { wordCount: words, estSec: Math.round(words / 2.5), tone, language, platforms, budget, perBeat },
    perBeat,
  };
}

async function generateScript({ hook, topic, tone = 'punchy', lengthSec = 60, platforms = 'tiktok,reels,shorts', audience = '', goal = '', language = 'en', cta = '', keyPoints = [], avoid = [], structure = 'Hook→Problem→Value→CTA', persona = '', workspaceKey = 'default' }) {
  const brief = { tone, lengthSec, platforms, audience, goal, language, cta, keyPoints: parseList(keyPoints), avoid: parseList(avoid), structure, persona, workspaceKey };
  const fallback = () => heuristicScript({ hook, topic, tone, lengthSec, ...brief });
  const budget = Math.round(lengthSec * 2.5);
  // ML: approval-weighted examples + workspace style profile (manager 2x)
  let fewShot = '', styleHint = '';
  try {
    const { getRelevantExamples, getProfile } = require('./training.service');
    const [exs, prof] = await Promise.all([
      getRelevantExamples({ topic, audience, tone, workspaceKey, limit: 2 }),
      getProfile(workspaceKey).catch(() => null),
    ]);
    if (exs.length) fewShot = `\nLearn from these APPROVED past scripts (manager-approved weighs 2x, do not copy):\n` + exs.map((e, i) => `Example ${i + 1} [${e.actor}/${e.brief?.tone}/${e.brief?.audience}/q=${e.quality}/perf=${e.performanceScore}]: ${(e.output?.content || e.output?.body || '').slice(0, 600)}`).join('\n---\n');
    const p = prof?.toJSON ? prof.toJSON() : prof;
    if (p && (Object.keys(p.preferredTones || {}).length || p.avgLengthSec || p.ctaStyle)) {
      styleHint = `\nWorkspace style (learned): preferred tones ${JSON.stringify(p.preferredTones)}; avg length ${p.avgLengthSec || lengthSec}s; CTA style "${p.ctaStyle || cta}". Bias toward this unless brief overrides.`;
    }
  } catch { /* retrieval optional */ }
  const prompt = `Write a ${lengthSec}s ${tone} short-form video script for: ${topic}
Opening hook (use verbatim): "${hook}"
Target platforms: ${platforms}. Word budget ≈ ${budget} (~150 wpm). Language: ${language}.
Audience: ${audience || 'general creators'}. Goal: ${goal || 'retain + convert'}. CTA: ${cta || 'follow for part 2'}.
Must include (in order if given): ${(brief.keyPoints.join('; ') || 'none')}. Avoid: ${(brief.avoid.join('; ') || 'none')}.
Structure: ${structure}. Persona/voice: ${persona || tone}.${styleHint}
Each beat = one sentence-level idea with on-screen direction + b-roll suggestion + startSec/endSec summing to ${lengthSec}s.
${fewShot}
Return JSON: {"content":"full script text","beats":[{"idx":0,"text":"","importance":1.0,"startSec":0,"endSec":3,"direction":"","broll":""}],
"visuals":[{"beatIdx":0,"direction":"","broll":""}],"shotList":[{"beatIdx":0,"shot":"","audio":""}],"teleprompter":"plain VO text",
"supporting":{"title":"","titleVariants":[],"caption":"","hashtags":[],"cta":"","ctaVariants":[]},
"meta":{"wordCount":0,"estSec":${lengthSec},"tone":"${tone}","language":"${language}"}}`;
  const { engine: eng, data } = await llmJson('You are an expert short-form scriptwriter. Return JSON only.', prompt, fallback);
  const base = fallback();
  const beats = Array.isArray(data?.beats) && data.beats.length ? data.beats : base.beats;
  const normBeats = beats.map((b, i) => ({ idx: b.idx ?? i, text: b.text, importance: Number(b.importance) || 0.7, startSec: Number(b.startSec) || 0, endSec: Number(b.endSec) || 0, direction: b.direction || '', broll: b.broll || '' }));
  return {
    engine: eng,
    brief,
    content: typeof data?.content === 'string' && data.content ? data.content : base.content,
    beats: normBeats,
    visuals: Array.isArray(data?.visuals) && data.visuals.length ? data.visuals : base.visuals,
    shotList: Array.isArray(data?.shotList) && data.shotList.length ? data.shotList : base.shotList,
    teleprompter: typeof data?.teleprompter === 'string' && data.teleprompter ? data.teleprompter : base.teleprompter,
    supporting: { ...base.supporting, ...(data?.supporting || {}) },
    meta: { ...base.meta, ...(data?.meta || {}) },
  };
}

// ---------- iterative refinement (structured filters + auto-improve → preview, non-destructive) ----------
// filters: { punchiness, clarity, formality, energy, ctaStrength (1-5), targetLengthSec, focus, preserveHook }
// mode: 'auto' = quality pass with no creator work, 'custom' = apply advanced filters + free instruction
async function refineScript({ currentContent, beats = [], instruction = '', brief = {}, filters = {}, mode = 'custom' }) {
  const f = filters || {};
  const fallback = () => ({ content: currentContent, beats });
  const filterLines = [];
  if (f.punchiness) filterLines.push(`- Punchiness ${f.punchiness}/5: ${f.punchiness >= 4 ? 'shorter sentences, stronger verbs, cut filler' : f.punchiness <= 2 ? 'calmer, more explanatory' : 'balanced'}`);
  if (f.clarity) filterLines.push(`- Clarity ${f.clarity}/5: ${f.clarity >= 4 ? 'simplify for beginners, one idea per sentence' : 'keep nuance'}`);
  if (f.formality) filterLines.push(`- Formality ${f.formality}/5: ${f.formality >= 4 ? 'professional, no slang' : f.formality <= 2 ? 'casual, conversational' : 'neutral'}`);
  if (f.energy) filterLines.push(`- Energy ${f.energy}/5: ${f.energy >= 4 ? 'high-energy VO cues, exclamations sparingly' : 'steady pacing'}`);
  if (f.ctaStrength) filterLines.push(`- CTA strength ${f.ctaStrength}/5: ${f.ctaStrength >= 4 ? 'direct + time-bound CTA' : 'soft CTA'}`);
  if (f.targetLengthSec) filterLines.push(`- Retarget to ~${f.targetLengthSec}s (≈${Math.round(f.targetLengthSec * 2.5)} words), trim or expand value beats only`);
  if (f.focus) filterLines.push(`- Focus emphasis on: ${f.focus}`);
  if (f.preserveHook === true || f.preserveHook === 'true') filterLines.push('- Keep opening hook verbatim');
  const filterBlock = filterLines.length ? `STRUCTURED FILTERS:\n${filterLines.join('\n')}` : '';

  const autoBlock = mode === 'auto'
    ? `QUALITY PASS (no extra work for creator): tighten sentences, remove filler, keep hook verbatim, keep word count within ±10%, improve beat transitions, strengthen CTA, fix grammar. Do NOT change topic or add new claims.`
    : '';
  const prompt = `Rewrite this short-form script. Keep the same JSON shape and roughly the same duration/word count unless retargeting.
BRIEF: ${JSON.stringify(brief)}
${filterBlock}
${autoBlock}
USER INSTRUCTION: ${instruction || '(none — apply filters/quality pass only)'}
CURRENT SCRIPT:\n${currentContent}\nBEATS: ${JSON.stringify(beats).slice(0, 2000)}
Return JSON: {"content":"","beats":[{"idx":0,"text":"","importance":0.8,"direction":"","broll":""}],"teleprompter":"","changeSummary":"one-line summary of what changed"}`;
  const { engine: eng, data } = await llmJson('You are an expert script editor. Make measurable improvements, never worsen. Preserve hook unless told otherwise. Return JSON only.', prompt, fallback);
  return {
    engine: eng,
    content: typeof data?.content === 'string' && data.content ? data.content : currentContent,
    beats: Array.isArray(data?.beats) && data.beats.length ? data.beats : beats,
    teleprompter: typeof data?.teleprompter === 'string' && data.teleprompter ? data.teleprompter : undefined,
    changeSummary: typeof data?.changeSummary === 'string' ? data.changeSummary : '',
  };
}

module.exports = { CATEGORIES, listPatterns, retrievePatterns, scoreHook, generateHooks, generateScript, refineScript, heuristicScript, parseList, engine };
