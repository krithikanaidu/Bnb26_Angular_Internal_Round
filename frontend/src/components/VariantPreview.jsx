// Per-platform variant preview honoring aspect + safe_zone
export default function VariantPreview({ variant }) {
  if (!variant) return null;
  return (
    <div className="card">
      <b>{variant.platform}</b> <span className="pill">{variant.aspect}</span>
      <p className="mut">{variant.caption}</p>
    </div>
  );
}
