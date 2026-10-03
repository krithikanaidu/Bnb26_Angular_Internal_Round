import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { createJob, createJobFromLink, inspectLink, listJobs, getJob, deleteJob, getHealth, mediaUrl, STAGES } from '../clippedai/api';

const fmtTime = (s) => {
  if (s === undefined || s === null) return '—';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

function StagePill({ status }) {
  const color = status === 'done' ? 'green' : status === 'error' ? 'red' : 'blue';
  const dot = { green: '#00e0b8', red: '#ff5c5c', blue: '#7c5cff' }[color];
  return (
    <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: dot }} />
      {STAGES[status] || status}
    </span>
  );
}

function ClipCard({ clip }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <video
        src={mediaUrl(clip.file)}
        controls
        preload="metadata"
        style={{ width: '100%', aspectRatio: '9/16', maxHeight: 420, background: '#000', display: 'block' }}
      />
      <div style={{ padding: 12 }}>
        <b style={{ fontSize: 14 }}>{clip.title}</b>
        <div className="mut" style={{ marginTop: 4 }}>
          <small>{fmtTime(clip.startSec)} → {fmtTime(clip.endSec)} · 🔥 {clip.score}</small>
        </div>
        <div className="bar" style={{ margin: '8px 0' }}>
          <div style={{ width: `${Math.min(100, clip.score * 100)}%` }} />
        </div>
        <div className="mut" style={{ marginBottom: 10 }}><small>“{clip.hookText}”</small></div>
        <div className="row">
          <a href={mediaUrl(clip.file)} download style={{ flex: 1 }}>
            <button style={{ width: '100%' }}>Download</button>
          </a>
          <Link to="/studio" style={{ flex: 1 }}>
            <button className="ghost" style={{ width: '100%' }}>Open in Studio</button>
          </Link>
        </div>
      </div>
    </div>
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
      } catch { /* job may be deleted */ }
    }, 2500);
    return () => clearInterval(t);
  }, [active, job.id]);

  useEffect(() => setFull(job), [job]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <b>{full.sourceName || 'Upload'}</b>
          <div className="mut"><small>{new Date(full.createdAt).toLocaleString()} · {full.outputs?.length || 0} shorts</small></div>
        </div>
        <div className="row">
          <StagePill status={full.status} />
          <button className="ghost" onClick={() => onDelete(full.id)} title="Delete job + files">✕</button>
        </div>
      </div>
      {active && (
        <div style={{ marginTop: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <small className="mut">{STAGES[full.stage] || full.stage}…</small>
            <small className="mut">{Math.round(full.progress || 0)}%</small>
          </div>
          <div className="bar" style={{ marginTop: 6 }}>
            <div style={{ width: `${full.progress || 0}%` }} />
          </div>
        </div>
      )}
      {full.status === 'error' && (
        <pre style={{ marginTop: 10 }}>{full.error || 'Render failed. Check backend logs (ffmpeg/transcription).'}</pre>
      )}
      {!!full.outputs?.length && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', marginTop: 12 }}>
          {full.outputs.map((c) => <ClipCard key={c.clipId || c.file} clip={c} />)}
        </div>
      )}
    </div>
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
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [j, p, h] = await Promise.all([
        listJobs(),
        api.get('/projects').catch(() => ({ data: [] })),
        getHealth().catch(() => null),
      ]);
      setJobs(j);
      setProjects(p.data || []);
      if (h?.engines) setEngines(h.engines);
    } catch (e) {
      setError('Backend unreachable — start it with `npm run dev` in backend/ (needs Supabase DB).');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const submit = async () => {
    setError('');
    const options = { projectId: projectId || undefined, maxClips, minLen, maxLen, subtitles, portrait };
    if (maxLen <= minLen) { setError('Max clip length must be greater than min.'); return; }
    setBusy(true);
    setUploadPct(0);
    try {
      let job;
      if (sourceTab === 'link') {
        if (!ytUrl.trim()) { setError('Paste a YouTube link first.'); setBusy(false); return; }
        job = await createJobFromLink(ytUrl.trim(), options);
      } else {
        if (!file) { setError('Choose a long-form video first.'); setBusy(false); return; }
        job = await createJob(file, options, setUploadPct);
      }
      setJobs((j) => [job, ...j]);
      setFile(null);
      setYtUrl('');
      setYtMeta(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const checkLink = async () => {
    setError('');
    setYtMeta(null);
    if (!ytUrl.trim()) { setError('Paste a YouTube link first.'); return; }
    setYtChecking(true);
    try {
      setYtMeta(await inspectLink(ytUrl.trim()));
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setYtChecking(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this job and its rendered files?')) return;
    await deleteJob(id).catch(() => {});
    setJobs((j) => j.filter((x) => x.id !== id));
  };

  const patch = (updated) => setJobs((j) => j.map((x) => (x.id === updated.id ? updated : x)));

  return (
    <div className="grid">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'end' }}>
        <div>
          <h2 style={{ margin: 0 }}>✂️ Auto Clips <span className="pill">ClipAI</span></h2>
          <p className="mut" style={{ margin: '6px 0 0' }}>
            Long video in → viral 9:16 shorts out. AI transcription, engagement scoring,
            auto-reframe, animated subtitles, viral titles. Ported from ClippedAI.
          </p>
        </div>
        <span className="pill">
          {engines
            ? `${engines.whisper ? '🎙 Whisper' : '📝 Heuristic subs'} · ${engines.titles === 'groq' ? '⚡ Groq titles' : engines.titles === 'openai' ? '✨ AI titles' : '💡 Heuristic titles'}`
            : 'No API keys needed · heuristic fallback built in'}
        </span>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>1 · Source video</h3>
            <div className="row" style={{ gap: 6 }}>
              <button
                className={sourceTab === 'upload' ? '' : 'ghost'}
                style={{ padding: '6px 12px' }}
                onClick={() => setSourceTab('upload')}
              >
                ⬆ Upload
              </button>
              <button
                className={sourceTab === 'link' ? '' : 'ghost'}
                style={{ padding: '6px 12px' }}
                onClick={() => setSourceTab('link')}
              >
                🔗 YouTube link
              </button>
            </div>
          </div>

          {sourceTab === 'upload' ? (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); setFile(e.dataTransfer.files?.[0] || null); }}
            style={{
              border: `2px dashed ${dragOver ? '#7c5cff' : '#232b3b'}`,
              borderRadius: 14, padding: 26, textAlign: 'center', cursor: 'pointer',
              background: dragOver ? '#151a2e' : 'transparent', marginTop: 12,
            }}
          >
            <div style={{ fontSize: 28 }}>🎬</div>
            <div style={{ marginTop: 8 }}>
              {file ? <b>{file.name}</b> : 'Drop a long-form video here or click to browse'}
            </div>
            <div className="mut"><small>mp4 / mov / mkv / webm · up to 1GB</small></div>
            <input
              ref={inputRef} type="file" accept="video/*" style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          ) : (
          <div style={{ marginTop: 12 }}>
            <div className="row">
              <input
                placeholder="Paste a YouTube link — watch, Shorts or youtu.be…"
                value={ytUrl}
                onChange={(e) => { setYtUrl(e.target.value); setYtMeta(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') checkLink(); }}
                style={{ flex: 1 }}
              />
              <button className="ghost" onClick={checkLink} disabled={ytChecking || !ytUrl.trim()}>
                {ytChecking ? 'Checking…' : 'Preview'}
              </button>
            </div>
            {ytMeta && (
              <div className="row" style={{ marginTop: 12, alignItems: 'center', background: '#0e1320', border: '1px solid #232b3b', borderRadius: 12, padding: 10 }}>
                {ytMeta.thumbnail && (
                  <img src={ytMeta.thumbnail} alt="" style={{ width: 120, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8 }} />
                )}
                <div>
                  <b style={{ fontSize: 13 }}>{ytMeta.title}</b>
                  <div className="mut"><small>{ytMeta.uploader || 'YouTube'} · {fmtTime(ytMeta.duration)} long</small></div>
                  <span className="pill" style={{ marginTop: 4, display: 'inline-block' }}>✓ Ready to clip</span>
                </div>
              </div>
            )}
            <p className="mut" style={{ marginTop: 10 }}>
              <small>Best quality ≤1080p is downloaded, then the normal pipeline runs. Only clip videos you own or have rights to use.</small>
            </p>
          </div>
          )}
          {busy && uploadPct > 0 && uploadPct < 100 && (
            <div style={{ marginTop: 10 }}>
              <small className="mut">Uploading… {uploadPct}%</small>
              <div className="bar" style={{ marginTop: 6 }}><div style={{ width: `${uploadPct}%` }} /></div>
            </div>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ maxWidth: 220 }}>
              <option value="">No project (standalone)</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        </div>

        <div className="card">
          <h3>2 · Clip recipe</h3>
          <label><small className="mut">Shorts to generate: {maxClips}</small></label>
          <input type="range" min={1} max={12} value={maxClips} onChange={(e) => setMaxClips(+e.target.value)} />
          <div className="grid g2" style={{ marginTop: 8 }}>
            <div>
              <label><small className="mut">Min length (s): {minLen}</small></label>
              <input type="range" min={5} max={120} value={minLen} onChange={(e) => setMinLen(+e.target.value)} />
            </div>
            <div>
              <label><small className="mut">Max length (s): {maxLen}</small></label>
              <input type="range" min={10} max={180} value={maxLen} onChange={(e) => setMaxLen(+e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={subtitles} onChange={(e) => setSubtitles(e.target.checked)} style={{ width: 'auto' }} />
              <small>Burned subtitles</small>
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={portrait} onChange={(e) => setPortrait(e.target.checked)} style={{ width: 'auto' }} />
              <small>9:16 reframe</small>
            </label>
          </div>
          <button onClick={submit} disabled={busy || (sourceTab === 'upload' ? !file : !ytUrl.trim())} style={{ width: '100%', marginTop: 14 }}>
            {busy ? (sourceTab === 'link' ? 'Starting…' : 'Uploading…') : '✂️ Generate shorts'}
          </button>
          {error && <pre style={{ marginTop: 10 }}>{error}</pre>}
          <p className="mut" style={{ marginTop: 10 }}>
            <small>
              Pipeline: transcribe (Whisper API or offline heuristic) → engagement score
              (density 45% · hooks 30% · length 25%) → trim → 9:16 → subtitles → viral title.
              Renders run one at a time on the backend; transcription is cached per job.
            </small>
          </p>
        </div>
      </div>

      <div className="grid">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>3 · Jobs & shorts</h3>
          <button className="ghost" onClick={refresh}>Refresh</button>
        </div>
        {jobs.length === 0 && (
          <div className="card"><span className="mut">No clip jobs yet — upload a video to create your first batch of shorts.</span></div>
        )}
        {jobs.map((j) => <JobCard key={j.id} job={j} onDelete={remove} onChanged={patch} />)}
      </div>
    </div>
  );
}
