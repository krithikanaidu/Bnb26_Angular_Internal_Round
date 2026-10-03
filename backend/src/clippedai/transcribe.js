// Transcription: real speech-to-text with word timestamps.
//
// Mirrors ClippedAI's transcribe step (main.py transcribe_with_progress), but
// resolves a REAL engine instead of degrading to placeholder data. That
// distinction matters: clip boundaries, hooks, engagement scores and burned
// captions are all derived from this transcript, so a fallback here makes the
// entire product static. See keys.sttProvider() for the resolution order.
//
// Providers: OpenAI Whisper → Groq whisper-large-v3-turbo.
//
// There is NO fabricated-transcript fallback any more. Whisper asked to
// transcribe silence does not return nothing — it returns its classic
// "Thank you. Thank you. Thank you." loop, and that hallucination used to get
// burned into every clip as if it were real dialogue. Silent input is now
// detected up front and reported as the honest error it is.
'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { probeDuration, probeAudio, extractAudio, isSilentOrMute } = require('./ffmpeg');
const { sttProvider } = require('./keys');

// Whisper chunk length. 10 min keeps each request small/fast and gives the
// UI honest incremental progress on long sources.
const CHUNK_SEC = Number(process.env.CLIPAI_STT_CHUNK_SEC || 600);
const MAX_ATTEMPTS = 3;

/** Filler phrases Whisper emits when it has nothing real to work with. */
const HALLUCINATION_PHRASES = [
  'thank you', 'thanks for watching', 'thank you for watching', 'subscribe',
  'like and subscribe', 'bye', 'bye bye', 'the end', 'you', 'so',
];

const normaliseToken = (w) => String(w || '').toLowerCase().replace(/[^a-z0-9']/g, '');

/**
 * Detect a hallucinated / degenerate transcript.
 *
 * Whisper on silence, music or noise reliably produces a short phrase repeated
 * over and over ("Thank you." x6). Those words have perfectly valid-looking
 * timestamps, so a naive length check waves them through and every downstream
 * stage treats them as real speech — which is how one video's captions ended up
 * on all of them. Real speech is lexically varied; a loop is not.
 *
 * @returns {null|{reason:string, detail:string}} null when the transcript looks real
 */
function isDegenerateTranscript(words) {
  const list = Array.isArray(words) ? words.filter((w) => w && w.word) : [];
  if (list.length < 4) {
    // 1-3 words is never a usable transcript for clipping.
    return { reason: 'too-few-words', detail: `only ${list.length} word(s) recognised` };
  }

  const tokens = list.map((w) => normaliseToken(w.word)).filter(Boolean);
  if (tokens.length < 4) return { reason: 'no-tokens', detail: 'no usable words' };

  // 1. Lexical diversity. Genuine speech sits well above 0.3 unique/token.
  const unique = new Set(tokens);
  const diversity = unique.size / tokens.length;
  if (diversity < 0.3) {
    return {
      reason: 'repetitive',
      detail: `only ${unique.size} distinct word(s) across ${tokens.length} words`,
    };
  }

  // 2. A single token dominating the whole transcript.
  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  let top = '';
  let topN = 0;
  for (const [t, n] of counts) if (n > topN) { top = t; topN = n; }
  if (topN / tokens.length > 0.45) {
    return { reason: 'single-word-loop', detail: `"${top}" repeated ${topN}/${tokens.length} times` };
  }

  // 3. Known filler phrase repeated back to back.
  const joined = tokens.join(' ');
  for (const phrase of HALLUCINATION_PHRASES) {
    const re = new RegExp(`(?:^| )${phrase.split(' ').join(' ')}(?: |$)`, 'g');
    const hits = (joined.match(re) || []).length;
    if (hits >= 3 && hits / tokens.length > 0.3) {
      return { reason: 'filler-loop', detail: `"${phrase}" repeated ${hits} times` };
    }
  }

  // 4. Speech density. Real narration runs well above 1 word/second; a
  //    transcript of a 10-minute video with 12 words in it is not narration.
  const span = Math.max(0, ...list.map((w) => Number(w.end) || 0)) - Math.min(0, ...list.map((w) => Number(w.start) || 0));
  if (span > 20 && tokens.length / span < 0.25) {
    return { reason: 'too-sparse', detail: `${tokens.length} words across ${Math.round(span)}s` };
  }

  return null;
}

/** Actionable message for every way a transcript can turn out to be unusable. */
function noSpeechMessage(reason, detail) {
  if (reason === 'no-audio-stream') {
    return 'This file has no audio track at all, so there is nothing to transcribe or clip. '
      + 'Re-upload a version that contains audio (screen recordings must include narration or system audio).';
  }
  if (reason === 'digital-silence' || reason === 'unmeasurable') {
    return 'This video\u2019s audio track is silent (no speech, no music \u2014 pure digital silence), '
      + 'so there is nothing to transcribe. Add narration or audio and re-upload. '
      + 'Rendering anyway would only burn invented captions onto the clips.';
  }
  if (reason === 'repetitive' || reason === 'single-word-loop' || reason === 'filler-loop') {
    return `No intelligible speech in this video \u2014 the speech-to-text engine only produced a repeated filler phrase (${detail}). `
      + 'This is what happens when the audio is silent or has no voice in it. '
      + 'Add real audio and re-upload rather than shipping captions that were invented.';
  }
  if (reason === 'too-sparse') {
    return `Almost no speech detected in this video (${detail}), so there is not enough transcript to clip. `
      + 'Use a video with continuous narration.';
  }
  return `No usable speech detected (${detail}). Use a video with clear narration.`;
}

/** Split provider response into word list + sentence-ish segments. */
function shapeResponse(data, offset = 0) {
  const words = (data.words || [])
    .map((w) => ({
      word: String(w.word || '').trim(),
      start: Number(w.start) + offset,
      end: Number(w.end) + offset,
    }))
    .filter((w) => w.word && Number.isFinite(w.start) && Number.isFinite(w.end));

  // Prefer the provider's own segments; fall back to grouping by sentence.
  let segments = (data.segments || []).map((s) => ({
    start: Number(s.start) + offset,
    end: Number(s.end) + offset,
    text: String(s.text || '').trim(),
  })).filter((s) => s.text && Number.isFinite(s.start) && Number.isFinite(s.end));

  if (!segments.length && words.length) {
    let cur = null;
    for (const w of words) {
      if (!cur || w.start - cur.start > 8 || /[.!?]$/.test(cur.text)) {
        if (cur) segments.push(cur);
        cur = { start: w.start, end: w.end, text: w.word };
      } else {
        cur.end = w.end;
        cur.text += ` ${w.word}`;
      }
    }
    if (cur) segments.push(cur);
  }

  return { words, segments };
}

/** POST one audio chunk to an OpenAI-compatible /audio/transcriptions. */
async function transcribeChunk(filePath, provider, offset) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model', provider.model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');
  // Omit `language` unless pinned so non-English sources are detected.
  const lang = process.env.CLIPAI_LANGUAGE;
  if (lang) form.append('language', lang);
  if (process.env.CLIPAI_STT_PROMPT) form.append('prompt', process.env.CLIPAI_STT_PROMPT);

  const base = provider.name === 'groq'
    ? 'https://api.groq.com/openai/v1/audio/transcriptions'
    : 'https://api.openai.com/v1/audio/transcriptions';

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { data } = await axios.post(base, form, {
        headers: { Authorization: `Bearer ${provider.key}`, ...form.getHeaders() },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 1000 * 60 * 15,
      });
      return shapeResponse(data, offset);
    } catch (e) {
      lastErr = e;
      const status = e.response?.status;
      // 4xx other than rate limits will not fix themselves.
      if (status && status !== 429 && status < 500) break;
      if (attempt < MAX_ATTEMPTS) {
        const wait = 800 * 2 ** (attempt - 1);
        console.warn(`[clipai] stt ${provider.name} attempt ${attempt} failed (${status || e.message}); retrying in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw new Error(`${provider.name} transcription failed: ${lastErr?.response?.data?.error?.message || lastErr?.message || 'unknown error'}`);
}

/**
 * Transcribe a whole video by extracting audio once, then walking it in
 * chunks so long sources report real progress instead of hanging on one
 * giant request. `onProgress(fraction, label)` fires as chunks land.
 */
async function transcribeReal(filePath, jobDir, provider, onProgress) {
  const audioPath = path.join(jobDir, 'audio.mp3');
  if (!fs.existsSync(audioPath)) {
    await extractAudio(filePath, audioPath);
  }

  const duration = await probeDuration(audioPath) || await probeDuration(filePath) || 0;
  if (!duration) throw new Error('Could not read audio duration — is the file a valid video?');

  const step = CHUNK_SEC;
  const total = Math.max(1, Math.ceil(duration / step));
  const words = [];
  const segments = [];

  for (let i = 0; i < total; i += 1) {
    const offset = i * step;
    const len = Math.min(step, duration - offset);
    // Single chunk covering the whole file → reuse the extracted audio as-is.
    const chunkPath = total > 1 ? path.join(jobDir, `chunk_${i}.mp3`) : audioPath;
    if (total > 1) {
      await extractAudio(audioPath, chunkPath, { start: offset, duration: len });
    }
    const res = await transcribeChunk(chunkPath, provider, offset);
    words.push(...res.words);
    segments.push(...res.segments);
    if (chunkPath !== audioPath) { try { fs.unlinkSync(chunkPath); } catch { /* noop */ } }
    if (onProgress) onProgress((i + 1) / total, `Transcribing ${Math.round(((i + 1) / total) * 100)}%`);
  }

  words.sort((a, b) => a.start - b.start);
  segments.sort((a, b) => a.start - b.start);

  const bad = isDegenerateTranscript(words);
  if (bad) {
    const err = new Error(noSpeechMessage(bad.reason, bad.detail));
    err.code = 'NO_SPEECH';
    throw err;
  }
  return { mode: provider.name, provider: provider.name, model: provider.model, words, segments, duration };
}

/**
 * Cache read that refuses poisoned entries.
 *
 * The cache used to be trusted on "has a non-empty words array", which meant a
 * single hallucinated run ("Thank you." x6) was replayed verbatim by every
 * later re-run of that job — the same captions came back no matter how many
 * times the user hit re-run, and no key change could clear them. Only a real
 * provider transcript that still passes the hallucination check is reusable;
 * anything else is deleted so the next run starts clean.
 */
function readCache(cachePath, providerName) {
  if (!fs.existsSync(cachePath)) return null;
  let cached = null;
  try {
    cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    try { fs.unlinkSync(cachePath); } catch { /* noop */ }
    return null;
  }

  const unusable = !cached
    || !Array.isArray(cached.words)
    || !cached.words.length
    // `heuristic` was the old fabricated-transcript mode; it never held real words.
    || cached.mode === 'heuristic'
    || (providerName !== 'none' && cached.mode !== providerName)
    || isDegenerateTranscript(cached.words);

  if (unusable) {
    console.warn('[clipai] discarding unusable cached transcript', cachePath, cached?.mode || '(none)');
    try { fs.unlinkSync(cachePath); } catch { /* noop */ }
    return null;
  }
  return { ...cached, cached: true };
}

/**
 * Entry point.
 *
 * Order matters: check the source actually has audible sound BEFORE spending a
 * speech-to-text call on it, and refuse to return anything that is not real
 * speech. A job either produces a genuine transcript or fails with a reason the
 * user can act on — it never produces invented captions.
 */
async function transcribe(filePath, jobDir, onProgress) {
  const provider = sttProvider();

  // 0. Does this file have sound at all? A present-but-silent AAC track is the
  //    common case for screen recordings and is invisible to a stream check.
  const sourceAudio = await probeAudio(filePath);
  if (!sourceAudio.hasAudio) {
    const err = new Error(noSpeechMessage('no-audio-stream'));
    err.code = 'NO_SPEECH';
    throw err;
  }

  const cachePath = path.join(jobDir, 'transcription.json');
  const cached = readCache(cachePath, provider.name);
  if (cached) return cached;

  if (provider.name === 'none') {
    const err = new Error(
      'No speech-to-text key configured, so real captions are impossible. '
      + 'Add GROQ_API_KEY (free) or OPENAI_API_KEY to backend/.env and re-run. '
      + 'Nothing is rendered with invented text.',
    );
    err.code = 'NO_STT';
    throw err;
  }

  // 1. Extract + measure before transcribing: silence must be reported as
  //    silence, not handed to Whisper to hallucinate over.
  const audioPath = path.join(jobDir, 'audio.mp3');
  if (!fs.existsSync(audioPath)) {
    await extractAudio(filePath, audioPath);
  }
  const level = await isSilentOrMute(audioPath);
  if (level.silent) {
    const err = new Error(noSpeechMessage(level.reason, level.loudness?.maxVolume != null ? `peak ${level.loudness.maxVolume} dB` : ''));
    err.code = 'NO_SPEECH';
    throw err;
  }

  const result = await transcribeReal(filePath, jobDir, provider, onProgress);

  try {
    fs.writeFileSync(cachePath, JSON.stringify({
      mode: result.mode,
      provider: result.provider,
      model: result.model,
      duration: result.duration,
      words: result.words,
      segments: result.segments,
    }));
  } catch { /* non-fatal */ }
  return result;
}

module.exports = {
  transcribe, shapeResponse, isDegenerateTranscript, noSpeechMessage, CHUNK_SEC,
};