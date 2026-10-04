'use strict';

// Zero-token input normalization. Runs BEFORE any LLM call.
// estimateTokens uses chars/4 heuristic (documented as estimate — Llama and
// gpt-oss tokenizers differ slightly, so budgets use a safety margin).

function normalize(s = '') {
  return String(s == null ? '' : s)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function clean(s = '', max = 0) {
  let t = String(s == null ? '' : s)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (max > 0 && t.length > max) {
    const cut = t.slice(0, max);
    const sp = cut.lastIndexOf(' ');
    t = (sp > max * 0.4 ? cut.slice(0, sp) : cut).trimEnd() + '…';
  }
  return t;
}

function estimateTokens(s = '') {
  return Math.ceil(String(s || '').length / 4);
}

function dedupeLines(s = '') {
  const seen = new Set();
  return String(s || '')
    .split('\n')
    .filter((line) => {
      const k = line.trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join('\n');
}

// Compact hook patterns: "cat:template (60ch)" CSV instead of "[cat] full template | ..."
function compactPatterns(patterns = [], perPattern = 60, max = 5) {
  return patterns.slice(0, max).map((p) => {
    const cat = p.category || p.style || 'gen';
    const t = String(p.pattern || p.text || '').replace(/\s+/g, ' ').trim().slice(0, perPattern);
    return `${cat}:${t}`;
  }).join(' | ');
}

module.exports = { normalize, clean, estimateTokens, dedupeLines, compactPatterns };
