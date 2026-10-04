import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/** Rendered instead of a number we do not actually have. */
const NO_VALUE = '—';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [insights, setInsights] = useState(null);
  const [title, setTitle] = useState('');
  const [projectsError, setProjectsError] = useState(null);
  const [insightsError, setInsightsError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    // Projects and insights are independent: one failing must not blank the other,
    // and neither may silently become "0", which is indistinguishable from a
    // genuine all-zero account.
    const [p, i] = await Promise.allSettled([
      api.get('/projects'),
      api.get('/content/insights'),
    ]);
    if (p.status === 'fulfilled') { setProjects(p.value.data || []); setProjectsError(null); }
    else setProjectsError('Could not load projects — is the backend running?');
    if (i.status === 'fulfilled') { setInsights(i.value.data); setInsightsError(null); }
    else { setInsights(null); setInsightsError('Could not load insights — is the backend running?'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.post('/projects', { title: title.trim(), status: 'idea' });
      setTitle(''); await load();
    } catch (e) {
      setProjectsError(e.response?.data?.error || 'Could not create the project.');
    } finally { setBusy(false); }
  };
  const move = async (id, status) => {
    setBusy(true);
    try {
      await api.patch(`/projects/${id}`, { status }); await load();
    } catch (e) {
      setProjectsError(e.response?.data?.error || 'Could not update the project.');
    } finally { setBusy(false); }
  };

  // A metric is shown only when the backend actually returned it.
  const kpis = [
    ['Views', insights?.totals?.views],
    ['Likes', insights?.totals?.likes],
    ['Comments', insights?.totals?.comments],
    ['Shares', insights?.totals?.shares],
  ];
  const patterns = insights?.productionPatterns;

  return (
    <div className="grid">
      <div className="row"><h2 style={{ margin: 0 }}>Creator Intelligence</h2><span className="pill">idea → published</span></div>
      {projectsError && <p className="error-text">⚠ {projectsError}</p>}
      {insightsError && <p className="error-text">⚠ {insightsError}</p>}
      <div className="grid g4">
        {kpis.map(([k, v]) => (
          <div className="card" key={k}>
            <div className="mut"><small>{k}</small></div>
            <div className="kpi">{insightsError || v == null ? NO_VALUE : Number(v).toLocaleString()}</div>
          </div>
        ))}
      </div>
      {patterns && (
        <div className="card">
          <b>Production patterns:</b>{' '}
          <span className="mut">
            {/* avgClipLen is computed from real clips; bestHookStyle and
                bestPostWindow cannot be derived from stored data, so the backend
                returns null and we say so instead of printing an invented window. */}
            {patterns.suggestion || 'Not enough recorded data yet.'}
            {patterns.avgClipLen != null && <> Avg clip {patterns.avgClipLen}s.</>}
            {patterns.bestPostWindow == null && <> No posting-window data is recorded yet.</>}
          </span>
        </div>
      )}
      <div className="card">
        <h3>New project / idea</h3>
        <div className="row">
          <input placeholder="Title your idea" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Project title" />
          <button onClick={create} disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Add idea'}</button>
        </div>
      </div>
      <div>
        <h3>Content workflow</h3>
        <div className="kanban">
          {['idea', 'editing', 'ready', 'published'].map((s) => (
            <div className="col" key={s}><b>{s}</b>
              {projects.filter((p) => p.status === s || (s === 'editing' && ['scripting', 'recording', 'editing'].includes(p.status)) || (s === 'ready' && ['ready', 'scheduled'].includes(p.status))).map((p) => (
                <div className="card" key={p.id} style={{ marginTop: 8 }}><small>{p.title}</small><br />
                  <select value={p.status} onChange={(e) => move(p.id, e.target.value)} disabled={busy} aria-label={`Status for ${p.title}`}>
                    {['idea', 'scripting', 'recording', 'editing', 'ready', 'scheduled', 'published'].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select></div>
              ))}
            </div>
          ))}
        </div>
        {!loading && projects.length === 0 && !projectsError && <p className="mut">No projects yet — add your first idea above.</p>}
        {loading && <p className="mut">Loading…</p>}
      </div>
    </div>
  );
}