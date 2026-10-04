// Renders TranscriptSegment list with start/end timestamps
export default function TranscriptViewer({ segments = [] }) {
  return (
    <div className="card">
      <h3>Transcript</h3>
      {segments.map((s, i) => (
        <p key={i}><small className="mut">{s.startSec?.toFixed(1)}s–{s.endSec?.toFixed(1)}s</small> {s.text}</p>
      ))}
    </div>
  );
}
