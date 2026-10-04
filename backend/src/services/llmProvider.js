// Shared LLM provider resolution: Groq (OpenAI-compatible) > OpenAI > heuristic.
// Env: GROQ_API_KEY + GROQ_MODEL | OPENAI_API_KEY + OPENAI_MODEL | AI_PROVIDER=groq|openai|heuristic
// All calls funnel through src/llm/client.js (usage logging, budgets, cache).
const { llmCall, resolveProvider, GROQ_URL, OPENAI_URL } = require('../llm/client');

async function chatJson({ system, user, temperature, json = true, task = 'default', maxTokens, timeout }) {
  const { engine, data, error } = await llmCall({
    task,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    temperature, json, maxTokens, timeout,
  });
  if (engine === 'heuristic' || data == null) return { engine: 'heuristic', data: null, error };
  return { engine, data };
}

module.exports = { resolveProvider, chatJson, GROQ_URL, OPENAI_URL };
