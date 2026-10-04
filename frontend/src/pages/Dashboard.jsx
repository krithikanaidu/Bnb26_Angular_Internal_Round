import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Lightbulb, Plus } from 'lucide-react';

import { api } from '../lib/api';
import { PaperPage, PageHead, Panel, StatTile, EmptyState, ErrorNote, LoadingNote, UnderlineDoodle, NO_VALUE } from '../ui/AppKit';
import { StatusDot, StatusDotLabel } from '../ui/StatusDot';
import { StickerLabel } from '../ui/StickerLabel';
import { StageTrail } from '../ui/PipelineMeter';
import { BlurReveal } from '../ui/BlurReveal';
import { useToast } from '../ui/uiStore';

/** Rendered instead of a number we do not actually have. */
const NO_VALUE_DASH = NO_VALUE;

/** Board columns. The mapping below is what folds 7 statuses into 4 columns. */
const COLUMNS = [
  { key: 'idea', label: 'Idea', dot: 'purple' },
  { key: 'editing', label: 'In production', dot: 'orange' },
  { key: 'ready', label: 'Ready', dot: 'green' },
  { key: 'published', label: 'Published', dot: 'green' },
];

const ALL_STATUSES = ['idea', 'scripting', 'recording', 'editing', 'ready', 'scheduled', 'published'];

function inColumn(status, column) {
  if (status === column) return true;
  if (column === 'editing') return ['scripting', 'recording', 'editing'].includes(status);
  if (column === 'ready') return ['ready', 'scheduled'].includes(status);
  return false;
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [insights, setInsights] = useState(null);
  const [title, setTitle] = useState('');
  const [projectsError, setProjectsError] = useState(null);
  const [insightsError, setInsightsError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    // Projects and insights are independent: one failing must not blank the other,
    // and neither may silently become "0", which is indistinguishable from a
    // genuine all-zero account.
    const [p, i] = await Promise.allSettled([api.get('/projects'), api.get('/content/insights')]);
    if (p.status === 'fulfilled') {
      setProjects(p.value.data || []);
      setProjectsError(null);
    } else setProjectsError('Could not load projects — is the backend running?');
    if (i.status === 'fulfilled') {
      setInsights(i.value.data);
      setInsightsError(null);
    } else {
      setInsights(null);
      setInsightsError('Could not load insights — is the backend running?');
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.post('/projects', { title: title.trim(), status: 'idea' });
      setTitle('');
      toast({ message: 'Idea added to the board.', variant: 'success' });
      await load();
    } catch (e) {
      setProjectsError(e.response?.data?.error || 'Could not create the project.');
    } finally {
      setBusy(false);
    }
  };

  const move = async (id, status) => {
    setBusy(true);
    try {
      await api.patch(`/projects/${id}`, { status });
      await load();
    } catch (e) {
      setProjectsError(e.response?.data?.error || 'Could not update the project.');
    } finally {
      setBusy(false);
    }
  };

  // A metric is shown only when the backend actually returned it.
  const kpis = [
    ['Views', insights?.totals?.views, 'Sum of recorded post views'],
    ['Likes', insights?.totals?.likes, 'Sum of recorded post likes'],
    ['Comments', insights?.totals?.comments, 'Sum of recorded post comments'],
    ['Shares', insights?.totals?.shares, 'Sum of recorded post shares'],
  ];
  const patterns = insights?.productionPatterns;

  return (
    <PaperPage>
      <PageHead
        number="00"
        title="Dashboard"
        script="the whole board"
        description="Everything Bit & Build knows about your content, in one place. Numbers appear only when the backend actually returned them — a gap shows as — and never as a zero."
        actions={
          <>
            <StickerLabel variant="ticket" color="var(--sticker-yellow)" rotate={-2}>
              idea → published
            </StickerLabel>
            <Link to="/ideation" className="btn primary">
              <Lightbulb className="w-4 h-4 inline -mt-0.5 mr-1" />
              Start an idea
            </Link>
          </>
        }
      />

      <UnderlineDoodle className="mb-2" width={180} />

      <div className="flex flex-col gap-3 mt-6">
        <ErrorNote>{projectsError}</ErrorNote>
        <ErrorNote label="Insights">{insightsError}</ErrorNote>
      </div>

      {/* ---- KPI row --------------------------------------------------- */}
      <section aria-label="Content totals" className="mt-6">
        <div className="bb-grid bb-g4">
          {kpis.map(([label, value, hint]) => (
            <StatTile
              key={label}
              label={label}
              hint={hint}
              value={insightsError || value == null ? NO_VALUE_DASH : Number(value).toLocaleString()}
            />
          ))}
        </div>
      </section>

      {/* ---- Production patterns ---------------------------------------- */}
      {patterns && (
        <BlurReveal className="mt-4">
          <Panel title="Production patterns" taped subtitle="What the recorded history actually suggests">
            <p className="text-sm leading-relaxed">
              {patterns.suggestion || 'Not enough recorded data yet.'}
              {patterns.avgClipLen != null && <> Avg clip {patterns.avgClipLen}s.</>}
              {/* avgClipLen is computed from real clips; bestHookStyle and
                  bestPostWindow cannot be derived from stored data, so the backend
                  returns null and we say so instead of printing an invented window. */}
              {patterns.bestPostWindow == null && <> No posting-window data is recorded yet.</>}
            </p>
          </Panel>
        </BlurReveal>
      )}

      {/* ---- New idea --------------------------------------------------- */}
      <Panel
        title="New project / idea"
        taped
        subtitle="Becomes the first card in the Idea column"
        className="mt-4"
      >
        <div className="bb-row">
          <input
            placeholder="Title your idea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Project title"
            onKeyDown={(e) => {
              if (e.key === 'Enter') create();
            }}
            className="flex-1 min-w-[220px]"
          />
          <button onClick={create} disabled={busy || !title.trim()} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            {busy ? 'Saving…' : 'Add idea'}
          </button>
        </div>
      </Panel>

      {/* ---- Pipeline map ------------------------------------------------ */}
      <Panel title="The pipeline" subtitle="Seven stages. Pick a stage to jump straight in." className="mt-4">
        <StageTrail />
      </Panel>

      {/* ---- Board ------------------------------------------------------- */}
      <section className="mt-4" aria-label="Content workflow">
        <div className="card-title-row !mb-4">
          <h2>Content workflow</h2>
          <StatusDotLabel color={projectsError ? 'red' : 'green'}>
            {projectsError ? 'board unavailable' : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
          </StatusDotLabel>
        </div>

        <div className="kanban">
          {COLUMNS.map((col) => {
            const items = projects.filter((p) => inColumn(p.status, col.key));
            return (
              <div className="col" key={col.key}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="flex items-center gap-2">
                    <StatusDot color={col.dot} size={9} pulse={false} />
                    {col.label}
                  </span>
                  <span className="pill !py-0.5 !px-2">{items.length}</span>
                </div>

                {items.map((p) => (
                  <ProjectCard key={p.id} project={p} busy={busy} onMove={move} />
                ))}

                {items.length === 0 && !loading && (
                  <p className="ex !block">Nothing in this column.</p>
                )}
              </div>
            );
          })}
        </div>

        {!loading && projects.length === 0 && !projectsError && (
          <EmptyState title="No projects yet" className="mt-4">
            Add your first idea above, or start from a topic in{' '}
            <Link to="/ideation" className="underline" style={{ color: 'var(--color-hot-pink)' }}>
              Ideation
            </Link>
            .
          </EmptyState>
        )}
        {loading && <LoadingNote className="mt-4">Loading the board…</LoadingNote>}
      </section>
    </PaperPage>
  );
}

/** One project card inside a board column. */
function ProjectCard({ project, busy, onMove }) {
  return (
    <article className="card !p-3 !rounded-lg" style={{ marginTop: 8 }}>
      <div className="flex items-start gap-2">
        <Flame className="w-3.5 h-3.5 mt-0.5 flex-none muted" aria-hidden="true" />
        <h3 className="!text-[14px] !font-display flex-1 min-w-0 break-words">{project.title || 'Untitled'}</h3>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <StatusDot color={project.status === 'published' ? 'green' : project.status === 'idea' ? 'purple' : 'orange'} size={7} pulse={false} />
        <span className="mono-xs muted truncate">{project.status}</span>
      </div>
      <select
        value={project.status}
        onChange={(e) => onMove(project.id, e.target.value)}
        disabled={busy}
        aria-label={`Status for ${project.title}`}
        className="mt-2 !py-1.5 !text-xs"
      >
        {ALL_STATUSES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </article>
  );
}
