'use strict';

// Key-slot tolerant accessors. Users often paste a Groq key (gsk_…) into
// OPENAI_API_KEY — instead of failing with a cryptic 401, route each key to
// the provider it actually belongs to.

/** Groq: prefers the dedicated slot, else recognises a gsk_… key anywhere. */
function groqKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  const openai = process.env.OPENAI_API_KEY || '';
  if (/^gsk_/.test(openai)) return openai;
  return '';
}

/** OpenAI: only real sk-… keys (project keys are sk-proj-…). */
function openaiKey() {
  const key = process.env.OPENAI_API_KEY || '';
  if (/^sk-/.test(key)) return key;
  return '';
}

/**
 * Speech-to-text provider resolution.
 *
 * This is what makes the pipeline real instead of static: transcription is the
 * input to clip selection, hooks and captions, so a missing STT provider used
 * to silently degrade the whole product to fabricated placeholder timings.
 *
 * Order: OpenAI Whisper (best accuracy, paid) → Groq whisper-large-v3-turbo
 * (free, verified live) → none.
 */
function sttProvider() {
  const oa = openaiKey();
  if (oa) return { name: 'openai', key: oa, model: process.env.CLIPAI_WHISPER_MODEL || 'whisper-1' };
  const gq = groqKey();
  if (gq) return { name: 'groq', key: gq, model: process.env.CLIPAI_GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo' };
  return { name: 'none', key: '', model: '' };
}

/** True when at least one real transcription engine is available. */
function hasStt() {
  return sttProvider().name !== 'none';
}

module.exports = { groqKey, openaiKey, sttProvider, hasStt };