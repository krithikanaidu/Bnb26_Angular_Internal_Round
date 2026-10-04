// Pipeline breadcrumb for the ideation flow: 1. Idea -> 2. Hooks -> 3. Script -> 4. Beats
const STEPS = [
  { key: 'idea', label: '1. Idea & Topic' },
  { key: 'hooks', label: '2. Hooks & Patterns' },
  { key: 'script', label: '3. Script Studio' },
  { key: 'beats', label: '4. Script Beats' },
];

export default function StageRail({ active, reached = 1, onSelect }) {
  return (
    <div className="ia-rail" role="tablist" aria-label="Ideation pipeline stages">
      {STEPS.map((s, i) => {
        const isCurrent = s.key === active;
        const isPassed = i + 1 < reached;
        const isAccessible = i + 1 <= Math.max(reached, 1);

        return (
          <span key={s.key} className="ia-rail-item">
            <button
              type="button"
              role="tab"
              aria-selected={isCurrent}
              disabled={!isAccessible}
              className={`step ${isCurrent ? 'active' : isPassed ? 'done' : ''}`}
              onClick={() => isAccessible && onSelect?.(s.key)}
            >
              <span className="step-num">{i + 1}</span>
              <span className="step-title">{s.label.replace(/^\d+\.\s*/, '')}</span>
            </button>
            {i < STEPS.length - 1 && <span className="sep">/</span>}
          </span>
        );
      })}
    </div>
  );
}
