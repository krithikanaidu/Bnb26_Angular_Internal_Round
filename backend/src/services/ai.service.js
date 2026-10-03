const axios = require('axios');

// Unified AI layer: uses OpenAI if key present, else deterministic heuristic
// so the app works out-of-the-box for demos/hackathons.
async function llm(prompt, fallback) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return fallback();
  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are CreatorAI, an expert short-form content strategist and scriptwriter.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
      },
      { headers: { Authorization: `Bearer ${key}` } }
    );
    return data.choices[0].message.content;
  } catch (e) {
    console.warn('[ai] OpenAI failed, using heuristic:', e.message);
    return fallback();
  }
}

const HOOK_STYLES = ['curiosity', 'contrarian', 'howto', 'story', 'listicle', 'shock'];

function heuristicHooks(topic, count = 5) {
  const t = topic || 'this video';
  return [
    { text: `Stop scrolling — ${t} in 30 seconds flat.`, style: 'shock', score: 0.92 },
    { text: `I wasted 2 years on ${t} so you don't have to.`, style: 'story', score: 0.89 },
    { text: `3 ${t} mistakes killing your growth (fix #2 today).`, style: 'listicle', score: 0.87 },
    { text: `Why nobody talks about this ${t} shortcut…`, style: 'curiosity', score: 0.85 },
    { text: `POV: you finally crack ${t} — here's step one.`, style: 'howto', score: 0.83 },
    { text: `Unpopular opinion: everything you know about ${t} is wrong.`, style: 'contrarian', score: 0.81 },
  ].slice(0, count);
}

function heuristicScript(topic, tone = 'energetic') {
  return {
    title: `${topic} — 60s script`,
    body: [
      `HOOK (0-3s): Stop scrolling — ${topic} in 30 seconds flat.`,
      `CONTEXT (3-10s): If you're a creator juggling scripting, filming and posting — this is for you.`,
      `VALUE (10-40s): Step 1: dump your raw idea. Step 2: let AI pull the 3 strongest beats. Step 3: cut everything else. B-roll over each beat, captions on, jump-cut every 2s.`,
      `PROOF (40-50s): Creators using this cut editing time 70% and doubled retention.`,
      `CTA (50-60s): Comment "${tone.toUpperCase()}" and I'll send the template. Follow for part 2.`,
    ].join('\n'),
  };
}

async function generateHooks(topic, count = 5) {
  return llm(`Generate ${count} viral hooks for: ${topic}. Return JSON array [{text,style,score}].`, () =>
    JSON.stringify(heuristicHooks(topic, count))
  ).then((r) => {
    try { const j = JSON.parse(r); return Array.isArray(j) ? j : heuristicHooks(topic, count); }
    catch { return heuristicHooks(topic, count); }
  });
}

async function generateScript(topic, tone, platforms) {
  return llm(`Write a 60s ${tone} video script for "${topic}" optimized for ${platforms}. Include HOOK/CONTEXT/VALUE/PROOF/CTA.`, () =>
    heuristicScript(topic, tone).body
  );
}

module.exports = { llm, generateHooks, generateScript, heuristicHooks, heuristicScript, HOOK_STYLES };
