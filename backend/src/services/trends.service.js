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

const CACHE_TTL_MS = 6 * 3600 * 1000;
const cache = new Map(); // key → { ts, data }

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
  cache.set(key, { ts: Date.now(), data: out });
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
  cache.set(key, { ts: Date.now(), data: out });
  return { ...out, cached: false };
}

// ---------- 2. Groq niche tags for the clip topic ----------
async function fetchNicheTags({ topic = '', niche = '' }) {
  const { chatJson } = require('./llmProvider');
  const { engine, data } = await chatJson({
    system: 'You suggest social-media hashtags. Return JSON only.',
    user: `Video topic: "${topic}". Niche/audience: "${niche}". Return {"tags":["#..."]} — 6 to 10 hashtags: half niche-specific (low competition), half broad reach. Lowercase, no spaces, no duplicates.`,
    temperature: 0.6, json: true,
  });
  const tags = Array.isArray(data?.tags) ? data.tags.filter((t) => typeof t === 'string').slice(0, 10) : [];
  return { engine, tags };
}

// ---------- 3. Optional YouTube mostPopular (needs YOUTUBE_API_KEY) ----------
async function fetchYoutubeTags({ region = 'IN', max = 10 } = {}) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { source: 'youtube', skipped: true, tags: [] };
  const { data } = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
    params: { part: 'snippet', chart: 'mostPopular', regionCode: region, maxResults: Math.min(25, max * 3), key },
    timeout: 10000,
  });
  const tags = [];
  for (const item of data.items || []) {
    for (const t of item.snippet?.tags || []) {
      const tag = slugTag(t);
      if (tag && !tags.includes(tag)) tags.push(tag);
      if (tags.length >= max) break;
    }
    if (tags.length >= max) break;
  }
  return { source: 'youtube', tags };
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

module.exports = { fetchRedditTrends, fetchHackerNews, fetchNicheTags, fetchYoutubeTags, getTagsForTopic, subsFor };
