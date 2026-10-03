import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type AvatarVariant =
  | 'bob' | 'glasses' | 'ponytail' | 'braids' | 'buzz' | 'sidepart'
  | 'curly' | 'topknot' | 'afro' | 'mohawk' | 'waves' | 'beanie';

/**
 * InkAvatar — bold black-ink flat avatar with thick outlines, dot cheeks, minimal faces.
 * Original inline SVG. Blinks and tilts on hover.
 */
export function InkAvatar({
  variant = 'bob',
  size = 80,
  className = '',
  name,
}: {
  variant?: AvatarVariant;
  size?: number;
  className?: string;
  name?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={className}
      whileHover={reduced ? {} : { rotate: [-2, 2, -1, 0], transition: { duration: 0.6 } }}
      title={name}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        {/* Face */}
        <ellipse cx="50" cy="52" rx="26" ry="30" fill="#F4C2A0" stroke="#141414" strokeWidth="2.5" />
        {/* Hair renders behind face top */}
        <HairSVG variant={variant} />
        {/* Cheeks */}
        <circle cx="38" cy="58" r="3" fill="#EE2B6C" opacity="0.5" />
        <circle cx="62" cy="58" r="3" fill="#EE2B6C" opacity="0.5" />
        {/* Eyes (with blink animation via CSS) */}
        <Eyes reduced={reduced} />
        {/* Mouth */}
        <path d="M44 66 Q50 70 56 66" stroke="#141414" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    </motion.div>
  );
}

function Eyes({ reduced }: { reduced: boolean }) {
  if (reduced) {
    return (
      <>
        <ellipse cx="42" cy="50" rx="2.5" ry="2.5" fill="#141414" />
        <ellipse cx="58" cy="50" rx="2.5" ry="2.5" fill="#141414" />
      </>
    );
  }
  return (
    <g>
      <ellipse cx="42" cy="50" rx="2.5" ry="2.5" fill="#141414">
        <animate attributeName="ry" values="2.5;2.5;0.3;2.5;2.5" dur="4s" repeatCount="indefinite" keyTimes="0;0.85;0.9;0.95;1" />
      </ellipse>
      <ellipse cx="58" cy="50" rx="2.5" ry="2.5" fill="#141414">
        <animate attributeName="ry" values="2.5;2.5;0.3;2.5;2.5" dur="4s" repeatCount="indefinite" keyTimes="0;0.85;0.9;0.95;1" />
      </ellipse>
    </g>
  );
}

function HairSVG({ variant }: { variant: AvatarVariant }) {
  const stroke = '#141414';
  const sw = 2.5;

  switch (variant) {
    case 'bob':
      return (
        <path d="M24 42 Q24 18 50 18 Q76 18 76 42 L76 56 Q70 48 65 46 L35 46 Q30 48 24 56 Z" fill="#141414" stroke={stroke} strokeWidth={sw} />
      );
    case 'glasses':
      return (
        <>
          <path d="M26 40 Q26 16 50 16 Q74 16 74 40 L74 50 Q68 44 64 42 L36 42 Q32 44 26 50 Z" fill="#141414" stroke={stroke} strokeWidth={sw} />
          <rect x="36" y="46" width="10" height="8" rx="2" fill="none" stroke={stroke} strokeWidth="2" />
          <rect x="54" y="46" width="10" height="8" rx="2" fill="none" stroke={stroke} strokeWidth="2" />
          <line x1="46" y1="50" x2="54" y2="50" stroke={stroke} strokeWidth="2" />
        </>
      );
    case 'ponytail':
      return (
        <>
          <path d="M72 30 Q80 45 76 70 Q74 78 70 75 Q74 55 68 42 Z" fill="#141414" stroke={stroke} strokeWidth={sw} />
          <path d="M26 40 Q26 18 50 18 Q74 18 74 40 L74 48 Q68 42 64 40 L36 40 Q32 42 26 48 Z" fill="#141414" stroke={stroke} strokeWidth={sw} />
        </>
      );
    case 'braids':
      return (
        <>
          <path d="M26 40 Q26 18 50 18 Q74 18 74 40 L74 48 Q68 42 64 40 L36 40 Q32 42 26 48 Z" fill="#141414" stroke={stroke} strokeWidth={sw} />
          {/* Braids with bows */}
          <path d="M22 44 Q18 55 22 66 Q26 75 22 80" fill="none" stroke={stroke} strokeWidth="3" />
          <path d="M78 44 Q82 55 78 66 Q74 75 78 80" fill="none" stroke={stroke} strokeWidth="3" />
          <path d="M18 44 L26 44 L22 50 Z" fill="#EE2B6C" stroke={stroke} strokeWidth="1.5" />
          <path d="M74 44 L82 44 L78 50 Z" fill="#EE2B6C" stroke={stroke} strokeWidth="1.5" />
        </>
      );
    case 'buzz':
      return (
        <path d="M28 40 Q28 22 50 22 Q72 22 72 40 L72 44 Q66 40 62 39 L38 39 Q34 40 28 44 Z" fill="#2a2a2a" stroke={stroke} strokeWidth={sw} />
      );
    case 'sidepart':
      return (
        <path d="M26 42 Q26 18 50 18 Q74 18 74 42 L74 52 Q68 44 60 42 Q55 38 50 40 Q42 44 34 48 Q30 50 26 52 Z" fill="#141414" stroke={stroke} strokeWidth={sw} />
      );
    case 'curly':
      return (
        <g fill="#141414" stroke={stroke} strokeWidth="1.5">
          <circle cx="30" cy="30" r="8" />
          <circle cx="42" cy="22" r="8" />
          <circle cx="56" cy="22" r="8" />
          <circle cx="68" cy="28" r="8" />
          <circle cx="74" cy="38" r="7" />
          <circle cx="26" cy="40" r="7" />
          <circle cx="36" cy="38" r="6" />
          <circle cx="62" cy="38" r="6" />
        </g>
      );
    case 'topknot':
      return (
        <>
          <circle cx="50" cy="14" r="8" fill="#141414" stroke={stroke} strokeWidth={sw} />
          <path d="M28 42 Q28 22 50 22 Q72 22 72 42 L72 48 Q66 42 62 40 L38 40 Q34 42 28 48 Z" fill="#141414" stroke={stroke} strokeWidth={sw} />
        </>
      );
    case 'afro':
      return (
        <circle cx="50" cy="32" r="26" fill="#141414" stroke={stroke} strokeWidth={sw} />
      );
    case 'mohawk':
      return (
        <>
          <path d="M44 8 L50 4 L56 8 L54 38 L46 38 Z" fill="#141414" stroke={stroke} strokeWidth={sw} />
          <path d="M30 44 Q30 38 40 38 L60 38 Q70 38 70 44 L70 48 Q64 44 60 42 L40 42 Q36 44 30 48 Z" fill="#141414" stroke={stroke} strokeWidth={sw} />
        </>
      );
    case 'waves':
      return (
        <path d="M26 38 Q30 26 38 30 Q44 22 50 28 Q56 22 62 30 Q70 26 74 38 L74 44 Q68 40 62 39 L38 39 Q32 40 26 44 Z" fill="#141414" stroke={stroke} strokeWidth={sw} />
      );
    case 'beanie':
      return (
        <>
          <path d="M26 38 Q26 20 50 20 Q74 20 74 38 L74 40 L26 40 Z" fill="#8E2DA8" stroke={stroke} strokeWidth={sw} />
          <rect x="26" y="38" width="48" height="6" fill="#6B2080" stroke={stroke} strokeWidth="2" />
          <circle cx="50" cy="16" r="5" fill="#FFD23F" stroke={stroke} strokeWidth="2" />
        </>
      );
    default:
      return null;
  }
}
