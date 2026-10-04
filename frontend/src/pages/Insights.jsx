import { useEffect, useState } from 'react';
import { LineChart, Trophy, Layers } from 'lucide-react';

import { api } from '../lib/api';
import { PaperPage, PageHead, Panel, StatTile, EmptyState, ErrorNote, LoadingNote, UnderlineDoodle, NO_VALUE, Bar, DataRow } from '../ui/AppKit';
import { BlurReveal } from '../ui/BlurReveal';
import { StickerLabel } from '../ui/StickerLabel';

/** Shown instead of a 0 we never actually measured. */
const NO_VALUE_DASH = NO_VALUE;

export default function Insights() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ytUrl, setYtUrl] = useState('');
  const [ytBusy, setYtBusy] = useState(false);
  const [ytErr, setYtErr] = useState(null);
  const [ytConfigured, setYtConfigured] = useState(null);
  const [mPlatform, setMPlatform] = useState('shorts');
  const [mViews, setMViews] = useState('');
  const [mLikes, setMLikes] = useState('');
  const [mComments, setMComments] = useState('');
  const [mShares, setMShares] = useState('');
  const [mBusy, setMBusy] = useState(false);
  const [mErr, setMErr] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        api.get('/content/insights'),
        api.get('/content/youtube/status').catch(() => ({ data: { configured: false } })),
      ]);
      setData(r.data);
      setYtConfigured(!!s.data?.configured);
      setError(null);
    } catch (e) {
      // Previously swallowed here, which rendered a full analytics report of
      // zeros that looked exactly like a real all-zero account.
      setData(null);
      setError(e.response?.data?.error || 'Could not load insights — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    load().catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const syncYouTube = async () => {
    if (!ytUrl.trim()) { setYtErr('Paste a YouTube link first.'); return; }
    setYtBusy(true); setYtErr(null);
    try {
      await api.post('/content/youtube/stats', { url: ytUrl.trim() });
      setYtUrl('');
      await load();
    } catch (e) {
      setYtErr(e.response?.data?.error || 'YouTube sync failed.');
    } finally {
      setYtBusy(false);
    }
  };

  const recordMetric = async () => {
    setMBusy(true); setMErr(null);
    try {
      await api.post('/content/metrics', {
        platform: mPlatform,
        views: mViews === '' ? 0 : Number(mViews),
        likes: mLikes === '' ? 0 : Number(mLikes),
        comments: mComments === '' ? 0 : Number(mComments),
        shares: mShares === '' ? 0 : Number(mShares),
      });
      setMViews(''); setMLikes(''); setMComments(''); setMShares('');
      await load();
    } catch (e) {
      setMErr(e.response?.data?.error || 'Could not record those metrics.');
    } finally {
      setMBusy(false);
    }
  };

  const kpis = [
    ['Views', data?.totals?.views, 'Sum across recorded posts'],
    ['Likes', data?.totals?.likes, 'Sum across recorded posts'],
    ['Comments', data?.totals?.comments, 'Sum across recorded posts'],
    ['Shares', data?.totals?.shares, 'Sum across recorded posts'],
  ];
  const patterns = data?.productionPatterns;
  const topClips = data?.topClips ?? [];
  const series = data?.series ?? [];

  // Largest value in the series, used to scale the bars. Guarded so an
  // all-null series does not divide by zero.
  const peakViews = series.reduce((max, m) => Math.max(max, Number(m.views) || 0), 0);

  return (
    <PaperPage>
      <PageHead
        number="07"
        title="Insights"
        script="what worked"
        description="Only numbers the backend actually recorded appear here. Anything missing shows as — and never as a zero, so an empty account can't be mistaken for a dead one."
        actions={
          <StickerLabel variant="ticket" rotate={-3} color="var(--sticker-purple)" textColor="#fff">
            recorded data only
          </StickerLabel>
        }
      />

      <UnderlineDoodle className="mb-2" width={160} />
      <ErrorNote className="mt-4">{error}</ErrorNote>
      {loading && <LoadingNote className="mt-4">Loading insights…</LoadingNote>}

      {/* ---- Dynamic sources ------------------------------------------------ */}
      <div className="bb-grid bb-g2 mt-4 items-start">
        <Panel title="Sync from YouTube" taped subtitle="Real public stats via YouTube Data API v3 — no OAuth needed">
          <div className="bb-row">
            <label htmlFor="insights-yt" className="sr-only">YouTube link</label>
            <input
              id="insights-yt"
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') syncYouTube(); }}
              placeholder="Paste a video / Shorts link…"
              className="flex-1 min-w-[180px]"
            />
            <button className="tiny" onClick={syncYouTube} disabled={ytBusy || !ytUrl.trim()}>
              {ytBusy ? 'Syncing…' : 'Pull stats'}
            </button>
          </div>
          {ytConfigured === false && (
            <p className="ex mt-2">YouTube API key not configured on the backend (YOUTUBE_API_KEY) — syncing will fail until it is set.</p>
          )}
          {ytConfigured === true && (
            <p className="ex mt-2">Connected — re-syncing the same video updates its row instead of duplicating it.</p>
          )}
          {ytErr && <span className="error-label mt-2 !block">{ytErr}</span>}
        </Panel>

        <Panel title="Record metrics" taped subtitle="Type in real numbers from any platform dashboard">
          <div className="bb-row">
            <label htmlFor="insights-m-platform" className="sr-only">Platform</label>
            <select id="insights-m-platform" value={mPlatform} onChange={(e) => setMPlatform(e.target.value)} className="!w-auto">
              {['tiktok', 'reels', 'shorts', 'x', 'linkedin'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {[
              ['Views', mViews, setMViews],
              ['Likes', mLikes, setMLikes],
              ['Comments', mComments, setMComments],
              ['Shares', mShares, setMShares],
            ].map(([label, value, set]) => (
              <span key={label} className="flex items-center gap-1.5">
                <label htmlFor={`insights-m-${label}`} className="sr-only">{label}</label>
                <input
                  id={`insights-m-${label}`}
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={label}
                  className="!w-[92px]"
                />
              </span>
            ))}
            <button className="tiny" onClick={recordMetric} disabled={mBusy}>
              {mBusy ? 'Saving…' : 'Save'}
            </button>
          </div>
          {mErr && <span className="error-label mt-2 !block">{mErr}</span>}
        </Panel>
      </div>

      {/* ---- Totals ------------------------------------------------------ */}
      <section aria-label="Totals" className="mt-6">
        <div className="bb-grid bb-g4">
          {kpis.map(([label, value, hint]) => (
            <StatTile
              key={label}
              label={label}
              hint={hint}
              value={error || value == null ? NO_VALUE_DASH : Number(value).toLocaleString()}
            />
          ))}
        </div>
      </section>

      {/* ---- Patterns ---------------------------------------------------- */}
      {patterns && (
        <BlurReveal className="mt-4">
          <Panel title="Patterns" taped>
            <p className="text-sm leading-relaxed">
              {patterns.suggestion || 'Not enough recorded data yet — patterns appear once clips and metrics exist.'}
            </p>
            {patterns.avgClipLen != null && (
              <div className="mt-3">
                <DataRow label="Average clip length">{patterns.avgClipLen}s</DataRow>
              </div>
            )}
          </Panel>
        </BlurReveal>
      )}

      <div className="bb-grid bb-g2 mt-4 items-start">
        {/* ---- Top clips ------------------------------------------------- */}
        <Panel
          title="Top clips"
          taped
          subtitle="Ranked by the score the clip generator recorded"
          actions={<Trophy className="w-4 h-4" style={{ color: 'var(--color-hot-pink)' }} />}
        >
          {!loading && !error && topClips.length === 0 && <EmptyState title="No clips recorded yet">Generate clips in the Studio or Auto Clips pages first.</EmptyState>}

          <ol className="flex flex-col gap-3 list-none p-0 m-0">
            {topClips.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3">
                <span className="step-num flex-none">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold break-words">{c.title || 'Untitled clip'}</p>
                  <Bar value={(c.viralityScore ?? 0) * 100} className="mt-1.5" />
                </div>
                <span className="pill pill-pink flex-none">
                  {/* Plain mono rather than extruded 3D type: on a solid pink
                      pill the blue extrusion turned the score into mush. */}
                  score {String(c.viralityScore ?? NO_VALUE_DASH)}
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        {/* ---- Per-platform ---------------------------------------------- */}
        <Panel
          title="Per-platform series"
          taped
          subtitle={peakViews > 0 ? 'Bars are scaled to the largest recorded view count' : 'Nothing recorded to scale against yet'}
          actions={<LineChart className="w-4 h-4" style={{ color: 'var(--color-folder-blue-deep)' }} />}
        >
          {!loading && !error && series.length === 0 && <EmptyState title="No platform metrics recorded yet" icon={<Layers className="w-5 h-5" />}>Publish something and record its metrics to see this fill up.</EmptyState>}

          <ul className="flex flex-col gap-3 list-none p-0 m-0">
            {series.map((m, i) => (
              <li key={`${m.platform}-${i}`} className="card !p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="pill pill-blue">{m.platform || 'unknown platform'}</span>
                  <span className="mono-xs muted">
                    {m.views == null ? NO_VALUE_DASH : `${Number(m.views).toLocaleString()} views`}
                  </span>
                </div>
                <Bar value={Number(m.views) || 0} max={peakViews || 1} className="mt-2" />
                <div className="bb-row mt-2">
                  <span className="pill">♥ {m.likes ?? NO_VALUE_DASH}</span>
                  <span className="pill">💬 {m.comments ?? NO_VALUE_DASH}</span>
                  <span className="pill">↗ {m.shares ?? NO_VALUE_DASH}</span>
                  {m.source && m.source !== 'manual' && <span className="pill pill-blue">via {m.source}</span>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </PaperPage>
  );
}
