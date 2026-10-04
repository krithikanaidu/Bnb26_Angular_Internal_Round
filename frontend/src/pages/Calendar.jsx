import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';

import { api } from '../lib/api';
import { PaperPage, PageHead, Panel, EmptyState, ErrorNote, LoadingNote } from '../ui/AppKit';
import { StatusDot } from '../ui/StatusDot';
import { StickerLabel } from '../ui/StickerLabel';

const STATUS_COLOR = {
  published: 'green',
  scheduled: 'purple',
  ready: 'orange',
  failed: 'red',
  error: 'red',
};

export default function Calendar() {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get('/content/publish')
      .then((r) => {
        if (active) {
          setJobs(Array.isArray(r.data) ? r.data : []);
          setError(null);
        }
      })
      // Swallowed before, then the page asserted "No publish jobs scheduled yet"
      // even when the request had failed outright.
      .catch((e) => {
        if (active) {
          setJobs([]);
          setError(e.response?.data?.error || 'Could not load the calendar — is the backend running?');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const byDay = useMemo(() => {
    const m = {};
    for (const j of jobs) {
      const d = j.scheduledAt ? new Date(j.scheduledAt).toLocaleDateString() : 'Unscheduled';
      (m[d] ||= []).push(j);
    }
    // Newest day first, with the unscheduled bucket pinned to the bottom.
    return Object.entries(m).sort(([a], [b]) => {
      if (a === 'Unscheduled') return 1;
      if (b === 'Unscheduled') return -1;
      return new Date(b) - new Date(a);
    });
  }, [jobs]);

  return (
    <PaperPage>
      <PageHead
        number="08"
        title="Calendar"
        script="when it ships"
        description="Every publish job grouped by its scheduled day. Jobs without a date are collected at the bottom rather than quietly dropped."
        actions={
          <Link to="/publish" className="btn primary flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" />
            Schedule something
          </Link>
        }
      />

      <ErrorNote className="mt-4">{error}</ErrorNote>
      {loading && <LoadingNote className="mt-4">Loading calendar…</LoadingNote>}

      <section aria-label="Scheduled publish jobs" className="mt-4 flex flex-col gap-4">
        {byDay.map(([day, list]) => (
          <Panel key={day} title={day} taped subtitle={`${list.length} job${list.length === 1 ? '' : 's'}`}>
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {list.map((j) => (
                <li key={j.id} className="flex items-center gap-3 flex-wrap">
                  <span className="pill pill-blue">{j.platform}</span>
                  <span className="pill">
                    <StatusDot color={STATUS_COLOR[j.status] ?? 'orange'} size={7} pulse={false} />
                    {j.status}
                  </span>
                  <span className="text-sm flex-1 min-w-[180px]">{j.caption || 'No caption'}</span>
                  {j.scheduledAt && (
                    <span className="mono-xs muted">
                      {new Date(j.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </section>

      {!loading && !error && jobs.length === 0 && (
        <EmptyState title="No publish jobs scheduled yet" className="mt-4" icon={<CalendarDays className="w-5 h-5" />}>
          Queue one from the Publish page and it will appear here.
        </EmptyState>
      )}

      {!loading && !error && jobs.length > 0 && (
        <p className="ex mt-4 flex items-center gap-2">
          <StickerLabel variant="tag" color="var(--color-olive)" textColor="var(--color-olive)" rotate={-2}>
            dates shown in your local timezone
          </StickerLabel>
        </p>
      )}
    </PaperPage>
  );
}
