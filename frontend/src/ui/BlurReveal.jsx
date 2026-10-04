import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from './useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

/**
 * BlurReveal — content arrives out of focus and snaps sharp as it enters the
 * viewport. Scroll-scrubbed so it also re-blurs on the way back up, which
 * makes long pages feel like a physical sheet being moved under a lamp.
 */
export function BlurReveal({ children, className = '', as: Tag = 'div', delay = 0 }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { filter: 'blur(8px)', opacity: 0.2 },
        {
          filter: 'blur(0px)',
          opacity: 1,
          duration: 0.8,
          delay,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            end: 'bottom 15%',
            toggleActions: 'play none none none',
          },
        },
      );
    }, el);

    return () => ctx.revert();
  }, [delay, reduced]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/**
 * StaggerIn — the container version: children fade + rise in sequence.
 * Used on page headers and grid rows so lists feel assembled rather than dumped.
 */
export function StaggerIn({ children, className = '', stagger = 0.06, delay = 0 }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.children,
        { opacity: 0, y: 22, rotate: -0.6 },
        {
          opacity: 1,
          y: 0,
          rotate: 0,
          duration: 0.65,
          delay,
          stagger,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none none',
          },
        },
      );
    }, el);

    return () => ctx.revert();
  }, [stagger, delay, reduced]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
