import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import PlatformPicker from '../components/PlatformPicker';
import VariantPreview from '../components/VariantPreview';

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

  const load = async () => {
    try {
      const [c, j] = await Promise.all([api.get('/content/clips'), api.get('/content/publish')]);
      setClips(c.data); setJobs(j.data);
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not load clips and publish jobs — is the backend running?');
    }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!clipId) { setVariants([]); setTrendTags([]); setPickedTags([]); setTrendsMeta(null); setEdlMeta(null); return; }
    api.get(`/content/clips/${clipId}/variants`).then((r) => {
      setVariants(r.data);
const withEdl = r.data.find((v) => v.edlVersion != null);
      if (withEdl) setEdlMeta({ version: withEdl.edlVersion });
      // A failed load used to be swallowed, and the page then stated "No variants
      // yet for this clip" — an affirmative claim the request never supported.
      setVariantsError(null);
    }).catch((e) => {
      setVariants([]);
      setVariantsError(e.response?.data?.error || 'Could not load variants for this clip.');
    });
  }, [clipId]);

  const clip = clips.find((c) => c.id === clipId);

  const loadTrends = async () => {
    if (!clip) return;
    setTrendsBusy(true);
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
    await api.post(`/content/publish/${id}/retry`);
    load();
  };

  const cancel = async (id) => {
    await api.delete(`/content/publish/${id}`);
    load();
  };

  return (
    <div className="grid">
      <div className="page-head">
        <div>
          <h1>Adapt & publish</h1>
          <p>One clip becomes platform-ready variants — true aspect, rewritten captions, validated limits — then schedule per platform.</p>
        </div>
      </div>
      {err && <p className="error-text">⚠ {err}</p>}

      <div className="card">
        <h3>1 · Source clip</h3>
        <div className="row">
          <select value={clipId} onChange={(e) => setClipId(e.target.value)} style={{ maxWidth: 340 }} aria-label="Select clip">
            <option value="">Select clip</option>
            {clips.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.startSec}s→{c.endSec}s)</option>)}
          </select>
          <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="niche (e.g. B2B SaaS)" style={{ maxWidth: 220 }} aria-label="Niche" />
        </div>
        <h3 style={{ marginTop: 16 }}>2 · Trend tags from the internet</h3>
        <p className="mut"><small>Live Reddit + Hacker News trends plus Groq niche tags. Toggle tags to feed adaptation — or adapt directly and the server fetches them for the clip topic.</small></p>
        <div className="row">
          <button className="ghost" onClick={loadTrends} disabled={!clip || trendsBusy}>{trendsBusy ? 'Fetching…' : 'Fetch trend tags'}</button>
          {trendsMeta && <span className="pill">source: {trendsMeta.source}</span>}
          {trendsFailed && <span className="error-label">Trend fetch failed — adapt directly and the server will try on its own.</span>}
        </div>
        {trendTags.length > 0 && (
          <div className="row" style={{ marginTop: 8 }}>
            {trendTags.map((t) => (
              <button key={t} type="button" onClick={() => toggleTag(t)}
                style={pickedTags.includes(t) ? { background: 'var(--yellow)' } : {}}
                aria-pressed={pickedTags.includes(t)}>{pickedTags.includes(t) ? '✓ ' : ''}{t}</button>
            ))}
          </div>
        )}
        <h3 style={{ marginTop: 16 }}>3 · Platforms</h3>
        <PlatformPicker value={platforms} onChange={setPlatforms} />
        <button className="primary" onClick={adapt} disabled={busy} style={{ marginTop: 14 }}>
          {busy ? 'Adapting…' : variants.length ? 'Re-adapt for selected platforms' : 'Adapt for selected platforms'}
        </button>
        <div className="row" style={{ marginTop: 8 }}>
          {engine && <span className="pill">captions engine: {engine}</span>}
          {edlMeta && <span className="pill">based on EDL v{edlMeta.version}{edlMeta.ctaSource ? ` · CTA from ${edlMeta.ctaSource}` : ''}</span>}
          {!edlMeta && clipId && <span className="pill">no Studio edit yet — preset defaults used</span>}
        </div>
        {edlMeta && <p className="mut"><small>Edit the clip in Studio and re-adapt — the new EDL version flows in automatically.</small></p>}
      </div>

      {variants.length > 0 && (
        <>
          <h2>Variants <span className="pill">{variants.length}</span></h2>
          <div className="grid g2">
            {variants.map((v) => (
              <VariantPreview key={v.id} variant={v} onSave={saveVariant} onSchedule={schedule} />
            ))}
          </div>
        </>
      )}
      {clipId && !variants.length && !busy && (
        <div className="card">
          {variantsError
            ? <p className="error-text">⚠ {variantsError}</p>
            : <p className="mut">No variants yet for this clip — adapt above, or pick another clip.</p>}
        </div>
      )}

      <h2>Scheduled / published</h2>
      <p className="mut"><small>Scheduling records only — no platform connector is wired up yet, so nothing here uploads to TikTok/Reels/Shorts/X.</small></p>
      {jobs.map((j) => (
        <div className="card" key={j.id}>
          <b>{j.platform}</b>{' '}
          <span className="pill"><span className="dot" style={{ background: j.status === 'published' ? 'var(--olive)' : j.status === 'failed' ? 'var(--coral)' : 'var(--orchid)' }} />{j.status}</span>{' '}
          <span className="mut"><small>
            {/* No caption is a real, visible state — the server no longer invents one. */}
            {j.caption ? j.caption : <em>no caption</em>}
            {' · '}
            {j.scheduledAt ? new Date(j.scheduledAt).toLocaleString() : 'draft'}
          </small></span>
          <div className="row" style={{ marginTop: 8 }}>
            {j.status === 'failed' && <button className="coral" onClick={() => retry(j.id)}>Retry publish</button>}
            {['scheduled', 'draft'].includes(j.status) && <button className="ghost" onClick={() => cancel(j.id)}>Cancel</button>}
          </div>
        </div>
      ))}
      {!jobs.length && <p className="mut">Nothing scheduled yet.</p>}
    </div>
  );
}
