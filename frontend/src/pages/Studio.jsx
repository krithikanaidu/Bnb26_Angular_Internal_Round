import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlignLeft, Scissors, Save, RefreshCw, Film } from 'lucide-react';

import { api } from '../lib/api';
import { PaperPage, PageHead, Panel, EmptyState, ErrorNote, LoadingNote, Bar, DataRow } from '../ui/AppKit';
import { StickerLabel } from '../ui/StickerLabel';
import { StatusDot } from '../ui/StatusDot';
import { useToast } from '../ui/uiStore';

export default function Studio() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [scripts, setScripts] = useState([]);
  const [scriptId, setScriptId] = useState('');
  // Starts empty. It used to be pre-filled with a developer-written script that
  // was then posted to /content/align as if the user had written it, so the whole
  // alignment and clip-scoring output was derived from invented text.
  const [scriptBody, setScriptBody] = useState('');
  const [alignment, setAlignment] = useState([]);
  const [clips, setClips] = useState([]);
  const [edl, setEdl] = useState(null);
  const [edlText, setEdlText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('tiktok');
  const toast = useToast();

  const load = async (pid = projectId) => {
    setLoading(true);
    // Fetch independently: these used to be one Promise.all, so a single
    // failing call (e.g. /clips 500ing on a stale table) blanked projects,
    // clips AND scripts together and the script picker went empty.
    const results = await Promise.allSettled([
      api.get('/projects'),
      api.get('/content/clips' + (pid ? `?projectId=${pid}` : '')),
      api.get('/content/scripts' + (pid ? `?projectId=${pid}` : '')),
    ]);
    const [p, c, s] = results;
    if (p.status === 'fulfilled') setProjects(p.value.data);
    if (c.status === 'fulfilled') setClips(c.value.data);
    if (s.status === 'fulfilled') {
      setScripts(s.value.data);
      // Keep the open editor in sync with the refreshed list.
      if (scriptId) {
        const fresh = (s.value.data || []).find((x) => x.id === scriptId);
        if (fresh?.body && fresh.body !== scriptBody) setScriptBody(fresh.body);
      }
    }
    const firstError = [p, c, s].find((r) => r.status === 'rejected');
    if (firstError) {
      setError(firstError.reason?.response?.data?.error || 'Could not load studio data. Is the backend running?');
    } else {
      setError(null);
    }
    setLoading(false);
  };
  // Refilters whenever the project changes — the dropdown used to silently keep
  // showing the previous project's clips/scripts until Refresh was found.
  useEffect(() => {
    load(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Pull the real saved script into the editor when one is chosen.
  const pickScript = (id) => {
    setScriptId(id);
    setAlignment([]);
    const s = scripts.find((x) => x.id === id);
    setScriptBody(s?.body || '');
  };

  const align = async () => {
    if (!scriptBody.trim()) {
      setError('Load or write a script before aligning.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/content/align', { scriptBody, projectId: projectId || undefined });
      setAlignment(data.alignment || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Alignment failed.');
    } finally {
      setBusy(false);
    }
  };

  const genClips = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/content/clips/generate', { projectId: projectId || undefined });
      setClips(data);
      // The backend 400s when there is nothing to generate from; a zero-length
      // 201 used to toast "0 clip(s) generated" as a success.
      if ((data || []).length) toast({ message: `${data.length} clip(s) generated.`, variant: 'success' });
      else setError('No clips came back — upload footage with speech and transcribe it first.');
    } catch (e) {
      setError(e.response?.data?.error || 'Clip generation failed.');
    } finally {
      setBusy(false);
    }
  };

  const makeEdit = async (clip) => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/content/edits', {
        projectId: projectId || clip.projectId || undefined,
        clipId: clip.id,
        platform,
      });
      setEdl(data);
      setEdlText(JSON.stringify(data.edl, null, 2));
      toast({ message: 'Edit created — it stays yours.', variant: 'success' });
      requestAnimationFrame(() => document.getElementById('edl-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      setError(e.response?.data?.error || 'Could not create an edit.');
    } finally {
      setBusy(false);
    }
  };

  const saveEdl = async () => {
    if (!edl?.id) { setError('No edit loaded yet — generate an AI edit first.'); return; }
    let parsed;
    try {
      parsed = JSON.parse(edlText);
    } catch {
      setError('That EDL is not valid JSON — fix the syntax before saving.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.patch(`/content/edits/${edl.id}`, { edl: parsed });
      setEdl(data);
      setEdlText(JSON.stringify(data.edl, null, 2));
      toast({ message: 'Your edit was saved.', variant: 'success' });
    } catch (e) {
      setError(e.response?.data?.error || 'Could not save the edit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PaperPage>
      <PageHead
        number="04"
        title="Studio"
        script="script to cut"
        description="Align a script to real transcript segments, generate short-form clips from that transcript, then take the AI's edit and make it yours. Every EDL is JSON you can rewrite."
        actions={
          <Link to="/video-editor" className="btn ghost">
            <Film className="w-4 h-4 inline -mt-0.5 mr-1" />
            Open the editor
          </Link>
        }
      />

      <ErrorNote className="mt-4">{error}</ErrorNote>

      {/* ---- Context pickers --------------------------------------------- */}
      <Panel title="Working set" className="mt-4">
        <div className="bb-row">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="studio-project">Project</label>
            <select id="studio-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label htmlFor="studio-script">Saved script</label>
            <select id="studio-script" value={scriptId} onChange={(e) => pickScript(e.target.value)}>
              <option value="">No saved script selected</option>
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || `Script ${s.id.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label htmlFor="studio-platform">Edit for</label>
            <select id="studio-platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {['tiktok', 'reels', 'shorts', 'x', 'linkedin'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <button className="ghost flex items-center gap-2 self-end" onClick={() => load()}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </Panel>

      {/* ---- EDL ----------------------------------------------------------
          Sits directly under the working set so the edit is one glance away —
          it used to live at the very bottom, past an unbounded clips list. */}
      {edl && (
        <Panel
          title={`Editable EDL — ${edl.platform} ${edl.aspect}`}
          taped
          subtitle={`Version ${edl.version}`}
          className="mt-4"
          actions={
            <button className="flex items-center gap-2 tiny" onClick={saveEdl} disabled={busy}>
              <Save className="w-3.5 h-3.5" />
              {busy ? 'Saving…' : 'Save my edit'}
            </button>
          }
        >
          <div id="edl-panel" className="bb-grid bb-g4 mb-3">
            <DataRow label="Edit id" mono>
              {edl.id}
            </DataRow>
            <DataRow label="Platform">{edl.platform}</DataRow>
            <DataRow label="Aspect">{edl.aspect}</DataRow>
            <DataRow label="Version">{edl.version}</DataRow>
          </div>
          <textarea rows={12} value={edlText} onChange={(e) => setEdlText(e.target.value)} aria-label="EDL JSON" className="font-mono !text-xs" />
        </Panel>
      )}

      <div className="bb-grid bb-g2 mt-4 items-start">
        {/* ---- Script + alignment ---------------------------------------- */}
        <Panel
          title="Script"
          taped
          subtitle="Sentences are matched to transcript segments"
          actions={<StickerLabel variant="tag" color="var(--hot-pink)" textColor="var(--hot-pink)">align</StickerLabel>}
        >
          <textarea
            rows={8}
            value={scriptBody}
            onChange={(e) => setScriptBody(e.target.value)}
            placeholder="Select a saved script above, or paste yours here."
            aria-label="Script body"
          />

          <div className="bb-row mt-3">
            <button className="flex items-center gap-2" onClick={align} disabled={busy || !scriptBody.trim()}>
              <AlignLeft className="w-4 h-4" />
              {busy ? 'Working…' : 'Align script ↔ footage'}
            </button>
          </div>

          {!scriptBody.trim() && (
            <p className="ex mt-3">
              Nothing to align yet — the editor starts empty so nothing invented gets aligned to your footage.
            </p>
          )}

          {alignment.length > 0 && (
            <>
              <hr className="sep" />
              <ol className="flex flex-col gap-3 list-none p-0 m-0">
                {alignment.map((a, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="step-num flex-none">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{a.sentence}</p>
                      <div className="bb-row mt-1.5">
                        <span className="pill pill-blue">
                          {a.best?.seg?.startSec ?? '?'}s – {a.best?.seg?.endSec ?? '?'}s
                        </span>
                        <span className="pill">
                          score {a.best?.score == null ? '—' : a.best.score}
                        </span>
                      </div>
                      {!!a.reason && <p className="mono-xs muted mt-1">{a.reason}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </Panel>

        {/* ---- Clips ------------------------------------------------------ */}
        <Panel
          title="Automated clips"
          taped
          subtitle="Generated from a real transcript"
          actions={
            <button className="ghost tiny flex items-center gap-1.5" onClick={genClips} disabled={busy}>
              <Scissors className="w-3.5 h-3.5" />
              {busy ? 'Working…' : 'Generate'}
            </button>
          }
        >
          {loading && <LoadingNote>Loading clips…</LoadingNote>}

          {!loading && clips.length === 0 && (
            <EmptyState title="No clips yet">
              Clips are generated from a real transcript, so upload footage with speech first.
            </EmptyState>
          )}

          <ul className="flex flex-col gap-3 list-none p-0 m-0">
            {clips.map((c) => (
              <li key={c.id} className="card !p-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="!text-[14px] flex-1 min-w-0 break-words">{c.title || 'Untitled clip'}</h3>
                  <span className="pill pill-pink flex-none">
                    {c.viralityScore == null ? (
                      'score —'
                    ) : (
                      <>
                        <StatusDot color={c.viralityScore >= 0.7 ? 'green' : c.viralityScore >= 0.4 ? 'orange' : 'red'} size={7} pulse={false} />
                        {c.viralityScore}
                      </>
                    )}
                  </span>
                </div>
                <div className="mono-xs muted mt-1.5">
                  {c.startSec ?? '?'}s → {c.endSec ?? '?'}s {c.hookText ? `· ${c.hookText}` : ''}
                </div>
                {!!c.reasons?.length && <p className="mono-xs muted mt-1">{c.reasons.join(' · ')}</p>}
                <Bar value={(c.viralityScore ?? 0) * 100} className="mt-2" />
                <button className="ghost tiny mt-2" onClick={() => makeEdit(c)} disabled={busy}>
                  AI edit (keep editable)
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </PaperPage>
  );
}
