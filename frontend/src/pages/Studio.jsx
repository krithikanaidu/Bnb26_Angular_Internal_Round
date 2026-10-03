import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Studio() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [scriptBody, setScriptBody] = useState('Stop scrolling — AI editing in 30 seconds flat.\nStep 1: dump your raw idea. Step 2: let AI pull the 3 strongest beats. Step 3: cut everything else.');
  const [alignment, setAlignment] = useState([]);
  const [clips, setClips] = useState([]);
  const [edl, setEdl] = useState(null);
  const [edlText, setEdlText] = useState('');

  const load = async () => {
    const [p, c] = await Promise.all([api.get('/projects'), api.get('/content/clips' + (projectId ? `?projectId=${projectId}` : ''))]);
    setProjects(p.data); setClips(c.data);
  };
  useEffect(() => { load(); }, []);

  const align = async () => {
    const { data } = await api.post('/content/align', { scriptBody, projectId: projectId || undefined });
    setAlignment(data.alignment);
  };
  const genClips = async () => {
    const { data } = await api.post('/content/clips/generate', { projectId: projectId || undefined });
    setClips(data);
  };
  const makeEdit = async (clip) => {
    const { data } = await api.post('/content/edits', { projectId: projectId || clip.projectId, clipId: clip.id, platform: 'tiktok' });
    setEdl(data); setEdlText(JSON.stringify(data.edl, null, 2));
  };
  const saveEdl = async () => {
    const { data } = await api.patch(`/content/edits/${edl.id}`, { edl: JSON.parse(edlText) });
    setEdl(data); alert(`Saved v${data.version} — creator edit retained`);
  };

  return (
    <div className="grid">
      <h2>Script → Video Understanding · Auto Clips · Editable AI Edits</h2>
      <div className="card row">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <button className="ghost" onClick={load}>Refresh</button>
      </div>
      <div className="grid g2">
        <div className="card"><h3>Script</h3><textarea rows={8} value={scriptBody} onChange={(e) => setScriptBody(e.target.value)} /><br /><br /><button onClick={align}>Align script ↔ footage</button>
          {alignment.map((a, i) => <div key={i} style={{ marginTop: 8 }}><small>{a.sentence}</small><br /><span className="pill">→ {a.best?.seg.startSec}s–{a.best?.seg.endSec}s · {a.best?.score}</span></div>)}
        </div>
        <div className="card"><h3>Automated clips</h3><button onClick={genClips}>Generate short-form clips</button>
          {clips.map((c) => (
            <div key={c.id} style={{ marginTop: 10, borderTop: '1px solid #232b3b', paddingTop: 8 }}>
              <b>{c.title}</b> <span className="pill">🔥 {c.viralityScore}</span>
              <div className="mut"><small>{c.startSec}s → {c.endSec}s · {c.hookText}</small></div>
              <div className="bar" style={{ margin: '6px 0' }}><div style={{ width: `${c.viralityScore * 100}%` }} /></div>
              <button className="ghost" onClick={() => makeEdit(c)}>AI edit (keep editable)</button>
            </div>
          ))}
        </div>
      </div>
      {edl && <div className="card"><h3>Editable EDL — {edl.platform} {edl.aspect} (v{edl.version})</h3><textarea rows={12} value={edlText} onChange={(e) => setEdlText(e.target.value)} /><br /><br /><button onClick={saveEdl}>Save my edit</button></div>}
    </div>
  );
}
