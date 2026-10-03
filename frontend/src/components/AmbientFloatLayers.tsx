import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type FloatingItem = {
  id: number;
  x: number; // percentage
  y: number; // percentage
  size: number;
  duration: number;
  delay: number;
  type: 'folder' | 'asterisk' | 'washi' | 'scribble' | 'sticker';
  rotate: number;
};

/**
 * AmbientFloatLayers — 3 depth layers of background elements drifting slowly.
 * Big blue folders, pink asterisks, washi tape, scribble blobs, tiny stickers.
 * Behind content, never hurting readability.
 */
export function AmbientFloatLayers({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();

  const layers: FloatingItem[][] = useMemo(
    () => [
      // Layer 1: far (large, slow, faint)
      generateItems(5, 'folder', 80, 120, 25, 35),
      generateItems(4, 'asterisk', 40, 70, 20, 30),
      // Layer 2: mid (medium, medium speed, more visible)
      generateItems(4, 'washi', 60, 90, 15, 25),
      generateItems(3, 'scribble', 30, 50, 10, 20),
      // Layer 3: near (small, faster, most visible)
      generateItems(5, 'sticker', 20, 40, 8, 15),
    ],
    []
  );

  const opacities = [0.12, 0.2, 0.35];

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {layers.map((layer, li) => (
        <div key={li} className="absolute inset-0" style={{ opacity: opacities[li] }}>
          {layer.map((item) => (
            <FloatingItemEl key={item.id} item={item} reduced={reduced} />
          ))}
        </div>
      ))}
    </div>
  );
}

function generateItems(
  count: number,
  type: FloatingItem['type'],
  minSize: number,
  maxSize: number,
  minDur: number,
  maxDur: number
): FloatingItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${type}-${i}` as unknown as number,
    x: Math.random() * 90 + 5,
    y: Math.random() * 90 + 5,
    size: minSize + Math.random() * (maxSize - minSize),
    duration: minDur + Math.random() * (maxDur - minDur),
    delay: Math.random() * 5,
    type,
    rotate: Math.random() * 60 - 30,
  }));
}

function FloatingItemEl({ item, reduced }: { item: FloatingItem; reduced: boolean }) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${item.x}%`,
    top: `${item.y}%`,
  };

  const animationProps = reduced
    ? {}
    : {
        y: [0, -15, 0],
        x: [0, 10, 0],
        rotate: [item.rotate, item.rotate + 5, item.rotate],
      };

  return (
    <motion.div
      style={style}
      animate={animationProps}
      transition={{
        duration: item.duration,
        delay: item.delay,
        repeat: Infinity,
        ease: 'easeInOut' as const,
      }}
    >
      <ItemShape type={item.type} size={item.size} rotate={item.rotate} />
    </motion.div>
  );
}

function ItemShape({ type, size, rotate }: { type: FloatingItem['type']; size: number; rotate: number }) {
  switch (type) {
    case 'folder':
      return (
        <div
          style={{
            width: size,
            height: size * 0.75,
            background: 'linear-gradient(135deg, var(--folder-blue), var(--folder-blue-deep))',
            borderRadius: '8px 8px 6px 6px',
            rotate: `${rotate}deg`,
            opacity: 0.6,
          }}
        />
      );
    case 'asterisk':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" style={{ rotate: `${rotate}deg` }}>
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i * Math.PI) / 4;
            return (
              <line
                key={i}
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
        </svg>
      );
    case 'washi':
      return (
        <div
          style={{
            width: size * 1.5,
            height: size * 0.3,
            background: 'var(--soft-pink)',
            opacity: 0.5,
            rotate: `${rotate}deg`,
            borderLeft: '3px dashed rgba(0,0,0,0.1)',
            borderRight: '3px dashed rgba(0,0,0,0.1)',
          }}
        />
      );
    case 'scribble':
      return (
        <svg width={size} height={size * 0.6} viewBox="0 0 100 60" style={{ rotate: `${rotate}deg` }}>
          <path
            d="M10 30 Q25 10 40 30 Q55 50 70 25 Q85 5 95 30"
            fill="none"
            stroke="var(--brand-orange)"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.5"
          />
        </svg>
      );
    case 'sticker':
      return (
        <div
          style={{
            width: size,
            height: size,
            background: 'var(--sticker-yellow)',
            borderRadius: '4px',
            rotate: `${rotate}deg`,
            opacity: 0.7,
            border: '2px solid var(--ink)',
          }}
        />
      );
    default:
      return null;
  }
}
