import { api } from '../lib/api';
import { useEffect, useMemo, useState } from 'react';

export default function Calendar() {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.get('/content/publish')
      .then((r) => { if (active) { setJobs(Array.isArray(r.data) ? r.data : []); setError(null); } })
      // Swallowed before, then the page asserted "No publish jobs scheduled yet"
      // even when the request had failed outright.
      .catch((e) => { if (active) { setJobs([]); setError(e.response?.data?.error || 'Could not load the calendar — is the backend running?'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const byDay = useMemo(() => {
    const m = {};
    for (const j of jobs) {
      const d = j.scheduledAt ? new Date(j.scheduledAt).toLocaleDateString() : 'Unscheduled';
      (m[d] ||= []).push(j);
    }
    return m;
  }, [jobs]);
  return (
    <div className="grid">
      <h2>Content calendar</h2>
      {error && <p className="error-text">⚠ {error}</p>}
      {loading && <p className="mut">Loading calendar…</p>}
      {Object.entries(byDay).map(([day, list]) => (
        <div className="card" key={day}>
          <b>{day}</b>
          {list.map((j) => <p key={j.id}><span className="pill">{j.platform}</span> {j.status} — {j.caption || 'No caption'}</p>)}
        </div>
      ))}
      {!loading && !error && jobs.length === 0 && <p className="mut">No publish jobs scheduled yet.</p>}
    </div>
  );
}
