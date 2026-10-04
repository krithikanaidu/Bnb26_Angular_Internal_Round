import { useEffect, useRef, useState } from 'react';

// Inline editor: click-to-edit title + auto-growing textarea. Save -> PATCH /content/scripts/:id
export default function ScriptEditor({ script, onSave }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(script?.title || '');
  const [content, setContent] = useState(script?.body || script?.content || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const area = useRef(null);

  useEffect(() => {
    setTitle(script?.title || '');
    setContent(script?.body || script?.content || '');
    setEditing(false);
  }, [script?.id, script?.version]);

  const rawContent = typeof content === 'string' ? content : '';
  const currentTitle = typeof title === 'string' ? title : '';
  const baseTitle = script?.title || '';
  const baseContent = script?.body || script?.content || '';

  const dirty = editing && (currentTitle !== baseTitle || rawContent !== baseContent);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onSave?.({ title: currentTitle, content: rawContent });
      setEditing(false);
    } catch (e) {
      setErr(e.response?.data?.error || 'Save failed. Please check the backend connection.');
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = () => {
    setTitle(baseTitle);
    setContent(baseContent);
    setEditing(false);
    setErr(null);
  };

  if (!script) return null;

  const words = rawContent.trim() ? rawContent.trim().split(/\s+/).length : 0;
  const estSeconds = Math.round(words / 2.5); // ~150 words per minute = 2.5 words/sec
  const lineCount = rawContent ? rawContent.split('\n').length : 1;

  return (
    <div className="grid ia-editor-grid">
      <div className="card ia-editor-header">
        <div className="row ia-editor-title-row">
          <input
            className="ia-script-title-input"
            value={currentTitle}
            onChange={(e) => {
              setTitle(e.target.value);
              setEditing(true);
            }}
            onFocus={() => setEditing(true)}
            aria-label="Script title"
            placeholder="Script Title"
          />
          <div className="row">
            <span className="pill">v{script.version || 1}</span>
            <span className="pill">{words} words</span>
            <span className="pill">~{estSeconds}s read</span>
          </div>

          <div className="ia-editor-actions">
            {dirty && (
              <>
                <button
                  type="button"
                  className="primary"
                  onClick={save}
                  disabled={busy}
                >
                  {busy ? 'Saving...' : 'Save Edit'}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={handleDiscard}
                  disabled={busy}
                >
                  Discard
                </button>
              </>
            )}
            {!dirty && (
              <span className="mut" style={{ fontSize: 13 }}>
                Click text to edit. Each save increments version.
              </span>
            )}
          </div>
        </div>

        <div className="ia-textarea-wrapper">
          <textarea
            ref={area}
            rows={Math.max(8, Math.min(26, lineCount + 2))}
            value={rawContent}
            onChange={(e) => {
              setContent(e.target.value);
              setEditing(true);
            }}
            onFocus={() => setEditing(true)}
            aria-label="Script content"
            placeholder="Write or edit your shootable script..."
          />
        </div>

        {err && (
          <div className="error-text" role="alert" style={{ marginTop: 10 }}>
            <span className="error-label">Alert:</span> {err}
          </div>
        )}
      </div>
    </div>
  );
}
