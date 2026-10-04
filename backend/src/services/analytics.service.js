'use strict';

// Analytics + feedback loop: aggregate real Metrics/Clips/Hooks/Feedback into
// creator-growth signals, then feed them back into prompts (styleCard) and
// outputs (recommendations + ROI). All heavy math is pure code (zero tokens);
// the LLM is used once for a short narrative via cascade (cheap → large).

const { Op } = require('sequelize');
const { normalizeRegion } = require('./geo.service');
const { clean } = require('../llm/preprocess');

function engagement(m = {}) {
  const v = Number(m.views) || 0;
  if (!v) return 0;
  return ((Number(m.likes) || 0) + (Number(m.comments) || 0) + (Number(m.shares) || 0)) / v;
}

function avg(nums) {
  const a = nums.filter((n) => Number.isFinite(n));
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

function since(days = 30) {
  if (!days || days <= 0) return null;
  return new Date(Date.now() - days * 86400000);
}

// ---------- main aggregation (the queries the dashboard + script share) ----------
async function aggregateMetrics({ projectId, platform, region, days = 30, limitClips = 20 } = {}) {
  const { Metric, Clip, Hook } = require('../models');
  const where = {};
  if (projectId) where.projectId = projectId;
  if (platform) where.platform = platform;
  if (region) where.region = normalizeRegion(region);
  const from = since(days);
  if (from) where.createdAt = { [Op.gte]: from };

  const metrics = await Metric.findAll({ where, limit: 500, order: [['createdAt', 'DESC']] }).catch(() => []);
  const clipWhere = projectId ? { projectId } : {};
  const clips = await Clip.findAll({ where: clipWhere, limit: limitClips, order: [['viralityScore', 'DESC']] }).catch(() => []);
  const hooks = await Hook.findAll({ where: projectId ? { projectId } : {}, limit: 200, order: [['createdAt', 'DESC']] }).catch(() => []);

  const totals = metrics.length
    ? {
        views: metrics.reduce((a, m) => a + (m.views || 0), 0),
        likes: metrics.reduce((a, m) => a + (m.likes || 0), 0),
        comments: metrics.reduce((a, m) => a + (m.comments || 0), 0),
        shares: metrics.reduce((a, m) => a + (m.shares || 0), 0),
        posts: metrics.length,
        avgEngagement: +avg(metrics.map(engagement)).toFixed(4),
      }
    : null;

  // Platform lift vs creator baseline.
  const byPlatform = {};
  for (const m of metrics) {
    if (!m.platform) continue;
    (byPlatform[m.platform] ||= { views: 0, posts: 0, eng: [] }).views += m.views || 0;
    byPlatform[m.platform].posts += 1;
    byPlatform[m.platform].eng.push(engagement(m));
  }
  const overallEng = totals ? totals.avgEngagement : 0;
  const platforms = Object.entries(byPlatform).map(([platform, s]) => ({
    platform, views: s.views, posts: s.posts,
    avgEngagement: +avg(s.eng).toFixed(4),
    lift: overallEng ? +(avg(s.eng) / overallEng).toFixed(2) : null,
  })).sort((a, b) => b.views - a.views);

  // ROI: region-based interest from REAL performance (not estimates).
  const byRegion = {};
  for (const m of metrics) {
    const r = m.region ? normalizeRegion(m.region) : null;
    if (!r) continue;
    (byRegion[r] ||= { views: 0, posts: 0, eng: [] }).views += m.views || 0;
    byRegion[r].posts += 1;
    byRegion[r].eng.push(engagement(m));
  }
  const regions = Object.entries(byRegion).map(([regionCode, s]) => ({
    region: regionCode, views: s.views, posts: s.posts,
    avgEngagement: +avg(s.eng).toFixed(4),
    lift: overallEng ? +(avg(s.eng) / overallEng).toFixed(2) : null,
  })).sort((a, b) => b.views - a.views);

  // Hook-category lift: joins hooks that have scores + clips with virality.
  const catStats = {};
  for (const h of hooks) {
    const c = h.category || h.style || 'statement';
    (catStats[c] ||= { count: 0, scores: [] }).count += 1;
    if (Number.isFinite(h.score)) catStats[c].scores.push(h.score);
  }
  const hookCategories = Object.entries(catStats).map(([category, s]) => ({
    category, count: s.count, avgScore: +avg(s.scores).toFixed(3),
  })).sort((a, b) => b.avgScore - a.avgScore);

  // Duration buckets.
  const buckets = { '0-20': [], '20-40': [], '40-60': [], '60+': [] };
  for (const c of clips) {
    const d = (c.endSec - c.startSec) || 0;
    const b = d < 20 ? '0-20' : d < 40 ? '20-40' : d < 60 ? '40-60' : '60+';
    buckets[b].push(c.viralityScore || 0);
  }
  const durations = Object.entries(buckets).map(([bucket, s]) => ({
    bucket, count: s.length, avgScore: +avg(s).toFixed(3),
  }));

  // Best posting window: hour-of-day by engagement (UTC; UI localizes).
  const hours = {};
  for (const m of metrics) {
    const h = new Date(m.createdAt).getUTCHours();
    (hours[h] ||= []).push(engagement(m));
  }
  const bestHour = Object.entries(hours).map(([h, e]) => ({ hour: Number(h), avgEngagement: +avg(e).toFixed(4), posts: e.length }))
    .filter((x) => x.posts >= 2).sort((a, b) => b.avgEngagement - a.avgEngagement)[0] || null;

  const avgClipLen = clips.length
    ? +(clips.reduce((a, c) => a + ((c.endSec - c.startSec) || 0), 0) / clips.length).toFixed(1)
    : null;

  return {
    filters: { projectId: projectId || null, platform: platform || null, region: region || null, days },
    totals, platforms, regions, hookCategories, durations, bestHour,
    topClips: clips.slice(0, 5),
    clipCount: clips.length, metricCount: metrics.length,
    avgClipLen,
    sampleNote: metrics.length < 5 ? 'low-confidence: fewer than 5 metric rows' : null,
  };
}

// ---------- styleCard: ≤200-token personalization injected into prompts ----------
// Derived from real feedback + metrics. Regenerate per request (cheap, cached
// by the LLM cache on the consuming call) — never sent raw rows to the LLM.
async function styleCardFor({ projectId, niche = '', defaultTone = 'punchy' } = {}) {
  const { Feedback, Hook } = require('../models');
  let fb = [];
  try {
    fb = await Feedback.findAll({
      where: projectId ? { projectId } : {}, limit: 100, order: [['createdAt', 'DESC']],
    });
  } catch { fb = []; }
  const pos = fb.filter((f) => (f.score || 0) > 0).length;
  const neg = fb.filter((f) => (f.score || 0) < 0).length;

  let cats = [];
  try {
    const hooks = await Hook.findAll({ where: projectId ? { projectId } : {}, limit: 100, order: [['score', 'DESC']] });
    cats = [...new Set(hooks.slice(0, 10).map((h) => h.category || h.style).filter(Boolean))].slice(0, 3);
  } catch { cats = []; }

  const bits = [
    `tone:${clean(defaultTone, 20)}`,
    niche ? `niche:${clean(niche, 40)}` : null,
    cats.length ? `win:${cats.join('/')}` : null,
    fb.length ? `fb:${pos}+/${neg}-` : null,
  ].filter(Boolean);
  return clean(bits.join(' | '), 400);
}

// ---------- feedback loop ----------
async function recordFeedback({ projectId, clipId, variantId, hookId, scriptId, kind = 'up', score, region, payload } = {}) {
  const { Feedback } = require('../models');
  const k = String(kind || 'up').toLowerCase();
  const s = score != null ? Number(score) : (/^(up|accept)$/.test(k) ? 1 : /^(down|reject)$/.test(k) ? -1 : 0);
  const row = await Feedback.create({
    projectId: projectId || null, clipId: clipId || null, variantId: variantId || null,
    hookId: hookId || null, scriptId: scriptId || null, kind: k,
    score: Number.isFinite(s) ? s : 0,
    region: region ? normalizeRegion(region) : null,
    payload: payload || {},
  });
  return row;
}

// ---------- growth recommendations: heuristic (free) + 1 cheap LLM narrative ----------
function heuristicRecs(agg, trends, regionInterest) {
  const recs = [];
  const topPlat = agg.platforms[0];
  if (topPlat && topPlat.lift && topPlat.lift > 1.1) {
    recs.push({
      idea: `Post next 3 clips to ${topPlat.platform} first`,
      reason: `${topPlat.lift}x your avg engagement over ${topPlat.posts} posts`,
      evidence: { platform: topPlat.platform, lift: topPlat.lift, sample: topPlat.posts },
    });
  }
  const topRegion = (regionInterest && regionInterest.topRegion) || agg.regions[0];
  if (topRegion && (topRegion.share >= 0.4 || (topRegion.lift && topRegion.lift > 1.1))) {
    recs.push({
      idea: `Angle the next hook for ${topRegion.label || topRegion.region} viewers`,
      reason: `ROI: ${topRegion.label || topRegion.region} drives the top share of topic interest`,
      evidence: { region: topRegion.region, share: topRegion.share ?? null, lift: topRegion.lift ?? null },
    });
  }
  const topCat = agg.hookCategories[0];
  if (topCat && topCat.count >= 2) {
    recs.push({
      idea: `Lead with ${topCat.category} hooks this week`,
      reason: `Your best-scoring hook style (avg ${topCat.avgScore} over ${topCat.count})`,
      evidence: { category: topCat.category, avgScore: topCat.avgScore, sample: topCat.count },
    });
  }
  const topTrend = (trends || [])[0];
  if (topTrend) {
    recs.push({
      idea: `React to: "${String(topTrend.title).slice(0, 70)}"`,
      reason: `Live trend (score ${topTrend.score}, ${topTrend.origin}${topTrend.freshnessHrs != null ? `, ${topTrend.freshnessHrs}h fresh` : ''})`,
      evidence: { title: String(topTrend.title).slice(0, 90), score: topTrend.score, origin: topTrend.origin },
    });
  }
  if (agg.bestHour) {
    recs.push({
      idea: `Schedule around ${agg.bestHour.hour}:00 UTC`,
      reason: `Your top engagement window over ${agg.bestHour.posts} posts`,
      evidence: { hour: agg.bestHour.hour, posts: agg.bestHour.posts },
    });
  }
  return recs.slice(0, 5);
}

async function growthRecommendations({ aggregate, trends = [], regionInterest = null, topic = '', useLlm = true } = {}) {
  const recs = heuristicRecs(aggregate, trends, regionInterest);
  if (!useLlm || !recs.length) return { recommendations: recs, narrative: null, engine: 'heuristic' };
  try {
    const { llmCascade } = require('../llm/client');
    const brief = recs.slice(0, 4).map((r, i) => `${i + 1}.${r.idea} (${r.reason})`).join(' ');
    const { engine, data, route } = await llmCascade({
      task: 'insightNarrative',
      messages: [
        { role: 'system', content: 'Growth coach. 2 sentences max. JSON only. No preamble.' },
        { role: 'user', content: `Topic:"${clean(topic, 100)}"|Top:${clean(brief, 400)}|JSON {"narrative":"..."}` },
      ],
      json: true,
      validate: (d) => d && typeof d.narrative === 'string' && d.narrative.length > 10 && d.narrative.length < 600,
    });
    if (data && data.narrative) return { recommendations: recs, narrative: data.narrative.slice(0, 400), engine, route };
  } catch (e) {
    console.warn('[analytics] narrative failed:', e.message);
  }
  return { recommendations: recs, narrative: null, engine: 'heuristic' };
}

module.exports = { engagement, aggregateMetrics, styleCardFor, recordFeedback, heuristicRecs, growthRecommendations };
