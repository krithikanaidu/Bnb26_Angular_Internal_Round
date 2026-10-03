import { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type StatusColor = 'green' | 'red' | 'purple' | 'orange';

const colorMap: Record<StatusColor, string> = {
  green: 'var(--status-green)',
  red: 'var(--status-red)',
  purple: 'var(--status-purple)',
  orange: 'var(--status-orange)',
};

export function StatusDot({
  color = 'green',
  size = 10,
  pulse = true,
  className = '',
}: {
  color?: StatusColor;
  size?: number;
  pulse?: boolean;
  className?: string;
}) {
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

  return (
    <motion.span
      animate={controls}
      className={`inline-block rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: colorMap[color],
        boxShadow: `0 0 8px ${colorMap[color]}66`,
      }}
    />
  );
}
