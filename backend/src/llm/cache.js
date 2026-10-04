'use strict';

// Exact-match response cache. Key = hash(model + promptVersion + task +
// normalized messages + params). In-memory LRU with TTL; no new deps.
// Skip for tasks that must be unique per call (script drafts).

const crypto = require('crypto');
const { normalize } = require('./preprocess');

const MAX_ENTRIES = 500;
const store = new Map(); // key -> { ts, ttlMs, value }
const stats = { hits: 0, misses: 0, sets: 0 };

function keyFor({ model = '', promptVersion = 'v1', task = '', messages = [], params = {} }) {
  const norm = messages.map((m) => `${m.role}:${normalize(m.content)}`).join('\n');
  const raw = `${model}|${promptVersion}|${task}|${norm}|${JSON.stringify(params)}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function get(key) {
  const hit = store.get(key);
  if (!hit) { stats.misses += 1; return null; }
  if (Date.now() - hit.ts > hit.ttlMs) { store.delete(key); stats.misses += 1; return null; }
  // LRU refresh
  store.delete(key);
  store.set(key, hit);
  stats.hits += 1;
  return hit.value;
}

function set(key, value, ttlMs = 3600 * 1000) {
  if (!ttlMs || ttlMs <= 0) return;
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  store.set(key, { ts: Date.now(), ttlMs, value });
  stats.sets += 1;
}

// Coalesce identical in-flight calls (double-clicks, concurrent clips).
const inflight = new Map();
async function dedupe(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const p = Promise.resolve().then(fn).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

function getStats() {
  const total = stats.hits + stats.misses;
  return { ...stats, size: store.size, hitRate: total ? +(stats.hits / total).toFixed(3) : 0 };
}

function clear() { store.clear(); inflight.clear(); stats.hits = 0; stats.misses = 0; stats.sets = 0; }

module.exports = { keyFor, get, set, dedupe, getStats, clear };
