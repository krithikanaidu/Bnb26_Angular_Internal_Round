// Curated viral hook pattern library (AGENT/DATABASE.md §4.5 hook_patterns).
// Template placeholders: {topic} required, optional {audience}, {number}.
// Categories: question | statement | story | stat | contrarian
module.exports = [
  // --- question ---
  { pattern: 'Why does nobody talk about {topic}?', category: 'question', example: 'Why does nobody talk about pricing psychology?' },
  { pattern: 'What if everything you know about {topic} is wrong?', category: 'question', example: 'What if everything you know about editing is wrong?' },
  { pattern: 'Still doing {topic} the hard way? Here\'s the fix.', category: 'question', example: 'Still scripting the hard way? Here\'s the fix.' },
  { pattern: 'Ever wonder why your {topic} never takes off?', category: 'question', example: 'Ever wonder why your hooks never take off?' },
  { pattern: 'Can you really get results with {topic} in {number} days?', category: 'question', example: 'Can you really grow with short-form in 30 days?' },
  { pattern: 'Is {topic} actually worth your time?', category: 'question', example: 'Is repurposing content actually worth your time?' },

  // --- statement ---
  { pattern: 'Stop scrolling — {topic} in {number} seconds flat.', category: 'statement', example: 'Stop scrolling — better hooks in 30 seconds flat.' },
  { pattern: 'Nobody warns you about this side of {topic}.', category: 'statement', example: 'Nobody warns you about this side of going viral.' },
  { pattern: 'You\'re one {topic} change away from your next breakthrough.', category: 'statement', example: 'You\'re one hook change away from your next breakthrough.' },
  { pattern: 'Here\'s the {topic} rule nobody taught you.', category: 'statement', example: 'Here\'s the scripting rule nobody taught you.' },
  { pattern: 'Do this with {topic} before it\'s too late.', category: 'statement', example: 'Do this with your first 3 seconds before it\'s too late.' },
  { pattern: 'This is the {topic} cheat code top creators use.', category: 'statement', example: 'This is the repurposing cheat code top creators use.' },

  // --- story ---
  { pattern: 'I wasted {number} months on {topic} so you don\'t have to.', category: 'story', example: 'I wasted 12 months on bad scripts so you don\'t have to.' },
  { pattern: 'POV: you finally crack {topic} — here\'s step one.', category: 'story', example: 'POV: you finally crack short-form — here\'s step one.' },
  { pattern: 'How I went from 0 to {number} using {topic}.', category: 'story', example: 'How I went from 0 to 100k using one hook pattern.' },
  { pattern: 'The moment I realized {topic} was broken…', category: 'story', example: 'The moment I realized my content pipeline was broken…' },
  { pattern: 'A year ago I couldn\'t afford {topic}. Today…', category: 'story', example: 'A year ago I couldn\'t afford an editor. Today…' },
  { pattern: 'From clueless to confident with {topic} in one week.', category: 'story', example: 'From clueless to confident with editing in one week.' },

  // --- stat ---
  { pattern: '{number} out of 10 creators get {topic} wrong.', category: 'stat', example: '8 out of 10 creators get hooks wrong.' },
  { pattern: 'You lose {number}% of viewers in the first {number} seconds — here\'s why.', category: 'stat', example: 'You lose 70% of viewers in the first 3 seconds — here\'s why.' },
  { pattern: 'I tested {topic} {number} times. One pattern won.', category: 'stat', example: 'I tested 50 hooks. One pattern won.' },
  { pattern: '{number} minutes of work, {number}× the reach: my {topic} system.', category: 'stat', example: '20 minutes of work, 3× the reach: my repurposing system.' },
  { pattern: 'Top creators spend {number}× more time on {topic} than you think.', category: 'stat', example: 'Top creators spend 5× more time on hooks than you think.' },
  { pattern: 'A {number}% retention rate starts with these 3 words.', category: 'stat', example: 'A 90% retention rate starts with these 3 words.' },

  // --- contrarian ---
  { pattern: 'Unpopular opinion: everything you know about {topic} is wrong.', category: 'contrarian', example: 'Unpopular opinion: posting daily is wrong.' },
  { pattern: 'Stop doing {topic}. Do this instead.', category: 'contrarian', example: 'Stop editing in Premiere. Do this instead.' },
  { pattern: '{topic} is a trap — here\'s what works.', category: 'contrarian', example: 'Chasing virality is a trap — here\'s what works.' },
  { pattern: 'The best {topic} advice online is terrible.', category: 'contrarian', example: 'The best growth advice online is terrible.' },
  { pattern: 'Everyone says do X with {topic}. They\'re wrong.', category: 'contrarian', example: 'Everyone says post daily. They\'re wrong.' },
  { pattern: 'If you love {topic}, never do this.', category: 'contrarian', example: 'If you love creating, never do this.' },
];
