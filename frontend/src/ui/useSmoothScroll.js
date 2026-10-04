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

    // Native hash jumps leave Lenis's internal position stale, so the next
    // raf snaps the page back. Intercept anchor clicks and route them
    // through lenis.scrollTo instead.
    const onAnchorClick = (e) => {
      const link = e.target.closest?.('a[href^="#"]');
      if (!link) return;
      const id = link.getAttribute('href').slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { offset: -84, duration: 1.1 });
      else el.scrollIntoView({ behavior: 'smooth' });
    };
    document.addEventListener('click', onAnchorClick);

    const onScroll = () => ScrollTrigger.update();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      document.removeEventListener('click', onAnchorClick);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      lenis?.destroy();
      lenis = null;
    };
  }, [reduced]);
}
