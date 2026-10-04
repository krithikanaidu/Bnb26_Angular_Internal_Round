// Shared LLM plumbing for ClipAI (Groq first, OpenAI second).
//
// Both the clip ranker and the title/hook generator need the same things:
// a chat call that tolerates reasoning models, and lenient JSON extraction
// from a response that may be wrapped in prose or code fences.
'use strict';

const axios = require('axios');
const { groqKey, openaiKey } = require('./keys');
const { taskConfig } = require('../llm/tokenBudgets');
const { clean } = require('../llm/preprocess');
const cache = require('../llm/cache');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function provider() {
  const gk = groqKey();
  if (gk) return { name: 'groq', key: gk, url: GROQ_URL, model: process.env.CLIPAI_GROQ_MODEL || 'openai/gpt-oss-20b' };
  const ok = openaiKey();
  if (ok) return { name: 'openai', key: ok, url: OPENAI_URL, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' };
  return null;
}

const hasLlm = () => !!provider();

/**
 * One chat completion. `reasoning_effort: 'low'` matters: Groq's reasoning
 * models otherwise burn the token budget thinking and return empty content.
 * Token-optimized: per-task caps, usage logging, exact-match cache + dedupe.
 */
async function chat(messages, { maxTokens, temperature = 0.4, timeout = 45000, task = 'default', json = false } = {}) {
  const p = provider();
  if (!p) throw new Error('No LLM key configured');
  const cfg = taskConfig(task);
  const maxOut = maxTokens ?? cfg.maxOut ?? 500;
  const inChars = messages.reduce((a, m) => a + String(m.content || '').length, 0);
  const cacheKey = cfg.cacheable
    ? cache.keyFor({ model: p.model, promptVersion: 'v1', task, messages, params: { temperature, maxOut, json } })
    : null;
  if (cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ evt: 'llm_usage', task, model: p.model, cached: true, inChars }));
      return { ...hit, cached: true };
    }
  }
  const run = async () => {
    const body = {
      model: p.model,
      messages,
      max_tokens: maxOut,
      temperature,
      top_p: 0.9,
    };
    if (json) body.response_format = { type: 'json_object' };
    if (p.name === 'groq') body.reasoning_effort = 'low';
    const started = Date.now();
    const { data } = await axios.post(p.url, body, {
      headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
      timeout,
    });
    const content = String(data?.choices?.[0]?.message?.content || '').trim();
    const usage = data?.usage || null;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      evt: 'llm_usage', task, model: p.model, engine: p.name, cached: false,
      inChars, promptTokens: usage?.prompt_tokens ?? null,
      completionTokens: usage?.completion_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? null,
      latencyMs: Date.now() - started,
    }));
    const out = { content, model: p.model, provider: p.name, usage, cached: false };
    if (cacheKey) cache.set(cacheKey, out, cfg.cacheTtlMs);
    return out;
  };
  if (cacheKey) return cache.dedupe(cacheKey, run);
  return run();
}

/** Pull the first JSON object out of a model response (handles fences/prose). */
function extractJson(text) {
  const s = String(text || '').trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fenced) candidates.push(fenced[1]);
  candidates.push(s);
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(s.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c.trim());
      if (parsed && typeof parsed === 'object') return parsed;
    } catch { /* try next */ }
  }
  return null;
}

/** Chat that must return JSON; returns null instead of throwing. */
async function chatJson(messages, opts = {}) {
  try {
    const { content } = await chat(messages, { ...opts, json: true, temperature: opts.temperature ?? 0.3, task: opts.task || 'default' });
    return extractJson(content);
  } catch (e) {
    console.warn('[clipai] LLM JSON call failed:', e.message);
    return null;
  }
}

module.exports = { chat, chatJson, extractJson, hasLlm, provider };