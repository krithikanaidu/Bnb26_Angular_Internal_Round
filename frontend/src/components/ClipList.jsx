// Virality-scored clip suggestions; onSelect picks one for the Studio/Edit flow
export default function ClipList({ clips = [], onSelect }) {
  return (
    <div className="card">
      <h3>Suggested clips</h3>
      {clips.map((c) => (
        <div className="row" key={c.id} onClick={() => onSelect?.(c)}>
          <span>{c.title}</span>
          <span className="pill">score {c.viralityScore?.toFixed?.(2) ?? c.viralityScore}</span>
        </div>
      ))}
    </div>
  );
}
