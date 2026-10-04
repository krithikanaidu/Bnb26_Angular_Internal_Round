// Visual timeline of EDL tracks/captions/overlays (timeline SDK planned)
export default function Timeline({ edl }) {
  return (
    <div className="card">
      <h3>Timeline</h3>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(edl?.tracks ?? [], null, 2)}</pre>
    </div>
  );
}
