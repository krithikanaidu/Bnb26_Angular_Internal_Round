import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Cpu, Mic, Server } from 'lucide-react';

import { SideNav } from '../ui/SideNav';
import { CustomCursor } from '../ui/CustomCursor';
import { OSDialog } from '../ui/OSDialog';
import { ToastQueue } from '../ui/ToastQueue';
import { PipelineMeter, stageForPath, PIPELINE_STAGES } from '../ui/PipelineMeter';
import { GridPaperBg } from '../ui/SkyBackground';
import { AmbientFloatLayers } from '../ui/AmbientFloatLayers';
import { useReducedMotion } from '../ui/useReducedMotion';
import { setUnauthorizedHandler, useSession } from '../lib/session';
import { api } from '../lib/api';

/**
 * Ask the backend which engines it actually resolved instead of asserting one.
 * This used to hardcode "AI: Groq / OpenAI / heuristic fallback", which kept
 * claiming Groq/OpenAI even when only the heuristic engine was available.
 */
function useEngines() {
  const [engines, setEngines] = useState(null);
  useEffect(() => {
    let active = true;
    // Goes through the shared client so the request carries the session token
    // and a dead session surfaces as a 401 rather than an anonymous read.
    api
      .get('/health')
      .then(({ data }) => {
        if (active) setEngines(data?.engines || null);
      })
      .catch(() => {
        if (active) setEngines(null);
      });
    return () => {
      active = false;
    };
  }, []);
  return engines;
}

/** Describes the copy engine truthfully, including when it has degraded. */
function describeCopyEngine(engines) {
  if (!engines) return 'Status unavailable';
  const copy = engines.copy;
  if (copy === 'groq') return 'Groq';
  if (copy === 'openai') return 'OpenAI';
  if (copy === 'heuristic') return 'Heuristic fallback (no LLM key)';
  return copy ? String(copy) : 'Not reported';
}

/**
 * Layout — the signed-in workspace shell.
 *
 * Navigation is a left sidebar, not a header: on desktop the numbered pipeline
 * runs down a paper rail, and on narrow screens it slides in from the left
 * behind a Menu button. The video editor is deliberately routed outside this
 * shell (see App.jsx) because it ships its own design system.
 */
export default function Layout() {
  const engines = useEngines();
  const location = useLocation();
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const user = useSession((s) => s.user);

  // A 401 anywhere in the workspace means the session died. Send them to login
  // once, rather than leaving every panel showing "unauthorized".
  useEffect(() => {
    setUnauthorizedHandler(() => navigate('/login', { replace: true, state: { from: location.pathname } }));
    return () => setUnauthorizedHandler(() => {});
  }, [navigate, location.pathname]);

  // Derived from the URL, never stored: the meter cannot drift out of sync
  // with where you actually are.
  const stage = stageForPath(location.pathname);

  const aiLabel = describeCopyEngine(engines);
  const sttLabel = engines?.stt?.name || (engines ? 'not configured' : 'unknown');

  return (
    <div className="layout app-shell">
      <CustomCursor />

      {/* The sheet the whole app is printed on. */}
      <GridPaperBg />
      <AmbientFloatLayers />
      <div className="bb-grain" aria-hidden="true" />

      <SideNav />

      <main className="app-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>

        {/* Colophon — states plainly what is actually wired up. */}
        <footer className="relative z-10 mt-8">
          <div className="bb-page !pt-0">
            <div className="card !py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="mono-xs muted flex items-center gap-2">
                <Server className="w-3.5 h-3.5" />
                Backend: Express + Sequelize + Supabase
              </span>
              <span className="mono-xs muted flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5" />
                Copy AI: {aiLabel}
              </span>
              <span className="mono-xs muted flex items-center gap-2">
                <Mic className="w-3.5 h-3.5" />
                Speech-to-text: {sttLabel}
              </span>
              <span className="mono-xs muted ml-auto hidden sm:inline">
                {PIPELINE_STAGES.length}-stage pipeline · {location.pathname}
              </span>
            </div>
          </div>
        </footer>
      </main>

      <PipelineMeter currentStage={stage ?? 1} />
      <OSDialog />
      <ToastQueue />
      <span className="sr-only">{user?.email ? `Signed in as ${user.email}` : ''}</span>
    </div>
  );
}
