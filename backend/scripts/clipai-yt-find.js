'use strict';
// Find a short public YouTube video for testing: prints watch URLs + durations.
const { spawn } = require('child_process');
const path = require('path');

const bin = path.join(__dirname, '..', 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');
const query = process.argv[2] || 'ytsearch5:lofi hip hop short';

const child = spawn(bin, ['--dump-single-json', '--no-playlist', '--flat-playlist', '--no-warnings', query]);
let out = '';
child.stdout.on('data', (d) => { out += d.toString(); });
child.on('close', () => {
  try {
    const j = JSON.parse(out);
    for (const e of j.entries || []) {
      console.log(`${e.duration || '?'}s\t${e.title}\thttps://www.youtube.com/watch?v=${e.id}`);
    }
  } catch (err) {
    console.error('PARSE_FAIL', out.slice(-500));
  }
});
