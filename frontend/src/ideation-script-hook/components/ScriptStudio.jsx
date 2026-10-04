import { useState } from 'react';
import { ideationApi } from '../api';
import ScriptEditor from './ScriptEditor';

// Stage 3 — F3.3 Script Generation (from chosen hook) + F3.5 Supporting Content
export default function ScriptStudio({
  projectId,
  hook,
  topic = '',
  script,
  onScript,
  onProceedToBeats,
}) {
  const [tone, setTone] = useState('punchy');
  const [lengthSec, setLengthSec] = useState(60);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  const wordBudget = Math.round(lengthSec * 2.5);

  const generate = async () => {
    if (!hook) {
      setErr('Please select an opening hook in Stage 2 first.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const effectiveTopic = (topic || hook.topic || hook.text || '').trim();
      const { data } = await ideationApi.generateScript({
        project_id: projectId || undefined,
        hook_id: hook.id,
        hook: hook.text,
        topic: effectiveTopic,
        tone,
        length_sec: lengthSec,
      });

      onScript?.({
        id: data.id,
        // No truncated-hook title. It used to store `${hook.text.slice(0,45)}...` as the
        // script's real title, which was then persisted on the next PATCH.
        title: data.title || '',
        body: data.content || data.body || '',
        content: data.content || data.body || '',
        beats: Array.isArray(data.beats) ? data.beats : [],
        supporting: data.supporting || {},
        version: Number(data.version) || 1,
        engine: data.engine || null,
      });
    } catch (e) {
      setErr(e.response?.data?.error || 'Script generation failed. Please check the backend connection.');
    } finally {
      setBusy(false);
    }
  };

  const save = async ({ title, content }) => {
    if (!script?.id) return;
    // A failed PATCH used to be an unhandled rejection (silent stuck save).
    // Surface it in the studio error banner instead.
    try {
      const { data } = await ideationApi.patchScript(script.id, { title, content });
      onScript?.({
        ...script,
        title: data.title || title,
        body: data.body || data.content || content,
        content: data.body || data.content || content,
        beats: Array.isArray(data.beats) ? data.beats : script.beats,
        supporting: data.supporting || script.supporting,
        version: Number(data.version) || (script.version + 1),
      });
      setErr(null);
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not save the script. Is the backend running?');
    }
  };

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!hook) {
    return (
      <div className="ia-empty card">
        <b>Stage 3 waits on an opening hook.</b>
        <span>Select any hook in Stage 2 above to carry its pattern and topic into a complete, shootable script.</span>
      </div>
    );
  }

  const hashtags = Array.isArray(script?.supporting?.hashtags)
    ? script.supporting.hashtags
    : [];

  return (
    <section className="ia-stage" aria-label="Script Studio">
      <div className="card ia-chosen-hook-banner">
        <div className="card-title-row">
          <div className="bb-row">
            <span className="ia-section-badge">Chosen Opening Hook</span>
            <span className={`ia-cat-chip ${hook.category || 'statement'}`}>
              {hook.category || 'statement'}
            </span>
          </div>
          {/* Only shown for a hook the backend actually scored. A script loaded from
          history has no scored hook, so this stays hidden rather than showing an
          invented percentage. */}
          {Number.isFinite(Number(hook.score)) && (
            <span className="pill">Strength {Math.round(Number(hook.score) * 100)}%</span>
          )}
        </div>
        <p className="ia-active-hook-quote">“{hook.text}”</p>

        <div className="row ia-controls-row">
          <div style={{ minWidth: 120 }}>
            <label htmlFor="ia-len">Target Duration</label>
            <select
              id="ia-len"
              value={lengthSec}
              onChange={(e) => setLengthSec(Number(e.target.value))}
            >
              {[30, 45, 60, 90, 120].map((s) => (
                <option key={s} value={s}>{s} seconds</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 130 }}>
            <label htmlFor="ia-stone">Pacing & Tone</label>
            <select
              id="ia-stone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            >
              <option value="punchy">punchy</option>
              <option value="educational">educational</option>
              <option value="funny">funny</option>
              <option value="professional">professional</option>
              <option value="energetic">energetic</option>
            </select>
          </div>

          <div className="ia-budget-pill">
            <span className="mut">Word budget:</span>
            <b>~{wordBudget} words</b>
            <span className="mut">(150 wpm)</span>
          </div>

          <button
            className="primary"
            onClick={generate}
            disabled={busy}
            style={{ marginLeft: 'auto' }}
          >
            {busy ? 'Writing Script...' : script ? 'Regenerate Script' : 'Generate Full Script'}
          </button>
        </div>

        {err && (
          <div className="error-text" role="alert" style={{ marginTop: 12 }}>
            <span className="error-label">Alert:</span> {err}
          </div>
        )}
      </div>

      {script && (
        <div className="ia-script-output-wrap">
          <ScriptEditor script={script} onSave={save} />

          {script?.supporting && (
            <div className="card ia-support-card">
              <div className="card-title-row">
                <h3>F3.5 Supporting Content</h3>
                <span className="pill">Ready to Post</span>
              </div>
              <p className="ia-desc-text">
                Multi-platform title, caption, hashtags, and CTA generated in lockstep with the script.
              </p>

              <div className="ia-support-grid">
                <div className="ia-support-item">
                  <div className="ia-support-item-head">
                    <b>Title:</b>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => copyToClipboard(script.supporting.title, 'title')}
                    >
                      {copiedField === 'title' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="ia-support-val">{script.supporting.title || '—'}</div>
                </div>

                <div className="ia-support-item">
                  <div className="ia-support-item-head">
                    <b>Caption:</b>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => copyToClipboard(script.supporting.caption, 'caption')}
                    >
                      {copiedField === 'caption' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="ia-support-val">{script.supporting.caption || '—'}</div>
                </div>

                <div className="ia-support-item">
                  <div className="ia-support-item-head">
                    <b>Hashtags:</b>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => copyToClipboard(hashtags.join(' '), 'tags')}
                    >
                      {copiedField === 'tags' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="tags">
                    {hashtags.map((t) => (
                      <span className="pill" key={t}>{t}</span>
                    ))}
                    {hashtags.length === 0 && <span className="mut">None</span>}
                  </div>
                </div>

                <div className="ia-support-item">
                  <div className="ia-support-item-head">
                    <b>Call To Action (CTA):</b>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => copyToClipboard(script.supporting.cta, 'cta')}
                    >
                      {copiedField === 'cta' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="ia-support-val">{script.supporting.cta || '— no CTA generated'}</div>
                </div>
              </div>

              {onProceedToBeats && (
                <div style={{ marginTop: 20, textAlign: 'right' }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={onProceedToBeats}
                  >
                    View Script Beats Breakdown
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
