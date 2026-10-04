import { useEffect, useState } from 'react';
import { ideationApi } from '../api';
import ScriptEditor from './ScriptEditor';

// Stage 3 — F3.3 Script Generation (from chosen hook) + F3.5 Supporting Content
export default function ScriptStudio({
  projectId,
  hook,
  topic = '',
  script,
  onScript,
  onProceedToBeats,
}) {
  const [tone, setTone] = useState('punchy');
  const [lengthSec, setLengthSec] = useState(60);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  // richer brief (F3.3+)
  const [showBrief, setShowBrief] = useState(false);
  const [audience, setAudience] = useState('beginner creators');
  const [goal, setGoal] = useState('save + follow');
  const [language, setLanguage] = useState('en');
  const [cta, setCta] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [avoid, setAvoid] = useState('');
  const [platforms, setPlatforms] = useState(['tiktok', 'reels', 'shorts']);
  // refine + feedback
  const [instruction, setInstruction] = useState('');
  const [refining, setRefining] = useState(false);
  const [rated, setRated] = useState(null);

  const wordBudget = Math.round(lengthSec * 2.5);

  const toList = (s) => String(s || '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);

  const mapScript = (data, fallbackHook) => ({
    id: data.id,
    title: data.title || `${(fallbackHook?.text || '').slice(0, 45)}...`,
    body: data.content || data.body || '',
    content: data.content || data.body || '',
    beats: Array.isArray(data.beats) ? data.beats : [],
    supporting: data.supporting || {},
    visuals: data.visuals || [],
    shotList: data.shotList || [],
    teleprompter: data.teleprompter || '',
    meta: data.meta || {},
    brief: data.brief || {},
    version: Number(data.version) || 1,
    engine: data.engine || 'heuristic',
  });

  const generate = async () => {
    if (!hook) {
      setErr('Please select an opening hook in Stage 2 first.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const effectiveTopic = (topic || hook.topic || hook.text || '').trim();
      const { data } = await ideationApi.generateScript({
        project_id: projectId || undefined,
        hook_id: hook.id,
        hook: hook.text,
        topic: effectiveTopic,
        tone,
        length_sec: lengthSec,
        audience, goal, language, cta,
        keyPoints: toList(keyPoints), avoid: toList(avoid),
        platforms, workspaceKey: projectId || 'default', actor,
      });

      onScript?.(mapScript(data, hook));
      setRated(null);
      refreshML();
    } catch (e) {
      setErr(e.response?.data?.error || 'Script generation failed. Please check the backend connection.');
    } finally {
      setBusy(false);
    }
  };

  // tune (replaces old destructive refine) + shoot-ready tabs
  const [actor, setActor] = useState('creator');
  const [ml, setMl] = useState(null);
  const refreshML = async () => {
    try { const { data } = await ideationApi.mlInsights(projectId || 'default'); setMl(data); }
    catch { /* ML panel optional */ }
  };
  useEffect(() => { refreshML(); }, [projectId]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState({ punchiness: 3, clarity: 3, formality: 3, energy: 3, ctaStrength: 3, targetLengthSec: '', focus: '', preserveHook: true });
  const [pending, setPending] = useState(null);
  const [shootTab, setShootTab] = useState('teleprompter');
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const runTune = async (mode) => {
    if (!script?.id) return;
    const cleaned = { ...filters, targetLengthSec: filters.targetLengthSec ? Number(filters.targetLengthSec) : undefined };
    if (mode !== 'auto' && !instruction.trim() && !filters.focus) { setErr('Add a custom instruction or a focus point — or use Auto-improve.'); return; }
    setErr(null); setRefining(true);
    try {
      const { data } = await ideationApi.refineScript(script.id, { instruction: instruction.trim(), filters: cleaned, mode, actor, preview: true });
      setPending({ suggestion: data.suggestion, beats: data.beats, teleprompter: data.teleprompter, changeSummary: data.changeSummary, engine: data.engine, mode });
    } catch (e) { setErr(e.response?.data?.error || 'Tune failed.'); }
    finally { setRefining(false); }
  };

  const acceptPending = async () => {
    if (!pending) return;
    const { data } = await ideationApi.patchScript(script.id, { content: pending.suggestion, beats: pending.beats, teleprompter: pending.teleprompter });
    try { await ideationApi.sendFeedback(script.id, { eventType: pending.mode === 'auto' ? 'auto_improve_accept' : 'refine_accept', instruction, actor, meta: { actor, filters, changeSummary: pending.changeSummary } }); } catch { /* non-blocking */ }
    onScript?.({ ...script, body: data.body || data.content, content: data.body || data.content, beats: data.beats, teleprompter: data.teleprompter, version: data.version });
    setPending(null); setInstruction(''); refreshML();
  };

  const rate = async (val) => {
    if (!script?.id) return;
    setRated(val);
    try { await ideationApi.sendFeedback(script.id, { rating: val, eventType: val >= 4 ? 'approve' : 'rate', actor }); refreshML(); }
    catch { /* non-blocking */ }
  };

  const save = async ({ title, content }) => {
    if (!script?.id) return;
    const { data } = await ideationApi.patchScript(script.id, { title, content });
    onScript?.({
      ...script,
      title: data.title || title,
      body: data.body || data.content || content,
      content: data.body || data.content || content,
      beats: Array.isArray(data.beats) ? data.beats : script.beats,
      supporting: data.supporting || script.supporting,
      visuals: data.visuals || script.visuals,
      shotList: data.shotList || script.shotList,
      teleprompter: data.teleprompter || script.teleprompter,
      version: Number(data.version) || (script.version + 1),
    });
  };

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!hook) {
    return (
      <div className="ia-empty card">
        <b>Stage 3 waits on an opening hook.</b>
        <span>Select any hook in Stage 2 above to carry its pattern and topic into a complete, shootable script.</span>
      </div>
    );
  }

  const hashtags = Array.isArray(script?.supporting?.hashtags)
    ? script.supporting.hashtags
    : [];

  return (
    <section className="ia-stage" aria-label="Script Studio">
      <div className="card ia-chosen-hook-banner">
        <div className="card-title-row">
          <div className="row">
            <span className="ia-section-badge">Chosen Opening Hook</span>
            <span className={`ia-cat-chip ${hook.category || 'statement'}`}>
              {hook.category || 'statement'}
            </span>
          </div>
          {hook.score !== undefined && (
            <span className="pill">Strength {Math.round(Number(hook.score) * 100)}%</span>
          )}
        </div>
        <p className="ia-active-hook-quote">“{hook.text}”</p>

        <div className="row ia-controls-row">
          <div style={{ minWidth: 120 }}>
            <label htmlFor="ia-len">Target Duration</label>
            <select
              id="ia-len"
              value={lengthSec}
              onChange={(e) => setLengthSec(Number(e.target.value))}
            >
              {[30, 45, 60, 90, 120].map((s) => (
                <option key={s} value={s}>{s} seconds</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 130 }}>
            <label htmlFor="ia-stone">Pacing & Tone</label>
            <select
              id="ia-stone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            >
              <option value="punchy">punchy</option>
              <option value="educational">educational</option>
              <option value="funny">funny</option>
              <option value="professional">professional</option>
              <option value="energetic">energetic</option>
            </select>
          </div>

          <div className="ia-budget-pill">
            <span className="mut">Word budget:</span>
            <b>~{wordBudget} words</b>
            <span className="mut">(150 wpm)</span>
          </div>

          <button
            className="primary"
            onClick={generate}
            disabled={busy}
            style={{ marginLeft: 'auto' }}
          >
            {busy ? 'Writing Script...' : script ? 'Regenerate Script' : 'Generate Full Script'}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <button type="button" className="ghost" onClick={() => setShowBrief((v) => !v)}>
            {showBrief ? 'Hide richer brief ▴' : 'Richer brief: audience, goal, points ▾'}
          </button>
          {showBrief && (
            <div className="grid g2" style={{ marginTop: 10 }}>
              <div><label>Audience</label><input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. beginner creators, SaaS founders" /></div>
              <div><label>Goal</label><input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. saves + follows" /></div>
              <div className="row">
                <div style={{ flex: 1 }}><label>Language</label><select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en">English</option><option value="hi">Hindi</option><option value="hinglish">Hinglish</option><option value="es">Spanish</option></select></div>
                <div style={{ flex: 2 }}><label>CTA override</label><input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="e.g. Comment GUIDE" /></div>
              </div>
              <div><label>Must-include points (one per line)</label><textarea rows={2} value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} placeholder="pricing mistake&#10;real example" /></div>
              <div><label>Avoid</label><textarea rows={2} value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="jargon, long intro" /></div>
              <div><label>Platforms</label><div className="row">{['tiktok', 'reels', 'shorts', 'x', 'linkedin'].map((p) => (<label key={p} style={{ fontWeight: 400 }}><input type="checkbox" checked={platforms.includes(p)} onChange={(e) => setPlatforms(e.target.checked ? [...platforms, p] : platforms.filter((x) => x !== p))} /> {p}</label>))}</div></div>
            </div>
          )}
        </div>

        {err && (
          <div className="error-text" role="alert" style={{ marginTop: 12 }}>
            <span className="error-label">Alert:</span> {err}
          </div>
        )}
        {ml?.insights?.length > 0 && (
          <div className="ia-ml-strip">
            <span className="pill">ML learned</span>
            <span className="mut" style={{ fontSize: 12 }}>{ml.insights.join(' ')}</span>
            <button type="button" className="quiet" onClick={async () => { await ideationApi.mlRecompute(projectId || 'default'); refreshML(); }}>Recompute</button>
          </div>
        )}
      </div>

      {script && (
        <div className="ia-script-output-wrap">
          <ScriptEditor script={script} onSave={save} />

          <div className="card ia-tune-card">
            <div className="card-title-row">
              <h3>Tune script</h3>
              <div className="row" style={{ gap: 8 }}>
                <label className="mut" style={{ fontSize: 12 }}>Acting as</label>
                <select value={actor} onChange={(e) => setActor(e.target.value)} style={{ minWidth: 110 }}>
                  <option value="creator">Creator</option>
                  <option value="manager">Manager</option>
                </select>
                <span className="pill">v{script.version}</span>
              </div>
            </div>
            <p className="ia-desc-text">Zero-work quality pass by default. Advanced filters only when you want control — nothing overwrites until you Accept.</p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="primary" onClick={() => runTune('auto')} disabled={refining}>{refining ? 'Improving…' : '✨ Auto-improve quality'}</button>
              <button type="button" className="ghost" onClick={() => setShowAdvanced((v) => !v)}>{showAdvanced ? 'Hide advanced filters ▴' : 'Advanced custom filters ▾'}</button>
            </div>
            {showAdvanced && (
              <div className="ia-tune-grid">
                {[['punchiness', 'Punchiness'], ['clarity', 'Simplicity'], ['formality', 'Formality'], ['energy', 'Energy'], ['ctaStrength', 'CTA strength']].map(([k, label]) => (
                  <div key={k}><label>{label} ({filters[k]}/5)</label><input type="range" min="1" max="5" value={filters[k]} onChange={(e) => setF(k, Number(e.target.value))} /></div>
                ))}
                <div><label>Retarget length (s, blank = keep)</label><input value={filters.targetLengthSec} onChange={(e) => setF('targetLengthSec', e.target.value)} placeholder="e.g. 30" inputMode="numeric" /></div>
                <div><label>Focus beat</label><input value={filters.focus} onChange={(e) => setF('focus', e.target.value)} placeholder="e.g. pricing example" /></div>
                <div><label><input type="checkbox" checked={filters.preserveHook} onChange={(e) => setF('preserveHook', e.target.checked)} /> Keep hook verbatim</label></div>
                <div style={{ gridColumn: '1 / -1' }}><label>Custom instruction (optional)</label><input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. funnier but keep numbers, Hindi mix in CTA" /></div>
                <div style={{ gridColumn: '1 / -1' }}><button className="primary" onClick={() => runTune('custom')} disabled={refining}>{refining ? 'Tuning…' : 'Preview tuned version'}</button></div>
              </div>
            )}
            {!showAdvanced && (
              <div className="row" style={{ marginTop: 8, gap: 8 }}>
                <input style={{ flex: 1 }} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Optional: e.g. shorter CTA (or just Auto-improve)" />
                <button className="ghost" onClick={() => runTune('custom')} disabled={refining}>Preview</button>
              </div>
            )}
            {pending && (
              <div className="ia-preview">
                <div className="card-title-row"><b>Suggestion ({pending.engine})</b><span className="mut" style={{ fontSize: 12 }}>{pending.changeSummary || 'review before accepting'}</span></div>
                <div className="ia-preview-cols">
                  <div><span className="ia-section-badge">Current v{script.version}</span><pre className="ia-preview-box">{(script.body || '').slice(0, 900)}</pre></div>
                  <div><span className="ia-section-badge">Suggested (not saved)</span><pre className="ia-preview-box ia-suggest">{(pending.suggestion || '').slice(0, 1200)}</pre></div>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <button className="primary" onClick={acceptPending}>Accept as v{script.version + 1}</button>
                  <button type="button" className="ghost" onClick={() => setPending(null)}>Discard</button>
                  <button type="button" className="quiet" onClick={() => copyToClipboard(pending.suggestion, 'sugg')}>{copiedField === 'sugg' ? 'Copied' : 'Copy suggestion'}</button>
                </div>
              </div>
            )}
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <span className="mut">Teach future outputs ({actor}):</span>
              <button type="button" className="ghost" onClick={() => rate(5)} disabled={rated !== null}>{rated === 5 ? '★ Saved as example' : '👍 Approve style'}</button>
              <button type="button" className="ghost" onClick={() => rate(1)} disabled={rated !== null}>{rated === 1 ? '✕ Logged' : '👎 Needs work'}</button>
              {script.meta?.wordCount && <span className="pill">{script.meta.wordCount} words · ~{script.meta.estSec}s · {script.meta.language}</span>}
              {script.engine && <span className="pill">engine: {script.engine}</span>}
            </div>
          </div>

          <div className="card ia-shoot-card">
            <div className="card-title-row">
              <h3>Shoot-ready</h3>
              <div className="row" style={{ gap: 6 }} role="tablist" aria-label="Shoot-ready outputs">
                {[['teleprompter', 'Teleprompter'], ['shots', 'Shot list'], ['visuals', 'Visuals'], ['titles', 'Titles & CTA']].map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={shootTab === k} className={`pill-btn ${shootTab === k ? 'active' : ''}`} onClick={() => setShootTab(k)}>{label}</button>
                ))}
              </div>
            </div>
            {shootTab === 'teleprompter' && (
              <div>
                <div className="ia-support-item-head"><span className="mut" style={{ fontSize: 12 }}>{(script.teleprompter || '').split(/\s+/).filter(Boolean).length} words · ~{Math.round((script.teleprompter || '').split(/\s+/).filter(Boolean).length / 2.5)}s read</span><button type="button" className="quiet" onClick={() => copyToClipboard(script.teleprompter || script.body, 'tp')}>{copiedField === 'tp' ? 'Copied' : 'Copy'}</button></div>
                <pre className="ia-teleprompter">{script.teleprompter || script.body || 'No script yet.'}</pre>
              </div>
            )}
            {shootTab === 'shots' && (
              <div className="ia-table-wrap"><table className="ia-table">
                <thead><tr><th>Beat</th><th>Time</th><th>Line</th><th>Shot / Audio</th></tr></thead>
                <tbody>{(script.beats || []).map((b, i) => {
                  const shot = (script.shotList || [])[i] || {};
                  return (<tr key={b.idx ?? i}><td><span className="pill">B{b.idx ?? i}</span></td><td className="mut">{b.startSec ?? '–'}–{b.endSec ?? '–'}s</td><td>{b.text}</td><td className="mut">{shot.shot || b.direction || '—'}{shot.audio ? ` · 🔊 ${shot.audio}` : ''}</td></tr>);
                })}</tbody>
              </table></div>
            )}
            {shootTab === 'visuals' && (
              <div className="ia-visual-grid">{(script.visuals?.length ? script.visuals : (script.beats || []).map((b) => ({ beatIdx: b.idx, direction: b.direction, broll: b.broll }))).map((v, i) => (
                <div key={i} className="ia-visual-card"><div className="row" style={{ justifyContent: 'space-between' }}><b>Beat {v.beatIdx}</b><button type="button" className="quiet" onClick={() => copyToClipboard(`${v.direction} / B-roll: ${v.broll}`, `v${i}`)}>{copiedField === `v${i}` ? 'Copied' : 'Copy'}</button></div><div>🎬 {v.direction || '—'}</div><div className="mut">📦 B-roll: {v.broll || '—'}</div></div>
              ))}</div>
            )}
            {shootTab === 'titles' && (
              <div className="ia-support-grid">
                <div className="ia-support-item"><div className="ia-support-item-head"><b>Title variants (click Use)</b></div>{[script.supporting?.title, ...(script.supporting?.titleVariants || [])].filter(Boolean).slice(0, 4).map((t) => (<div key={t} className="row" style={{ justifyContent: 'space-between', gap: 8 }}><span>{t}</span><button type="button" className="quiet" onClick={async () => { const { data } = await ideationApi.patchScript(script.id, { title: t }); onScript?.({ ...script, title: data.title }); }}>Use</button></div>))}</div>
                <div className="ia-support-item"><div className="ia-support-item-head"><b>CTA variants</b><button type="button" className="quiet" onClick={() => copyToClipboard((script.supporting?.ctaVariants || []).join(' / '), 'ctav')}>{copiedField === 'ctav' ? 'Copied' : 'Copy'}</button></div><div>{[script.supporting?.cta, ...(script.supporting?.ctaVariants || [])].filter(Boolean).slice(0, 4).map((c) => (<div key={c} className="pill" style={{ margin: '2px 4px 2px 0' }}>{c}</div>))}</div></div>
              </div>
            )}
          </div>

          {script?.supporting && (
            <div className="card ia-support-card">
              <div className="card-title-row">
                <h3>F3.5 Supporting Content</h3>
                <span className="pill">Ready to Post</span>
              </div>
              <p className="ia-desc-text">
                Multi-platform title, caption, hashtags, and CTA generated in lockstep with the script.
              </p>

              <div className="ia-support-grid">
                <div className="ia-support-item">
                  <div className="ia-support-item-head">
                    <b>Title:</b>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => copyToClipboard(script.supporting.title, 'title')}
                    >
                      {copiedField === 'title' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="ia-support-val">{script.supporting.title || 'Untitled'}</div>
                </div>

                <div className="ia-support-item">
                  <div className="ia-support-item-head">
                    <b>Caption:</b>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => copyToClipboard(script.supporting.caption, 'caption')}
                    >
                      {copiedField === 'caption' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="ia-support-val">{script.supporting.caption || 'No caption'}</div>
                </div>

                <div className="ia-support-item">
                  <div className="ia-support-item-head">
                    <b>Hashtags:</b>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => copyToClipboard(hashtags.join(' '), 'tags')}
                    >
                      {copiedField === 'tags' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="tags">
                    {hashtags.map((t) => (
                      <span className="pill" key={t}>{t}</span>
                    ))}
                    {hashtags.length === 0 && <span className="mut">None</span>}
                  </div>
                </div>

                <div className="ia-support-item">
                  <div className="ia-support-item-head">
                    <b>Call To Action (CTA):</b>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => copyToClipboard(script.supporting.cta, 'cta')}
                    >
                      {copiedField === 'cta' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="ia-support-val">{script.supporting.cta || 'Follow for more'}</div>
                </div>
              </div>

              {onProceedToBeats && (
                <div style={{ marginTop: 20, textAlign: 'right' }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={onProceedToBeats}
                  >
                    View Script Beats Breakdown
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
