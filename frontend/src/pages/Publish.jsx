import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Publish() {
  const [clips, setClips] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [clipId, setClipId] = useState('');
  const [platform, setPlatform] = useState('tiktok');
  const [adapted, setAdapted] = useState([]);

  const load = async () => {
    const [c, j] = await Promise.all([api.get('/content/clips'), api.get('/content/publish')]);
    setClips(c.data); setJobs(j.data);
  };
  useEffect(() => { load(); }, []);

  const adapt = async () => {
    if (!clipId) return alert('Pick a clip');
    const { data } = await api.post('/content/adapt', { clipId, platforms: ['tiktok', 'reels', 'shorts', 'x', 'linkedin'] });
    setAdapted(data);
  };
  const publish = async (p) => {
    await api.post('/content/publish', { clipId, platform: p, projectId: clips.find((c) => c.id === clipId)?.projectId, caption: adapted.find((a) => a.platform === p)?.caption || 'New drop', scheduledAt: new Date(Date.now() + 3600e3) });
    load();
  };

  return (
    <div className="grid">
      <h2>Multi-Platform Adaptation & Publishing</h2>
      <div className="card row">
        <select value={clipId} onChange={(e) => setClipId(e.target.value)} style={{ maxWidth: 320 }}>
          <option value="">Select clip</option>{clips.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button onClick={adapt}>Adapt for all platforms</button>
      </div>
      <div className="grid g3">
        {adapted.map((a) => (
          <div className="card" key={a.platform}><b>{a.platform}</b> <span className="pill">{a.preset.aspect} · ≤{a.preset.maxSec}s</span>
            <ul>{a.actions.map((x, i) => <li key={i}><small>{x}</small></li>)}</ul>
            <div className="mut"><small>{a.preset.notes}</small></div>
            <div><small>#{a.hashtags.join(' #')}</small></div><br />
            <button onClick={() => publish(a.platform)}>Schedule to {a.platform}</button>
          </div>
        ))}
      </div>
      <h3>Scheduled / published</h3>
      {jobs.map((j) => <div className="card" key={j.id}><b>{j.platform}</b> <span className="pill">{j.status}</span> <span className="mut"><small>{j.caption} · {j.scheduledAt}</small></span></div>)}
    </div>
  );
}
