import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Read the real duration from the file in the browser.
 *
 * The server probes duration with ffprobe and prefers that, so this is only a
 * hint for the rare container ffprobe cannot parse. It used to send a hardcoded
 * 120s for every file, which the server stored as fact.
 */
function readDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith('audio') ? 'audio' : 'video');
    const done = (v) => { URL.revokeObjectURL(url); resolve(v); };
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const d = Number(el.duration);
      done(Number.isFinite(d) && d > 0 ? d : null);
    };
    // Never block the upload on a metadata read that will not arrive.
    el.onerror = () => done(null);
    setTimeout(() => done(null), 4000);
    el.src = url;
  });
}

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [a, p] = await Promise.all([api.get('/assets'), api.get('/projects')]);
      setAssets(a.data); setProjects(p.data); setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load assets. Is the backend running?');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!file) { setError('Choose a file first.'); return; }
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (projectId) fd.append('projectId', projectId);
      const duration = await readDuration(file);
      // Only send a duration we actually measured — never a placeholder.
      if (duration != null) fd.append('durationSec', String(duration));
      await api.post('/assets/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFile(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed. Is the backend running?');
    } finally { setBusy(false); }
  };

  return (
    <div className="grid">
      <h2>Asset Management</h2>
      {error && <p className="error-text">⚠ {error}</p>}
      <div className="card row">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ maxWidth: 260 }} aria-label="Project">
          <option value="">No project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <input type="file" accept="video/*,image/*,audio/*" onChange={(e) => setFile(e.target.files[0])} aria-label="File" />
        <button onClick={upload} disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload to Supabase'}</button>
      </div>
      <div className="grid g3">
        {assets.map((a) => (
          <div className="card" key={a.id}>
            <b>{a.fileName}</b> <span className="pill">{a.kind}</span>
            <div className="mut"><small>{a.mimeType} · {(a.sizeBytes / 1024).toFixed(0)} KB</small></div>
            {a.durationSec > 0 && <span className="pill">{Math.round(a.durationSec)}s</span>}
            {a.meta?.hasAudio === false && <span className="pill">no audio track</span>}
            {a.publicUrl && <div><a href={a.publicUrl} target="_blank" rel="noreferrer"><small>Open file ↗</small></a></div>}
            <div className="mut"><small>{a.storagePath}</small></div>
          </div>
        ))}
      </div>
      {!loading && assets.length === 0 && !error && (
        <div className="mut">No assets yet — upload raw footage. Transcripts come from the ClipAI pipeline using real speech-to-text.</div>
      )}
      {loading && <div className="mut">Loading assets…</div>}
    </div>
  );
}
