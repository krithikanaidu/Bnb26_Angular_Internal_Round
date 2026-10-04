import { useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';
import { StatusDot } from './StatusDot';

/**
 * FloatingFolder — a light-blue macOS folder that bobs, tilts with mouse
 * parallax, and swings its front flap open on hover to show what's inside.
 *
 * When rendered as a non-interactive card (no `onClick`) the flap opens
 * whenever the pointer is anywhere over it, so the preview stays readable.
 */
export function FloatingFolder({
  label,
  statusColor = 'green',
  stageNumber,
  children,
  onClick,
  className = '',
  delay = 0,
  bobDuration = 4,
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [-50, 50], [8, -8]), { stiffness: 150, damping: 15 });
  const rotY = useSpring(useTransform(mx, [-50, 50], [-8, 8]), { stiffness: 150, damping: 15 });
  const lift = useSpring(0, { stiffness: 200, damping: 20 });

  function handleMouseMove(e) {
    if (reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left - rect.width / 2);
    my.set(e.clientY - rect.top - rect.height / 2);
  }

  function handleMouseEnter() {
    setOpen(true);
    if (!reduced) lift.set(-12);
  }

  function handleMouseLeave() {
    setOpen(false);
    if (!reduced) {
      mx.set(0);
      my.set(0);
      lift.set(0);
    }
  }

  function handleKeyDown(e) {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }

  const interactive = Boolean(onClick);

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{ rotateX: reduced ? 0 : rotX, rotateY: reduced ? 0 : rotY, y: lift, perspective: 800 }}
      className={`relative ${interactive ? 'cursor-pointer' : ''} ${className}`}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {/* Bobbing wrapper */}
      <motion.div
        animate={reduced ? {} : { y: [0, -8, 0], rotate: [0, 2, 0] }}
        transition={{ duration: bobDuration, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Folder back */}
        <div
          className="relative rounded-t-xl rounded-b-lg"
          style={{
            width: 200,
            height: 150,
            background: 'linear-gradient(135deg, var(--folder-blue) 0%, var(--folder-blue-deep) 100%)',
            boxShadow: 'var(--sticker-shadow), inset 0 -4px 8px rgba(0,0,0,0.1)',
          }}
        >
          {/* Folder tab */}
          <div className="absolute -top-5 left-4 rounded-t-lg" style={{ width: 70, height: 22, background: 'var(--folder-blue-deep)' }} />
          {/* Preview content */}
          <div className="absolute inset-3 rounded-lg bg-white/90 overflow-hidden flex items-center justify-center p-2">
            {children ?? <div className="text-ink/40 font-mono text-[10px] text-center">{stageNumber ?? '01'}</div>}
          </div>
        </div>

        {/* Folder front flap (swings open on hover) */}
        <motion.div
          className="absolute top-0 left-0 rounded-t-xl rounded-b-lg origin-top"
          style={{
            width: 200,
            height: 150,
            background: 'linear-gradient(135deg, var(--folder-blue) 0%, var(--folder-blue-deep) 100%)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            transformStyle: 'preserve-3d',
          }}
          animate={reduced ? {} : { rotateX: open ? -65 : 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
            <StatusDot color={statusColor} size={8} />
            <span
              className="font-mono text-[10px] font-bold text-white truncate uppercase tracking-wide"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
            >
              {label}
            </span>
          </div>
          {stageNumber && <div className="absolute top-2 right-2 font-mono text-[9px] text-white/60 font-bold">{stageNumber}</div>}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
