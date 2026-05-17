/**
 * useTheme — manages dark/light mode with localStorage persistence.
 *
 * Reads the saved 'theme' key on first mount and applies it.
 * Consumers should call toggleTheme() or set setDark(bool) directly.
 *
 * Usage:
 *   const { isDark, toggleTheme } = useTheme();
 */
import { useState, useEffect, useCallback } from 'react';

function applyTheme(dark) {
  if (dark) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
}

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    // Respect OS preference if no saved preference
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  // Apply class on mount and whenever isDark changes
  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      applyTheme(next);
      return next;
    });
  }, []);

  const setDark = useCallback((dark) => {
    setIsDark(dark);
    applyTheme(dark);
  }, []);

  return {
    /** Whether dark mode is currently active */
    isDark,
    /** Toggle between dark and light mode */
    toggleTheme,
    /** Explicitly set dark (true) or light (false) mode */
    setDark,
  };
}
