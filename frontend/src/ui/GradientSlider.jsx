import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

/**
 * GradientSlider — the "how much AI should touch this" control: a pink→orange
 * track with tilted end tags, a sticker stack that grows as the value rises,
 * and full keyboard + pointer support (role="slider", arrow keys, Home/End).
 */
export function GradientSlider({
  value: controlledValue,
  defaultValue = 30,
  onIntensityChange,
  className = '',
  leftTag = 'TOO LIGHT',
  rightTag = 'FULL AI',
  stackCount = 0,
  label = 'AI edit intensity',
}) {
  const reduced = useReducedMotion();
  const trackRef = useRef(null);
  const [internal, setInternal] = useState(defaultValue);
  const controlled = controlledValue !== undefined;
  const value = controlled ? controlledValue : internal;

  const setValue = (next) => {
    const pct = Math.max(0, Math.min(100, next));
    if (!controlled) setInternal(pct);
    onIntensityChange?.(pct);
  };

  function handleKeyDown(e) {
    const step = e.shiftKey ? 10 : 5;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setValue(value - step);
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setValue(value + step);
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setValue(0);
    }
    if (e.key === 'End') {
      e.preventDefault();
      setValue(100);
    }
  }

  function pctFromClientX(clientX) {
    if (!trackRef.current) return null;
    const rect = trackRef.current.getBoundingClientRect();
    if (rect.width === 0) return null;
    return ((clientX - rect.left) / rect.width) * 100;
  }

  function startDrag(e) {
    const initial = pctFromClientX(e.clientX);
    if (initial === null) return;
    if (!reduced) e.preventDefault();
    setValue(initial);

    const move = (ev) => {
      const pct = pctFromClientX(ev.clientX);
      if (pct === null) return;
      setValue(pct);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  return (
    <div className={`relative ${className}`}>
      {/* Sticker card stack grows with the value */}
      <div className="absolute -top-16 left-0 right-0 flex justify-center pointer-events-none">
        {Array.from({ length: Math.min(Math.round(stackCount), 5) }, (_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: `${20 + i * 12}%`, zIndex: i }}
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

      {/* End tags */}
      <div className="flex justify-between mb-3 px-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink/60" style={{ transform: 'rotate(-3deg)', display: 'inline-block' }}>
          {leftTag}
        </span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink/60" style={{ transform: 'rotate(3deg)', display: 'inline-block' }}>
          {rightTag}
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-3 rounded-full cursor-pointer touch-none"
        style={{ background: 'linear-gradient(to right, var(--hot-pink), var(--brand-orange))' }}
        onPointerDown={startDrag}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-ink shadow-md cursor-grab active:cursor-grabbing"
          style={{ left: `${value}%` }}
          role="slider"
          aria-valuenow={Math.round(value)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="mt-2 text-center">
        <span className="font-mono text-[10px] text-ink/50">{Math.round(value)}% AI</span>
      </div>
    </div>
  );
}
