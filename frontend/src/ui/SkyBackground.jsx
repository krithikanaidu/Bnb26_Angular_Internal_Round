import { motion } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

/**
 * SkyBackground — the marketing-page backdrop: a warm sky gradient with big
 * faint folders, spinning asterisks and strips of washi tape drifting through
 * it. Deliberately NO clouds / mountains / sunsets: the paper-studio language
 * is folders and stationery, not landscape illustration.
 */
export function SkyBackground({ className = '' }) {
  const reduced = useReducedMotion();

  return (
    <div className={`absolute inset-0 sky-gradient overflow-hidden ${className}`} aria-hidden="true">
      {/* Sun glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: 300,
          height: 300,
          right: '8%',
          top: '5%',
          background: 'radial-gradient(circle, rgba(255,210,63,0.4) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      {/* Floating folders (large, faint) */}
      {[
        { x: 10, y: 15, size: 100, dur: 8, delay: 0, rotate: -8 },
        { x: 75, y: 20, size: 80, dur: 10, delay: 1, rotate: 12 },
        { x: 20, y: 55, size: 70, dur: 9, delay: 2, rotate: -5 },
        { x: 60, y: 65, size: 90, dur: 11, delay: 0.5, rotate: 8 },
        { x: 85, y: 50, size: 60, dur: 7, delay: 3, rotate: -12 },
        { x: 45, y: 35, size: 75, dur: 12, delay: 1.5, rotate: 5 },
      ].map((f, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: `${f.x}%`, top: `${f.y}%` }}
          animate={reduced ? {} : { y: [0, -12, 0], rotate: [f.rotate, f.rotate + 3, f.rotate] }}
          transition={{ duration: f.dur, delay: f.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div
            style={{
              width: f.size,
              height: f.size * 0.75,
              background: 'linear-gradient(135deg, var(--folder-blue), var(--folder-blue-deep))',
              borderRadius: '8px 8px 6px 6px',
              opacity: 0.25,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            <div
              style={{
                width: f.size * 0.35,
                height: f.size * 0.12,
                background: 'var(--folder-blue-deep)',
                borderRadius: '4px 4px 0 0',
                marginLeft: 8,
                marginTop: -f.size * 0.1,
                opacity: 0.8,
              }}
            />
          </div>
        </motion.div>
      ))}

      {/* Asterisks */}
      {[
        { x: 5, y: 40, size: 30, dur: 6 },
        { x: 90, y: 30, size: 25, dur: 7 },
        { x: 50, y: 80, size: 35, dur: 8 },
        { x: 30, y: 85, size: 20, dur: 5 },
      ].map((a, i) => (
        <motion.svg
          key={`ast-${i}`}
          width={a.size}
          height={a.size}
          viewBox="0 0 100 100"
          className="absolute"
          style={{ left: `${a.x}%`, top: `${a.y}%`, opacity: 0.3 }}
          animate={reduced ? {} : { rotate: 360 }}
          transition={{ duration: a.dur * 3, repeat: Infinity, ease: 'linear' }}
        >
          {Array.from({ length: 8 }, (_, j) => {
            const angle = (j * Math.PI) / 4;
            return (
              <line
                key={j}
                x1={50 + Math.cos(angle) * 15}
                y1={50 + Math.sin(angle) * 15}
                x2={50 + Math.cos(angle) * 45}
                y2={50 + Math.sin(angle) * 45}
                stroke="var(--hot-pink)"
                strokeWidth="5"
                strokeLinecap="round"
              />
            );
          })}
        </motion.svg>
      ))}

      {/* Washi tape pieces */}
      {[
        { x: 15, y: 25, w: 80, rotate: -15 },
        { x: 70, y: 75, w: 60, rotate: 20 },
      ].map((w, i) => (
        <div
          key={`washi-${i}`}
          className="absolute"
          style={{
            left: `${w.x}%`,
            top: `${w.y}%`,
            width: w.w,
            height: 18,
            background: 'var(--soft-pink)',
            opacity: 0.3,
            transform: `rotate(${w.rotate}deg)`,
            borderLeft: '2px dashed rgba(0,0,0,0.1)',
            borderRight: '2px dashed rgba(0,0,0,0.1)',
          }}
        />
      ))}
    </div>
  );
}

/**
 * GridPaperBg — the everyday work-page backdrop: cream sheet with a faint
 * graph grid, so content sits on graph paper rather than on a flat void.
 */
export function GridPaperBg({ className = '' }) {
  return <div className={`absolute inset-0 bg-grid-paper ${className}`} style={{ backgroundColor: 'var(--cream)' }} aria-hidden="true" />;
}
