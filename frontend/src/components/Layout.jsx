import { NavLink, Outlet } from 'react-router-dom';
export default function Layout() {
  return (
    <div className="layout">
      <aside className="side">
        <h1>✨ CreatorAI</h1>
        <p>AI Creator Operating Platform (PERN)</p>
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/assets">Assets</NavLink>
          <NavLink to="/scripts">Scripts & Hooks</NavLink>
          <NavLink to="/studio">Script→Video & Clips</NavLink>
          <NavLink to="/publish">Adapt & Publish</NavLink>
        </nav>
        <div style={{ marginTop: 18 }} className="card"><small className="mut">Backend: Express + Sequelize + Supabase<br />AI: OpenAI / heuristic fallback</small></div>
      </aside>
      <div className="main"><Outlet /></div>
    </div>
  );
}
