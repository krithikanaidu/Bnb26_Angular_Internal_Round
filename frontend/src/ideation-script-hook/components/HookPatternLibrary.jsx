import { useEffect, useState } from 'react';
import { ideationApi } from '../api';

const CATS = ['all', 'question', 'statement', 'story', 'stat', 'contrarian'];

// Stage 2b — F3.2 Viral Hook Pattern Library: browse the seeded hook_patterns table.
export default function HookPatternLibrary({ onSelectPattern }) {
  const [patterns, setPatterns] = useState([]);
  const [cat, setCat] = useState('all');
  const [isOpen, setIsOpen] = useState(false);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    ideationApi.listPatterns(cat === 'all' ? undefined : cat)
      .then((r) => {
        if (active) {
          setPatterns(Array.isArray(r?.data) ? r.data : []);
          setErr(null);
        }
      })
      .catch((e) => {
        if (active) {
          setErr(e.response?.data?.error || 'Unable to load pattern library from backend.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [cat]);

  return (
    <section className="ia-stage" aria-label="Viral Hook Pattern Library">
      <div className="card ia-pattern-container">
        <div className="ia-pattern-header">
          <div className="row">
            <h3 style={{ margin: 0 }}>Viral Hook Pattern Library</h3>
            <span className="pill">{patterns.length} Proven Structures</span>
            <span className="pill">F3.2 Library</span>
          </div>
          <button
            type="button"
            className="ghost"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? 'Hide Pattern Library' : 'Browse Pattern Library'}
          </button>
        </div>

        {isOpen && (
          <div style={{ marginTop: 16 }}>
            <div className="row" style={{ marginBottom: 16 }}>
              <span className="mut" style={{ fontSize: 13, marginRight: 8 }}>Filter by category:</span>
              {CATS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`pill-btn ${cat === c ? 'active' : ''}`}
                  onClick={() => setCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {err && (
              <div className="error-text" role="alert">
                <span className="error-label">Alert:</span> {err}
              </div>
            )}

            {loading ? (
              <div className="ia-empty card">Loading patterns...</div>
            ) : (
              <div className="ia-patterns">
                {patterns.map((p) => (
                  <div className="ia-pattern" key={p.id}>
                    <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
                      <span className={`ia-cat-chip ${p.category}`}>{p.category}</span>
                      {onSelectPattern && (
                        <button
                          type="button"
                          className="quiet"
                          style={{ fontSize: 12 }}
                          onClick={() => onSelectPattern(p)}
                        >
                          Use Formula
                        </button>
                      )}
                    </div>
                    <div className="tpl">{p.pattern}</div>
                    {p.example && <div className="ex">Example: “{p.example}”</div>}
                  </div>
                ))}
                {!patterns.length && !err && (
                  <div className="ia-empty card">
                    <b>No patterns found in this category.</b>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
