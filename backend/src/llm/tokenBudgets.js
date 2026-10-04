'use strict';

// Per-task token budgets + sampling. Single source of truth for Phase 1 caps.
// maxIn: hard input guard (chars + est tokens). maxOut: Groq max_tokens.
// Temperature: low for extraction, higher only for creative drafts.

const TASKS = {
  hooks:        { maxOut: 400, temperature: 0.7, maxInChars: 4000,  cacheTtlMs: 24 * 3600 * 1000, cacheable: true },
  script:       { maxOut: 800, temperature: 0.7, maxInChars: 2000,  cacheTtlMs: 0,                cacheable: false },
  rank:         { maxOut: 300, temperature: 0.2, maxInChars: 6000,  cacheTtlMs: 0,                cacheable: false },
  clipCopy:     { maxOut: 250, temperature: 0.4, maxInChars: 800,   cacheTtlMs: 24 * 3600 * 1000, cacheable: true },
  clipPackage:  { maxOut: 300, temperature: 0.4, maxInChars: 800,   cacheTtlMs: 24 * 3600 * 1000, cacheable: true },
  title:        { maxOut: 60,  temperature: 0.5, maxInChars: 600,   cacheTtlMs: 24 * 3600 * 1000, cacheable: true },
  adapt:        { maxOut: 500, temperature: 0.4, maxInChars: 1500,  cacheTtlMs: 6 * 3600 * 1000,  cacheable: true },
  nicheTags:    { maxOut: 150, temperature: 0.3, maxInChars: 300,   cacheTtlMs: 6 * 3600 * 1000,  cacheable: true },
  legacyHooks:  { maxOut: 300, temperature: 0.7, maxInChars: 1000,  cacheTtlMs: 3600 * 1000,      cacheable: true },
  legacyScript: { maxOut: 500, temperature: 0.7, maxInChars: 1000,  cacheTtlMs: 0,                cacheable: false },
  trendAnalysis: { maxOut: 300, temperature: 0.3, maxInChars: 2500, cacheTtlMs: 3600 * 1000,      cacheable: true },
  insightNarrative: { maxOut: 300, temperature: 0.3, maxInChars: 2500, cacheTtlMs: 3600 * 1000,   cacheable: true },
};

function taskConfig(name) {
  return TASKS[name] || { maxOut: 500, temperature: 0.4, maxInChars: 4000, cacheTtlMs: 0, cacheable: false };
}

module.exports = { TASKS, taskConfig };
