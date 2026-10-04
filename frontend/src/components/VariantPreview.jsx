import { useEffect, useState } from 'react';

// Per-platform variant card (F7.3): true-aspect phone frame with safe-zone
// overlay + editable caption/title/hashtags with live counters + warnings.
// Controlled-ish: { variant, onSave(id, draft), onSchedule(variant, datetime) }.
export default function VariantPreview({ variant, onSave, onSchedule }) {
  const preset = variant.preset || null;
  // No invented platform limits. These used to fall back to 2200 chars / 0-5
  // tags / a 10%-15% safe zone, which contradicted the real presets (X is 280
  // chars, Shorts 5000) — so a user on X was shown "45/2200" and never warned
  // about the actual limit. When the preset is absent we say so.
  const maxCaption = preset?.caption?.max_chars ?? null;
  const maxTitle = preset?.caption?.title_max_chars ?? null;
  const tagRange = preset?.hashtags ?? null;
  const requiredTags = Array.isArray(preset?.hashtags?.required) ? preset.hashtags.required : [];

  const [caption, setCaption] = useState(variant.caption || '');
  const [title, setTitle] = useState(variant.title || '');
  const [tags, setTags] = useState((variant.hashtags || []).join(' '));
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCaption(variant.caption || '');
    setTitle(variant.title || '');
    setTags((variant.hashtags || []).join(' '));
  }, [variant.id, variant.caption, variant.title, JSON.stringify(variant.hashtags)]); // eslint-disable-line

  const tagList = tags.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`));
  const dirty = caption !== (variant.caption || '') || title !== (variant.title || '') || tags !== (variant.hashtags || []).join(' ');
  const warnings = variant.warnings || [];
  const safe = preset?.safe_zone ?? null;
  const aspect = preset?.aspect || variant.aspect || null;
  const tall = aspect === '9:16';
  const reframe = variant.reframe || null;

  const [err, setErr] = useState(null);

  const save = async () => {
    setBusy(true); setErr(null);
    try { await onSave?.(variant.id, { title, caption, hashtags: tagList }); }
    // Previously swallowed entirely: a failed save left the edit looking saved.
    catch (e) { setErr(e.response?.data?.error || 'Save failed.'); }
    finally { setBusy(false); }
  };

  const revalidate = async () => {
    setBusy(true); setErr(null);
    try { await onSave?.(variant.id, { title, caption, hashtags: tagList }); }
    catch (e) { setErr(e.response?.data?.error || 'Re-validate failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b>{preset.label || variant.platform}</b>
        <span className="row">
          <span className="pill">
            {variant.aspect}
            {/* duration is null when the clip has no in/out points yet — say
                "unknown" rather than rendering a fabricated "30s". */}
            {variant.duration == null ? ' · duration unknown' : ` · ${variant.duration}s`}
          </span>
          {variant.captionStyle && <span className="pill">captions: {variant.captionStyle}</span>}
          {variant.edlVersion != null && <span className="pill">EDL v{variant.edlVersion}</span>}
          <span className="pill" style={variant.status === 'needs_attention' ? { background: 'var(--coral)', color: 'var(--paper)' } : { background: 'var(--olive)' }}>
            <span className="dot" style={{ background: variant.status === 'needs_attention' ? 'var(--paper)' : 'var(--ink)' }} />
            {variant.status === 'needs_attention' ? 'needs attention' : 'ready'}
          </span>
        </span>
      </div>

      {/* true-ratio frame with safe-zone overlay */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <div style={{
          position: 'relative', flexShrink: 0, width: tall ? 96 : 150,
          aspectRatio: aspect ? aspect.replace(':', ' / ') : '9 / 16',
          background: 'var(--paper-2)', border: '2px solid var(--ink)', borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--ink-soft)' }}>preview</div>
          {/* Only draw a safe zone when the preset actually defines one. */}
          {safe && (
            <div style={{
              position: 'absolute', left: 0, right: 0,
              top: `${(safe.top || 0) * 100}%`, bottom: `${(safe.bottom || 0) * 100}%`,
              border: '2px dashed var(--pink)', borderLeft: 0, borderRight: 0,
            }} title="Safe zone — keep captions inside" />
          )}
        </div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
          {(variant.actions || []).map((a, i) => <li key={i}><small>{a}</small></li>)}
        </ul>
      </div>

      {reframe && (
        <details style={{ marginTop: 10 }}>
          <summary><small><b>Reframe plan</b> <span className="mut">{reframe.source} → {reframe.target} · {reframe.focus} crop (render-time)</span></small></summary>
          <pre style={{ fontSize: 12, marginTop: 6 }}>ffmpeg -vf "{reframe.ffmpeg}"{'\n'}# {reframe.note}</pre>
        </details>
      )}

      {warnings.length > 0 && (
        <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          {warnings.map((w, i) => (
            <div key={i} className="pill" style={{ background: 'var(--yellow)', justifySelf: 'start' }}>
              ⚠ {w.message} <span className="mut">— {w.fix}</span>
            </div>
          ))}
        </div>
      )}

      {maxTitle != null && (
        <div style={{ marginTop: 10 }}>
          <label>Title <span className="mut">({title.length}/{maxTitle})</span></label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={maxTitle + 20} />
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <label>
          Caption{' '}
          <span className="mut">
            ({caption.length}
            {maxCaption != null ? `/${maxCaption}` : ' — platform limit unavailable'})
          </span>
        </label>
        <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} style={{ width: '100%' }} />
      </div>
      <div style={{ marginTop: 10 }}>
        <label>
          Hashtags{' '}
          <span className="mut">
            ({tagList.length}
            {tagRange ? ` · platform wants ${tagRange.min}–${tagRange.max}, space-separated` : ' · no platform range available'})
          </span>
        </label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={requiredTags.length ? requiredTags.join(' ') : 'Space-separated hashtags'} />
        {requiredTags.length > 0 && (
          <div className="mut"><small>Required by this platform: {requiredTags.join(' ')}</small></div>
        )}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        {dirty && <button className="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save variant'}</button>}
        {!dirty && <button className="ghost" onClick={revalidate} disabled={busy}>{busy ? 'Validating…' : 'Re-validate'}</button>}
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ maxWidth: 200 }} aria-label="Schedule time" />
        <button onClick={() => onSchedule?.(variant, when || null)} disabled={busy}>Schedule</button>
        {err && <span className="error-label">{err}</span>}
      </div>
    </div>
  );
}
