import { useEffect, useState } from 'react';
import { ideationApi } from './api';
import StageRail from './components/StageRail';
import IdeaTopicCapture from './components/IdeaTopicCapture';
import HookGenerator from './components/HookGenerator';
import HookPatternLibrary from './components/HookPatternLibrary';
import ScriptStudio from './components/ScriptStudio';
import ScriptBeatsViewer from './components/ScriptBeatsViewer';
import { PaperPage, PageHead, ErrorNote } from '../ui/AppKit';
import { StickerLabel } from '../ui/StickerLabel';
import './ideation.css';

// Ideation page — orchestrates the Idea -> Hooks -> Script -> Beats pipeline
// (AGENT/FEATURES.md Domain 3, CONTENT_WORKFLOW.md, AI_PIPELINE.md §3.1–3.2, DESIGN.md)
export default function IdeationPage() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  // All three start empty. They used to be pre-filled with a developer-authored
  // topic ('SaaS pricing mistakes most founders make') and niche ('B2B SaaS'),
  // which were submitted to the generators as the workspace's real topic.
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('punchy');
  const [niche, setNiche] = useState('');
  const [hook, setHook] = useState(null);
  const [script, setScript] = useState(null);
  const [savedScripts, setSavedScripts] = useState([]);
  const [activeStage, setActiveStage] = useState('idea');
  const [reachedStage, setReachedStage] = useState(1);
  const [loadError, setLoadError] = useState(null);
  const [savedError, setSavedError] = useState(null);
  const [patternHint, setPatternHint] = useState(null);

  // Load projects safely
  useEffect(() => {
    let active = true;
    ideationApi.listProjects()
      .then((r) => {
        if (active) {
          setProjects(Array.isArray(r?.data) ? r.data : []);
          setLoadError(null);
        }
      })
      .catch((e) => {
        // Surface the failure instead of silently pretending there are no projects.
        if (active) { setProjects([]); setLoadError(e?.response?.data?.error || 'Could not load projects — is the backend running?'); }
      });

    return () => { active = false; };
  }, []);

  // Load saved scripts for the project / workspace. A failure used to be
  // swallowed silently (empty history, no explanation); surface it instead.
  const loadSavedScripts = (projId) => {
    ideationApi.listScripts(projId || undefined)
      .then((r) => {
        setSavedScripts(Array.isArray(r?.data) ? r.data : []);
        setSavedError(null);
      })
      .catch((e) => {
        setSavedScripts([]);
        setSavedError(e?.response?.data?.error || 'Could not load saved scripts — is the backend running?');
      });
  };

  useEffect(() => {
    loadSavedScripts(projectId);
  }, [projectId]);

  // When hook is selected
  const handleHookPick = (chosenHook) => {
    setHook(chosenHook);
    if (chosenHook.topic) {
      setTopic(chosenHook.topic);
    }
    setReachedStage((prev) => Math.max(prev, 3));
    setActiveStage('script');
  };

  // When script is created or edited
  const handleScriptUpdate = (newScript) => {
    setScript(newScript);
    setReachedStage(4);
    loadSavedScripts(projectId);
  };

  // When user selects a pattern from pattern library
  const handlePatternSelect = (pattern) => {
    // Requires a real topic. Substituting 'this topic' used to push a fabricated
    // string into the topic field and from there into the generators.
    if (!topic.trim()) {
      setPatternHint('Enter your topic first — a pattern is only a template, so it needs something to fill it.');
      return;
    }
    setPatternHint(null);
    setTopic((pattern.pattern || '').replace('{topic}', topic.trim()));
    setActiveStage('hooks');
  };

  // When user loads an existing saved script from history
  const handleLoadSavedScript = (s) => {
    setScript({
      id: s.id,
      title: s.title,
      body: s.body,
      content: s.body,
      beats: Array.isArray(s.beats) ? s.beats : [],
      supporting: s.supporting || {},
      version: Number(s.version) || 1,
      engine: 'saved',
    });
    // The hook text is recovered from the script's first line, but its strength is
    // NOT invented: a saved script carries no scored hook, so score stays null and
    // the Strength badge is hidden rather than showing a fabricated 85%.
    setHook({
      id: s.hookPatternId || null,
      text: (s.body || '').split('\n')[0]?.replace(/^HOOK[^:]*:\s*/i, '') || s.title || '',
      category: null,
      score: null,
      fromSavedScript: true,
    });
    setReachedStage(4);
    setActiveStage('script');
  };

  return (
    <PaperPage>
      <div className="ia-root">
        {/* Header bar */}
        <PageHead
          number="01"
          title="Ideation"
          script="idea to script"
          description="Topic definition → viral hook generation → shootable script with live versioning → beat breakdown ready for Studio alignment."
          actions={
            <div className="flex flex-col items-end gap-2">
              <StickerLabel variant="pill" rotate={-2} color="var(--color-sticker-purple)" textColor="#fff">
                Domain 3 workflow
              </StickerLabel>
              <div>
                <label htmlFor="ia-header-proj">Target Project</label>
                <select
                  id="ia-header-proj"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="!w-auto min-w-[220px]"
                >
                  <option value="">Workspace Scratchpad</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            </div>
          }
        />

        {/* Pipeline Navigation Rail */}
        {loadError && <ErrorNote className="mt-4">{loadError}</ErrorNote>}

        <StageRail
          active={activeStage}
          reached={reachedStage}
          onSelect={(stageKey) => setActiveStage(stageKey)}
        />

      {/* Stage 1: Idea and Topic Capture (F1.3, F3.6) */}
      {activeStage === 'idea' && (
        <IdeaTopicCapture
          projects={projects}
          projectId={projectId}
          onProjectChange={setProjectId}
          topic={topic}
          onTopicChange={setTopic}
          tone={tone}
          onToneChange={setTone}
          niche={niche}
          onNicheChange={setNiche}
          onProceedToHooks={() => {
            setReachedStage((prev) => Math.max(prev, 2));
            setActiveStage('hooks');
          }}
        />
      )}

      {/* Stage 2: Hook Generation and Pattern Library (F3.1, F3.2) */}
      {activeStage === 'hooks' && (
        <>
          <HookGenerator
            projectId={projectId}
            topic={topic}
            onTopicChange={setTopic}
            tone={tone}
            onToneChange={setTone}
            niche={niche}
            onNicheChange={setNiche}
            pickedId={hook?.id}
            onPick={handleHookPick}
          />
          <HookPatternLibrary onSelectPattern={handlePatternSelect} />
          {patternHint && <ErrorNote className="mt-3">{patternHint}</ErrorNote>}
        </>
      )}

      {/* Stage 3: Script Studio & Inline Editing (F3.3, F3.5) */}
      {activeStage === 'script' && (
        <ScriptStudio
          projectId={projectId}
          hook={hook}
          topic={topic}
          script={script}
          onScript={handleScriptUpdate}
          onProceedToBeats={() => setActiveStage('beats')}
        />
      )}

      {/* Stage 4: Script Beats (F3.4) */}
      {activeStage === 'beats' && (
        <ScriptBeatsViewer
          script={script}
          onScriptUpdate={handleScriptUpdate}
        />
      )}

      {/* Saved Scripts History Drawer/Section */}
      {savedError && <ErrorNote className="mt-3">{savedError}</ErrorNote>}
      {savedScripts.length > 0 && (
        <section className="ia-history-section">
          <div className="card ia-history-card">
            <div className="card-title-row">
              <div className="bb-row">
                <h3>Saved Scripts History</h3>
                <span className="pill">{savedScripts.length} Saved</span>
              </div>
              <span className="mut" style={{ fontSize: 13 }}>Click to load into editor</span>
            </div>

            <div className="ia-history-grid">
              {savedScripts.map((s) => (
                <div
                  key={s.id}
                  className={`ia-history-item ${script?.id === s.id ? 'active' : ''}`}
                  onClick={() => handleLoadSavedScript(s)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLoadSavedScript(s);
                  }}
                >
                  <div className="bb-row" style={{ justifyContent: 'space-between' }}>
                    <b>{s.title || 'Untitled'}</b>
                    <span className="pill">v{s.version || 1}</span>
                  </div>
                  <div className="mut" style={{ fontSize: 12, marginTop: 4 }}>
                    {/* 'standard' was never a tone in this app's vocabulary, and
                        "0 words" asserted a measurement that was never taken. */}
                    Tone: {s.tone || '—'} · {s.body ? `${s.body.split(/\s+/).filter(Boolean).length} words` : 'no body'}
                  </div>
                  <pre className="ia-history-snippet">
                    {(s.body || '').slice(0, 140)}{s.body && s.body.length > 140 ? '…' : ''}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      </div>
    </PaperPage>
  );
}
