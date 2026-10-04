import { useEffect, useRef, useState } from 'react';
import { useFinePointer, useReducedMotion } from './useReducedMotion';

/**
 * CustomCursor — the brand asterisk follows the mouse and swells over anything
 * clickable. Desktop-only (fine pointer) and never shown under reduced motion.
 * The native cursor is left intact; this layer is purely additive so keyboard
 * and touch users are completely unaffected.
 */
export function CustomCursor() {
  const cursorRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [interactive, setInteractive] = useState(false);

  const finePointer = useFinePointer();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!finePointer || reduced) return;

    setVisible(true);
    let raf = 0;
    let x = 0;
    let y = 0;
    let cx = 0;
    let cy = 0;

    const onMove = (e) => {
      x = e.clientX;
      y = e.clientY;
      const target = e.target;
      if (!(target instanceof Element)) return;
      setInteractive(
        target.tagName === 'BUTTON' ||
          target.tagName === 'A' ||
          target.closest('button') !== null ||
          target.closest('a') !== null ||
          target.getAttribute('role') === 'slider' ||
          target.tagName === 'INPUT'
      );
    };

    const animate = () => {
      cx += (x - cx) * 0.2;
      cy += (y - cy) * 0.2;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [finePointer, reduced]);

  if (!visible) return null;

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 z-[9999] pointer-events-none"
      style={{ willChange: 'transform' }}
      aria-hidden="true"
    >
      <svg
        width={interactive ? 28 : 18}
        height={interactive ? 28 : 18}
        viewBox="0 0 100 100"
        className="transition-all duration-150"
        style={{ opacity: 0.8 }}
      >
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
              strokeWidth="6"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </div>
  );
}
