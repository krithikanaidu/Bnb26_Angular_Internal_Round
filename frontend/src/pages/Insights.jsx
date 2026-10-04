import { api } from '../lib/api';
import { useEffect, useState } from 'react';

export default function Insights() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/content/insights').then((r) => setData(r.data)).catch(() => {}); }, []);
  return (
    <div className="grid">
      <h2>Insights</h2>
      <div className="grid g4">
        {[['Views', data?.totals?.views ?? 0], ['Likes', data?.totals?.likes ?? 0], ['Comments', data?.totals?.comments ?? 0], ['Shares', data?.totals?.shares ?? 0]].map(([k, v]) => (
          <div className="card" key={k}><div className="mut"><small>{k}</small></div><div className="kpi">{Number(v).toLocaleString()}</div></div>
        ))}
      </div>
      {data?.productionPatterns && (
        <div className="card"><b>Patterns:</b> <span className="mut">{data.productionPatterns.suggestion}</span></div>
      )}
      <div className="card">
        <h3>Top clips</h3>
        {(data?.topClips ?? []).map((c) => <p key={c.id}>{c.title} — score {c.viralityScore}</p>)}
      </div>
      <div className="card">
        <h3>Per-platform series</h3>
        {(data?.series ?? []).map((m, i) => <p key={i}>{m.platform}: {m.views} views, {m.likes} likes</p>)}
      </div>
    </div>
  );
}
