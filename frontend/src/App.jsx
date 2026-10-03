import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Scripts from './pages/Scripts';
import Studio from './pages/Studio';
import Publish from './pages/Publish';
import ClipAI from './pages/ClipAI';

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="assets" element={<Assets />} />
          <Route path="scripts" element={<Scripts />} />
          <Route path="studio" element={<Studio />} />
          <Route path="publish" element={<Publish />} />
          <Route path="clips" element={<ClipAI />} />
        </Route>
        {/* Full-screen video editor (own header/panels/timeline) */}
        <Route
          path="video-editor"
          element={
            <Suspense fallback={<EditorFallback />}>
              <VideoEditor />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
