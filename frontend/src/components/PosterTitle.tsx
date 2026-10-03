import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * PosterTitle — ultra-bold neo-grotesk word overlapped by an elegant swash script.
 * The script word sits ON the bold word with partial overlap.
 * Optional letter-by-letter animation.
 */
export function PosterTitle({
  boldText,
  scriptText,
  boldClassName = '',
  scriptClassName = '',
  className = '',
  animate = false,
  extruded = false,
  extrudedColor = 'blue',
  delay = 0,
}: {
  boldText: string;
  scriptText: string;
  boldClassName?: string;
  scriptClassName?: string;
  className?: string;
  animate?: boolean;
  extruded?: boolean;
  extrudedColor?: 'blue' | 'pink';
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const boldRef = useRef<HTMLHeadingElement>(null);
  const scriptRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!animate || reduced) return;
    const el = boldRef.current;
    if (!el) return;

    const letters = boldText.split('');
    const baseDelay = delay * 1000;
    el.innerHTML = letters
      .map(
        (l) =>
          `<span style="display:inline-block;opacity:0;transform:translateY(20px) rotate(-5deg)">${
            l === ' ' ? '&nbsp;' : l
          }</span>`
      )
      .join('');

    const spans = el.querySelectorAll('span');
    spans.forEach((s, i) => {
      setTimeout(() => {
        s.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        s.style.opacity = '1';
        s.style.transform = 'translateY(0) rotate(0deg)';
      }, baseDelay + i * 60);
    });

    if (scriptRef.current) {
      setTimeout(
        () => {
          if (scriptRef.current) {
            scriptRef.current.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            scriptRef.current.style.opacity = '1';
            scriptRef.current.style.transform = 'translate(-50%, 0) scale(1)';
          }
        },
        baseDelay + letters.length * 60 + 200
      );
    }
  }, [animate, boldText, reduced, delay]);

  return (
    <div className={`relative ${className}`}>
      <h1
        ref={boldRef}
        className={`font-display font-black tracking-tighter leading-none ${boldClassName} ${
          extruded ? (extrudedColor === 'pink' ? 'extruded-text-pink' : 'extruded-text') : ''
        }`}
      >
        {boldText}
      </h1>
      <span
        ref={scriptRef}
        className={`absolute left-1/2 font-script leading-none ${scriptClassName}`}
        style={{
          transform: animate && !reduced ? 'translate(-50%, 20px) scale(0.8)' : 'translate(-50%, 0)',
          opacity: animate && !reduced ? 0 : 1,
          top: '30%',
          pointerEvents: 'none',
        }}
      >
        {scriptText}
      </span>
    </div>
  );
}

/**
 * ExtrudedTitle — 3D extruded text using stacked text-shadows.
 */
export function ExtrudedTitle({
  text,
  className = '',
  color = 'blue',
}: {
  text: string;
  className?: string;
  color?: 'blue' | 'pink' | 'orange';
}) {
  const shadowMap = {
    blue: 'var(--folder-blue-deep)',
    pink: 'var(--brand-orange)',
    orange: 'var(--hot-pink)',
  };
  const c = shadowMap[color];

  return (
    <span
      className={`font-display font-black tracking-tighter leading-none ${className}`}
      style={{
        textShadow: `1px 1px 0 ${c},2px 2px 0 ${c},3px 3px 0 ${c},4px 4px 0 ${c},5px 5px 0 ${c},6px 6px 0 ${c},7px 7px 0 ${c},8px 8px 12px rgba(0,0,0,0.3)`,
      }}
    >
      {text}
    </span>
  );
}

/**
 * SectionLabel — condensed serif numbered label ("01 / Dashboard") with lip-mark glyph.
 */
export function SectionLabel({
  number,
  label,
  className = '',
}: {
  number: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-2 font-serif font-bold uppercase tracking-widest text-sm ${className}`}>
      <span className="font-mono text-xs opacity-60">{number}</span>
      <span className="w-8 h-px bg-current opacity-30" />
      <span>{label.replace(/i/gi, '✷')}</span>
    </div>
  );
}
