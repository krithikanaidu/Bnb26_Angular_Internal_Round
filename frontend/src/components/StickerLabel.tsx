import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * StickerLabel — perforated stamp/ticket CTA sticker or outlined pill tag.
 */
export function StickerLabel({
  children,
  variant = 'pill',
  color = 'var(--sticker-yellow)',
  textColor = 'var(--ink)',
  rotate = 0,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  variant?: 'pill' | 'ticket' | 'tag';
  color?: string;
  textColor?: string;
  rotate?: number;
  className?: string;
  onClick?: () => void;
}) {
  if (variant === 'ticket') {
    return (
      <div
        className={`relative inline-flex items-center gap-2 px-4 py-2 ${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{
          background: color,
          color: textColor,
          transform: `rotate(${rotate}deg)`,
          borderRadius: 6,
          boxShadow: 'var(--sticker-shadow)',
          border: '1.5px dashed rgba(0,0,0,0.2)',
        }}
        onClick={onClick}
      >
        {/* Perforations */}
        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-current" style={{ color: 'var(--cream)' }} />
        <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-current" style={{ color: 'var(--cream)' }} />
        <span className="font-mono text-xs font-bold uppercase tracking-wider px-2">{children}</span>
      </div>
    );
  }

  if (variant === 'tag') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{
          background: 'transparent',
          color: textColor,
          border: `2px solid ${color}`,
          borderRadius: 4,
          transform: `rotate(${rotate}deg)`,
          boxShadow: 'var(--sticker-shadow)',
        }}
        onClick={onClick}
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider">{children}</span>
      </div>
    );
  }

  // pill
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        background: color,
        color: textColor,
        transform: `rotate(${rotate}deg)`,
        boxShadow: 'var(--sticker-shadow)',
      }}
      onClick={onClick}
    >
      <span className="font-mono text-xs font-bold uppercase tracking-wider">{children}</span>
    </div>
  );
}

/**
 * StickerCutout — a cutout element with sticker outline drop-shadow filter.
 */
export function StickerCutout({
  children,
  outlineColor = 'ink',
  rotate = 0,
  className = '',
  drop = true,
}: {
  children: React.ReactNode;
  outlineColor?: 'ink' | 'white' | 'pink';
  rotate?: number;
  className?: string;
  drop?: boolean;
}) {
  const filterClass =
    outlineColor === 'white'
      ? 'sticker-outline-white'
      : outlineColor === 'pink'
      ? 'sticker-outline-pink'
      : 'sticker-outline';

  return (
    <div
      className={`${drop ? filterClass : ''} ${className}`}
      style={{ transform: `rotate(${rotate}deg)`, filter: drop ? undefined : 'none' }}
    >
      {children}
    </div>
  );
}

/**
 * ParallaxLayer — depth layer that drifts with scroll + mouse parallax.
 */
export function ParallaxLayer({
  children,
  speed = 0.3,
  className = '',
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(useTransform(mx, [-0.5, 0.5], [-20 * speed, 20 * speed]), { stiffness: 50, damping: 20 });
  const y = useSpring(useTransform(my, [-0.5, 0.5], [-20 * speed, 20 * speed]), { stiffness: 50, damping: 20 });

  function handleMouseMove(e: React.MouseEvent) {
    if (reduced) return;
    mx.set(e.clientX / window.innerWidth - 0.5);
    my.set(e.clientY / window.innerHeight - 0.5);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      style={{ x: reduced ? 0 : x, y: reduced ? 0 : y }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
