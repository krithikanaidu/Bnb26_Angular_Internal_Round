import { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

/**
 * StickerLabel — three flavours of label:
 *   pill   — solid rounded sticker (default CTA chip)
 *   ticket — perforated ticket with punched side holes
 *   tag    — transparent, hard 2px keyline tag
 */
export function StickerLabel({
  children,
  variant = 'pill',
  color = 'var(--sticker-yellow)',
  textColor = 'var(--ink)',
  rotate = 0,
  className = '',
  onClick,
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
        {/* Perforations — punched out of the ticket, so they read as the page behind */}
        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full" style={{ background: 'var(--cream)' }} />
        <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full" style={{ background: 'var(--cream)' }} />
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

/** StickerCutout — wraps any element in a die-cut ink keyline. */
export function StickerCutout({ children, outlineColor = 'ink', rotate = 0, className = '', drop = true }) {
  const filterClass =
    outlineColor === 'white'
      ? 'sticker-outline-white'
      : outlineColor === 'pink'
        ? 'sticker-outline-pink'
        : 'sticker-outline';

  return (
    <div className={`${drop ? filterClass : ''} ${className}`} style={{ transform: `rotate(${rotate}deg)` }}>
      {children}
    </div>
  );
}

/** ParallaxLayer — depth plane that drifts with mouse position. */
export function ParallaxLayer({ children, speed = 0.3, className = '' }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(useTransform(mx, [-0.5, 0.5], [-20 * speed, 20 * speed]), { stiffness: 50, damping: 20 });
  const y = useSpring(useTransform(my, [-0.5, 0.5], [-20 * speed, 20 * speed]), { stiffness: 50, damping: 20 });

  function handleMouseMove(e) {
    if (reduced) return;
    mx.set(e.clientX / window.innerWidth - 0.5);
    my.set(e.clientY / window.innerHeight - 0.5);
  }

  return (
    <motion.div ref={ref} onMouseMove={handleMouseMove} style={{ x: reduced ? 0 : x, y: reduced ? 0 : y }} className={className}>
      {children}
    </motion.div>
  );
}

/** TapeStrip — a strip of washi tape. Pure decoration; never intercepts clicks. */
export function TapeStrip({ color = 'var(--sticker-yellow)', rotate = -4, className = '', width = 96, left = 26, top = -11 }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute z-20 pointer-events-none ${className}`}
      style={{
        width,
        height: 22,
        left,
        top,
        background: `color-mix(in srgb, ${color} 62%, transparent)`,
        borderLeft: '2px dashed rgba(0,0,0,0.12)',
        borderRight: '2px dashed rgba(0,0,0,0.12)',
        transform: `rotate(${rotate}deg)`,
        animation: 'tape-sway 7s ease-in-out infinite',
      }}
    />
  );
}

/** WobbleHover — wraps a child so it springs on hover (used for cards/buttons). */
export function WobbleHover({ children, className = '', lift = -4, rotate = -0.6 }) {
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      animate={reduced ? {} : hovered ? { y: lift, rotate } : { y: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.div>
  );
}
