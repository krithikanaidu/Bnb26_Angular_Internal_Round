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

async function llmJson(system, user, fallbackFn, { task = 'default', temperature = 0.4, maxTokens, validate } = {}) {
  const { llmCascade } = require('../llm/client');
  try {
    const { engine: eng, data, route } = await llmCascade({
      task,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      json: true, temperature, maxTokens, validate,
    });
    if (data) return { engine: eng, data, route };
  } catch (e) {
    console.warn(`[ideation] ${task} cascade failed:`, e.message);
  }
  return { engine: 'heuristic', data: fallbackFn(), route: 'heuristic-fallback' };
}

// Compact trend + style context (token-bounded): top-3 trend titles ≤60ch,
// styleCard ≤200 tokens equivalent. Keeps prompts trend-aware for ~60 tokens.
function trendContextBlock(trends = [], max = 3) {
  const items = (trends || []).slice(0, max).map((t) => String(t.title || '').replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean);
  return items.length ? `|Trends:${items.join(' ~ ')}` : '';
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
// trendAware: { trends, styleCard, geo } — all optional, token-bounded.
async function generateHooks({ topic, tone = 'punchy', count = 8, niche = '', topCategories = [], trends = [], styleCard = '', geo = '' }) {
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
  const { compactPatterns, clean } = require('../llm/preprocess');
  const t = clean(topic, 200);
  const style = clean(styleCard, 400);
  const prompt = `Topic:${t}|Niche:${clean(niche, 60)}|Tone:${clean(tone, 20)}${geo ? `|Geo:${clean(geo, 8)}` : ''}${style ? `|You:${style}` : ''}|Styles:${compactPatterns(patterns, 60, 5)}${trendContextBlock(trends)}`
    + `|N=${Math.min(count, 8)} hooks 6-14 words. JSON {"hooks":[{"text":"","category":"question|statement|story|stat|contrarian","pattern_id":""}]}. No preamble.`;
  const { engine: eng, data, route } = await llmJson(
    'Hook writer. JSON only. No preamble.',
    prompt, fallback, {
      task: 'hooks', temperature: 0.7,
      validate: (d) => Array.isArray(d?.hooks) && d.hooks.length > 0 && typeof d.hooks[0].text === 'string',
    });

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
  // Trend boost: hooks echoing a live trend title word get +0.05 (capped at 1).
  const trendWords = new Set((trends || []).flatMap((x) => String(x.title || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)));
  for (const h of hooks) {
    const words = String(h.text || '').toLowerCase().split(/[^a-z0-9]+/);
    if (words.some((w) => trendWords.has(w))) h.score = Math.min(1, +((h.score || 0) + 0.05).toFixed(2));
  }
  return { engine: eng, patterns, hooks, route };
}

// ---------- script generation (F3.3) + supporting (F3.5) ----------
function heuristicScript({ hook, topic, tone, lengthSec }) {
  const budget = Math.max(30, Math.round(lengthSec * 2.5)); // ~150 wpm
  const beats = [
    { idx: 0, text: hook, importance: 1.0 },
    { idx: 1, text: `Problem: most creators fumble ${topic} because they skip the setup.`, importance: 0.8 },
    { idx: 2, text: `Value 1: the one change to ${topic} you can make today.`, importance: 0.9 },
    { idx: 3, text: `Value 2: a concrete example of ${topic} working in the wild.`, importance: 0.7 },
    { idx: 4, text: `Value 3: the mistake to avoid and the fix.`, importance: 0.7 },
    { idx: 5, text: `CTA: follow for part 2 and comment "${(topic || '').split(' ')[0] || 'guide'}" for the template.`, importance: 0.8 },
  ];
  const perBeat = Math.max(4, Math.floor(budget / beats.length));
  const content = [
    `HOOK (0–3s): ${hook}`,
    `PROBLEM (3–10s): ${beats[1].text}`,
    `VALUE (10–${Math.round(lengthSec * 0.7)}s): ${beats[2].text} ${beats[3].text} ${beats[4].text}`,
    `CTA (${Math.round(lengthSec * 0.85)}–${lengthSec}s): ${beats[5].text}`,
  ].join('\n\n');
  return {
    content, beats,
    supporting: {
      title: `${topic} — ${tone} cut`,
      caption: `${hook} Full breakdown inside. ${topic} for creators who want the shortcut.`,
      hashtags: ['#creatorai', '#creatoreconomy', `#${(topic || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18) || 'content'}`],
      cta: 'Follow for part 2',
    },
    perBeat,
  };
}

async function generateScript({ hook, topic, tone = 'punchy', lengthSec = 60, platforms = 'tiktok,reels,shorts', trends = [], styleCard = '', geo = '' }) {
  const fallback = () => heuristicScript({ hook, topic, tone, lengthSec });
  const { clean } = require('../llm/preprocess');
  const budget = Math.round(lengthSec * 2.5);
  const style = clean(styleCard, 400);
  const prompt = `${lengthSec}s ${clean(tone, 20)} script:${clean(topic, 200)}|Hook:"${clean(hook, 140)}"`
    + `|Platforms:${clean(platforms, 60)}${geo ? `|Geo:${clean(geo, 8)}` : ''}${style ? `|You:${style}` : ''}${trendContextBlock(trends, 2)}|~${budget}w|Hook>Problem>2-3 beats>CTA|`
    + `JSON {"content":"","beats":[{"idx":0,"text":"","importance":1}],"supporting":{"title":"","caption":"","hashtags":[],"cta":""}}. No preamble.`;
  const { engine: eng, data, route } = await llmJson(
    'Scriptwriter. JSON only. No preamble.',
    prompt, fallback, {
      task: 'script', temperature: 0.7,
      validate: (d) => typeof d?.content === 'string' && d.content.length > 20 && Array.isArray(d?.beats) && d.beats.length > 0,
    });
  const base = fallback();
  const beats = Array.isArray(data?.beats) && data.beats.length ? data.beats : base.beats;
  return {
    engine: eng, route,
    content: typeof data?.content === 'string' && data.content ? data.content : base.content,
    beats: beats.map((b, i) => ({ idx: b.idx ?? i, text: b.text, importance: Number(b.importance) || 0.7 })),
    supporting: { ...base.supporting, ...(data?.supporting || {}) },
  };
}

module.exports = { CATEGORIES, listPatterns, retrievePatterns, scoreHook, generateHooks, generateScript, heuristicScript, engine };
