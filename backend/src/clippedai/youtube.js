'use strict';

// YouTube ingestion via yt-dlp: validate → inspect (metadata only) → download.
// Binary resolution mirrors ffmpeg.js: CLIPAI_YTDLP_PATH > bundled
// yt-dlp-exec binary > PATH.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function resolveYtDlp() {
  if (process.env.CLIPAI_YTDLP_PATH && fs.existsSync(process.env.CLIPAI_YTDLP_PATH)) {
    return process.env.CLIPAI_YTDLP_PATH;
  }
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    require.resolve('yt-dlp-exec');
    const bin = path.join(
      path.dirname(require.resolve('yt-dlp-exec/package.json')),
      process.platform === 'win32' ? 'bin/yt-dlp.exe' : 'bin/yt-dlp',
    );
    if (fs.existsSync(bin)) return bin;
  } catch { /* not installed */ }
  return 'yt-dlp';
}

const YTDLP = resolveYtDlp();

function isYouTubeUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.length > 1;
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') return !!u.searchParams.get('v');
      return /^\/(shorts|live|embed|v)\/[^/]+/.test(u.pathname);
    }
    return false;
  } catch {
    return false;
  }
}

function runCollect(args, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, { windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('yt-dlp timed out. Check the link and your connection.'));
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`yt-dlp failed: ${err.slice(-800) || `exit ${code}`}`));
    });
  });
}

/** Metadata only — no download. Used for the pre-flight preview card. */
async function inspect(url) {
  if (!isYouTubeUrl(url)) throw new Error('That does not look like a YouTube link (watch / shorts / youtu.be).');
  const raw = await runCollect([
    '--dump-single-json', '--no-playlist', '--skip-download',
    '--no-warnings', String(url).trim(),
  ]);
  let info;
  try {
    info = JSON.parse(raw);
  } catch {
    throw new Error('Could not read video info — the video may be private, age-restricted or removed.');
  }
  const maxMin = Number(process.env.CLIPAI_YT_MAX_MIN || 120);
  if (maxMin > 0 && info.duration && info.duration > maxMin * 60) {
    throw new Error(`Video is ${Math.round(info.duration / 60)} min — over the ${maxMin} min limit (CLIPAI_YT_MAX_MIN).`);
  }
  return {
    id: info.id || null,
    title: info.title || 'YouTube video',
    duration: info.duration || 0,
    thumbnail: info.thumbnail || null,
    uploader: info.uploader || info.channel || null,
  };
}

/**
 * Download best ≤1080p mp4. Progress callback receives 0–100.
 * Returns when the file is fully written.
 */
function download(url, outPath, onProgress) {
  return new Promise((resolve, reject) => {
    // yt-dlp needs ffmpeg to merge video+audio — point it at our bundled
    // binary (ffmpeg-static), otherwise parts are left unmerged.
    let ffmpegLoc = null;
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const ff = require('./ffmpeg').FFMPEG;
      if (ff && fs.existsSync(ff)) ffmpegLoc = path.dirname(ff);
    } catch { /* merge will fail loudly below */ }
    const args = [
      '--no-playlist', '--no-warnings', '--newline',
      ...(ffmpegLoc ? ['--ffmpeg-location', ffmpegLoc] : []),
      '-f', 'bv*[height<=1080]+ba/b[height<=1080]/b',
      '--merge-output-format', 'mp4',
      '-o', outPath,
      String(url).trim(),
    ];
    const child = spawn(YTDLP, args, { windowsHide: true });
    let err = '';
    let lastPct = 0;
    const report = (pct) => {
      lastPct = Math.max(lastPct, Math.min(100, pct));
      if (onProgress) { try { onProgress(lastPct); } catch { /* noop */ } }
    };
    child.stdout.on('data', (d) => {
      const text = d.toString();
      const m = text.match(/(\d+(?:\.\d+)?)%/);
      if (m) report(parseFloat(m[1]));
    });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) {
        report(100);
        resolve(outPath);
      } else if (code === 0) {
        // Merged file missing (e.g. no ffmpeg for the merge step) — surface
        // what actually landed so the cause is obvious.
        let listing = '';
        try {
          listing = fs.readdirSync(path.dirname(outPath)).join(', ');
        } catch { /* noop */ }
        reject(new Error(`Download finished but no merged file appeared (parts: ${listing || 'none'}). ffmpeg merge failed.`));
      } else {
        reject(new Error(`Download failed: ${err.slice(-800) || `exit ${code}`}`));
      }
    });
  });
}

module.exports = { YTDLP, isYouTubeUrl, inspect, download };
