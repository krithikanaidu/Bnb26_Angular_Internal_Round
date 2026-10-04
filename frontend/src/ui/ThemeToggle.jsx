import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'bb-theme';

/**
 * ThemeToggle — flips the whole app between the light "paper" surface and the
 * dark "night desk" surface by setting `data-bb-theme` on <html>, which the
 * theme swaps at the token level. Every accent stays the same; only the
 * surfaces change, so nothing on screen is recoloured into a new meaning.
 */
export function ThemeToggle({ className = '' }) {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.setAttribute('data-bb-theme', 'dark');
    else root.removeAttribute('data-bb-theme');
    try {
      window.localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    } catch {
      /* private mode — the toggle still works for this session */
    }
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to paper theme' : 'Switch to night-desk theme'}
      aria-pressed={dark}
      title={dark ? 'Paper theme' : 'Night desk theme'}
      className={`!p-1.5 !rounded-lg ghost ${className}`}
    >
      {dark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  );
}
