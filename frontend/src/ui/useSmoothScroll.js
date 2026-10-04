import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from './useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

/**
 * useSmoothScroll — keeps GSAP's ScrollTrigger in sync with native scroll
 * and hands scrolling to Lenis for the paper-studio inertia feel.
 *
 * Skipped entirely under reduced-motion (Lenis smooths and ScrollTrigger's
 * scrub adds perceived motion), so those users get plain 1:1 scrolling.
 */
export function useSmoothScroll() {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (typeof window === 'undefined') return;

    let lenis = null;

    // Lenis is a progressive enhancement — if the import fails the app still
    // scrolls perfectly well with the native scroller.
    import('lenis')
      .then(({ default: Lenis }) => {
        if (!Lenis) return;
        lenis = new Lenis({
          duration: 1.05,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          // Stop Lenis from fighting the editor's own wheel handling.
          autoRaf: false,
        });
        lenis.on('scroll', ScrollTrigger.update);
      })
      .catch(() => {
        lenis = null;
      });

    let raf = 0;
    const loop = (time) => {
      lenis?.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onScroll = () => ScrollTrigger.update();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      lenis?.destroy();
      lenis = null;
    };
  }, [reduced]);
}
