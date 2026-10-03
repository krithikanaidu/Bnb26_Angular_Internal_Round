'use strict';
// End-to-end render smoke: synthetic source -> trim + 9:16 + ASS burn-in.
// Proves the ffmpeg filter graph (crop/scale/ass+fontsdir) actually works.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { FFMPEG, run, probeDuration } = require('../src/clippedai/ffmpeg');
const { buildCues, buildAss } = require('../src/clippedai/subtitles');
const { renderOne } = require('../src/clippedai/pipeline');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipai-smoke-'));
  console.log('ffmpeg:', FFMPEG);

  // 6s 1280x720 test source with audio tone
  const src = path.join(dir, 'src.mp4');
  await run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=6:size=1280x720:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', src]);
  const dur = await probeDuration(src);
  assert(dur > 5 && dur < 7, `probe duration ${dur}`);

  // ASS burn-in through the real pipeline helper
  const words = [
    { word: 'hello', start: 0.2, end: 0.6 },
    { word: '$100', start: 0.7, end: 1.2 },
    { word: 'world', start: 1.3, end: 1.8 },
  ];
  const fakeClipModel = { create: async (row) => ({ id: 'clip-test', ...row }) };
  const out = await renderOne({
    Clip: fakeClipModel,
    job: { id: 'smoke', projectId: null, sourcePath: src, transcript: { mode: 'smoke' } },
    words,
    clip: { start_time: 0, end_time: 4, score: 0.9 },
    index: 0,
    jobDir: dir,
    options: { subtitles: true, portrait: true },
  });
  assert(fs.existsSync(path.join(dir, decodeURIComponent(out.file.split('/').pop()))), 'output exists');
  const stat = fs.statSync(path.join(dir, decodeURIComponent(out.file.split('/').pop())));
  assert(stat.size > 50000, `output size ${stat.size}`);

  // Verify geometry is 1080x1920
  const { FFPROBE } = require('../src/clippedai/ffmpeg');
  const { spawn } = require('child_process');
  const probe = spawn(FFPROBE, ['-v', 'quiet', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0',
    path.join(dir, decodeURIComponent(out.file.split('/').pop()))]);
  let dims = '';
  for await (const c of probe.stdout) dims += c.toString();
  assert(dims.trim() === '1080,1920', `geometry ${dims.trim()}`);
  assert(out.title && out.title.length > 0, 'viral title present');

  console.log('SMOKE OK:', JSON.stringify({ file: out.file, size: stat.size, dims: dims.trim(), title: out.title }));
  fs.rmSync(dir, { recursive: true, force: true });
})().catch((e) => { console.error('SMOKE FAILED:', e.message); process.exit(1); });
