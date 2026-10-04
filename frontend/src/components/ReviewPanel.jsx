// Time-coded review comments panel (lives inside Studio)
export default function ReviewPanel({ comments = [] }) {
  return (
    <div className="card">
      <h3>Review comments</h3>
      {comments.length === 0 && <p className="mut">No comments yet.</p>}
      {comments.map((c, i) => (
        <p key={i}><small className="mut">{c.t}s</small> {c.text}</p>
      ))}
    </div>
  );
}
