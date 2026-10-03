'use strict';
// Live YouTube check: inspect + download a tiny public test video.
// Usage: node scripts/clipai-yt-test.js [url]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { inspect, download } = require('../src/clippedai/youtube');

const URL = process.argv[2] || 'https://www.youtube.com/watch?v=BaW_jenozKc';

(async () => {
  const meta = await inspect(URL);
  console.log('INSPECT:', JSON.stringify({ title: meta.title, duration: meta.duration, uploader: meta.uploader }));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clipai-yt-')), 'source.mp4');
  let last = 0;
  await download(URL, out, (pct) => {
    if (pct - last >= 25 || pct === 100) { last = pct; console.log(`DOWNLOAD: ${Math.round(pct)}%`); }
  });
  const stat = fs.statSync(out);
  console.log(`SAVED: ${out} (${Math.round(stat.size / 1024)} KB)`);
})().catch((e) => { console.error('YT_TEST_FAIL:', e.message); process.exit(1); });
