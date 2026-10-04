import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

/**
 * The real Bit & Build pipeline — seven stages, in the order content actually
 * moves through this product. Utility routes (dashboard, calendar, the video
 * editor, the component playground) are deliberately NOT stages: they are
 * places you visit, not things content flows through.
 */
export const PIPELINE_STAGES = [
  { index: 1, key: 'idea', label: 'IDEA', path: '/ideation' },
  { index: 2, key: 'script', label: 'SCRIPT', path: '/scripts' },
  { index: 3, key: 'assets', label: 'ASSETS', path: '/assets' },
  { index: 4, key: 'studio', label: 'STUDIO', path: '/studio' },
  { index: 5, key: 'clips', label: 'CLIPS', path: '/clips' },
  { index: 6, key: 'publish', label: 'PUBLISH', path: '/publish' },
  { index: 7, key: 'insights', label: 'INSIGHTS', path: '/insights' },
];

/**
 * Every nav destination, numbered. Kept in one place so SideNav and the meter
 * agree. The dashboard lives at `/dashboard` — `/` is the public marketing
 * page, so it must stay reachable while signed out and must never appear as a
 * workspace tab.
 */
export const NAV_TABS = [
  { label: 'Dashboard', path: '/dashboard', number: '00' },
  { label: 'Idea', path: '/ideation', number: '01' },
  { label: 'Scripts', path: '/scripts', number: '02' },
  { label: 'Assets', path: '/assets', number: '03' },
  { label: 'Studio', path: '/studio', number: '04' },
  { label: 'Auto Clips', path: '/clips', number: '05' },
  { label: 'Publish', path: '/publish', number: '06' },
  { label: 'Insights', path: '/insights', number: '07' },
  { label: 'Calendar', path: '/calendar', number: '08' },
];

export const EDITOR_PATH = '/video-editor';

/** Route → pipeline stage number. Returns null for non-stage routes. */
export function stageForPath(pathname) {
  const match = PIPELINE_STAGES.find((s) => pathname === s.path || pathname.startsWith(`${s.path}/`));
  return match ? match.index : null;
}

/**
 * PipelineMeter — fixed monospace readout, bottom-left, telling you which stage
 * you're standing in. The line fills with scroll position, so the page itself
 * acts as a progress indicator.
 */
export function PipelineMeter({ currentStage, total = PIPELINE_STAGES.length, className = '' }) {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const stage = PIPELINE_STAGES[(currentStage ?? 1) - 1] ?? PIPELINE_STAGES[0];
  const stageInfo = `STAGE ${String(stage.index).padStart(2, '0')} / ${String(total).padStart(2, '0')} · ${stage.label}`;

  // Keep a tiny state so the readout is announced politely to screen readers
  // rather than being mutated in place.
  const [announced, setAnnounced] = useState(stageInfo);
  useEffect(() => setAnnounced(stageInfo), [stageInfo]);

  return (
    <div className={`fixed bottom-4 left-4 lg:left-[264px] z-40 hidden sm:flex items-center gap-3 ${className}`}>
      <span className="sr-only" role="status" aria-live="polite">
        {announced}
      </span>
      <span className="mono-xs bg-white/80 px-2 py-1 rounded" aria-hidden="true">
        {stageInfo}
      </span>
      <div className="w-20 h-px bg-ink/20 relative overflow-hidden" aria-hidden="true">
        <motion.div
          className="absolute inset-y-0 left-0 bg-hot-pink origin-left"
          style={{ scaleX: reduced ? 1 : lineScale, width: '100%' }}
        />
      </div>
    </div>
  );
}

/**
 * StageTrail — the seven stages as a horizontal dotted trail. Not a progress
 * bar: nothing here is complete/incomplete, it is purely a map of where you
 * are. Used on the dashboard to link out to each step.
 */
export function StageTrail({ className = '' }) {
  return (
    <nav className={`bb-row ${className}`} aria-label="Pipeline stages">
      {PIPELINE_STAGES.map((s) => (
        <NavLink key={s.key} to={s.path} className="pill hover:-translate-y-0.5 transition-transform">
          <span className="opacity-50">{String(s.index).padStart(2, '0')}</span>
          {s.label}
        </NavLink>
      ))}
    </nav>
  );
}
