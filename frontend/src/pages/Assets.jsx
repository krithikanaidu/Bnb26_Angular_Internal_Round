import { useEffect, useState } from 'react';
import { Upload, ExternalLink, Film, VolumeX } from 'lucide-react';

import { api } from '../lib/api';
import { PaperPage, PageHead, Panel, EmptyState, ErrorNote, LoadingNote } from '../ui/AppKit';
import { SpillBin } from '../ui/SpillBin';
import { StatusDot } from '../ui/StatusDot';
import { useToast } from '../ui/uiStore';

/**
 * Read the real duration from the file in the browser.
 *
 * The server probes duration with ffprobe and prefers that, so this is only a
 * hint for the rare container ffprobe cannot parse. It used to send a hardcoded
 * 120s for every file, which the server stored as fact.
 */
function readDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith('audio') ? 'audio' : 'video');
    const done = (v) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const d = Number(el.duration);
      done(Number.isFinite(d) && d > 0 ? d : null);
    };
    // Never block the upload on a metadata read that will not arrive.
    el.onerror = () => done(null);
    setTimeout(() => done(null), 4000);
    el.src = url;
  });
}

const KIND_COLOR = {
  video: 'var(--sticker-purple)',
  audio: 'var(--folder-blue-deep)',
  image: 'var(--sticker-yellow)',
};

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [a, p] = await Promise.all([api.get('/assets'), api.get('/projects')]);
      setAssets(a.data);
      setProjects(p.data);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load assets. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const upload = async () => {
    if (!file) {
      setError('Choose a file first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (projectId) fd.append('projectId', projectId);
      const duration = await readDuration(file);
      // Only send a duration we actually measured — never a placeholder.
      if (duration != null) fd.append('durationSec', String(duration));
      await api.post('/assets/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFile(null);
      toast({ message: `${file.name} uploaded.`, variant: 'success' });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed. Is the backend running?');
      toast({ message: 'Upload failed.', variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // Only the newest few files are poured into the decorative bin.
  const binItems = assets.slice(0, 4).map((a, i) => ({
    id: a.id,
    label: a.fileName || `file-${i}`,
    color: KIND_COLOR[a.kind] ?? 'var(--sticker-purple)',
  }));

  return (
    <PaperPage>
      <PageHead
        number="03"
        title="Assets"
        script="the library"
        description="Raw footage, stills and audio. Transcripts are produced by the Auto Clips pipeline using real speech-to-text — nothing is transcribed speculatively here."
      />

      <ErrorNote>{error}</ErrorNote>

      {/* ---- Upload ---------------------------------------------------- */}
      <Panel
        title="Add to the library"
        taped
        subtitle="Stored in Supabase; duration is probed server-side with ffprobe"
        className="mt-4"
      >
        <div className="bb-grid bb-g2 items-start">
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="asset-project">Project</label>
              <select id="asset-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="asset-file">File</label>
              <input
                id="asset-file"
                type="file"
                accept="video/*,image/*,audio/*"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </div>
            <button onClick={upload} disabled={busy || !file} className="flex items-center gap-2 justify-center">
              <Upload className="w-4 h-4" />
              {busy ? 'Uploading…' : 'Upload to Supabase'}
            </button>
          </div>

          <div className="pt-14 flex justify-center">
            <SpillBin items={binItems} />
          </div>
        </div>
      </Panel>

      {/* ---- Library ---------------------------------------------------- */}
      <section aria-label="Asset library" className="mt-4">
        <div className="card-title-row !mb-4">
          <h2>Library</h2>
          <span className="pill">
            {loading ? 'loading…' : `${assets.length} file${assets.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="bb-grid bb-auto">
          {assets.map((a) => (
            <article key={a.id} className="card card-hover">
              <div className="card-title-row !mb-2">
                <h3 className="break-all">{a.fileName}</h3>
                <span className="pill">
                  <StatusDot color={a.kind === 'audio' ? 'orange' : a.kind === 'image' ? 'purple' : 'green'} size={7} pulse={false} />
                  {a.kind}
                </span>
              </div>

              <div className="mono-xs muted mb-2">
                {a.mimeType} · {(a.sizeBytes / 1024).toFixed(0)} KB
              </div>

              <div className="tags">
                {a.durationSec > 0 && (
                  <span className="pill pill-blue">
                    <Film className="w-3 h-3" />
                    {Math.round(a.durationSec)}s
                  </span>
                )}
                {a.meta?.hasAudio === false && (
                  <span className="pill pill-yellow">
                    <VolumeX className="w-3 h-3" />
                    no audio track
                  </span>
                )}
              </div>

              {a.publicUrl && (
                <a
                  href={a.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-3 mono-xs hover:underline"
                  style={{ color: 'var(--color-brand-orange)' }}
                >
                  Open file
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              <div className="mono-xs muted mt-2 break-all">{a.storagePath}</div>
            </article>
          ))}
        </div>

        {loading && <LoadingNote className="mt-4">Loading assets…</LoadingNote>}

        {!loading && assets.length === 0 && !error && (
          <EmptyState title="No assets yet">
            Upload raw footage above. Transcripts come from the Auto Clips pipeline using real speech-to-text.
          </EmptyState>
        )}
      </section>
    </PaperPage>
  );
}
