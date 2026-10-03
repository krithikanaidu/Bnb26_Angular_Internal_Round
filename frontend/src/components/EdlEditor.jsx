import { useState } from 'react';

// Editable JSON EDL: creators always own the final cut. onSave(edl) → PATCH /content/edits/:id
export default function EdlEditor({ edl, onSave }) {
  const [text, setText] = useState(JSON.stringify(edl ?? {}, null, 2));
  const [err, setErr] = useState(null);
  const save = () => {
    try { onSave?.(JSON.parse(text)); setErr(null); }
    catch (e) { setErr('Invalid JSON: ' + e.message); }
  };
  return (
    <div className="card">
      <h3>EDL (editable JSON)</h3>
      <textarea rows={12} style={{ width: '100%' }} value={text} onChange={(e) => setText(e.target.value)} />
      {err && <p style={{ color: 'salmon' }}>{err}</p>}
      <button onClick={save}>Save version</button>
    </div>
  );
}
