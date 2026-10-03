import { useEffect, useState } from 'react';
import { ideationApi } from './api';
import StageRail from './components/StageRail';
import IdeaTopicCapture from './components/IdeaTopicCapture';
import HookGenerator from './components/HookGenerator';
import HookPatternLibrary from './components/HookPatternLibrary';
import ScriptStudio from './components/ScriptStudio';
import ScriptBeatsViewer from './components/ScriptBeatsViewer';
import './ideation.css';

// Ideation page — orchestrates the Idea -> Hooks -> Script -> Beats pipeline
// (AGENT/FEATURES.md Domain 3, CONTENT_WORKFLOW.md, AI_PIPELINE.md §3.1–3.2, DESIGN.md)
export default function IdeationPage() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [topic, setTopic] = useState('SaaS pricing mistakes most founders make');
  const [tone, setTone] = useState('punchy');
  const [niche, setNiche] = useState('B2B SaaS');
  const [hook, setHook] = useState(null);
  const [script, setScript] = useState(null);
  const [savedScripts, setSavedScripts] = useState([]);
  const [activeStage, setActiveStage] = useState('idea');
  const [reachedStage, setReachedStage] = useState(1);

  // Load projects safely
  useEffect(() => {
    let active = true;
    ideationApi.listProjects()
      .then((r) => {
        if (active) {
          setProjects(Array.isArray(r?.data) ? r.data : []);
        }
      })
      .catch(() => {
        if (active) setProjects([]);
      });

    return () => { active = false; };
  }, []);

  // Load saved scripts for the project / workspace
  const loadSavedScripts = (projId) => {
    ideationApi.listScripts(projId || undefined)
      .then((r) => {
        setSavedScripts(Array.isArray(r?.data) ? r.data : []);
      })
      .catch(() => setSavedScripts([]));
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
    const formatted = (pattern.pattern || '').replace('{topic}', topic || 'this topic');
    setTopic(formatted);
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
    setHook({
      id: s.hookPatternId || 'saved-hook',
      text: (s.body || '').split('\n')[0]?.replace(/^HOOK[^:]*:\s*/i, '') || s.title,
      category: 'statement',
      score: 0.85,
    });
    setReachedStage(4);
    setActiveStage('script');
  };

  return (
    <div className="ia-root">
      {/* Header bar */}
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <h1>Ideation, Scripts & Hooks</h1>
            <span className="pill">Domain 3 Master Workflow</span>
          </div>
          <p>
            Topic definition &rarr; viral hook generation &rarr; shootable script with live versioning &rarr; beat breakdown ready for Studio alignment.
          </p>
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <label htmlFor="ia-header-proj" style={{ display: 'block', margin: 0, fontSize: 11, color: 'var(--txt-muted)' }}>
              Target Project
            </label>
            <select
              id="ia-header-proj"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={{ minWidth: 220 }}
            >
              <option value="">Workspace Scratchpad</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pipeline Navigation Rail */}
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
      {savedScripts.length > 0 && (
        <section className="ia-history-section">
          <div className="card ia-history-card">
            <div className="card-title-row">
              <div className="row">
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
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b>{s.title || 'Untitled Script'}</b>
                    <span className="pill">v{s.version || 1}</span>
                  </div>
                  <div className="mut" style={{ fontSize: 12, marginTop: 4 }}>
                    Tone: {s.tone || 'standard'} · {s.body ? `${s.body.split(/\s+/).length} words` : '0 words'}
                  </div>
                  <pre className="ia-history-snippet">
                    {(s.body || '').slice(0, 140)}...
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
