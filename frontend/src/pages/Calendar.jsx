import { api } from '../lib/api';
import { useEffect, useMemo, useState } from 'react';

export default function Calendar() {
  const [jobs, setJobs] = useState([]);
  useEffect(() => { api.get('/content/publish').then((r) => setJobs(r.data)).catch(() => {}); }, []);
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
      {Object.entries(byDay).map(([day, list]) => (
        <div className="card" key={day}>
          <b>{day}</b>
          {list.map((j) => <p key={j.id}><span className="pill">{j.platform}</span> {j.status} — {j.caption}</p>)}
        </div>
      ))}
      {jobs.length === 0 && <p className="mut">No publish jobs scheduled yet.</p>}
    </div>
  );
}
