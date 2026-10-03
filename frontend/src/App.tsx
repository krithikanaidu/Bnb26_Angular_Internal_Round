import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { NavBar } from '@/components/NavBar';
import { OSDialog } from '@/components/OSDialog';
import { ToastQueue } from '@/components/ToastQueue';
import { CustomCursor } from '@/components/CustomCursor';
import { PipelineMeter } from '@/components/PipelineMeter';
import { useAppStore } from '@/store/appStore';
import { Dashboard } from '@/pages/Dashboard';
import { Playground } from '@/pages/Playground';
import { ComingSoon } from '@/pages/ComingSoon';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';

function AnimatedRoutes() {
  const location = useLocation();
  const { currentStage } = useAppStore();

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/playground" element={<Playground />} />
            <Route path="/scripts" element={<ComingSoon number="02" label="Scripts & Hooks" description="AI-powered script writing with hook generation, beat detection, and typewriter-style text reveal." />} />
            <Route path="/assets" element={<ComingSoon number="03" label="Assets" description="Your media library with AI transcription, semantic search, and the tilted upload bin pouring files into your collection." />} />
            <Route path="/studio" element={<ComingSoon number="04" label="Studio" description="The Twick timeline editor with AI-assisted EDL operations, version history, and the AI intensity slider." />} />
            <Route path="/review" element={<ComingSoon number="05" label="Review" description="Time-coded comments as washi-tape sticky notes on the timeline, with ink avatars for each reviewer." />} />
            <Route path="/publish" element={<ComingSoon number="06" label="Publish" description="Multi-platform publishing with the Instagram-post frame scene, flip-calendar scheduler, and caption chips dropping into platform cards." />} />
            <Route path="/insights" element={<ComingSoon number="07" label="Insights" description="Giant 3D extruded numbers, paper-white chart cards with props riding the line, and recommendation tiles with sticker-outlined portraits." />} />
            <Route path="/align" element={<ComingSoon number="02b" label="Alignment" description="Split-screen notebook pages connecting script beats to footage transcript segments with hand-drawn pink lines." />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      <PipelineMeter currentStage={currentStage} />
    </>
  );
}

function App() {
  useSmoothScroll();

  return (
    <BrowserRouter>
      <CustomCursor />
      <NavBar />
      <main className="pt-14 min-h-screen">
        <AnimatedRoutes />
      </main>
      <OSDialog />
      <ToastQueue />
    </BrowserRouter>
  );
}

export default App;
