// ML loop v1 (no GPU, explainable):
// 1) Approval learning: manager approve weighs 2x creator, reject down-ranks
// 2) Performance learning: Metric views/likes boost example quality
// 3) Style profiles: per-workspace tone/audience/length/CTA aggregated
const { ScriptFeedback, ScriptExample, WorkspaceProfile, Metric, Clip } = require('../models');

function tokens(s = '') {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
}
function overlap(a = '', b = '') {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.sqrt(A.size * B.size);
}
const ACTOR_W = { manager: 2, creator: 1, system: 0.5 };

async function logFeedback({ scriptId, projectId, eventType = 'generate', actor = 'creator', rating = null, instruction = '', editedBody = '', meta = {} }) {
  try {
    return await ScriptFeedback.create({ scriptId, projectId, eventType, actor, rating, instruction, editedBody, meta: { ...meta, actor } });
  } catch (e) { console.warn('[ml] logFeedback failed:', e.message); return null; }
}

async function promoteToExample({ topic, brief = {}, output = {}, quality = 0.9, source = 'user-approved', actor = 'creator', styleTags = {} }) {
  try {
    const existing = await ScriptExample.findAll({ order: [['createdAt', 'DESC']], limit: 50 });
    const content = output.content || output.body || '';
    for (const ex of existing) {
      const exContent = ex.output?.content || ex.output?.body || '';
      if (ex.topic === topic && exContent === content) {
        await ex.update({ approvalCount: (ex.approvalCount || 1) + 1, quality: Math.min(1, (ex.quality + quality) / 2 + 0.05) });
        await recomputeProfile(brief?.workspaceKey || 'default').catch(() => {});
        return ex;
      }
    }
    const row = await ScriptExample.create({ topic, brief, output, quality, source, actor, styleTags });
    await recomputeProfile(brief?.workspaceKey || 'default').catch(() => {});
    return row;
  } catch (e) { console.warn('[ml] promote failed:', e.message); return null; }
}

// Approval + performance weighted retrieval for few-shot prompting.
async function getRelevantExamples({ topic = '', audience = '', tone = '', workspaceKey = 'default', limit = 3 } = {}) {
  try {
    const rows = await ScriptExample.findAll({ order: [['quality', 'DESC']], limit: 60 });
    if (!rows.length) return [];
    const scored = rows.map((r) => {
      const rel = overlap(topic, r.topic || '') * 0.5
        + overlap(audience, r.brief?.audience || '') * 0.2
        + (tone && (r.brief?.tone === tone || r.styleTags?.tone === tone) ? 0.15 : 0)
        + (r.brief?.workspaceKey === workspaceKey ? 0.15 : 0);
      const appr = Math.log(1 + (r.approvalCount || 1)) * 0.1 + (ACTOR_W[r.actor] || 1) * 0.05;
      const perf = (r.performanceScore || 0) * 0.25;
      return { row: r, s: rel + appr + perf, rel };
    }).sort((a, b) => b.s - a.s);
    const top = scored.filter((x) => x.rel > 0.03 || x.row.performanceScore > 0.5).slice(0, limit).map((x) => x.row);
    const fallback = top.length ? top : scored.slice(0, Math.min(limit, 1)).map((x) => x.row);
    for (const t of fallback) t.increment('usageCount').catch(() => {});
    return fallback;
  } catch (e) { console.warn('[ml] retrieval failed:', e.message); return []; }
}

// Aggregate approved examples + feedback into a workspace style profile.
async function recomputeProfile(workspaceKey = 'default') {
  const examples = await ScriptExample.findAll({ limit: 200, order: [['quality', 'DESC']] });
  const scoped = examples.filter((e) => !e.brief?.workspaceKey || e.brief.workspaceKey === workspaceKey);
  const tones = {}, audiences = {}, cats = {};
  let lenSum = 0, lenN = 0;
  const ctas = {};
  let approvals = 0, rejects = 0, ratingSum = 0, ratingN = 0;
  for (const e of scoped) {
    const w = ACTOR_W[e.actor] || 1;
    const t = e.brief?.tone || e.styleTags?.tone;
    if (t) tones[t] = (tones[t] || 0) + w;
    const a = e.brief?.audience;
    if (a) audiences[a] = (audiences[a] || 0) + w;
    const L = Number(e.brief?.lengthSec);
    if (L > 0) { lenSum += L * w; lenN += w; }
    const c = e.output?.supporting?.cta || e.brief?.cta;
    if (c) ctas[c.slice(0, 60)] = (ctas[c.slice(0, 60)] || 0) + w;
    approvals += (e.approvalCount || 1);
  }
  try {
    const fb = await ScriptFeedback.findAll({ limit: 300, order: [['createdAt', 'DESC']] });
    for (const f of fb) {
      if (f.eventType.includes('reject') || f.rating === 1 && f.eventType === 'rate') rejects++;
      if (f.rating != null) { ratingSum += Number(f.rating) || 0; ratingN++; }
    }
  } catch { /* optional */ }
  const topTones = Object.fromEntries(Object.entries(tones).sort((a, b) => b[1] - a[1]).slice(0, 5));
  const profile = {
    preferredTones: topTones,
    preferredAudiences: Object.keys(audiences).slice(0, 5),
    avgLengthSec: lenN ? Math.round(lenSum / lenN) : null,
    ctaStyle: Object.entries(ctas).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    stats: { approvals, rejects, avgRating: ratingN ? +(ratingSum / ratingN).toFixed(2) : null, examples: scoped.length, lastComputed: new Date().toISOString() },
  };
  const [row] = await WorkspaceProfile.upsert({ workspaceKey, ...profile }, { returning: true });
  return row || profile;
}

async function getProfile(workspaceKey = 'default') {
  try {
    const row = await WorkspaceProfile.findOne({ where: { workspaceKey } });
    if (row) return row;
    return await recomputeProfile(workspaceKey);
  } catch (e) { console.warn('[ml] getProfile failed:', e.message); return { workspaceKey, preferredTones: {}, preferredAudiences: [], stats: {} }; }
}

// Performance join: top-viewed clips boost matching examples' performanceScore.
async function recomputePerformance({ limit = 20 } = {}) {
  const clips = await Clip.findAll({ order: [['viralityScore', 'DESC']], limit: 50 });
  const metrics = await Metric.findAll({ limit: 200 });
  const viewsByClip = {};
  for (const m of metrics) viewsByClip[m.clipId] = (viewsByClip[m.clipId] || 0) + (m.views || 0);
  const maxViews = Math.max(1, ...Object.values(viewsByClip), ...clips.map(() => 0));
  const examples = await ScriptExample.findAll({ limit });
  let updated = 0;
  for (const ex of examples) {
    // match example topic words against clip titles/hookText
    let best = 0;
    for (const c of clips) {
      const s = Math.max(overlap(ex.topic || '', c.title || ''), overlap(ex.topic || '', c.hookText || ''));
      const perf = s * ((viewsByClip[c.id] || 0) / maxViews) + (c.viralityScore || 0) * 0.2 * s;
      if (perf > best) best = perf;
    }
    const score = Math.min(1, Math.round(best * 100) / 100);
    if (score !== ex.performanceScore) { await ex.update({ performanceScore: score }).catch(() => {}); updated++; }
  }
  return { updated, maxViews };
}

async function getInsights(workspaceKey = 'default') {
  const profile = await getProfile(workspaceKey);
  const p = profile.toJSON ? profile.toJSON() : profile;
  const tones = Object.entries(p.preferredTones || {}).sort((a, b) => b[1] - a[1]);
  const lines = [];
  if (tones.length) lines.push(`Best tone: ${tones[0][0]} (${tones[0][1]} weighted approvals, manager counts 2x).`);
  if (p.avgLengthSec) lines.push(`Sweet length: ~${p.avgLengthSec}s.`);
  if (p.ctaStyle) lines.push(`Winning CTA style: "${p.ctaStyle}".`);
  if (p.stats?.avgRating) lines.push(`Avg rating: ${p.stats.avgRating} across approvals/rejects.`);
  if (!lines.length) lines.push('Not enough approvals yet — approve 3-5 scripts (manager counts 2x) to train.');
  return { profile: p, insights: lines };
}

async function exportJSONL({ limit = 200 } = {}) {
  const rows = await ScriptExample.findAll({ order: [['quality', 'DESC']], limit });
  return rows.map((r) => ({
    messages: [
      { role: 'system', content: 'You are an expert short-form scriptwriter. Return JSON with content, beats, supporting.' },
      { role: 'user', content: `Brief: ${JSON.stringify({ topic: r.topic, ...r.brief })}` },
      { role: 'assistant', content: JSON.stringify(r.output) },
    ],
  }));
}

module.exports = { logFeedback, promoteToExample, getRelevantExamples, getProfile, recomputeProfile, recomputePerformance, getInsights, exportJSONL };
