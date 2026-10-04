import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Studio() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [scripts, setScripts] = useState([]);
  const [scriptId, setScriptId] = useState('');
  // Starts empty. It used to be pre-filled with a developer-written script that
  // was then posted to /content/align as if the user had written it, so the whole
  // alignment and clip-scoring output was derived from invented text.
  const [scriptBody, setScriptBody] = useState('');
  const [alignment, setAlignment] = useState([]);
  const [clips, setClips] = useState([]);
  const [edl, setEdl] = useState(null);
  const [edlText, setEdlText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, c, s] = await Promise.all([
        api.get('/projects'),
        api.get('/content/clips' + (projectId ? `?projectId=${projectId}` : '')),
        api.get('/content/scripts' + (projectId ? `?projectId=${projectId}` : '')),
      ]);
      setProjects(p.data); setClips(c.data); setScripts(s.data); setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load studio data. Is the backend running?');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Pull the real saved script into the editor when one is chosen.
  const pickScript = (id) => {
    setScriptId(id);
    setAlignment([]);
    const s = scripts.find((x) => x.id === id);
    setScriptBody(s?.body || '');
  };

  const align = async () => {
    if (!scriptBody.trim()) { setError('Load or write a script before aligning.'); return; }
    setBusy(true); setError(null);
    try {
      const { data } = await api.post('/content/align', { scriptBody, projectId: projectId || undefined });
      setAlignment(data.alignment || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Alignment failed.');
    } finally { setBusy(false); }
  };
  const genClips = async () => {
    setBusy(true); setError(null);
    try {
      const { data } = await api.post('/content/clips/generate', { projectId: projectId || undefined });
      setClips(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Clip generation failed.');
    } finally { setBusy(false); }
  };
  const makeEdit = async (clip) => {
    setBusy(true); setError(null);
    try {
      const { data } = await api.post('/content/edits', { projectId: projectId || clip.projectId, clipId: clip.id, platform: 'tiktok' });
      setEdl(data); setEdlText(JSON.stringify(data.edl, null, 2));
    } catch (e) {
      setError(e.response?.data?.error || 'Could not create an edit.');
    } finally { setBusy(false); }
  };
  const saveEdl = async () => {
    let parsed;
    try { parsed = JSON.parse(edlText); } catch {
      setError('That EDL is not valid JSON — fix the syntax before saving.');
      return;
    }
    setBusy(true); setError(null);
    try {
      const { data } = await api.patch(`/content/edits/${edl.id}`, { edl: parsed });
      setEdl(data); setEdlText(JSON.stringify(data.edl, null, 2));
    } catch (e) {
      setError(e.response?.data?.error || 'Could not save the edit.');
    } finally { setBusy(false); }
  };

  return (
    <div className="grid">
      <h2>Script → Video Understanding · Auto Clips · Editable AI Edits</h2>
      {error && <p className="error-text">⚠ {error}</p>}
      <div className="card row">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ maxWidth: 260 }} aria-label="Project">
          <option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <select value={scriptId} onChange={(e) => pickScript(e.target.value)} style={{ maxWidth: 300 }} aria-label="Saved script">
          <option value="">No saved script selected</option>
          {scripts.map((s) => <option key={s.id} value={s.id}>{s.title || `Script ${s.id.slice(0, 8)}`}</option>)}
        </select>
        <button className="ghost" onClick={load}>Refresh</button>
      </div>
      <div className="grid g2">
        <div className="card">
          <h3>Script</h3>
          <textarea rows={8} value={scriptBody} onChange={(e) => setScriptBody(e.target.value)} placeholder="Select a saved script above, or paste yours here." aria-label="Script body" />
          <br /><br />
          <button onClick={align} disabled={busy || !scriptBody.trim()}>{busy ? 'Working…' : 'Align script ↔ footage'}</button>
          {!scriptBody.trim() && <div className="mut"><small>Nothing to align yet — the editor starts empty so nothing invented gets aligned to your footage.</small></div>}
          {alignment.map((a, i) => <div key={i} style={{ marginTop: 8 }}><small>{a.sentence}</small><br /><span className="pill">→ {a.best?.seg.startSec}s–{a.best?.seg.endSec}s · {a.best?.score}</span></div>)}
        </div>
        <div className="card">
          <h3>Automated clips</h3>
          <button onClick={genClips} disabled={busy}>{busy ? 'Working…' : 'Generate short-form clips'}</button>
          {clips.map((c) => (
            <div key={c.id} style={{ marginTop: 10, borderTop: '1px solid #232b3b', paddingTop: 8 }}>
              <b>{c.title}</b> <span className="pill">🔥 {c.viralityScore}</span>
              <div className="mut"><small>{c.startSec}s → {c.endSec}s · {c.hookText}</small></div>
              <div className="bar" style={{ margin: '6px 0' }}><div style={{ width: `${c.viralityScore * 100}%` }} /></div>
              <button className="ghost" onClick={() => makeEdit(c)} disabled={busy}>AI edit (keep editable)</button>
            </div>
          ))}
          {!loading && clips.length === 0 && <div className="mut"><small>No clips yet. Clips are generated from a real transcript, so upload footage with speech first.</small></div>}
        </div>
      </div>
      {edl && (
        <div className="card">
          <h3>Editable EDL — {edl.platform} {edl.aspect} (v{edl.version})</h3>
          <textarea rows={12} value={edlText} onChange={(e) => setEdlText(e.target.value)} aria-label="EDL JSON" />
          <br /><br />
          <button onClick={saveEdl} disabled={busy}>{busy ? 'Saving…' : 'Save my edit'}</button>
        </div>
      )}
    </div>
  );
}