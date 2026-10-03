// Viral titles: same prompt/examples as ClippedAI main.py get_viral_title,
// served through the shared LLM client (Groq → OpenAI) with a heuristic
// fallback. Clip-level packaging (hook, poll, CTA) lives in ai.js.
'use strict';

const { chat, hasLlm } = require('./llm');

const EXAMPLES = [
  'She was almost dead 😵',
  'He made $1,000,000 in 1 hour 💸',
  'This changed everything... 😲',
  "They couldn't believe what happened! 😱",
  'He risked it all for this 😬',
];

function safeFilename(s) {
  // Same allow-list as ClippedAI safe_filename (letters, digits, spaces,
  // punctuation, emoji ranges) MINUS <>:"/\| which are illegal on Windows —
  // main.py keeps ':' and breaks on Windows saves.
  const base = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_.'
    + '!?.;,@#$%^&+=[]{}';
  const safe = new Set(base.split(''));
  const emojiRanges = [[0x1f600, 0x1f64f], [0x1f300, 0x1f5ff], [0x1f900, 0x1f9ff], [0x1fa70, 0x1faff]];
  const isEmoji = (ch) => {
    const cp = ch.codePointAt(0);
    return emojiRanges.some(([a, b]) => cp >= a && cp <= b);
  };
  return [...s].filter((c) => safe.has(c) || isEmoji(c)).join('');
}

function firstLine(content) {
  const lines = String(content || '')
    .split('\n')
    .map((l) => l.trim().replace(/^["']|["']$/g, ''))
    .filter((l) => l && !/^here/i.test(l) && !/^title:/i.test(l) && !/^json/i.test(l));
  return lines[0] || '';
}

function heuristicTitle(clipText, index) {
  const words = String(clipText || '').split(/\s+/).filter(Boolean);
  const hook = words.slice(0, 6).join(' ');
  const emojis = ['🔥', '😱', '💸', '🤯', '⚡'];
  const emoji = emojis[index % emojis.length];
  if (!hook) return `Viral Clip ${index + 1} ${emoji}`;
  const titled = hook.charAt(0).toUpperCase() + hook.slice(1);
  return `${titled}... ${emoji}`.slice(0, 60);
}

/**
 * Viral title for one clip. ClippedAI's original model (llama-3.1-8b-instant)
 * was retired by Groq, so the default is a live model — override with
 * CLIPAI_GROQ_MODEL.
 */
async function viralTitle(clipText, index = 0) {
  if (!hasLlm()) return heuristicTitle(clipText, index);
  try {
    const { content } = await chat([{
      role: 'user',
      content: 'Given the following transcript, generate a catchy, viral YouTube Shorts title (max 7 words). '
        + 'ALWAYS include an emoji in the title. ONLY output the title, nothing else. Do NOT use hashtags. '
        + 'Do NOT explain, do NOT repeat the prompt, do NOT add quotes. The title should be in the style of these examples: '
        + `${EXAMPLES.join(', ')}.\n\nTranscript:\n${clipText}`,
    }], { maxTokens: 200, temperature: 0.7 });
    const title = firstLine(content);
    return title ? title.slice(0, 80) : heuristicTitle(clipText, index);
  } catch (e) {
    console.warn('[clipai] title generation failed, heuristic fallback:', e.message);
    return heuristicTitle(clipText, index);
  }
}

module.exports = { viralTitle, safeFilename, heuristicTitle };