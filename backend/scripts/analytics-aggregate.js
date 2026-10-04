// Aggregation script: runs the same queries as the analytics API and prints
// JSON for dashboards / cron / debugging.
// Usage:
//   node scripts/analytics-aggregate.js [--projectId=UUID] [--platform=tiktok]
//     [--region=IN] [--days=30] [--topic="..."] [--niche="..."] [--no-llm]
// Dies with a clear message when DATABASE_URL is missing (Supabase-only mode).
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

function args(argv = []) {
  const out = {};
  for (const a of argv) {
    const m = String(a).match(/^--([^=]+)(=(.*))?$/);
    if (m) out[m[1]] = m[3] === undefined ? true : m[3];
  }
  return out;
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL. Copy backend/.env.example -> backend/.env and set it first.');
    process.exit(1);
  }
  const { sequelize } = require('../src/models');
  const { aggregateMetrics, growthRecommendations } = require('../src/services/analytics.service');
  const trends = require('../src/services/trends.service');

  await sequelize.authenticate();
  const projectId = a.projectId || a.project_id || undefined;
  const platform = a.platform || undefined;
  const region = a.region || a.geo || undefined;
  const days = a.days ? Number(a.days) : 30;
  const topic = a.topic || '';
  const niche = a.niche || '';

  const aggregate = await aggregateMetrics({ projectId, platform, region, days });
  let trendData = { trendsScored: [], regionInterest: null, tags: [] };
  if (topic) {
    try {
      trendData = await trends.analyzeTrends({ topic, niche, geo: region || 'IN' });
    } catch (e) {
      console.warn('[analytics-aggregate] trends failed:', e.message);
    }
  }
  const growth = await growthRecommendations({
    aggregate, trends: trendData.trendsScored || [], regionInterest: trendData.regionInterest || null,
    topic, useLlm: !a['no-llm'],
  });

  // Token estimate for the LLM narrative only (aggregations are pure SQL/code).
  const { clean, estimateTokens } = require('../src/llm/preprocess');
  const brief = (growth.recommendations || []).slice(0, 4).map((r) => r.idea).join(' ');
  const estIn = estimateTokens(clean(`Topic:"${topic}"|Top:${brief}`, 500));
  console.log(JSON.stringify({
    aggregate, trends: { scored: trendData.trendsScored || [], regionInterest: trendData.regionInterest || null, tags: trendData.tags || [] },
    growth, tokenEstimate: { narrativeIn: estIn, narrativeMaxOut: 300 },
    queries: [
      'Metric.findAll({ where: { projectId?, platform?, region?, createdAt >= days } })',
      'Clip.findAll({ where: { projectId? }, order: viralityScore DESC, limit 20 })',
      'Hook.findAll({ where: { projectId? }, limit 200 }) → category lift',
      'Feedback.findAll({ where: { projectId? }, limit 100 }) → styleCard',
      'fetchRedditTrends + fetchHackerNews + fetchYoutubeTags(region) → scoreTrends → getRegionInterest',
    ],
  }, null, 2));
  await sequelize.close();
}

main().catch((e) => { console.error('[analytics-aggregate]', e.message); process.exit(1); });
