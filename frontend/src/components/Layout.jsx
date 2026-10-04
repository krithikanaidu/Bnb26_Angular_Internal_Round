import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';

// Ask the backend which engines it actually resolved instead of asserting one.
// This used to hardcode "AI: Groq / OpenAI / heuristic fallback", which kept
// claiming Groq/OpenAI even when only the heuristic engine was available.
function useEngines() {
  const [engines, setEngines] = useState(null);
  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((h) => { if (active) setEngines(h?.engines || null); })
      .catch(() => { if (active) setEngines(null); });
    return () => { active = false; };
  }, []);
  return engines;
}

export default function Layout() {
  const engines = useEngines();
  const copy = engines?.copy;
  const aiLabel = copy === 'groq' ? 'Groq'
    : copy === 'openai' ? 'OpenAI'
      : copy === 'heuristic' ? 'Heuristic fallback (no LLM key)'
        : engines ? String(copy) : 'Status unavailable';

  return (
    <div className="layout">
      <aside className="side">
        <h1>✨ CreatorAI</h1>
        <p>AI Creator Operating Platform (PERN)</p>
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/assets">Assets</NavLink>
          <NavLink to="/scripts">Scripts & Hooks</NavLink>
          <NavLink to="/ideation">💡 Ideation &amp; Hooks</NavLink>
          <NavLink to="/studio">Script→Video & Clips</NavLink>
          <NavLink to="/clips">✂️ Auto Clips</NavLink>
          <NavLink to="/publish">Adapt & Publish</NavLink>
          <NavLink to="/insights">📊 Insights</NavLink>
          <NavLink to="/calendar">🗓 Calendar</NavLink>
          <NavLink to="/video-editor">🎬 Video Editor</NavLink>
        </nav>
        <div style={{ marginTop: 18 }} className="card"><small className="mut">Backend: Express + Sequelize + Supabase<br />AI: {aiLabel}<br />Speech-to-text: {engines?.stt?.name || (engines ? 'not configured' : 'unknown')}</small></div>
      </aside>
      <div className="main"><Outlet /></div>
    </div>
  );
}
