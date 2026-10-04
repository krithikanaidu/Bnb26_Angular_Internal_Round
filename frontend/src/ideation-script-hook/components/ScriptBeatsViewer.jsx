import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ideationApi } from '../api';

// Stage 4 — F3.4 Script Beats: sentence/idea-level units for Studio alignment and clip scoring
export default function ScriptBeatsViewer({ script, onScriptUpdate }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const beats = Array.isArray(script?.beats) ? script.beats : [];

  const handleRegenerateBeats = async () => {
    if (!script?.id) return;
    setBusy(true);
    setErr(null);
    try {
      const { data } = await ideationApi.generateBeats(script.id, {
        content: script.body || script.content,
      });
      onScriptUpdate?.({
        ...script,
        beats: Array.isArray(data.beats) ? data.beats : script.beats,
        version: Number(data.version) || (script.version + 1),
      });
    } catch (e) {
      setErr(e.response?.data?.error || 'Unable to re-split beats. Check backend.');
    } finally {
      setBusy(false);
    }
  };

  if (!script) {
    return (
      <div className="ia-empty card">
        <b>Stage 4 waits on a generated script.</b>
        <span>Generate a script in Stage 3 to see its structured beat units for footage alignment.</span>
      </div>
    );
  }

  return (
    <section className="ia-stage" aria-label="Script Beats Breakdown">
      <div className="card ia-beats-card">
        <div className="card-title-row">
          <div className="row">
            <h3>Script Beats</h3>
            <span className="pill">{beats.length} Alignment Units</span>
            <span className="pill">F3.4 Units</span>
          </div>
          <div className="row">
            <button
              type="button"
              className="ghost"
              onClick={handleRegenerateBeats}
              disabled={busy}
            >
              {busy ? 'Re-parsing Beats...' : 'Re-parse Beats from Text'}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => navigate('/studio')}
            >
              Open Studio for Footage Alignment
            </button>
          </div>
        </div>

        <p className="ia-desc-text">
          Beats are the atomic ideas used by the AI pipeline to match against transcript segments and score short-form video clips (AI_PIPELINE §3.4–3.6).
        </p>

        {err && (
          <div className="error-text" role="alert" style={{ marginBottom: 12 }}>
            <span className="error-label">Alert:</span> {err}
          </div>
        )}

        <div className="ia-beats-list">
          {beats.length === 0 ? (
            <div className="ia-empty" style={{ padding: 16 }}>
              No beats parsed yet. Click Re-parse Beats from Text above.
            </div>
          ) : (
            beats.map((b, i) => {
              const weight = Number.isFinite(Number(b.importance)) ? Number(b.importance) : null;
              return (
                <div key={b.idx ?? i} className="ia-beat-item">
                  <div className="ia-beat-badge-col">
                    <span className="ia-beat-num">Beat {b.idx ?? i}</span>
                    <span className="ia-beat-weight">{weight == null ? 'Weight not scored' : `Weight ${weight.toFixed(1)}`}</span>
                  </div>
                  <div className="ia-beat-text-col">
                    <p className="ia-beat-text">{b.text}</p>
                    <span className="mut" style={{ fontSize: 12 }}>
                      {i === 0 ? 'Opening Hook (highest retention priority)' : i === beats.length - 1 ? 'Closing Call-to-Action' : 'Core Value Beat'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
