import { useEffect, useState } from 'react';
import { Send, Radar, Sparkles, CalendarClock } from 'lucide-react';

import { api } from '../lib/api';
import PlatformPicker from '../components/PlatformPicker';
import VariantPreview from '../components/VariantPreview';
import { PaperPage, PageHead, Panel, EmptyState, ErrorNote, LoadingNote, UnderlineDoodle } from '../ui/AppKit';
import { StatusDot } from '../ui/StatusDot';
import { StickerLabel } from '../ui/StickerLabel';

const JOB_STATUS_COLOR = { published: 'green', failed: 'red', error: 'red', scheduled: 'purple', draft: 'orange' };

// Domain 7: Multi-Platform Adaptation (F7.1–F7.4) + handoff to scheduling (F8.1).
// One clip → persisted per-platform variants → edit with validation → schedule.
export default function Publish() {
  const [clips, setClips] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [clipId, setClipId] = useState('');
  const [platforms, setPlatforms] = useState(['tiktok', 'reels', 'shorts']);
  const [variants, setVariants] = useState([]);
  const [engine, setEngine] = useState(null);
  const [edlMeta, setEdlMeta] = useState(null);
  const [trendsMeta, setTrendsMeta] = useState(null);
  const [trendTags, setTrendTags] = useState([]);
  const [pickedTags, setPickedTags] = useState([]);
  const [trendsBusy, setTrendsBusy] = useState(false);
  const [trendsFailed, setTrendsFailed] = useState(false);
  const [variantsError, setVariantsError] = useState(null);
  const [niche, setNiche] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [c, j] = await Promise.all([api.get('/content/clips'), api.get('/content/publish')]);
      setClips(c.data); setJobs(j.data); setErr(null);
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not load clips and publish jobs — is the backend running?');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!clipId) { setVariants([]); setTrendTags([]); setPickedTags([]); setTrendsMeta(null); setEdlMeta(null); setVariantsError(null); return; }
    let active = true;
    api.get(`/content/clips/${clipId}/variants`).then((r) => {
      if (!active) return;
      setVariants(r.data);
      const withEdl = r.data.find((v) => v.edlVersion != null);
      if (withEdl) setEdlMeta({ version: withEdl.edlVersion });
      // A failed load used to be swallowed, and the page then stated "No variants
      // yet for this clip" — an affirmative claim the request never supported.
      setVariantsError(null);
    }).catch((e) => {
      if (!active) return;
      setVariants([]);
      setVariantsError(e.response?.data?.error || 'Could not load variants for this clip.');
    });
    return () => { active = false; };
  }, [clipId]);

  const clip = clips.find((c) => c.id === clipId);

  const loadTrends = async () => {
    if (!clip) return;
    setTrendsBusy(true);
    setTrendsFailed(false);
    try {
      const { data } = await api.get('/content/trends', { params: { topic: clip.title || '', niche } });
      setTrendTags(data.tags || []);
      setPickedTags((data.tags || []).slice(0, 6));
      setTrendsMeta({ source: data.source });
    } catch {
      // Do not assert what the server "will use" — that is an unverifiable claim.
      setTrendsMeta(null);
      setTrendsFailed(true);
    } finally { setTrendsBusy(false); }
  };

  const toggleTag = (t) => setPickedTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  const adapt = async () => {
    if (!clipId) { setErr('Pick a clip first.'); return; }
    if (!platforms.length) { setErr('Toggle at least one platform.'); return; }
    setErr(null); setBusy(true);
    try {
      // pickedTags empty → server auto-fetches internet trends for the clip topic
      const { data } = await api.post('/content/adapt', {
        clipId, platforms, topic: clip?.title || '', niche, topicTags: pickedTags,
      });
      setVariants(data.variants || []);
      setEngine(data.engine);
      setEdlMeta(data.edl || null);
      setTrendsMeta(data.trends || null);
    } catch (e) {
      setErr(e.response?.data?.error || 'Adaptation failed. Is the backend running?');
    } finally { setBusy(false); }
  };

  const saveVariant = async (id, draft) => {
    try {
      const { data } = await api.patch(`/content/variants/${id}`, draft);
      setVariants((vs) => vs.map((v) => (v.id === id ? { ...v, ...data } : v)));
      setErr(null);
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not save the variant.');
      throw e; // let the button show its own failure state
    }
  };

  const schedule = async (variant, when) => {
    const clip = clips.find((c) => c.id === clipId);
    try {
      await api.post('/content/publish', {
        variant_id: variant.id, clipId, projectId: clip?.projectId,
        platform: variant.platform, caption: variant.caption,
        scheduledAt: when ? new Date(when) : null,
      });
      setErr(null);
      load();
    } catch (e) {
      // Previously unhandled: the rejection surfaced as an unhandled promise and
      // the list silently kept showing the old state.
      setErr(e.response?.data?.error || 'Could not create the publish job.');
    }
  };

  const retry = async (id) => {
    try {
      await api.post(`/content/publish/${id}/retry`);
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Retry failed.');
    }
  };

  const cancel = async (id) => {
    try {
      await api.delete(`/content/publish/${id}`);
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Cancel failed.');
    }
  };

  return (
    <PaperPage>
      <PageHead
        number="06"
        title="Publish"
        script="every platform"
        description="One clip becomes platform-ready variants — true aspect, rewritten captions, validated limits — then schedule per platform."
        actions={
          <StickerLabel variant="ticket" rotate={2} color="var(--sticker-purple)" textColor="#fff">
            <CalendarClock className="w-3.5 h-3.5" />
            records only
          </StickerLabel>
        }
      />

      <UnderlineDoodle className="mb-2" width={170} />
      <ErrorNote className="mt-4">{err}</ErrorNote>
      {loading && <LoadingNote className="mt-3">Loading clips and publish jobs…</LoadingNote>}

      {/* ---- Steps 1-3 ---------------------------------------------------- */}
      <section aria-label="Adapt a clip for platforms" className="mt-4">
        <Panel title="Adapt a clip" taped>
          <div className="step">
            <span className="step-num">1</span>
            <div className="min-w-0 flex-1">
              <span className="step-title">Source clip</span>
              <div className="bb-row mt-2">
                <label htmlFor="pub-clip" className="sr-only">Select clip</label>
                <select
                  id="pub-clip"
                  value={clipId}
                  onChange={(e) => setClipId(e.target.value)}
                  className="!w-auto min-w-[220px] flex-1"
                >
                  <option value="">Select clip</option>
                  {clips.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.startSec}s→{c.endSec}s)
                    </option>
                  ))}
                </select>

                <label htmlFor="pub-niche" className="sr-only">Niche</label>
                <input
                  id="pub-niche"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="niche (e.g. B2B SaaS)"
                  className="!w-auto min-w-[180px]"
                />
              </div>
              {clips.length === 0 && !loading && !err && (
                <p className="ex mt-2">No clips recorded yet — trim one in the Studio, or generate shorts in Auto Clips first.</p>
              )}
            </div>
          </div>

          <div className="step mt-4">
            <span className="step-num">2</span>
            <div className="min-w-0 flex-1">
              <span className="step-title flex items-center gap-1.5">
                <Radar className="w-4 h-4" style={{ color: 'var(--color-hot-pink)' }} />
                Trend tags from the internet
              </span>
              <p className="ex mt-1 !normal-case !font-body !tracking-normal">
                Live Reddit + Hacker News trends plus AI niche tags. Toggle tags to feed adaptation — or adapt directly and the
                server fetches them for the clip topic.
              </p>
              <div className="bb-row mt-2">
                <button className="ghost tiny" onClick={loadTrends} disabled={!clip || trendsBusy}>
                  {trendsBusy ? 'Fetching…' : 'Fetch trend tags'}
                </button>
                {trendsMeta && <span className="pill pill-blue">source: {trendsMeta.source}</span>}
                {trendsFailed && <span className="error-label">Trend fetch failed — adapt directly and the server will try on its own.</span>}
              </div>

              {trendTags.length > 0 && (
                <div className="tags mt-3">
                  {trendTags.map((t) => (
                    <button key={t} type="button" onClick={() => toggleTag(t)} className={`pill-btn ${pickedTags.includes(t) ? 'active' : ''}`} aria-pressed={pickedTags.includes(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="step mt-4">
            <span className="step-num">3</span>
            <div className="min-w-0 flex-1">
              <span className="step-title">Platforms</span>
              <div className="mt-2">
                <PlatformPicker value={platforms} onChange={setPlatforms} />
              </div>
              <button onClick={adapt} disabled={busy} className="mt-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {busy ? 'Adapting…' : variants.length ? 'Re-adapt for selected platforms' : 'Adapt for selected platforms'}
              </button>

              <div className="bb-row mt-3">
                {engine && <span className="pill pill-blue">captions engine: {engine}</span>}
                {edlMeta && (
                  <span className="pill pill-olive">
                    based on EDL v{edlMeta.version}
                    {edlMeta.ctaSource ? ` · CTA from ${edlMeta.ctaSource}` : ''}
                  </span>
                )}
                {!edlMeta && clipId && <span className="pill pill-yellow">no Studio edit yet — preset defaults used</span>}
              </div>

              {edlMeta && (
                <p className="ex mt-2 !normal-case !font-body !tracking-normal">
                  Edit the clip in Studio and re-adapt — the new EDL version flows in automatically.
                </p>
              )}
            </div>
          </div>
        </Panel>
      </section>

      {/* ---- Variants ----------------------------------------------------- */}
      {variants.length > 0 && (
        <section aria-label="Platform variants" className="mt-6">
          <div className="card-title-row">
            <h2>Variants</h2>
            <span className="pill pill-pink">{variants.length}</span>
          </div>
          <div className="bb-grid bb-g2 items-start">
            {variants.map((v) => (
              <VariantPreview key={v.id} variant={v} onSave={saveVariant} onSchedule={schedule} />
            ))}
          </div>
        </section>
      )}

      {clipId && !variants.length && !busy && (
        <div className="mt-4">
          {variantsError ? (
            <ErrorNote>{variantsError}</ErrorNote>
          ) : (
            <EmptyState title="No variants yet for this clip" icon={<Sparkles className="w-5 h-5" />}>
              Adapt it above, or pick another clip.
            </EmptyState>
          )}
        </div>
      )}

      {/* ---- Queue -------------------------------------------------------- */}
      <section aria-label="Scheduled and published jobs" className="mt-6">
        <div className="card-title-row">
          <h2>Scheduled / published</h2>
          <StickerLabel variant="tag" color="var(--color-hot-pink)" rotate={-2}>
            <Send className="w-3.5 h-3.5" />
            no connector wired up yet
          </StickerLabel>
        </div>
        <p className="ex mb-3 !normal-case !font-body !tracking-normal">
          Scheduling records only — no platform connector is wired up yet, so nothing here uploads to TikTok/Reels/Shorts/X.
        </p>

        {!loading && jobs.length === 0 && <EmptyState title="Nothing scheduled yet" icon={<CalendarClock className="w-5 h-5" />}>Schedule a variant above and it will appear here.</EmptyState>}

        <div className="flex flex-col gap-3">
          {jobs.map((j) => (
            <article key={j.id} className="card !p-4 flex items-start gap-3 flex-wrap">
              <span className="pill pill-blue">{j.platform}</span>
              <span className="pill">
                <StatusDot color={JOB_STATUS_COLOR[j.status] ?? 'orange'} size={7} pulse={false} />
                {j.status}
              </span>
              <span className="text-sm flex-1 min-w-[200px]">
                {/* No caption is a real, visible state — the server no longer invents one. */}
                {j.caption ? j.caption : <em className="muted">no caption</em>}
                <span className="mono-xs muted ml-2">
                  {j.scheduledAt ? new Date(j.scheduledAt).toLocaleString() : 'draft'}
                </span>
              </span>
              <div className="bb-row shrink-0">
                {j.status === 'failed' && (
                  <button className="tiny" onClick={() => retry(j.id)}>
                    Retry publish
                  </button>
                )}
                {['scheduled', 'draft'].includes(j.status) && (
                  <button className="ghost tiny" onClick={() => cancel(j.id)}>
                    Cancel
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </PaperPage>
  );
}
