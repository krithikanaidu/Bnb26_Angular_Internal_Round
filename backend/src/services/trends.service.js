// Trend + niche tags from the internet (Domain 7 hashtag rule).
// Sources (all free, no paid keys needed):
//   1. Reddit public RSS (r/popular + niche subreddits, Atom XML, no key).
//   2. Hacker News Algolia front page (JSON, no key).
//   3. Groq LLM → niche-specific tags for the clip topic (existing GROQ_API_KEY).
//   4. Optional YouTube Data API mostPopular (only if YOUTUBE_API_KEY is set).
// Results are cached in-memory (TTL 6h). Any failure → Groq + static evergreen
// fallback, so adaptation never blocks on the network.
// NOTE: Google Trends' public dailytrends endpoint was retired (404) — not used.
const axios = require('axios');
const { normalizeRegion, compareRegions, regionLabel } = require('./geo.service');

const CACHE_TTL_MS = 6 * 3600 * 1000;
const cache = new Map(); // key → { ts, data, seenAt }

function touchSeen(key) {
  const hit = cache.get(key);
  if (hit && !hit.seenAt) { hit.seenAt = Date.now(); cache.set(key, hit); }
  return hit ? hit.seenAt : Date.now();
}

const EVERGREEN = ['#contentcreator', '#viralvideo', '#growth', '#creatoreconomy', '#videoediting'];

const NICHE_SUBS = [
  { match: ['saas', 'startup', 'entrepreneur', 'business', 'founder', 'pricing'], subs: ['startups', 'Entrepreneur', 'SaaS'] },
  { match: ['fitness', 'gym', 'workout', 'health'], subs: ['Fitness', 'loseit'] },
  { match: ['finance', 'money', 'invest', 'stock'], subs: ['personalfinance', 'stocks'] },
  { match: ['ai', 'tech', 'coding', 'program', 'software', 'gadget'], subs: ['technology', 'artificial'] },
  { match: ['market', 'creator', 'content', 'social media', 'brand'], subs: ['marketing', 'NewTubers'] },
];

function subsFor(niche = '', topic = '') {
  const hay = `${niche} ${topic}`.toLowerCase();
  for (const n of NICHE_SUBS) {
    if (n.match.some((w) => hay.includes(w))) return n.subs;
  }
  return ['popular'];
}

function slugTag(s = '') {
  const t = s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).slice(0, 3).join('');
  return t.length >= 3 ? `#${t}` : null;
}

function decodeEntities(s = '') {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}

// ---------- 1a. Reddit public RSS (Atom, no key) ----------
async function fetchRedditTrends({ subs = ['popular'], perSub = 15 } = {}) {
  const key = `reddit:${subs.join('+')}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return { ...hit.data, cached: true };
  const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CreatorAI/1.0' };
  const settled = await Promise.all(subs.map((sub) =>
    axios.get(`https://www.reddit.com/r/${sub}/.rss`, { timeout: 10000, responseType: 'text', headers: UA })
      .then((r) => ({ sub, xml: String(r.data) }))
      .catch((e) => ({ sub, error: e.message }))));
  const trends = [];
  for (const s of settled) {
    if (!s.xml) { console.warn(`[trends] reddit r/${s.sub} failed:`, s.error); continue; }
    const entries = s.xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    for (const e of entries.slice(0, perSub)) {
      const m = e.match(/<title>([\s\S]*?)<\/title>/);
      if (!m) continue;
      const title = decodeEntities(m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
      if (title && !/^(u\/|r\/)/.test(title)) trends.push({ title, sub: s.sub });
    }
  }
  const out = { source: 'reddit-rss', trends };
  cache.set(key, { ts: Date.now(), seenAt: touchSeen(key) || Date.now(), data: out });
  return { ...out, cached: false };
}

// ---------- 1b. Hacker News front page (JSON, no key) ----------
async function fetchHackerNews({ limit = 12 } = {}) {
  const key = 'hn:front';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return { ...hit.data, cached: true };
  const { data } = await axios.get('https://hn.algolia.com/api/v1/search', {
    params: { tags: 'front_page', hitsPerPage: limit }, timeout: 10000,
  });
  const out = { source: 'hackernews', trends: (data.hits || []).map((h) => ({ title: h.title || '', sub: 'hackernews' })) };
  cache.set(key, { ts: Date.now(), seenAt: touchSeen(key) || Date.now(), data: out });
  return { ...out, cached: false };
}

// ---------- 2. Groq niche tags for the clip topic ----------
async function fetchNicheTags({ topic = '', niche = '' }) {
  const t = String(topic || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const n = String(niche || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!t && !n) return { engine: 'heuristic', tags: [] };
  const { chatJson } = require('./llmProvider');
  const { engine, data } = await chatJson({
    system: 'Hashtag suggester. JSON only. No preamble.',
    user: `T:"${t}"|N:"${n}"|JSON {"tags":["#..."]} 6-10, half niche half broad, lowercase, no spaces.`,
    temperature: 0.3, json: true, task: 'nicheTags',
  });
  const tags = Array.isArray(data?.tags) ? data.tags.filter((t) => typeof t === 'string').slice(0, 10) : [];
  return { engine, tags };
}

// ---------- 3. Optional YouTube mostPopular (needs YOUTUBE_API_KEY) ----------
// Region-aware: cache key includes regionCode so ROI compare doesn't mix regions.
async function fetchYoutubeTags({ region = 'IN', max = 10 } = {}) {
  const code = normalizeRegion(region);
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { source: 'youtube', skipped: true, tags: [], region: code };
  const ckey = `yt:${code}:${max}`;
  const hit = cache.get(ckey);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return { ...hit.data, cached: true, region: code };
  const { data } = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
    params: { part: 'snippet', chart: 'mostPopular', regionCode: code, maxResults: Math.min(25, max * 3), key },
    timeout: 10000,
  });
  const tags = [];
  const titles = [];
  for (const item of data.items || []) {
    if (item.snippet?.title) titles.push(item.snippet.title);
    for (const t of item.snippet?.tags || []) {
      const tag = slugTag(t);
      if (tag && !tags.includes(tag)) tags.push(tag);
      if (tags.length >= max) break;
    }
    if (tags.length >= max) break;
  }
  const out = { source: 'youtube', tags, titles: titles.slice(0, 10) };
  cache.set(ckey, { ts: Date.now(), seenAt: touchSeen(ckey) || Date.now(), data: out });
  return { ...out, cached: false, region: code };
}

// ---------- trend scoring: overlap + velocity + freshness ----------
// velocity: how many sources mention the same normalized title words.
// freshness: hours since first seen (cached seenAt); decays after 48h.
function scoreTrends(trends = [], topic = '') {
  const topicWords = new Set(String(topic || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 3));
  const now = Date.now();
  const counts = {};
  for (const t of trends) {
    const k = String(t.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60);
    counts[k] = (counts[k] || 0) + 1;
  }
  return trends.map((t) => {
    const words = String(t.title || '').toLowerCase().split(/[^a-z0-9]+/);
    const overlap = words.filter((w) => topicWords.has(w)).length;
    const k = String(t.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60);
    const velocity = counts[k] || 1;
    const seenAt = t.seenAt || now;
    const freshnessHrs = Math.max(0, (now - seenAt) / 3600000);
    const freshness = freshnessHrs <= 48 ? 1 : Math.max(0.2, 1 - (freshnessHrs - 48) / 120);
    const score = +(overlap * 0.5 + Math.min(velocity, 4) * 0.15 + freshness * 0.2 + (t.origin === 'youtube' ? 0.15 : 0)).toFixed(3);
    return { ...t, overlap, velocity, freshnessHrs: +freshnessHrs.toFixed(1), freshness: +freshness.toFixed(2), score };
  }).sort((a, b) => b.score - a.score);
}

// Region-Based Interest: per-region score = youtube tag/title overlap with the
// topic, normalized to shares. No LLM — pure code, so it costs zero tokens.
async function getRegionInterest({ topic = '', niche = '', regions } = {}) {
  const list = (Array.isArray(regions) && regions.length ? regions : compareRegions()).map(normalizeRegion);
  const topicWords = new Set(String(topic || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2));
  const per = [];
  for (const region of [...new Set(list)]) {
    let tags = [], titles = [], ok = false;
    try {
      const yt = await fetchYoutubeTags({ region, max: 10 });
      tags = yt.tags || []; titles = yt.titles || []; ok = !yt.skipped;
    } catch { ok = false; }
    const hay = [...tags, ...titles].join(' ').toLowerCase().split(/[^a-z0-9]+/);
    const hits = hay.filter((w) => topicWords.has(w)).length;
    per.push({ region, label: regionLabel(region), score: hits, tags: tags.slice(0, 5), live: ok });
  }
  const total = per.reduce((a, r) => a + r.score, 0) || 1;
  const ranked = per.map((r) => ({ ...r, share: +(r.score / total).toFixed(3) })).sort((a, b) => b.score - a.score);
  return { regions: ranked, topRegion: ranked[0] || null, topic: String(topic).slice(0, 120) };
}

// Full trend analysis for a topic: scored trends + tags + ROI.
// Token-optimized: trends capped (top 8, 90ch each), nicheTags LLM cached 6h.
async function analyzeTrends({ topic = '', niche = '', geo = 'IN', regions, maxTrends = 8 } = {}) {
  const region = normalizeRegion(geo);
  const base = await getTagsForTopic({ topic, niche, geo: region });
  const scored = scoreTrends(base.trends || [], topic).slice(0, maxTrends);
  let regionInterest;
  try {
    regionInterest = await getRegionInterest({ topic, niche, regions: regions || [region, ...compareRegions()] });
  } catch { regionInterest = { regions: [], topRegion: null }; }
  return { ...base, geo: region, trendsScored: scored, regionInterest };
}

// ---------- merged: tags for a topic ----------
async function getTagsForTopic({ topic = '', niche = '', geo = 'IN' } = {}) {
  const topicWords = new Set(topic.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 3));
  let trends = [];
  const sources = [];
  try {
    const r = await fetchRedditTrends({ subs: subsFor(niche, topic) });
    trends = trends.concat(r.trends.map((t) => ({ ...t, origin: 'reddit' })));
    sources.push(r.cached ? 'reddit (cached)' : 'reddit (live)');
  } catch (e) {
    console.warn('[trends] reddit failed, continuing:', e.message);
  }
  try {
    const h = await fetchHackerNews();
    trends = trends.concat(h.trends.map((t) => ({ ...t, origin: 'hn' })));
    sources.push(h.cached ? 'hackernews (cached)' : 'hackernews (live)');
  } catch (e) {
    console.warn('[trends] hackernews failed, continuing:', e.message);
  }
  const source = sources.length ? sources.join(' + ') : 'fallback';

  // trend titles overlapping the topic rank first, then top generic trends
  const scored = trends.map((t) => {
    const words = t.title.toLowerCase().split(/[^a-z0-9]+/);
    const overlap = words.filter((w) => topicWords.has(w)).length;
    return { ...t, overlap };
  }).sort((a, b) => b.overlap - a.overlap || 1);
  const trendTags = [];
  for (const t of scored) {
    const tag = slugTag(t.title);
    if (tag && !trendTags.includes(tag)) trendTags.push(tag);
    if (trendTags.length >= 6) break;
  }

  let nicheTags = [];
  try {
    const n = await fetchNicheTags({ topic, niche });
    nicheTags = n.tags;
  } catch (e) {
    console.warn('[trends] niche tags failed:', e.message);
  }

  let ytTags = [];
  try {
    ytTags = (await fetchYoutubeTags({ region: geo })).tags || [];
  } catch (e) {
    console.warn('[trends] youtube tags failed:', e.message);
  }

  const tags = [...new Set([...nicheTags, ...trendTags, ...ytTags, ...EVERGREEN])].slice(0, 12);
  return { source, trends: trends.slice(0, 10), tags };
}

module.exports = { fetchRedditTrends, fetchHackerNews, fetchNicheTags, fetchYoutubeTags, getTagsForTopic, analyzeTrends, scoreTrends, getRegionInterest, subsFor };
