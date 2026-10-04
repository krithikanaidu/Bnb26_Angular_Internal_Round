// YouTube Data API v3 — the one platform API that works with a key alone.
// videos.list?part=statistics,snippet needs no OAuth for PUBLIC videos, fits a
// free quota (1 unit per call), and returns exactly what Insights stores:
// views, likes, comments, title, channel. Instagram needs FB app review +
// OAuth, X's API is paid — so YouTube is the demo-practical dynamic source.
'use strict';

function parseVideoId(input = '') {
  const s = String(input).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s; // bare id
  const m = s.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function fetchVideoStats(input) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    const err = new Error('YOUTUBE_API_KEY is not set — add it to backend/.env (Google Cloud Console > YouTube Data API v3).');
    err.status = 400;
    throw err;
  }
  const videoId = parseVideoId(input);
  if (!videoId) {
    const err = new Error('That does not look like a YouTube link or video id (watch / shorts / youtu.be).');
    err.status = 400;
    throw err;
  }
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=${encodeURIComponent(key)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    const err = new Error(e.name === 'AbortError' ? 'YouTube API timed out — try again.' : `YouTube API unreachable: ${e.message}`);
    err.status = 502;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const err = new Error(res.status === 403 ? 'YouTube API rejected the key (check quota / restrictions).' : `YouTube API error ${res.status}.`);
    err.status = 502;
    throw err;
  }
  const data = await res.json();
  const item = data.items && data.items[0];
  if (!item) {
    const err = new Error('No public YouTube video found for that link (private/deleted?).');
    err.status = 404;
    throw err;
  }
  const stats = item.statistics || {};
  const num = (v) => (v == null ? 0 : Number(v) || 0);
  return {
    videoId,
    title: item.snippet?.title || '',
    channel: item.snippet?.channelTitle || '',
    publishedAt: item.snippet?.publishedAt || null,
    views: num(stats.viewCount),
    likes: num(stats.likeCount),
    comments: num(stats.commentCount),
  };
}

module.exports = { parseVideoId, fetchVideoStats };
