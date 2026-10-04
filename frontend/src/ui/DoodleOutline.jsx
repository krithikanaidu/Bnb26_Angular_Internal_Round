import { motion } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

/**
 * DoodleOutline — hand-drawn pink SVG keylines that animate on as if someone
 * were sketching them over the page. Used to circle a number, underline a
 * headline, or point at a control.
 *
 * Circle / underline / arrow / scribble / sunglasses / asterisk.
 */
export function DoodleOutline({
  type = 'circle',
  className = '',
  color = 'var(--hot-pink)',
  animate = true,
  width = 120,
  height = 80,
}) {
  const reduced = useReducedMotion();
  const dashClass = animate && !reduced ? 'doodle-path' : '';

  const paths = {
    circle: (
      <path
        d="M60 8 Q95 10 98 40 Q100 65 80 72 Q50 78 25 70 Q5 62 4 38 Q6 12 35 8 Q48 6 60 8"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="4 3"
        className={dashClass}
      />
    ),
    underline: (
      <path
        d="M5 40 Q30 35 60 38 Q90 42 115 36"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        className={dashClass}
      />
    ),
    arrow: (
      <path
        d="M5 50 Q30 20 80 30 L70 20 M80 30 L72 42"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={dashClass}
      />
    ),
    scribble: (
      <path
        d="M10 40 Q20 20 35 35 Q50 50 65 30 Q80 15 95 35 Q105 45 110 38"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        className={dashClass}
      />
    ),
    sunglasses: (
      <g fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" className={dashClass}>
        <ellipse cx="35" cy="35" rx="22" ry="16" />
        <ellipse cx="85" cy="35" rx="22" ry="16" />
        <line x1="57" y1="33" x2="63" y2="33" />
        <path d="M13 25 Q15 18 20 22" />
        <path d="M107 25 Q105 18 100 22" />
        <path d="M25 30 Q35 28 45 32" strokeDasharray="2 2" opacity="0.6" />
        <path d="M75 30 Q85 28 95 32" strokeDasharray="2 2" opacity="0.6" />
      </g>
    ),
    asterisk: <AsteriskBurst color={color} animate={animate && !reduced} />,
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 80"
      fill="none"
      className={className}
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      {paths[type] ?? paths.circle}
    </svg>
  );
}

/** AsteriskBurst — slowly rotating 8-point pink asterisk. The brand mark. */
export function AsteriskBurst({ color = 'var(--hot-pink)', size = 40, animate = true, className = '' }) {
  const reduced = useReducedMotion();

  const points = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI) / 4;
    points.push(
      <line
        key={i}
        x1={50 + Math.cos(angle) * 10}
        y1={50 + Math.sin(angle) * 10}
        x2={50 + Math.cos(angle) * 45}
        y2={50 + Math.sin(angle) * 45}
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />,
    );
  }

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      animate={animate && !reduced ? { rotate: 360 } : {}}
      transition={animate && !reduced ? { duration: 12, repeat: Infinity, ease: 'linear' } : {}}
    >
      {points}
    </motion.svg>
  );
}
