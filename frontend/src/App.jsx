import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { RequireSession, PublicOnly } from './components/RequireSession';
import Marketing from './pages/Marketing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Scripts from './pages/Scripts';
import Studio from './pages/Studio';
import Publish from './pages/Publish';
import ClipAI from './pages/ClipAI';
// KRITIKA: ideation → hooks → script → beats studio, plus insights + calendar.
import IdeationPage from './ideation-script-hook/IdeationPage';
import Insights from './pages/Insights';
import Calendar from './pages/Calendar';
import Playground from './pages/Playground';
import { useSmoothScroll } from './ui/useSmoothScroll';

// Lazy: the editor pulls in pixi/mediabunny (~4MB) — keep it out of the main chunk.
const VideoEditor = lazy(() => import('./pages/VideoEditor'));

function EditorFallback() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        alignItems: 'center',
        justifyContent: 'center',
        background: '#09090b',
        color: '#e4e4e7',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'linear-gradient(135deg,#7c5cff,#00e0b8)',
          animation: 've-pulse 1.2s ease-in-out infinite',
        }}
      />
      <div style={{ fontSize: 13, color: '#9aa7bd' }}>Loading Video Editor…</div>
      <style>{'@keyframes ve-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.94)}}'}</style>
    </div>
  );
}

/**
 * Three zones, on purpose:
 *
 *  - `/` and `/login` are public. The marketing page is the front door, so it
 *    must render with no session at all.
 *  - Everything inside `<Layout>` is the workspace: sidebar navigation, the
 *    pipeline meter, dialogs and toasts, all behind RequireSession.
 *  - `/video-editor` sits outside `<Layout>` because it ships its own design
 *    system and full-screen chrome, but it is still gated — it is a workspace
 *    tool, not a public page.
 */
export default function App() {
  // One Lenis + ScrollTrigger instance for the whole app shell. The video
  // editor mounts outside Layout, so it never inherits the smoothed scroller.
  useSmoothScroll();

  return (
    <BrowserRouter>
      <Routes>
        {/* ---- Public ------------------------------------------------- */}
        <Route path="/" element={<Marketing />} />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />

        {/* ---- Workspace (sidebar shell, session required) --------------- */}
        <Route
          element={
            <RequireSession>
              <Layout />
            </RequireSession>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/scripts" element={<Scripts />} />
          <Route path="/ideation" element={<IdeationPage />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/clips" element={<ClipAI />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/playground" element={<Playground />} />
        </Route>

        {/* Full-screen video editor (own header/panels/timeline/design system) */}
        <Route
          path="/video-editor"
          element={
            <RequireSession>
              <Suspense fallback={<EditorFallback />}>
                <VideoEditor />
              </Suspense>
            </RequireSession>
          }
        />

        {/* Anything else: send people to the front door rather than a blank page. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
