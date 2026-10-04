import { useState } from 'react';

// Suggested topics grounded in creator intelligence & proven viral hook patterns (F3.6)
const RECOMMENDED_IDEAS = [
  {
    topic: '5 AI tools that save 10 hours of video editing every week',
    niche: 'Creator Economy & AI',
    tone: 'punchy',
    reason: 'Stat + listicle pattern shows +34% retention lift across short-form formats.',
  },
  {
    topic: 'Why your opening hooks are killing your video retention (and the fix)',
    niche: 'Content Strategy',
    tone: 'educational',
    reason: 'Question + problem pattern targets high scroll-stop rate in first 3 seconds.',
  },
  {
    topic: 'Stop editing in Premiere before you know this one workflow trick',
    niche: 'Video Production',
    tone: 'contrarian',
    reason: 'Contrarian statement pattern triggers curiosity gap and comment engagement.',
  },
  {
    topic: 'How I turned 1 long podcast episode into 12 viral clips',
    niche: 'Repurposing & Growth',
    tone: 'energetic',
    reason: 'Personal story pattern with specific numerical transformation.',
  },
];

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

  const applyIdea = (idea, idx) => {
    setActivePreset(idx);
    onTopicChange?.(idea.topic);
    onToneChange?.(idea.tone);
    if (idea.niche) onNicheChange?.(idea.niche);
  };

  return (
    <section className="ia-stage" aria-label="Idea and Topic Capture">
      <div className="card ia-idea-card">
        <div className="card-title-row">
          <div className="row">
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

          <div className="row" style={{ marginTop: 4 }}>
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
            <span className="ia-recommender-title">F3.6 Suggested Topics (Creator Intelligence)</span>
            <span className="mut" style={{ fontSize: 12 }}>Click to auto-fill topic</span>
          </div>

          <div className="ia-recommender-grid">
            {RECOMMENDED_IDEAS.map((item, idx) => (
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
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="ia-cat-chip stat">{item.niche}</span>
                  <span className="pill">{item.tone}</span>
                </div>
                <b>“{item.topic}”</b>
                <p className="ia-idea-reason">{item.reason}</p>
              </div>
            ))}
          </div>
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
