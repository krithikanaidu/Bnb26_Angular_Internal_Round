import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [file, setFile] = useState(null);

  const load = async () => {
    const [a, p] = await Promise.all([api.get('/assets'), api.get('/projects')]);
    setAssets(a.data); setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!file) return alert('Choose a file');
    const fd = new FormData();
    fd.append('file', file);
    if (projectId) fd.append('projectId', projectId);
    fd.append('durationSec', '120');
    await api.post('/assets/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setFile(null); load();
  };

  return (
    <div className="grid">
      <h2>Asset Management</h2>
      <div className="card row">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">No project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <input type="file" accept="video/*,image/*,audio/*" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={upload}>Upload to Supabase</button>
      </div>
      <div className="grid g3">
        {assets.map((a) => (
          <div className="card" key={a.id}>
            <b>{a.fileName}</b> <span className="pill">{a.kind}</span>
            <div className="mut"><small>{a.mimeType} · {(a.sizeBytes / 1024).toFixed(0)} KB</small></div>
            {a.publicUrl && <div><a href={a.publicUrl} target="_blank" rel="noreferrer"><small>Open file ↗</small></a></div>}
            <div className="mut"><small>{a.storagePath}</small></div>
          </div>
        ))}
      </div>
      {assets.length === 0 && <div className="mut">No assets yet — upload raw footage. Demo transcript segments auto-seed for clip generation.</div>}
    </div>
  );
}
