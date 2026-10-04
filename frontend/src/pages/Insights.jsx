import { api } from '../lib/api';
import { useEffect, useState } from 'react';

/** Shown instead of a 0 we never actually measured. */
const NO_VALUE = '—';

export default function Insights() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/content/insights')
      .then((r) => { if (active) { setData(r.data); setError(null); } })
      // Previously swallowed here, which rendered a full analytics report of
      // zeros that looked exactly like a real all-zero account.
      .catch((e) => { if (active) { setData(null); setError(e.response?.data?.error || 'Could not load insights — is the backend running?'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const kpis = [
    ['Views', data?.totals?.views],
    ['Likes', data?.totals?.likes],
    ['Comments', data?.totals?.comments],
    ['Shares', data?.totals?.shares],
  ];
  const patterns = data?.productionPatterns;
  const topClips = data?.topClips ?? [];
  const series = data?.series ?? [];

  return (
    <div className="grid">
      <h2>Insights</h2>
      {error && <p className="error-text">⚠ {error}</p>}
      {loading && <p className="mut">Loading insights…</p>}
      <div className="grid g4">
        {kpis.map(([k, v]) => (
          <div className="card" key={k}>
            <div className="mut"><small>{k}</small></div>
            <div className="kpi">{error || v == null ? NO_VALUE : Number(v).toLocaleString()}</div>
          </div>
        ))}
      </div>
      {patterns && (
        <div className="card">
          <b>Patterns:</b>{' '}
          <span className="mut">{patterns.suggestion || 'Not enough recorded data yet — patterns appear once clips and metrics exist.'}</span>
        </div>
      )}
      <div className="card">
        <h3>Top clips</h3>
        {topClips.map((c) => <p key={c.id}>{c.title || 'Untitled clip'} — score {c.viralityScore}</p>)}
        {!loading && !error && topClips.length === 0 && <p className="mut">No clips recorded yet.</p>}
      </div>
      <div className="card">
        <h3>Per-platform series</h3>
        {series.map((m, i) => <p key={i}>{m.platform || 'unknown platform'}: {m.views} views, {m.likes} likes</p>)}
        {!loading && !error && series.length === 0 && <p className="mut">No platform metrics recorded yet.</p>}
      </div>
    </div>
  );
}