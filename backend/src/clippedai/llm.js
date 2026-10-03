// Shared LLM plumbing for ClipAI (Groq first, OpenAI second).
//
// Both the clip ranker and the title/hook generator need the same things:
// a chat call that tolerates reasoning models, and lenient JSON extraction
// from a response that may be wrapped in prose or code fences.
'use strict';

const axios = require('axios');
const { groqKey, openaiKey } = require('./keys');

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
 */
async function chat(messages, { maxTokens = 700, temperature = 0.6, timeout = 45000 } = {}) {
  const p = provider();
  if (!p) throw new Error('No LLM key configured');
  const { data } = await axios.post(p.url, {
    model: p.model,
    messages,
    max_tokens: maxTokens,
    temperature,
    top_p: 0.9,
    reasoning_effort: p.name === 'groq' ? 'low' : undefined,
  }, {
    headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
    timeout,
  });
  const content = data?.choices?.[0]?.message?.content || '';
  return { content: String(content).trim(), model: p.model, provider: p.name };
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
    const { content } = await chat(messages, { ...opts, temperature: opts.temperature ?? 0.4 });
    return extractJson(content);
  } catch (e) {
    console.warn('[clipai] LLM JSON call failed:', e.message);
    return null;
  }
}

module.exports = { chat, chatJson, extractJson, hasLlm, provider };