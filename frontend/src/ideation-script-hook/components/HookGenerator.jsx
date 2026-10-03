import { useState, useEffect } from 'react';
import { ideationApi } from '../api';

// Stage 2 — F3.1 AI Hook Generation: 5–12 hooks, category + deterministic strength score.
export default function HookGenerator({
  projectId,
  topic: propTopic = '',
  onTopicChange,
  tone: propTone = 'punchy',
  onToneChange,
  niche: propNiche = '',
  onNicheChange,
  onPick,
  pickedId,
}) {
  const [topic, setTopic] = useState(propTopic);
  const [tone, setTone] = useState(propTone);
  const [niche, setNiche] = useState(propNiche);
  const [count, setCount] = useState(8);
  const [hooks, setHooks] = useState([]);
  const [filterCat, setFilterCat] = useState('all');
  const [engine, setEngine] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (propTopic !== undefined) setTopic(propTopic);
  }, [propTopic]);

  useEffect(() => {
    if (propTone !== undefined) setTone(propTone);
  }, [propTone]);

  useEffect(() => {
    if (propNiche !== undefined) setNiche(propNiche);
  }, [propNiche]);

  const handleTopicChange = (val) => {
    setTopic(val);
    onTopicChange?.(val);
  };

  const handleToneChange = (val) => {
    setTone(val);
    onToneChange?.(val);
  };

  const handleNicheChange = (val) => {
    setNiche(val);
    onNicheChange?.(val);
  };

  const generate = async () => {
    const cleanTopic = (topic || '').trim();
    if (!cleanTopic) {
      setErr('Please provide a topic first.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const { data } = await ideationApi.generateHooks({
        project_id: projectId || undefined,
        topic: cleanTopic,
        tone,
        niche: niche || undefined,
        count,
      });
      const generated = Array.isArray(data?.hooks) ? data.hooks : [];
      setHooks(generated);
      setEngine(data?.engine || 'heuristic');
      // If user had not picked a hook yet and hooks returned, auto-select first as candidate
      if (!pickedId && generated.length > 0) {
        onPick?.({ ...generated[0], topic: cleanTopic });
      }
    } catch (e) {
      setErr(e.response?.data?.error || 'Hook generation failed. Please verify the backend is running.');
    } finally {
      setBusy(false);
    }
  };

  const filteredHooks = filterCat === 'all'
    ? hooks
    : hooks.filter((h) => (h.category || '').toLowerCase() === filterCat.toLowerCase());

  return (
    <section className="ia-stage" aria-label="AI Hook Generation">
      <div className="ia-gen-grid">
        <div className="card ia-form-card">
          <div className="card-title-row">
            <h3>Generate Hooks</h3>
            <span className="pill">F3.1 Engine</span>
          </div>
          <p className="ia-desc-text">
            Produces high-retention opening hooks with category labeling and deterministic strength scoring (AI_PIPELINE §3.1).
          </p>

          <label htmlFor="ia-topic">Core Topic / Angle</label>
          <input
            id="ia-topic"
            value={topic}
            onChange={(e) => handleTopicChange(e.target.value)}
            placeholder="e.g. 5 SaaS pricing mistakes to avoid"
          />

          <div className="row" style={{ marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label htmlFor="ia-niche">Niche (Optional)</label>
              <input
                id="ia-niche"
                value={niche}
                onChange={(e) => handleNicheChange(e.target.value)}
                placeholder="e.g. B2B SaaS, Fitness"
              />
            </div>
            <div style={{ width: 140 }}>
              <label htmlFor="ia-tone">Tone</label>
              <select
                id="ia-tone"
                value={tone}
                onChange={(e) => handleToneChange(e.target.value)}
              >
                <option value="punchy">punchy</option>
                <option value="energetic">energetic</option>
                <option value="educational">educational</option>
                <option value="funny">funny</option>
                <option value="professional">professional</option>
              </select>
            </div>
            <div style={{ width: 90 }}>
              <label htmlFor="ia-count">Count</label>
              <select
                id="ia-count"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {[5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="primary"
            onClick={generate}
            disabled={busy}
            style={{ marginTop: 16, width: '100%' }}
          >
            {busy ? 'Generating Hooks...' : 'Generate Hooks'}
          </button>

          {err && (
            <div className="error-text" role="alert">
              <span className="error-label">Alert:</span> {err}
            </div>
          )}
          {engine && (
            <p className="mut" style={{ marginTop: 10 }}>
              <small>Generation engine: <b>{engine}</b> (few-shot with viral hook patterns)</small>
            </p>
          )}
        </div>

        <div className="ia-results-pane">
          {hooks.length > 0 && (
            <div className="ia-filter-bar">
              <span className="ia-filter-label">Filter by type:</span>
              {['all', 'question', 'statement', 'story', 'stat', 'contrarian'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`pill-btn ${filterCat === cat ? 'active' : ''}`}
                  onClick={() => setFilterCat(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="grid">
            {hooks.length === 0 && !busy && (
              <div className="ia-empty card">
                <b>No hooks generated yet.</b>
                <span>Enter a topic and click Generate Hooks to see viral opening options.</span>
              </div>
            )}

            {filteredHooks.map((h) => {
              const isSelected = pickedId === h.id;
              const scorePct = Math.round((Number(h.score) || 0) * 100);
              return (
                <div
                  key={h.id || h.text}
                  className={`ia-hook ${isSelected ? 'selected' : ''}`}
                  onClick={() => onPick?.({ ...h, topic: topic.trim() })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPick?.({ ...h, topic: topic.trim() });
                    }
                  }}
                >
                  <div className="ia-hook-body">
                    <span className="quote-mark">“</span>
                    <span className="ia-hook-text">{h.text}</span>
                    <span className="quote-mark">”</span>
                  </div>
                  <div className="ia-hook-meta">
                    <span className={`ia-cat-chip ${h.category}`}>{h.category}</span>
                    <div className="ia-score-wrap">
                      <span className="ia-score-num">Score {scorePct}</span>
                      <div className="bar" aria-label={`Hook strength ${scorePct} percent`}>
                        <div style={{ width: `${Math.min(100, Math.max(0, scorePct))}%` }} />
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="ia-chosen-tag">Selected for Script</span>
                    ) : (
                      <button
                        type="button"
                        className="select-hook-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPick?.({ ...h, topic: topic.trim() });
                        }}
                      >
                        Use This Hook
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
