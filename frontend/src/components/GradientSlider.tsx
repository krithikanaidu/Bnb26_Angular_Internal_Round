import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * GradientSlider — pink -> orange track with tilted tags "TOO LIGHT" and "FULL AI".
 * Dragging grows a stack of sticker cards above it.
 */
export function GradientSlider({
  onIntensityChange,
  className = '',
  leftTag = 'TOO LIGHT',
  rightTag = 'FULL AI',
  stackCount = 0,
}: {
  onIntensityChange?: (value: number) => void;
  className?: string;
  leftTag?: string;
  rightTag?: string;
  stackCount?: number;
}) {
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(30);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') setValue((v) => Math.max(0, v - 5));
    if (e.key === 'ArrowRight') setValue((v) => Math.min(100, v + 5));
  }

  function handlePointer(e: React.PointerEvent) {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setValue(pct);
    onIntensityChange?.(pct);
  }

  function startDrag(e: React.PointerEvent) {
    if (reduced) return;
    e.preventDefault();
    handlePointer(e);
    const move = (ev: PointerEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      setValue(pct);
      onIntensityChange?.(pct);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return (
    <div className={`relative ${className}`}>
      {/* Sticker card stack above slider */}
      <div className="absolute -top-16 left-0 right-0 flex justify-center pointer-events-none">
        {Array.from({ length: Math.min(stackCount, 5) }, (_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${20 + i * 12}%`,
              zIndex: i,
            }}
            initial={reduced ? {} : { y: -20, opacity: 0, rotate: -5 + i * 3 }}
            animate={{ y: -i * 4, opacity: 1 - i * 0.1, rotate: -5 + i * 3 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: i * 0.05 }}
          >
            <div
              className="w-12 h-16 rounded-md flex items-center justify-center font-mono text-[8px] font-bold"
              style={{
                background: 'var(--sticker-yellow)',
                border: '2px solid var(--ink)',
                boxShadow: 'var(--sticker-shadow)',
              }}
            >
              AI {i + 1}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tags */}
      <div className="flex justify-between mb-3 px-2">
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink/60"
          style={{ transform: 'rotate(-3deg)', display: 'inline-block' }}
        >
          {leftTag}
        </span>
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink/60"
          style={{ transform: 'rotate(3deg)', display: 'inline-block' }}
        >
          {rightTag}
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-3 rounded-full cursor-pointer"
        style={{
          background: 'linear-gradient(to right, var(--hot-pink), var(--brand-orange))',
        }}
        onPointerDown={startDrag}
      >
        {/* Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-ink shadow-md cursor-grab active:cursor-grabbing"
          style={{ left: `${value}%` }}
          role="slider"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="AI edit intensity"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Value display */}
      <div className="mt-2 text-center">
        <span className="font-mono text-[10px] text-ink/50">{Math.round(value)}% AI</span>
      </div>
    </div>
  );
}
