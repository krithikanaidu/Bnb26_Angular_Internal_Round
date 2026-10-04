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
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    try {
      setErr('');
      const [p, c] = await Promise.all([api.get('/projects'), api.get('/content/clips' + (projectId ? `?projectId=${projectId}` : ''))]);
      setProjects(p.data); setClips(c.data);
    } catch (e) { setErr(e.response?.data?.error || 'Load failed. Is backend on :5000?'); }
  };
  useEffect(() => { load(); }, []);

  const align = async () => {
    try {
      setErr(''); setBusy('align');
      if (!scriptBody.trim()) { setErr('Paste a script first.'); return; }
      const { data } = await api.post('/content/align', { scriptBody, projectId: projectId || undefined });
      setAlignment(data.alignment || []);
    } catch (e) { setErr(e.response?.data?.error || 'Align failed. Upload footage first — transcript auto-seeds on upload.'); }
    finally { setBusy(''); }
  };
  const genClips = async () => {
    try {
      setErr(''); setBusy('clips');
      const { data } = await api.post('/content/clips/generate', { projectId: projectId || undefined });
      setClips(data);
      if (!data.length) setErr('No clips: footage too short or no transcript. Upload a longer video.');
    } catch (e) { setErr(e.response?.data?.error || 'Clip generation failed. Upload a video first.'); }
    finally { setBusy(''); }
  };
  const makeEdit = async (clip) => {
    try {
      setErr(''); setBusy('edit');
      const { data } = await api.post('/content/edits', { projectId: projectId || clip.projectId, clipId: clip.id, platform: 'tiktok' });
      setEdl(data); setEdlText(JSON.stringify(data.edl, null, 2));
    } catch (e) { setErr(e.response?.data?.error || 'Edit creation failed.'); }
    finally { setBusy(''); }
  };
  const saveEdl = async () => {
    try {
      const { data } = await api.patch(`/content/edits/${edl.id}`, { edl: JSON.parse(edlText) });
      setEdl(data); alert(`Saved v${data.version} — creator edit retained`);
    } catch (e) { setErr('EDL JSON invalid or save failed.'); }
  };

  return (
    <div className="grid">
      <h2>Script → Video Understanding · Auto Clips · Editable AI Edits</h2>
      <div className="card" style={{ borderLeft: '3px solid var(--acc,#7c5cff)' }}>
        <small className="mut">Content-only pipeline: this finds <b>timestamps + editable EDL plan</b>, it does <b>not</b> render MP4. No AI video generation — use your footage. Auto MP4 render (FFmpeg F6.9) is planned.</small>
      </div>
      {err && <div className="error-text" role="alert">{err}</div>}
      <div className="card row">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <button className="ghost" onClick={load}>Refresh</button>
      </div>
      <div className="grid g2">
        <div className="card"><h3>Script</h3><textarea rows={8} value={scriptBody} onChange={(e) => setScriptBody(e.target.value)} /><br /><br /><button onClick={align} disabled={busy === 'align'}>{busy === 'align' ? 'Aligning…' : 'Align script ↔ footage'}</button>
          {(alignment || []).map((a, i) => <div key={i} style={{ marginTop: 8 }}><small>{a.sentence}</small><br />{a.best?.seg ? <span className="pill">→ {a.best.seg.startSec ?? '?'}s–{a.best.seg.endSec ?? '?'}s · {a.best.score}</span> : <span className="pill">no match — gap</span>}</div>)}
        </div>
        <div className="card"><h3>Automated clips</h3><button onClick={genClips} disabled={busy === 'clips'}>{busy === 'clips' ? 'Finding clips…' : 'Generate short-form clips'}</button>
          {(clips || []).map((c) => (
            <div key={c.id} style={{ marginTop: 10, borderTop: '1px solid #232b3b', paddingTop: 8 }}>
              <b>{c.title}</b> <span className="pill">🔥 {c.viralityScore}</span>
              <div className="mut"><small>{c.startSec}s → {c.endSec}s · {c.hookText}</small></div>
              <div className="bar" style={{ margin: '6px 0' }}><div style={{ width: `${Math.min(100, (c.viralityScore || 0) * 100)}%` }} /></div>
              <button className="ghost" onClick={() => makeEdit(c)}>AI edit (keep editable)</button>
            </div>
          ))}
          {clips.length === 0 && <div className="mut" style={{ marginTop: 8 }}><small>No clips yet — upload footage, then Generate.</small></div>}
        </div>
      </div>
      {edl && <div className="card"><h3>Editable EDL — {edl.platform} {edl.aspect} (v{edl.version})</h3><textarea rows={12} value={edlText} onChange={(e) => setEdlText(e.target.value)} /><br /><br /><button onClick={saveEdl}>Save my edit</button></div>}
    </div>
  );
}
