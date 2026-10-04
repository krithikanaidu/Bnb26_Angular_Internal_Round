import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Scissors, Link2, Upload, RefreshCw, X, Film } from 'lucide-react';

import { api } from '../lib/api';
import { createJob, createJobFromLink, inspectLink, listJobs, getJob, deleteJob, getHealth, mediaUrl, STAGES } from '../clippedai/api';
import { PaperPage, PageHead, Panel, EmptyState, ErrorNote, LoadingNote, Bar, UnderlineDoodle } from '../ui/AppKit';
import { StatusDot } from '../ui/StatusDot';
import { StickerLabel } from '../ui/StickerLabel';
import { useDialog, useToast } from '../ui/uiStore';

const fmtTime = (s) => {
  if (s === undefined || s === null) return '—';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/** Job stage → status colour. Queued/running read as blue, done green, failed red. */
const stageColor = (status) => (status === 'done' ? 'green' : status === 'error' ? 'red' : 'blue');

function StagePill({ status }) {
  return (
    <span className="pill">
      <StatusDot color={stageColor(status)} size={7} pulse={!['done', 'error'].includes(status)} />
      {STAGES[status] || status}
    </span>
  );
}

function ClipCard({ clip }) {
  return (
    <article className="card !p-0 !overflow-hidden">
      <video
        src={mediaUrl(clip.file)}
        controls
        preload="metadata"
        style={{ width: '100%', aspectRatio: '9/16', maxHeight: 420, background: '#000', display: 'block' }}
      />
      <div className="p-3">
        <h3 className="!text-[14px] break-words">{clip.title}</h3>
        <div className="mono-xs muted mt-1">
          {fmtTime(clip.startSec)} → {fmtTime(clip.endSec)} · score {clip.score ?? '—'}
        </div>
        <Bar value={(clip.score ?? 0) * 100} className="mt-2" />
        {clip.hookText && <p className="ex mt-2">“{clip.hookText}”</p>}

        <div className="bb-row mt-3">
          <a href={mediaUrl(clip.file)} download className="btn tiny flex-1 flex items-center justify-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
          <Link to="/studio" className="btn ghost tiny flex-1 flex items-center justify-center">
            Open in Studio
          </Link>
        </div>
      </div>
    </article>
  );
}

function JobCard({ job, onDelete, onChanged }) {
  const [full, setFull] = useState(job);
  const active = !['done', 'error'].includes(job.status);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      try {
        const j = await getJob(job.id);
        setFull(j);
        onChanged(j);
        if (['done', 'error'].includes(j.status)) clearInterval(t);
      } catch {
        /* job may be deleted */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [active, job.id]);

  useEffect(() => setFull(job), [job]);

  return (
    <article className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="break-words">{full.sourceName || 'Untitled job'}</h3>
          <div className="mono-xs muted mt-1">
            {new Date(full.createdAt).toLocaleString()} · {full.outputs?.length || 0} shorts
          </div>
        </div>
        <div className="bb-row shrink-0">
          <StagePill status={full.status} />
          <button
            className="ghost !p-1.5"
            onClick={() => onDelete(full.id)}
            title="Delete job + files"
            aria-label={`Delete ${full.sourceName || 'job'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {active && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="mono-xs muted">{STAGES[full.stage] || full.stage}…</span>
            <span className="mono-xs muted">{Math.round(full.progress || 0)}%</span>
          </div>
          <Bar value={full.progress || 0} className="mt-1.5" />
        </div>
      )}

      {full.status === 'error' && (
        <pre className="mt-3">{full.error || 'The job failed without reporting a reason — check the backend logs (ffmpeg / transcription).'}</pre>
      )}

      {!!full.outputs?.length && (
        <div className="bb-grid bb-auto mt-3">
          {full.outputs.map((c) => (
            <ClipCard key={c.clipId || c.file} clip={c} />
          ))}
        </div>
      )}
    </article>
  );
}

export default function ClipAI() {
  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [file, setFile] = useState(null);
  const [sourceTab, setSourceTab] = useState('upload'); // upload | link
  const [ytUrl, setYtUrl] = useState('');
  const [ytMeta, setYtMeta] = useState(null);
  const [ytChecking, setYtChecking] = useState(false);
  const [maxClips, setMaxClips] = useState(4);
  const [minLen, setMinLen] = useState(20);
  const [maxLen, setMaxLen] = useState(60);
  const [subtitles, setSubtitles] = useState(true);
  const [portrait, setPortrait] = useState(true);
  const [uploadPct, setUploadPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [engines, setEngines] = useState(null);
  const [scoreWeights, setScoreWeights] = useState(null);
  const [healthState, setHealthState] = useState('loading'); // loading | ok | unavailable
  const [projectsError, setProjectsError] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const pushDialog = useDialog();
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      // Projects and health are loaded independently so one failure cannot blank
      // out the other. A failed /projects used to become [], which silently hid
      // every project and let clips be created unattached.
      const [j, pRes, hRes] = await Promise.allSettled([listJobs(), api.get('/projects'), getHealth()]);
      if (j.status === 'fulfilled') setJobs(j.value);
      else setError('Could not load jobs — is the backend running?');

      if (pRes.status === 'fulfilled') {
        setProjects(pRes.value.data || []);
        setProjectsError(false);
      } else setProjectsError(true);

      if (hRes.status === 'fulfilled' && hRes.value?.engines) {
        setEngines(hRes.value.engines);
        setScoreWeights(hRes.value.scoreWeights || null);
        setHealthState('ok');
      } else setHealthState('unavailable');
    } catch {
      setError('Backend unreachable — start it with `npm run dev` in backend/ (needs Supabase DB).');
      setHealthState('unavailable');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submit = async () => {
    setError('');
    const options = { projectId: projectId || undefined, maxClips, minLen, maxLen, subtitles, portrait };
    if (maxLen <= minLen) {
      setError('Max clip length must be greater than min.');
      return;
    }
    setBusy(true);
    setUploadPct(0);
    try {
      let job;
      if (sourceTab === 'link') {
        if (!ytUrl.trim()) {
          setError('Paste a YouTube link first.');
          setBusy(false);
          return;
        }
        job = await createJobFromLink(ytUrl.trim(), options);
      } else {
        if (!file) {
          setError('Choose a long-form video first.');
          setBusy(false);
          return;
        }
        job = await createJob(file, options, setUploadPct);
      }
      setJobs((j) => [job, ...j]);
      setFile(null);
      setYtUrl('');
      setYtMeta(null);
      toast({ message: 'Job queued — renders one at a time.', variant: 'info' });
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      toast({ message: 'Could not start the job.', variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const checkLink = async () => {
    setError('');
    setYtMeta(null);
    if (!ytUrl.trim()) {
      setError('Paste a YouTube link first.');
      return;
    }
    setYtChecking(true);
    try {
      setYtMeta(await inspectLink(ytUrl.trim()));
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setYtChecking(false);
    }
  };

  const remove = (id) => {
    const job = jobs.find((j) => j.id === id);
    pushDialog({
      headline: `Delete "${job?.sourceName || 'this job'}"?`,
      accentWord: 'Delete',
      subline: 'this removes the rendered files too',
      actions: [
        { label: 'Keep it', variant: 'secondary' },
        {
          label: 'Delete',
          variant: 'primary',
          onClick: async () => {
            await deleteJob(id).catch(() => {});
            setJobs((j) => j.filter((x) => x.id !== id));
            toast({ message: 'Job deleted.', variant: 'success' });
          },
        },
      ],
    });
  };

  const patch = (updated) => setJobs((j) => j.map((x) => (x.id === updated.id ? updated : x)));

  const canSubmit = busy || (sourceTab === 'upload' ? !file : !ytUrl.trim());

  return (
    <PaperPage>
      <PageHead
        number="05"
        title="Auto Clips"
        script="long to short"
        description="Long video in → viral 9:16 shorts out. AI transcription, engagement scoring, auto-reframe, animated subtitles, viral titles. Every stage reports its real status; nothing is claimed before it happens."
        actions={
          <StickerLabel variant="ticket" rotate={-2}>
            {healthState === 'loading' && 'Checking engines…'}
            {healthState === 'unavailable' && 'Engine status unavailable'}
            {healthState === 'ok' && engines && (() => {
              // Report the provider the backend actually resolved. This used to read
              // a non-existent `engines.titles`, so it always claimed "Heuristic
              // titles" even with Groq/OpenAI live, and on a failed health request it
              // asserted "No API keys needed" — a capability claim from a network error.
              const sttLabel = engines.stt?.name ? engines.stt.name : engines.whisper ? 'STT ready' : 'No speech-to-text key';
              const copy = engines.titles || engines.copy;
              const copyLabel = copy === 'groq' ? 'Groq copy' : copy === 'openai' ? 'AI copy' : copy === 'heuristic' ? 'Heuristic copy' : `${copy || 'unknown'} copy`;
              return `${sttLabel} · ${copyLabel}`;
            })()}
          </StickerLabel>
        }
      />

      <UnderlineDoodle className="mb-2" width={190} />

      <div className="bb-grid bb-g2 mt-6 items-start">
        {/* ---- 1 · Source ------------------------------------------------- */}
        <Panel
          title="1 · Source video"
          taped
          actions={
            <div className="bb-row" style={{ gap: 6 }}>
              <button type="button" className={`pill-btn ${sourceTab === 'upload' ? 'active' : ''}`} onClick={() => setSourceTab('upload')}>
                Upload
              </button>
              <button type="button" className={`pill-btn ${sourceTab === 'link' ? 'active' : ''}`} onClick={() => setSourceTab('link')}>
                YouTube link
              </button>
            </div>
          }
        >
          {sourceTab === 'upload' ? (
            <div
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                setFile(e.dataTransfer.files?.[0] || null);
              }}
              role="button"
              tabIndex={0}
              aria-label="Drop a long-form video here, or press Enter to browse"
              className="bb-empty !cursor-pointer transition-colors"
              style={
                dragOver
                  ? { borderColor: 'var(--color-hot-pink)', background: 'color-mix(in srgb, var(--color-hot-pink) 8%, transparent)' }
                  : undefined
              }
            >
              <Film className="w-7 h-7" />
              <span className="!text-ink">
                {file ? <b className="break-all">{file.name}</b> : 'Drop a long-form video here or click to browse'}
              </span>
              <span>mp4 / mov / mkv / webm · up to 1GB</span>
              <input ref={inputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          ) : (
            <div>
              <label htmlFor="yt-url">YouTube link</label>
              <div className="bb-row">
                <input
                  id="yt-url"
                  placeholder="watch, Shorts or youtu.be…"
                  value={ytUrl}
                  onChange={(e) => {
                    setYtUrl(e.target.value);
                    setYtMeta(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') checkLink();
                  }}
                  className="flex-1 min-w-[180px]"
                />
                <button className="ghost flex items-center gap-1.5" onClick={checkLink} disabled={ytChecking || !ytUrl.trim()}>
                  <Link2 className="w-4 h-4" />
                  {ytChecking ? 'Checking…' : 'Preview'}
                </button>
              </div>

              {ytMeta && (
                <div className="card card-hover mt-3 !p-3 flex items-center gap-3">
                  {ytMeta.thumbnail && <img src={ytMeta.thumbnail} alt="" className="w-28 aspect-video object-cover rounded-lg flex-none" />}
                  <div className="min-w-0">
                    <h3 className="!text-[14px] break-words">{ytMeta.title}</h3>
                    <div className="mono-xs muted mt-1">
                      {ytMeta.uploader || 'Unknown channel'} · {fmtTime(ytMeta.duration)} long
                    </div>
                    <span className="pill pill-olive mt-2">Ready to clip</span>
                  </div>
                </div>
              )}

              <p className="ex mt-3">Best quality ≤1080p is downloaded, then the normal pipeline runs. Only clip videos you own or have rights to use.</p>
            </div>
          )}

          {busy && uploadPct > 0 && uploadPct < 100 && (
            <div className="mt-3">
              <span className="mono-xs muted">Uploading… {uploadPct}%</span>
              <Bar value={uploadPct} className="mt-1.5" />
            </div>
          )}

          <div className="mt-4">
            <label htmlFor="clip-project">Project</label>
            <select
              id="clip-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={projectsError}
            >
              {/* Standalone is a real option, but only offer it as a clean choice —
                  when /projects failed we must not present an empty list as if the
                  workspace genuinely has no projects. */}
              {projectsError ? <option value="">Projects failed to load</option> : <option value="">No project (standalone)</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            {projectsError && <span className="error-label mt-2 !block">Could not load projects — retry or run standalone.</span>}
          </div>
        </Panel>

        {/* ---- 2 · Recipe ------------------------------------------------- */}
        <Panel title="2 · Clip recipe" taped>
          <div>
            <label htmlFor="max-clips">Shorts to generate · {maxClips}</label>
            <input id="max-clips" type="range" min={1} max={12} value={maxClips} onChange={(e) => setMaxClips(+e.target.value)} />
          </div>

          <div className="bb-grid bb-g2 mt-3">
            <div>
              <label htmlFor="min-len">Min length · {minLen}s</label>
              <input id="min-len" type="range" min={5} max={120} value={minLen} onChange={(e) => setMinLen(+e.target.value)} />
            </div>
            <div>
              <label htmlFor="max-len">Max length · {maxLen}s</label>
              <input id="max-len" type="range" min={10} max={180} value={maxLen} onChange={(e) => setMaxLen(+e.target.value)} />
            </div>
          </div>

          <div className="bb-row mt-4">
            <label className="!flex !items-center gap-2 !mb-0 !normal-case !tracking-normal !font-mono cursor-pointer">
              <input type="checkbox" checked={subtitles} onChange={(e) => setSubtitles(e.target.checked)} />
              <span className="!text-[13px]">Burned subtitles</span>
            </label>
            <label className="!flex !items-center gap-2 !mb-0 !normal-case !tracking-normal !font-mono cursor-pointer">
              <input type="checkbox" checked={portrait} onChange={(e) => setPortrait(e.target.checked)} />
              <span className="!text-[13px]">9:16 reframe</span>
            </label>
          </div>

          <button onClick={submit} disabled={canSubmit} className="w-full mt-5 flex items-center justify-center gap-2">
            <Scissors className="w-4 h-4" />
            {busy ? (sourceTab === 'link' ? 'Starting…' : 'Uploading…') : 'Generate shorts'}
          </button>

          {error && (
            <pre className="mt-3">
              {error}
            </pre>
          )}

          <p className="ex mt-3">
            Pipeline: transcribe ({engines?.stt?.name || 'no speech-to-text key — set GROQ_API_KEY or OPENAI_API_KEY'}) → clip score → trim → 9:16 →
            subtitles → title.
            {scoreWeights ? ` Score blend: ${Object.entries(scoreWeights).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(' · ')}.` : ''} Renders run
            one at a time on the backend; transcription is cached per job.
          </p>
        </Panel>
      </div>

      {/* ---- 3 · Jobs ------------------------------------------------------ */}
      <section aria-label="Clip jobs" className="mt-4">
        <div className="card-title-row !mb-4">
          <h2>3 · Jobs &amp; shorts</h2>
          <div className="bb-row">
            <span className="pill">{jobs.length} job{jobs.length === 1 ? '' : 's'}</span>
            <button className="ghost tiny flex items-center gap-1.5" onClick={refresh}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {jobs.length === 0 && (
          <EmptyState title="No clip jobs yet" icon={<Upload className="w-5 h-5" />}>
            Upload a video above to create your first batch of shorts.
          </EmptyState>
        )}

        <div className="flex flex-col gap-4">
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} onDelete={remove} onChanged={patch} />
          ))}
        </div>

        {jobs.length > 0 && (
          <LoadingNote className="mt-3">Active jobs poll every 2.5s until they finish.</LoadingNote>
        )}
      </section>
    </PaperPage>
  );
}
