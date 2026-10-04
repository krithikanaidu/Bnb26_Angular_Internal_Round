'use strict';

// Single LLM entry point. Every feature must go through llmCall() so usage
// logging, budgets, cache, dedupe and retry discipline apply in one place.

const axios = require('axios');
const { taskConfig } = require('./tokenBudgets');
const { clean, estimateTokens } = require('./preprocess');
const cache = require('./cache');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const PROMPT_VERSION = process.env.LLM_PROMPT_VERSION || 'v1';

function resolveProvider() {
  const want = (process.env.AI_PROVIDER || '').toLowerCase().trim();
  const groqKey = process.env.GROQ_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  if (want === 'heuristic' || want === 'none') return { provider: 'heuristic' };
  if (want === 'groq' && groqKey) return { provider: 'groq', key: groqKey, model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', url: GROQ_URL };
  if (want === 'openai' && openaiKey) return { provider: 'openai', key: openaiKey, model: process.env.OPENAI_MODEL || 'gpt-4o-mini', url: OPENAI_URL };
  if (groqKey) return { provider: 'groq', key: groqKey, model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', url: GROQ_URL };
  if (openaiKey) return { provider: 'openai', key: openaiKey, model: process.env.OPENAI_MODEL || 'gpt-4o-mini', url: OPENAI_URL };
  return { provider: 'heuristic' };
}

function clipProvider() {
  const gk = (process.env.GROQ_API_KEY || '').trim();
  if (gk) return { name: 'groq', key: gk, url: GROQ_URL, model: process.env.CLIPAI_GROQ_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-20b' };
  const ok = (process.env.OPENAI_API_KEY || '').trim();
  if (ok) return { name: 'openai', key: ok, url: OPENAI_URL, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' };
  return null;
}

function logUsage(rec) {
  // Structured log line; hook to metrics store without new deps.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ evt: 'llm_usage', v: PROMPT_VERSION, ...rec }));
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function postWithRetry(url, body, headers, { timeout = 30000, maxRetries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const started = Date.now();
      const { data } = await axios.post(url, body, { headers, timeout });
      return { data, latencyMs: Date.now() - started, retries: attempt };
    } catch (e) {
      lastErr = e;
      const status = e.response && e.response.status;
      const transient = status === 429 || (status >= 500 && status < 600) || !status;
      if (!transient || attempt >= maxRetries) break;
      const retryAfter = Number(e.response && e.response.headers && e.response.headers['retry-after']);
      const backoff = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt) + Math.random() * 200;
      await sleep(Math.min(backoff, 5000));
    }
  }
  throw lastErr;
}

/**
 * llmCall({ task, messages, json=true, temperature, maxTokens, timeout, model })
 * Returns { engine, data|null(text|json), usage, cached, model }.
 * Never throws on LLM failure — returns heuristic fallback signal instead.
 * Pass model to pin a tier (used by llmCascade); otherwise provider default.
 */
async function llmCall({ task = 'default', messages = [], json = true, temperature, maxTokens, timeout = 30000, model, fresh = false }) {
  const cfg = taskConfig(task);
  const p = resolveProvider();
  if (p.provider === 'heuristic') return { engine: 'heuristic', data: null, cached: false, usage: null };

  const temp = temperature ?? cfg.temperature ?? 0.4;
  const maxOut = maxTokens ?? cfg.maxOut ?? 500;
  const useModel = model || p.model;
  const started = Date.now();
  const inputChars = messages.reduce((a, m) => a + String(m.content || '').length, 0);

  // Token-budget guard at the edge: truncate dynamic tail instead of failing.
  if (cfg.maxInChars && inputChars > cfg.maxInChars) {
    const over = inputChars - cfg.maxInChars;
    const last = messages[messages.length - 1];
    if (last) last.content = clean(last.content, Math.max(200, String(last.content).length - over - 1));
  }

  // fresh=true (regenerate flows like recopy) skips the store: the caller
  // explicitly wants new tokens spent instead of yesterday's answer.
  const cacheKey = cfg.cacheable && !fresh
    ? cache.keyFor({ model: useModel, promptVersion: PROMPT_VERSION, task, messages, params: { temp, maxOut, json } })
    : null;
  if (cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit) {
      logUsage({ task, model: useModel, cached: true, inChars: inputChars, estIn: estimateTokens(inputChars) });
      return { ...hit, cached: true };
    }
  }

  const run = async () => {
    const body = { model: useModel, messages, temperature: temp, max_tokens: maxOut };
    if (json) body.response_format = { type: 'json_object' };
    if (p.provider === 'groq') body.reasoning_effort = 'low';
    const { data, latencyMs, retries } = await postWithRetry(p.url, body, {
      Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json',
    }, { timeout });
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    const usage = data?.usage || null;
    let parsed = text;
    if (json) {
      try { parsed = JSON.parse(text); } catch { parsed = null; }
    }
    const rec = {
      task, model: useModel, engine: p.provider, cached: false,
      inChars: inputChars, estIn: estimateTokens(inputChars),
      promptTokens: usage?.prompt_tokens ?? null,
      completionTokens: usage?.completion_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? null,
      latencyMs, retries,
    };
    logUsage(rec);
    const out = { engine: p.provider, data: parsed, raw: text, usage, cached: false, model: useModel };
    if (cacheKey && parsed != null) cache.set(cacheKey, out, cfg.cacheTtlMs);
    return out;
  };

  try {
    if (cacheKey) return await cache.dedupe(cacheKey, run);
    return await run();
  } catch (e) {
    const detail = (e.response && e.response.data ? JSON.stringify(e.response.data) : e.message).slice(0, 200);
    console.warn(`[llm] ${p.provider}/${task} failed, heuristic fallback:`, detail);
    logUsage({ task, model: useModel, engine: 'heuristic-fallback', error: detail, ms: Date.now() - started });
    return { engine: 'heuristic', data: null, error: detail, cached: false, usage: null };
  }
}

// ---------- Model cascade: cheap first, escalate once on validation fail ----------
// Keeps token cost down: easy tasks never touch the large model. The validator
// is a pure function (schema/length/confidence check) — no extra LLM call.
// Env: LLM_CHEAP_MODEL (default llama-3.1-8b-instant), LLM_LARGE_MODEL (falls
// back to provider default). Set LLM_CASCADE=0 to disable globally.
function cheapModel() { return process.env.LLM_CHEAP_MODEL || 'llama-3.1-8b-instant'; }
function largeModel() { return process.env.LLM_LARGE_MODEL || null; } // null = provider default

async function llmCascade({ task = 'default', messages = [], json = true, temperature, maxTokens, timeout = 30000, validate, forceTier } = {}) {
  const p = resolveProvider();
  if (p.provider === 'heuristic') return { engine: 'heuristic', data: null, cached: false, route: 'heuristic-no-key' };
  if (process.env.LLM_CASCADE === '0' || forceTier === 'large') {
    const out = await llmCall({ task, messages, json, temperature, maxTokens, timeout, model: largeModel() || undefined });
    return { ...out, route: 'large-direct', escalated: false };
  }
  if (forceTier === 'cheap') {
    const out = await llmCall({ task, messages, json, temperature, maxTokens, timeout, model: cheapModel() });
    return { ...out, route: 'cheap-direct', escalated: false };
  }
  const cheap = await llmCall({ task, messages, json, temperature, maxTokens, timeout, model: cheapModel() });
  if (cheap.engine === 'heuristic' || cheap.data == null) {
    // Transport failure, not a quality fail — escalate once, it may be model-specific.
    const large = await llmCall({ task, messages, json, temperature, maxTokens, timeout, model: largeModel() || undefined });
    logUsage({ evt: 'llm_route', task, route: 'escalate-transport', cheapModel: cheap.model, largeModel: large.model });
    return { ...large, route: 'escalate-transport', escalated: true };
  }
  let ok = true;
  try { ok = validate ? validate(cheap.data, cheap.raw) !== false : true; } catch { ok = false; }
  if (ok) {
    logUsage({ evt: 'llm_route', task, route: 'cheap-hit', model: cheap.model });
    return { ...cheap, route: 'cheap-hit', escalated: false };
  }
  const large = await llmCall({ task, messages, json, temperature, maxTokens, timeout, model: largeModel() || undefined });
  logUsage({ evt: 'llm_route', task, route: 'escalate-validate', cheapModel: cheap.model, largeModel: large.model });
  return { ...large, route: 'escalate-validate', escalated: true, cheapFallback: cheap.data };
}

module.exports = { llmCall, llmCascade, cheapModel, largeModel, resolveProvider, clipProvider, logUsage, PROMPT_VERSION, GROQ_URL, OPENAI_URL };
