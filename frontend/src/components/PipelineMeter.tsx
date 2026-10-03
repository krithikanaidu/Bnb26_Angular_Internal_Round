import { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type PipelineStage = {
  index: number;
  key: string;
  label: string;
};

export const PIPELINE_STAGES: PipelineStage[] = [
  { index: 1, key: 'idea', label: 'IDEA' },
  { index: 2, key: 'scripted', label: 'SCRIPTED' },
  { index: 3, key: 'recorded', label: 'RECORDED' },
  { index: 4, key: 'editing', label: 'EDITING' },
  { index: 5, key: 'review', label: 'REVIEW' },
  { index: 6, key: 'scheduled', label: 'SCHEDULED' },
  { index: 7, key: 'published', label: 'PUBLISHED' },
];

/**
 * PipelineMeter — fixed monospace label bottom-left showing current stage.
 * Updates as user scrolls or switches tabs.
 */
export function PipelineMeter({
  currentStage,
  total = 7,
  className = '',
}: {
  currentStage: number;
  total?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const [stageInfo, setStageInfo] = useState('STAGE 01 / 07 · IDEA');

  useEffect(() => {
    const stage = PIPELINE_STAGES[currentStage - 1] ?? PIPELINE_STAGES[0];
    setStageInfo(`STAGE ${String(stage.index).padStart(2, '0')} / ${String(total).padStart(2, '0')} · ${stage.label}`);
  }, [currentStage, total]);

  return (
    <div
      className={`fixed bottom-4 left-4 z-40 flex items-center gap-3 ${className}`}
      role="status"
      aria-label={`Pipeline ${stageInfo}`}
    >
      <span className="font-mono text-[10px] font-bold text-ink/70 uppercase tracking-wider bg-white/80 px-2 py-1 rounded">
        {stageInfo}
      </span>
      <div className="w-20 h-px bg-ink/20 relative overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-hot-pink origin-left"
          style={{ scaleX: reduced ? 1 : lineScale, width: '100%' }}
        />
      </div>
    </div>
  );
}
