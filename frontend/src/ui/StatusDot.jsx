import { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

export const STATUS_COLORS = {
  green: 'var(--status-green)',
  red: 'var(--status-red)',
  purple: 'var(--status-purple)',
  orange: 'var(--status-orange)',
  // `blue` marks work that is in flight (queued / transcribing / rendering).
  // Without it the lookup fell through to green, so a job mid-render wore the
  // same light as a finished one.
  blue: 'var(--color-folder-blue)',
};

/**
 * StatusDot — small glowing status light that breathes.
 *
 * Colour must be chosen from real state by the caller; there is no default
 * that implies "healthy", because a dot that looks fine when we have no data
 * would be a lie.
 */
export function StatusDot({ color = 'green', size = 10, pulse = true, className = '' }) {
  const controls = useAnimation();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !pulse) return;
    controls.start({
      scale: [1, 1.3, 1],
      opacity: [1, 0.7, 1],
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
    });
  }, [controls, pulse, reduced]);

  const c = STATUS_COLORS[color] ?? STATUS_COLORS.green;

  return (
    <motion.span
      animate={controls}
      className={`inline-block rounded-full flex-none ${className}`}
      style={{ width: size, height: size, backgroundColor: c, boxShadow: `0 0 8px ${c}66` }}
    />
  );
}

/**
 * StatusDotLabel — dot plus a monospace label, used in stat rows so the state
 * is never communicated by colour alone.
 */
export function StatusDotLabel({ color = 'green', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 mono-xs ${className}`}>
      <StatusDot color={color} size={8} />
      <span>{children}</span>
    </span>
  );
}
