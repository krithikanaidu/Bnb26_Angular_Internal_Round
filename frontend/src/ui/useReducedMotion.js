import { useEffect, useState } from 'react';

/**
 * useReducedMotion — live `prefers-reduced-motion` subscription.
 *
 * Every animated component in this app checks this before it starts a
 * transform/opacity loop, so reduced-motion users get a static (but fully
 * usable and fully legible) interface rather than a slowed-down one.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setReduced(e.matches);
    setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/** useFinePointer — true for mouse/trackpad. Gates the custom cursor. */
export function useFinePointer() {
  const [fine, setFine] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(pointer: fine)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: fine)');
    const handler = (e) => setFine(e.matches);
    setFine(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return fine;
}
