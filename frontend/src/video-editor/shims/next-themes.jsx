// Vite shim for `next-themes` -> tiny dark/light context backed by localStorage.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
  resolvedTheme: 'dark',
  themes: ['light', 'dark', 'system'],
});

export function ThemeProvider({ children, defaultTheme = 'dark', attribute = 'class', enableSystem = true }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('ve-theme') || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const resolvedTheme = useMemo(() => {
    if (theme === 'system' && enableSystem && typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme === 'system' ? 'dark' : theme;
  }, [theme, enableSystem]);

  useEffect(() => {
    try {
      localStorage.setItem('ve-theme', theme);
    } catch {}
    const root = document.documentElement;
    if (attribute === 'class') {
      root.classList.toggle('dark', resolvedTheme === 'dark');
      root.style.colorScheme = resolvedTheme;
    }
  }, [theme, resolvedTheme, attribute]);

  const setTheme = useCallback((t) => setThemeState(t), []);

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme, themes: ['light', 'dark', 'system'] }),
    [theme, setTheme, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
