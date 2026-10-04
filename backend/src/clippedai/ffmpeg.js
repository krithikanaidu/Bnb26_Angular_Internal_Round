// ffmpeg/ffprobe runners for the ClipAI pipeline.
// Prefers system binaries (CLIPAI_FFMPEG_PATH / PATH), falls back to the
// bundled ffmpeg-static / ffprobe-static packages (installed via npm).
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');

function resolveBinary(envVar, staticPkg, names) {
  if (process.env[envVar] && fs.existsSync(process.env[envVar])) return process.env[envVar];
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const mod = require(staticPkg);
    const p = typeof mod === 'string' ? mod : mod.path;
    if (p && fs.existsSync(p)) return p;
  } catch { /* not installed */ }
  return names[0]; // hope it's on PATH
}

const FFMPEG = resolveBinary('CLIPAI_FFMPEG_PATH', 'ffmpeg-static', ['ffmpeg']);
const FFPROBE = resolveBinary('CLIPAI_FFPROBE_PATH', 'ffprobe-static', ['ffprobe']);

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, ...opts });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stderr });
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

/** Media duration in seconds (0 when undetectable). */
async function probeDuration(filePath) {
  try {
    const child = spawn(FFPROBE, [
      '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath,
    ], { windowsHide: true });
    let out = '';
    for await (const chunk of child.stdout) out += chunk.toString();
    const code = await new Promise((res) => child.on('close', res));
    if (code !== 0) return 0;
    const dur = parseFloat(out.trim());
    return Number.isFinite(dur) ? dur : 0;
  } catch {
    return 0;
  }
}

/** Full JSON-ish stream info (width/height/duration/rotation). */
async function probeStreams(filePath) {
  try {
    const child = spawn(FFPROBE, [
      '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath,
    ], { windowsHide: true });
    let out = '';
    for await (const chunk of child.stdout) out += chunk.toString();
    const code = await new Promise((res) => child.on('close', res));
    if (code !== 0) return null;
    return JSON.parse(out);
  } catch {
    return null;
  }
}

/**
 * Run a binary and collect its output, resolving with '' on any failure.
 *
 * Collects BOTH stdout and stderr on purpose. ffmpeg writes its diagnostics —
 * including everything `-af volumedetect` reports — to stderr, while `-f null`
 * sends the real media stream nowhere. Reading only stdout made the loudness
 * numbers unparseable, so every file looked like digital silence.
 */
function capture(cmd, args, { timeout = 120000 } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { windowsHide: true });
    } catch {
      resolve('');
      return;
    }
    let out = '';
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => { try { child.kill(); } catch { /* noop */ } }, timeout);
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { out += d.toString(); });
    child.on('error', () => { clearTimeout(timer); finish(''); });
    child.on('close', () => { clearTimeout(timer); finish(out); });
  });
}

/**
 * Audio stream facts for a media file.
 *
 * A missing audio stream used to sail straight through the pipeline: the render
 * produced a silent mp4 and Whisper was handed a file it could not read, so it
 * hallucinated speech. Callers must check `hasAudio` before doing either.
 */
async function probeAudio(filePath) {
  const info = await probeStreams(filePath);
  const streams = Array.isArray(info?.streams) ? info.streams : [];
  const a = streams.find((s) => s.codec_type === 'audio');
  if (!a) return { hasAudio: false, channels: 0, sampleRate: 0, duration: 0 };
  return {
    hasAudio: true,
    channels: Number(a.channels) || 0,
    sampleRate: Number(a.sample_rate) || 0,
    duration: Number(a.duration) || Number(info?.format?.duration) || 0,
  };
}

/**
 * Integrated + peak loudness in dBFS via ffmpeg's volumedetect.
 *
 * This is the silence test. Screen recordings very often ship a real-but-empty
 * AAC track: ffprobe reports an audio stream, so "does it have audio?" says yes,
 * while the samples are digital zero. Whisper fed that produces its classic
 * "Thank you. Thank you. Thank you." loop, which used to get burned into every
 * clip as if it were real speech. `maxVolume` below SILENCE_DB_FS means there is
 * nothing to transcribe.
 */
async function measureLoudness(filePath, { timeout = 180000 } = {}) {
  const stderr = await capture(FFMPEG, [
    '-hide_banner', '-nostats', '-i', filePath, '-af', 'volumedetect', '-f', 'null', 'NUL',
  ], { timeout });
  const pick = (key) => {
    const m = stderr.match(new RegExp(`${key}:\\s*(-?[\\d.]+)\\s*dB`, 'i'));
    return m ? Number(m[1]) : null;
  };
  return { meanVolume: pick('mean_volume'), maxVolume: pick('max_volume') };
}

/** dBFS ceiling below which a track counts as silence (not speech, not music). */
const SILENCE_DB_FS = -50;

/**
 * True when the file carries no usable sound: no audio stream at all, or a
 * stream whose peak level sits under the silence floor.
 *
 * A level that could not be read (`max_volume` unparsed) is reported as
 * `unmeasured`, NOT as silence. Silently treating "we could not measure this" as
 * "this is silent" rejected every upload whenever volumedetect output was
 * unavailable. The speech-to-text result is the real arbiter of whether there is
 * speech, so an unreadable level must never block transcription on its own.
 */
async function isSilentOrMute(filePath) {
  const audio = await probeAudio(filePath);
  if (!audio.hasAudio) return { silent: true, measured: true, reason: 'no-audio-stream', audio };
  const level = await measureLoudness(filePath);
  const peak = level.maxVolume;
  const measured = Number.isFinite(peak);
  if (!measured) {
    return { silent: false, measured: false, reason: 'unmeasured', audio, loudness: level };
  }
  const silent = peak < SILENCE_DB_FS;
  return {
    silent,
    measured: true,
    reason: silent ? 'digital-silence' : 'has-sound',
    audio,
    loudness: level,
  };
}

/**
 * Extract a low-bitrate mono 16 kHz audio track for speech-to-text.
 *
 * Whisper-class models resample to 16 kHz internally, so shipping a ~32 kbps
 * mp3 instead of the source keeps uploads ~20x smaller (a 60-min video lands
 * around 14 MB, comfortably inside provider limits) and uploads far faster.
 *
 * `-ss` is placed AFTER `-i` on purpose: output seeking decodes up to the
 * offset instead of snapping to a keyframe, so reported word timestamps stay
 * frame-accurate against the original video (input seeking on mp3 drifts).
 */
async function extractAudio(inputPath, outPath, { start = 0, duration = null } = {}) {
  const args = ['-y', '-i', inputPath];
  if (start > 0) args.push('-ss', String(start));
  if (duration) args.push('-t', String(duration));
  args.push('-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '32k', outPath);
  await run(FFMPEG, args);
  return outPath;
}

/**
 * Decode `count` greyscale frames of `width` px spread across [start, end].
 * Returns raw buffers — the caller derives saliency for smart 9:16 framing.
 * Sampling at low resolution keeps this fast even on 4K sources.
 */
async function sampleGrayFrames(inputPath, { start = 0, end = 0, count = 12, width = 64 }) {
  const span = Math.max(0.1, end - start);
  const height = Math.max(2, Math.round((width * 9) / 16));
  const args = [
    '-v', 'error',
    ...(start > 0 ? ['-ss', String(start)] : []),
    '-i', inputPath,
    '-t', String(span),
    '-vf', `fps=${Math.max(0.05, count / span)},scale=${width}:${height}`,
    '-pix_fmt', 'gray',
    '-f', 'rawvideo',
    '-',
  ];
  return new Promise((resolve) => {
    const child = spawn(FFMPEG, args, { windowsHide: true });
    const chunks = [];
    child.stdout.on('data', (d) => chunks.push(d));
    let err = '';
    child.stderr.on('data', (d) => { err += d.toString(); });
    // Never let a decode hang the render queue.
    const timer = setTimeout(() => child.kill(), 60000);
    child.on('error', () => { clearTimeout(timer); resolve([]); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !chunks.length) { resolve([]); return; }
      const size = width * height;
      const buf = Buffer.concat(chunks);
      const frames = [];
      for (let o = 0; o + size <= buf.length; o += size) frames.push(buf.subarray(o, o + size));
      resolve(frames);
    });
  });
}

/** libass `ass=` filter wants forward slashes + escaped colons/drive letters. */
function assFilterPath(absPath) {
  const fwd = absPath.replace(/\\/g, '/');
  const escaped = fwd.replace(/:/g, '\\:').replace(/'/g, "\\'");
  return `ass='${escaped}'`;
}

/** Same, with a fonts dir so libass finds bundled fonts (correct quoting). */
function assFilterWithFonts(absPath, fontsDir) {
  const esc = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  return `ass='${esc(absPath)}':fontsdir='${esc(fontsDir)}'`;
}

module.exports = {
  FFMPEG, FFPROBE, run, probeDuration, probeStreams, probeAudio, measureLoudness,
  isSilentOrMute, extractAudio, sampleGrayFrames, assFilterPath, assFilterWithFonts,
  SILENCE_DB_FS,
};
