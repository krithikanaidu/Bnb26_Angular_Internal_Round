import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * SpillBin — tilted upload bin that pours file chips/thumbnails into the library.
 * Files fall with gravity + bounce.
 */
export function SpillBin({
  items,
  className = '',
  onDrop,
}: {
  items: { id: string; label: string; color?: string }[];
  className?: string;
  onDrop?: (id: string) => void;
}) {
  const reduced = useReducedMotion();

  return (
    <div className={`relative ${className}`} style={{ overflow: 'visible' }}>
      {/* Bin */}
      <motion.div
        className="relative"
        style={{
          transform: 'rotate(-15deg)',
          width: 160,
          height: 100,
        }}
        animate={reduced ? {} : { rotate: [-15, -12, -15] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Bin body */}
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            background: 'var(--folder-blue)',
            border: '3px solid var(--ink)',
            clipPath: 'polygon(10% 0, 90% 0, 100% 100%, 0% 100%)',
          }}
        />
        {/* Bin label */}
        <span className="absolute top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold text-white uppercase tracking-wider">
          UPLOAD
        </span>
      </motion.div>

      {/* Falling items */}
      <div className="absolute top-20 left-0 right-0" style={{ overflow: 'visible' }}>
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            className="absolute"
            style={{ left: `${20 + (i % 4) * 35}px`, top: 0 }}
            initial={reduced ? {} : { y: -50, opacity: 0, rotate: -20 }}
            animate={{ y: 60 + (i % 3) * 10, opacity: 1, rotate: (i % 2 === 0 ? 1 : -1) * (5 + i * 3) }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 12,
              delay: i * 0.15,
            }}
            onClick={() => onDrop?.(item.id)}
          >
            <div
              className="w-12 h-12 rounded-md flex items-center justify-center font-mono text-[8px] font-bold text-white"
              style={{
                background: item.color ?? 'var(--sticker-purple)',
                border: '2px solid var(--ink)',
                boxShadow: 'var(--sticker-shadow)',
              }}
            >
              {item.label.slice(0, 4).toUpperCase()}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/**
 * ParachuteDrop — stickers, hook cards, file chips fall from above with gravity,
 * bounce slightly, tilt and settle.
 */
export function ParachuteDrop({
  children,
  delay = 0,
  className = '',
  fromY = -200,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  fromY?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? {} : { y: fromY, opacity: 0, rotate: -10 }}
      animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1, rotate: 0 }}
      transition={{
        type: 'spring',
        stiffness: 150,
        damping: 10,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}
