import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('medsync-theme') as Theme | null;
    return stored ?? 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('medsync-theme', theme);
  }, [theme]);

  return { theme, setTheme, toggle: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')) };
}
