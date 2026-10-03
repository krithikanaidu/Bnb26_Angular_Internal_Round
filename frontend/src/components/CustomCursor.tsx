import { useEffect, useRef, useState } from 'react';

/**
 * CustomCursor — asterisk cursor that grows on interactive elements.
 * Only activates on devices with fine pointer (desktop).
 */
export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(coarse-pointer)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setVisible(true);
    let raf = 0;
    let x = 0;
    let y = 0;
    let cx = 0;
    let cy = 0;

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      const target = e.target as HTMLElement;
      setInteractive(
        target.tagName === 'BUTTON' ||
          target.tagName === 'A' ||
          target.closest('button') !== null ||
          target.closest('a') !== null ||
          target.getAttribute('role') === 'slider'
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
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 z-[9999] pointer-events-none transition-transform duration-150"
      style={{ willChange: 'transform' }}
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
