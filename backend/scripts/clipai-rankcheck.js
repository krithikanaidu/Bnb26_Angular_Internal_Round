require('dotenv').config();
const { selectClips } = require('../src/clippedai/score');
const { rankMoments } = require('../src/clippedai/ai');

const t = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const maxClips = Number(process.argv[3]) || 2;

(async () => {
  const scored = selectClips(t, { minLen: 15, maxLen: 40, maxClips });
  console.log(`candidates (${scored.length}):`);
  for (const c of scored) {
    console.log(`  ${c.start_time}-${c.end_time}s score=${c.score.toFixed(3)} "${c.text.slice(0, 55)}…"`);
  }
  const ranked = await rankMoments(scored, maxClips);
  console.log(`\nrankMoments asked for ${maxClips}, returned ${ranked ? ranked.length : 'null'}`);
  if (ranked) {
    for (const c of ranked) console.log(`  ${c.start_time}-${c.end_time}s score=${c.score.toFixed(3)} "${c.text.slice(0, 55)}…"`);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
