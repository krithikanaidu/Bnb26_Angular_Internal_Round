'use strict';
// Live API test: Groq title with the user's key (works from either env slot).
// Whisper is only attempted with a real OpenAI (sk-) key.
require('dotenv').config();
const assert = require('assert');
const { groqKey, openaiKey } = require('../src/clippedai/keys');
const { viralTitle } = require('../src/clippedai/titles');

(async () => {
  console.log(`KEYS: groq=${groqKey() ? 'set' : 'missing'} openai=${openaiKey() ? 'set' : 'missing'}`);
  const title = await viralTitle('He made one hundred dollars in one hour with this simple trick', 0);
  console.log(`TITLE:${title}`);
  assert(title && title.length > 0, 'title present');
  console.log('LIVE API TEST PASSED');
})().catch((e) => { console.error('LIVE_TEST_FAIL:', e.message); process.exit(1); });
