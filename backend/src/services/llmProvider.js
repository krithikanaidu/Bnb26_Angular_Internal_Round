// Shared LLM provider resolution: Groq (OpenAI-compatible) > OpenAI > heuristic.
// Env: GROQ_API_KEY + GROQ_MODEL | OPENAI_API_KEY + OPENAI_MODEL | AI_PROVIDER=groq|openai|heuristic
const axios = require('axios');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function resolveProvider() {
  const want = (process.env.AI_PROVIDER || '').toLowerCase().trim();
  const groqKey = process.env.GROQ_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';

  if (want === 'groq' && groqKey) {
    return { provider: 'groq', key: groqKey, model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', url: GROQ_URL };
  }
  if (want === 'openai' && openaiKey) {
    return { provider: 'openai', key: openaiKey, model: process.env.OPENAI_MODEL || 'gpt-4o-mini', url: OPENAI_URL };
  }
  if (want === 'heuristic' || want === 'none') return { provider: 'heuristic' };
  // auto-detect: prefer Groq (user switched), then OpenAI
  if (groqKey) {
    return { provider: 'groq', key: groqKey, model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', url: GROQ_URL };
  }
  if (openaiKey) {
    return { provider: 'openai', key: openaiKey, model: process.env.OPENAI_MODEL || 'gpt-4o-mini', url: OPENAI_URL };
  }
  return { provider: 'heuristic' };
}

async function chatJson({ system, user, temperature = 0.8, json = true }) {
  const p = resolveProvider();
  if (p.provider === 'heuristic') return { engine: 'heuristic', data: null };
  try {
    const body = { model: p.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature };
    if (json) body.response_format = { type: 'json_object' };
    const { data } = await axios.post(p.url, body, {
      headers: { Authorization: 'Bearer ' + p.key, 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    const text = data.choices[0].message.content;
    return { engine: p.provider, data: json ? JSON.parse(text) : text };
  } catch (e) {
    const detail = e.response && e.response.data ? JSON.stringify(e.response.data).slice(0, 200) : e.message;
    console.warn(`[llm] ${p.provider} failed, heuristic fallback:`, detail);
    return { engine: 'heuristic', data: null, error: detail };
  }
}

module.exports = { resolveProvider, chatJson, GROQ_URL, OPENAI_URL };
