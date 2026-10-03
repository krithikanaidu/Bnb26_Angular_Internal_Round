import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [insights, setInsights] = useState(null);
  const [title, setTitle] = useState('');

  const load = async () => {
    const [p, i] = await Promise.all([api.get('/projects'), api.get('/content/insights').catch(() => ({ data: null }))]);
    setProjects(p.data); setInsights(i.data);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!title) return;
    await api.post('/projects', { title, status: 'idea' });
    setTitle(''); load();
  };
  const move = async (id, status) => { await api.patch(`/projects/${id}`, { status }); load(); };

  return (
    <div className="grid">
      <div className="row"><h2 style={{ margin: 0 }}>Creator Intelligence</h2><span className="pill">idea → published</span></div>
      <div className="grid g4">
        {[['Views', insights?.totals?.views ?? 0], ['Likes', insights?.totals?.likes ?? 0], ['Comments', insights?.totals?.comments ?? 0], ['Shares', insights?.totals?.shares ?? 0]].map(([k, v]) => (
          <div className="card" key={k}><div className="mut"><small>{k}</small></div><div className="kpi">{Number(v).toLocaleString()}</div></div>
        ))}
      </div>
      {insights?.productionPatterns && (
        <div className="card"><b>Production patterns:</b> <span className="mut">{insights.productionPatterns.suggestion} Avg clip {insights.productionPatterns.avgClipLen}s · Best window {insights.productionPatterns.bestPostWindow}</span></div>
      )}
      <div className="card">
        <h3>New project / idea</h3>
        <div className="row"><input placeholder="e.g. 5 AI editing hacks" value={title} onChange={(e) => setTitle(e.target.value)} /><button onClick={create}>Add idea</button></div>
      </div>
      <div>
        <h3>Content workflow</h3>
        <div className="kanban">
          {['idea', 'editing', 'ready', 'published'].map((s) => (
            <div className="col" key={s}><b>{s}</b>
              {projects.filter((p) => p.status === s || (s === 'editing' && ['scripting', 'recording', 'editing'].includes(p.status)) || (s === 'ready' && ['ready', 'scheduled'].includes(p.status))).map((p) => (
                <div className="card" key={p.id} style={{ marginTop: 8 }}><small>{p.title}</small><br />
                  <select value={p.status} onChange={(e) => move(p.id, e.target.value)}>
                    {['idea', 'scripting', 'recording', 'editing', 'ready', 'scheduled', 'published'].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
