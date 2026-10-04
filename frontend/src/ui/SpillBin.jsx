import { motion } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

/**
 * SpillBin — a tilted bin that pours file chips into the library below.
 * The chips are real file names passed in by the caller; nothing here is
 * generated. Clicking a chip forwards its id so the owner page can act on it.
 */
export function SpillBin({ items = [], className = '', onDrop }) {
  const reduced = useReducedMotion();

  return (
    <div className={`relative ${className}`} style={{ overflow: 'visible' }}>
      <motion.div
        className="relative"
        style={{ transform: 'rotate(-15deg)', width: 160, height: 100 }}
        animate={reduced ? {} : { rotate: [-15, -12, -15] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            background: 'var(--folder-blue)',
            border: '3px solid var(--ink)',
            clipPath: 'polygon(10% 0, 90% 0, 100% 100%, 0% 100%)',
          }}
        />
        <span className="absolute top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold text-white uppercase tracking-wider">
          UPLOAD
        </span>
      </motion.div>

      <div className="absolute top-20 left-0 right-0" style={{ overflow: 'visible' }}>
        {items.map((item, i) => (
          <motion.button
            key={item.id}
            type="button"
            className="absolute"
            style={{ left: `${20 + (i % 4) * 35}px`, top: 0 }}
            initial={reduced ? {} : { y: -50, opacity: 0, rotate: -20 }}
            animate={{ y: 60 + (i % 3) * 10, opacity: 1, rotate: (i % 2 === 0 ? 1 : -1) * (5 + i * 3) }}
            transition={{ type: 'spring', stiffness: 200, damping: 12, delay: i * 0.15 }}
            onClick={() => onDrop?.(item.id)}
            title={item.label}
            aria-label={item.label}
          >
            <span
              className="w-12 h-12 rounded-md flex items-center justify-center font-mono text-[8px] font-bold text-white"
              style={{
                background: item.color ?? 'var(--sticker-purple)',
                border: '2px solid var(--ink)',
                boxShadow: 'var(--sticker-shadow)',
              }}
            >
              {item.label.slice(0, 4).toUpperCase()}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/**
 * ParachuteDrop — content falls in from above, settles, and bounces.
 */
export function ParachuteDrop({ children, delay = 0, className = '', fromY = -200 }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? {} : { y: fromY, opacity: 0, rotate: -10 }}
      animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 150, damping: 10, delay }}
    >
      {children}
    </motion.div>
  );
}
