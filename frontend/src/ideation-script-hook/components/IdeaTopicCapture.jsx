import { useState } from 'react';

/**
 * No hardcoded topic suggestions.
 *
 * This used to ship four invented topics under the heading "Suggested Topics
 * (Creator Intelligence)", each with a made-up justification — including a
 * fabricated "+34% retention lift" statistic that was never measured anywhere.
 * Suggestions are now derived from the user's own real project titles, so
 * anything on screen is genuinely theirs.
 */
function useRealSuggestions(projects) {
  return (Array.isArray(projects) ? projects : [])
    .filter((p) => p && p.title && String(p.title).trim())
    .slice(0, 4)
    .map((p) => ({
      topic: String(p.title).trim(),
      tone: null,
      niche: null,
      reason: p.description ? String(p.description).slice(0, 120) : 'From your project.',
    }));
}

export default function IdeaTopicCapture({
  projects = [],
  projectId,
  onProjectChange,
  topic,
  onTopicChange,
  tone,
  onToneChange,
  niche,
  onNicheChange,
  onProceedToHooks,
}) {
  const [activePreset, setActivePreset] = useState(null);
  const suggestions = useRealSuggestions(projects);

  const applyIdea = (idea, idx) => {
    setActivePreset(idx);
    onTopicChange?.(idea.topic);
    if (idea.tone) onToneChange?.(idea.tone);
    if (idea.niche) onNicheChange?.(idea.niche);
  };

  return (
    <section className="ia-stage" aria-label="Idea and Topic Capture">
      <div className="card ia-idea-card">
        <div className="card-title-row">
          <div className="bb-row">
            <h3>Stage 1: Idea & Topic Definition</h3>
            <span className="pill">F1.3 Project</span>
            <span className="pill">F3.6 Idea Recommender</span>
          </div>
        </div>
        <p className="ia-desc-text">
          Capture a high-potential content topic or pick a performance-backed recommendation from creator intelligence.
        </p>

        <div className="ia-idea-form-grid">
          <div>
            <label htmlFor="ia-proj-select">Assign to Project</label>
            <select
              id="ia-proj-select"
              value={projectId}
              onChange={(e) => onProjectChange?.(e.target.value)}
            >
              <option value="">No project (Workspace Scratchpad)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({p.status || 'idea'})</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ia-topic-input">Content Topic / Concept</label>
            <input
              id="ia-topic-input"
              value={topic}
              onChange={(e) => onTopicChange?.(e.target.value)}
              placeholder="e.g. Why most founders underprice their software"
            />
          </div>

          <div className="bb-row" style={{ marginTop: 4 }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor="ia-niche-input">Niche / Target Audience</label>
              <input
                id="ia-niche-input"
                value={niche}
                onChange={(e) => onNicheChange?.(e.target.value)}
                placeholder="e.g. SaaS Founders, Freelance Editors"
              />
            </div>
            <div style={{ width: 160 }}>
              <label htmlFor="ia-tone-select">Creator Tone</label>
              <select
                id="ia-tone-select"
                value={tone}
                onChange={(e) => onToneChange?.(e.target.value)}
              >
                <option value="punchy">punchy</option>
                <option value="energetic">energetic</option>
                <option value="educational">educational</option>
                <option value="funny">funny</option>
                <option value="professional">professional</option>
              </select>
            </div>
          </div>
        </div>

        <div className="ia-recommender-section">
          <div className="card-title-row" style={{ marginTop: 20 }}>
            <span className="ia-recommender-title">Your Projects</span>
            <span className="mut" style={{ fontSize: 12 }}>Click to use a project title as your topic</span>
          </div>

          {suggestions.length > 0 ? (
            <div className="ia-recommender-grid">
              {suggestions.map((item, idx) => (
                <div
                  key={idx}
                  className={`ia-idea-suggestion ${activePreset === idx ? 'active' : ''}`}
                  onClick={() => applyIdea(item, idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyIdea(item, idx);
                  }}
                >
                  <div className="bb-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    {item.niche ? <span className="ia-cat-chip stat">{item.niche}</span> : <span className="ia-cat-chip stat">Project</span>}
                    {item.tone && <span className="pill">{item.tone}</span>}
                  </div>
                  <b>&ldquo;{item.topic}&rdquo;</b>
                  <p className="ia-idea-reason">{item.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mut" style={{ fontSize: 13 }}>
              No projects yet, so there are no suggestions to show. Type your topic above, or
              create a project on the Dashboard first. Nothing here is pre-filled with invented ideas.
            </p>
          )}
        </div>

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button
            type="button"
            className="primary"
            onClick={onProceedToHooks}
            disabled={!topic.trim()}
          >
            Proceed to Hook Generation
          </button>
        </div>
      </div>
    </section>
  );
}
