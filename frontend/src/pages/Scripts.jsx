import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Scripts() {
  const [projects, setProjects] = useState([]);
  const [scripts, setScripts] = useState([]);
  // Starts empty. It used to be pre-filled with 'AI video editing for creators',
  // which was then submitted to the generators as the user's own topic whenever
  // they clicked Generate without touching the field.
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('energetic');
  const [projectId, setProjectId] = useState('');
  const [hooks, setHooks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([api.get('/projects'), api.get('/content/scripts')]);
      setProjects(p.data); setScripts(s.data); setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load scripts. Is the backend running?');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn) => {
    if (!topic.trim()) { setError('Enter a topic first — nothing is generated from a blank prompt.'); return; }
    setBusy(true); setError(null);
    try { await fn(); } catch (e) {
      setError(e.response?.data?.error || 'Generation failed.');
    } finally { setBusy(false); }
  };

  const genHooks = () => run(async () => {
    const { data } = await api.post('/content/generate-hooks', { topic: topic.trim(), count: 5, projectId: projectId || undefined });
    setHooks(data || []);
  });
  const genScript = () => run(async () => {
    await api.post('/content/generate-script', { topic: topic.trim(), tone, platforms: ['tiktok', 'reels', 'shorts'], projectId: projectId || undefined, title: topic.trim() });
    await load();
  });

  return (
    <div className="grid">
      <h2>AI Script & Hook Generation</h2>
      {error && <p className="error-text">⚠ {error}</p>}
      <div className="card grid g2">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic — e.g. the subject of your video" aria-label="Topic" />
        <div className="row">
          <select value={tone} onChange={(e) => setTone(e.target.value)} aria-label="Tone"><option>energetic</option><option>educational</option><option>funny</option><option>professional</option></select>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project"><option value="">No project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        </div>
        <button onClick={genHooks} disabled={busy || !topic.trim()}>{busy ? 'Generating…' : 'Generate hooks'}</button>
        <button className="green" onClick={genScript} disabled={busy || !topic.trim()}>{busy ? 'Generating…' : 'Generate full script'}</button>
      </div>
      {hooks.length > 0 && <div className="grid g2">{hooks.map((h, i) => <div className="card" key={i}><b>{h.text}</b><div className="mut"><small>{h.style} · score {h.score}</small></div></div>)}</div>}
      <h3>Scripts</h3>
      {scripts.map((s) => <div className="card" key={s.id}><b>{s.title || 'Untitled'}</b> <span className="pill">{s.tone || '—'}</span><pre>{s.body}</pre></div>)}
      {!loading && scripts.length === 0 && !error && <div className="mut">No scripts saved yet.</div>}
      {loading && <div className="mut">Loading scripts…</div>}
    </div>
  );
}