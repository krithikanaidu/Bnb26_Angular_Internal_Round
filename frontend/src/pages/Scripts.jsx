import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Scripts() {
  const [projects, setProjects] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [topic, setTopic] = useState('AI video editing for creators');
  const [tone, setTone] = useState('energetic');
  const [projectId, setProjectId] = useState('');
  const [hooks, setHooks] = useState([]);

  const load = async () => {
    const [p, s] = await Promise.all([api.get('/projects'), api.get('/content/scripts')]);
    setProjects(p.data); setScripts(s.data);
  };
  useEffect(() => { load(); }, []);

  const genHooks = async () => {
    const { data } = await api.post('/content/generate-hooks', { topic, count: 5, projectId: projectId || undefined });
    setHooks(data);
  };
  const genScript = async () => {
    await api.post('/content/generate-script', { topic, tone, platforms: ['tiktok', 'reels', 'shorts'], projectId: projectId || undefined, title: topic });
    load();
  };

  return (
    <div className="grid">
      <h2>AI Script & Hook Generation</h2>
      <div className="card grid g2">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" />
        <div className="row">
          <select value={tone} onChange={(e) => setTone(e.target.value)}><option>energetic</option><option>educational</option><option>funny</option><option>professional</option></select>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">No project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        </div>
        <button onClick={genHooks}>Generate hooks</button>
        <button className="green" onClick={genScript}>Generate full script</button>
      </div>
      {hooks.length > 0 && <div className="grid g2">{hooks.map((h, i) => <div className="card" key={i}><b>{h.text}</b><div className="mut"><small>{h.style} · score {h.score}</small></div></div>)}</div>}
      <h3>Scripts</h3>
      {scripts.map((s) => <div className="card" key={s.id}><b>{s.title}</b> <span className="pill">{s.tone}</span><pre>{s.body}</pre></div>)}
    </div>
  );
}
