import { useEffect, useState } from 'react';
import { Sparkles, ScrollText, Target } from 'lucide-react';

import { api } from '../lib/api';
import { PaperPage, PageHead, Panel, EmptyState, ErrorNote, LoadingNote, UnderlineDoodle } from '../ui/AppKit';
import { GradientSlider } from '../ui/GradientSlider';
import { StickerLabel } from '../ui/StickerLabel';
import { useToast } from '../ui/uiStore';

const TONES = ['energetic', 'educational', 'funny', 'professional'];

/**
 * Maps a hook score (0–1 from the backend) onto the sticker-stack height on the
 * GradientSlider. Null/undefined scores stay at zero rather than defaulting to
 * a middling value that would overstate a weak hook.
 */
function scoreToIntensity(score) {
  if (score == null) return 0;
  return Math.round(Math.max(0, Math.min(1, Number(score))) * 100);
}

export default function Scripts() {
  const [projects, setProjects] = useState([]);
  const [scripts, setScripts] = useState([]);
  // Starts empty. It used to be pre-filled with 'AI video editing for creators',
  // which was then submitted to the generators as the user's own topic whenever
  // they clicked Generate without touching the field.
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('energetic');
  const [projectId, setProjectId] = useState('');
  const [hooks, setHooks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    // Fetch independently: one Promise.all used to mean a failing scripts
    // call also discarded the projects list (and vice versa).
    const results = await Promise.allSettled([api.get('/projects'), api.get('/content/scripts')]);
    const [p, s] = results;
    if (p.status === 'fulfilled') setProjects(p.value.data);
    if (s.status === 'fulfilled') setScripts(s.value.data);
    const firstError = [p, s].find((r) => r.status === 'rejected');
    if (firstError) {
      setError(firstError.reason?.response?.data?.error || 'Could not load scripts. Is the backend running?');
    } else {
      setError(null);
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const run = async (fn, successMessage) => {
    if (!topic.trim()) {
      setError('Enter a topic first — nothing is generated from a blank prompt.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast({ message: successMessage, variant: 'success' });
    } catch (e) {
      setError(e.response?.data?.error || 'Generation failed.');
      toast({ message: 'Generation failed.', variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const genHooks = () =>
    run(async () => {
      const { data } = await api.post('/content/generate-hooks', {
        topic: topic.trim(),
        count: 5,
        projectId: projectId || undefined,
      });
      setHooks(data || []);
    }, 'Hooks generated.');

  const genScript = () =>
    run(async () => {
      await api.post('/content/generate-script', {
        topic: topic.trim(),
        tone,
        platforms: ['tiktok', 'reels', 'shorts'],
        projectId: projectId || undefined,
        title: topic.trim(),
      });
      await load();
    }, 'Script saved.');

  const bestScore = hooks.reduce((max, h) => (h?.score != null && h.score > max ? h.score : max), 0);
  const bestIntensity = scoreToIntensity(bestScore);

  return (
    <PaperPage>
      <PageHead
        number="02"
        title="Scripts"
        script="hooks first"
        description="Generate opening hooks, then a full script. Both go through whichever copy engine the backend reports — check the footer for which one is live."
      />

      <UnderlineDoodle className="mb-2" width={150} />
      <ErrorNote className="mt-4">{error}</ErrorNote>

      {/* ---- Composer ---------------------------------------------------- */}
      <Panel
        title="Compose"
        taped
        subtitle="Platforms: TikTok · Reels · Shorts"
        className="mt-4"
        actions={<StickerLabel variant="ticket" rotate={2}>{tone}</StickerLabel>}
      >
        <div className="bb-grid bb-g2">
          <div>
            <label htmlFor="script-topic">Topic</label>
            <input
              id="script-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="the subject of your video"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && topic.trim()) genScript();
              }}
            />
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="script-tone">Tone</label>
              <select id="script-tone" value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="script-project">Project</label>
              <select id="script-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bb-row mt-4">
          <button className="flex items-center gap-2" onClick={genHooks} disabled={busy || !topic.trim()}>
            <Sparkles className="w-4 h-4" />
            {busy ? 'Generating…' : 'Generate hooks'}
          </button>
          <button className="green flex items-center gap-2" onClick={genScript} disabled={busy || !topic.trim()}>
            <ScrollText className="w-4 h-4" />
            {busy ? 'Generating…' : 'Generate full script'}
          </button>
          {!topic.trim() && <span className="ex">Enter a topic to unlock generation.</span>}
        </div>
      </Panel>

      {/* ---- Hooks -------------------------------------------------------- */}
      {hooks.length > 0 && (
        <section aria-label="Generated hooks" className="mt-4">
          <Panel
            title="Hooks"
            taped
            subtitle="Scored by the backend. The slider shows the strongest hook it returned."
            className="relative overflow-visible"
          >
            <div className="bb-grid bb-g2">
              {hooks.map((h, i) => (
                <article key={`${h.text}-${i}`} className="card card-hover">
                  <span className="step-num mb-2">{String(i + 1).padStart(2, '0')}</span>
                  <p className="font-display font-bold text-[15px] leading-snug mt-2">{h.text}</p>
                  <div className="bb-row mt-3">
                    <span className="pill pill-pink">{h.style}</span>
                    <span className="pill">
                      score {h.score == null ? '—' : h.score}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-2 pt-16 max-w-md mx-auto">
              <GradientSlider
                value={bestIntensity}
                stackCount={bestIntensity / 20}
                leftTag="WEAKEST"
                rightTag="STRONGEST"
                label="Strongest hook strength"
              />
              <p className="ex text-center mt-1">
                Read-only here — set the real intensity on the Publish page.
              </p>
            </div>
          </Panel>
        </section>
      )}

      {/* ---- Saved scripts ----------------------------------------------- */}
      <section aria-label="Saved scripts" className="mt-4">
        <div className="card-title-row !mb-4">
          <h2>Saved scripts</h2>
          <span className="pill">
            {loading ? 'loading…' : `${scripts.length}`}
          </span>
        </div>

        <div className="bb-grid bb-g2">
          {scripts.map((s) => (
            <article key={s.id} className="card">
              <div className="card-title-row">
                <h3 className="break-words">{s.title || 'Untitled'}</h3>
                <span className="pill">{s.tone || '—'}</span>
              </div>
              <pre className="mt-2">{s.body}</pre>
            </article>
          ))}
        </div>

        {loading && <LoadingNote className="mt-4">Loading scripts…</LoadingNote>}

        {!loading && scripts.length === 0 && !error && (
          <EmptyState title="No scripts saved yet" icon={<Target className="w-5 h-5" />}>
            Generate one above, or build it beat by beat in the Ideation studio.
          </EmptyState>
        )}
      </section>
    </PaperPage>
  );
}
