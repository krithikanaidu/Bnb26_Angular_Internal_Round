import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, LayoutGrid, LogOut, Scissors, Wrench } from 'lucide-react';

import { NAV_TABS, EDITOR_PATH } from './PipelineMeter';
import { ThemeToggle } from './ThemeToggle';
import { AsteriskBurst } from './DoodleOutline';
import { useSession } from '../lib/session';

/** Non-stage destinations: places you visit, not things content flows through. */
const UTILITY_LINKS = [
  { label: 'Calendar', path: '/calendar', Icon: CalendarDays },
  { label: 'Video Editor', path: EDITOR_PATH, Icon: Scissors, note: 'opens standalone' },
  { label: 'Components', path: '/playground', Icon: Wrench },
];

function initialsFor(user) {
  const source = (user?.name || user?.email || '').trim();
  if (!source) return 'BB';
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
}

/**
 * SideNav — the app's navigation rail.
 *
 * Replaces the old fixed header: on a desktop the numbered pipeline runs down
 * a paper strip on the left (00–08), so the whole product reads top-to-bottom
 * the way the pipeline actually flows. On narrow screens it collapses behind a
 * MENU button and slides in as a sheet.
 *
 * The dashboard is `/dashboard`, not `/` — the root path is the public
 * marketing page and must stay reachable while signed out.
 */
export function SideNav({ onNavigate }) {
  const location = useLocation();
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    onNavigate?.();
  };

  const itemClass = ({ isActive }) => `side-item${isActive ? ' is-active' : ''}`;

  const contents = (
    <>
      <div className="side-head">
        <NavLink to="/dashboard" className="side-brand" onClick={close}>
          <AsteriskBurst size={22} />
          <span className="font-display font-black text-lg tracking-tight">
            Bit<span style={{ color: 'var(--hot-pink)' }}>&amp;</span>Build
          </span>
        </NavLink>
        <p className="mono-xs muted !mt-1">Creator pipeline · 9 stages</p>
      </div>

      <nav className="side-nav" aria-label="Workspace">
        <p className="mono-xs muted side-group">Pipeline</p>
        {NAV_TABS.map((tab) => (
          <NavLink key={tab.path} to={tab.path} end={tab.path === '/dashboard'} className={itemClass} onClick={close}>
            <span className="side-num">{tab.number}</span>
            <span className="side-label">{tab.label}</span>
          </NavLink>
        ))}

        <p className="mono-xs muted side-group mt-4">Tools</p>
        {UTILITY_LINKS.map(({ label, path, Icon, note }) => (
          <NavLink key={path} to={path} className={itemClass} onClick={close}>
            <span className="side-num">
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span className="side-label">
              {label}
              {note && <span className="mono-xs muted block">{note}</span>}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="side-foot">
        <div className="side-user">
          <span className="side-avatar" aria-hidden="true">
            {initialsFor(user)}
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-sm truncate">{user?.name || 'Signed in'}</span>
            <span className="mono-xs muted block truncate">{user?.email || '—'}</span>
          </span>
        </div>
        <div className="side-foot-row">
          <ThemeToggle />
          <button type="button" className="btn ghost tiny" onClick={logout} title="Sign out">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
        <NavLink to="/" className="mono-xs muted hover:text-ink transition-colors" onClick={close}>
          ← Back to the public site
        </NavLink>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile trigger — sits in the top bar, not the rail. */}
      <div className="side-trigger">
        <button
          type="button"
          className="btn ghost tiny"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {/* Desktop rail */}
      <aside className="side-rail" aria-label="Workspace navigation">
        {contents}
      </aside>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              className="side-sheet lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              aria-label="Workspace navigation"
            >
              {contents}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
