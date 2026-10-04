import { useEffect, useState } from 'react';

import { StatusDot } from '../ui/StatusDot';
import { NO_VALUE } from '../ui/AppKit';
import { TriangleAlert } from 'lucide-react';

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

  const needsAttention = variant.status === 'needs_attention';

  return (
    <article className="card card-hover">
      <div className="card-title-row">
        <h3 className="break-words">{preset.label || variant.platform}</h3>
        <div className="bb-row shrink-0">
          <span className="pill">
            {aspect || NO_VALUE}
            {/* duration is null when the clip has no in/out points yet — say
                "unknown" rather than rendering a fabricated "30s". */}
            {variant.duration == null ? ' · duration unknown' : ` · ${variant.duration}s`}
          </span>
          {needsAttention ? (
            <span className="pill" style={{ background: 'var(--color-status-red)', borderColor: 'var(--color-status-red)', color: '#fff' }}>
              <StatusDot color="red" size={7} pulse={false} />
              needs attention
            </span>
          ) : (
            <span className="pill pill-olive">
              <StatusDot color="green" size={7} pulse={false} />
              ready
            </span>
          )}
        </div>
      </div>

      <div className="bb-row" style={{ gap: 6 }}>
        {variant.captionStyle && <span className="pill">captions: {variant.captionStyle}</span>}
        {variant.edlVersion != null && <span className="pill pill-blue">EDL v{variant.edlVersion}</span>}
      </div>

      {/* true-ratio frame with safe-zone overlay */}
      <div className="flex gap-3 mt-3 items-start">
        <div
          className="relative flex-none"
          style={{
            width: tall ? 84 : 132,
            aspectRatio: aspect ? aspect.replace(':', ' / ') : '9 / 16',
            background: 'var(--color-surface-sunken)',
            border: '2px solid var(--color-ink)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <span className="absolute inset-0 grid place-items-center text-[10px] muted">
            preview
          </span>
          {/* Only draw a safe zone when the preset actually defines one. */}
          {safe && (
            <div
              style={{
                position: 'absolute', left: 0, right: 0,
                top: `${(safe.top || 0) * 100}%`, bottom: `${(safe.bottom || 0) * 100}%`,
                border: '2px dashed var(--color-hot-pink)', borderLeft: 0, borderRight: 0,
              }}
              title="Safe zone — keep captions inside"
            />
          )}
        </div>

        <ul className="list-none p-0 m-0 flex-1 min-w-0 flex flex-col gap-1.5">
          {(variant.actions || []).length === 0 && <li className="ex">No platform actions recorded for this variant.</li>}
          {(variant.actions || []).map((a, i) => (
            <li key={i} className="text-[13px] leading-snug">
              {a}
            </li>
          ))}
        </ul>
      </div>

      {reframe && (
        <details className="mt-3">
          <summary>
            Reframe plan
            <span className="mut normal-case tracking-normal">
              {reframe.source} → {reframe.target} · {reframe.focus} crop (render-time)
            </span>
          </summary>
          <pre className="mt-2">
            ffmpeg -vf "{reframe.ffmpeg}"{'\n'}# {reframe.note}
          </pre>
        </details>
      )}

      {warnings.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-3">
          {warnings.map((w, i) => (
            <span key={i} className="pill pill-yellow self-start" style={{ whiteSpace: 'normal', textAlign: 'left' }}>
              <TriangleAlert className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1 flex-none" />
              {w.message} <span className="muted">— {w.fix}</span>
            </span>
          ))}
        </div>
      )}

      {maxTitle != null && (
        <div className="mt-3">
          <label htmlFor={`t-${variant.id}`}>
            Title <span className="muted">({title.length}/{maxTitle})</span>
          </label>
          <input id={`t-${variant.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={maxTitle + 20} />
        </div>
      )}

      <div className="mt-3">
        <label htmlFor={`c-${variant.id}`}>
          Caption{' '}
          <span className="muted">
            ({caption.length}
            {maxCaption != null ? `/${maxCaption}` : ' — platform limit unavailable'})
          </span>
        </label>
        <textarea id={`c-${variant.id}`} rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
      </div>

      <div className="mt-3">
        <label htmlFor={`h-${variant.id}`}>
          Hashtags{' '}
          <span className="muted">
            ({tagList.length}
            {tagRange ? ` · platform wants ${tagRange.min}–${tagRange.max}, space-separated` : ' · no platform range available'})
          </span>
        </label>
        <input id={`h-${variant.id}`} value={tags} onChange={(e) => setTags(e.target.value)} placeholder={requiredTags.length ? requiredTags.join(' ') : 'Space-separated hashtags'} />
        {requiredTags.length > 0 && (
          <p className="ex mt-1.5 !normal-case !font-body !tracking-normal">
            Required by this platform: {requiredTags.join(' ')}
          </p>
        )}
      </div>

      <div className="bb-row mt-3">
        {dirty ? (
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save variant'}
          </button>
        ) : (
          <button className="ghost" onClick={revalidate} disabled={busy}>
            {busy ? 'Validating…' : 'Re-validate'}
          </button>
        )}
        <label htmlFor={`w-${variant.id}`} className="sr-only">
          Schedule time
        </label>
        <input
          id={`w-${variant.id}`}
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="!w-auto"
        />
        <button onClick={() => onSchedule?.(variant, when || null)} disabled={busy}>
          Schedule
        </button>
        {err && <span className="error-label">{err}</span>}
      </div>
    </article>
  );
}
