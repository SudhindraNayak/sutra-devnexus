import { createContext, useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings } from '../db/settings';

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setTheme(s.theme || 'dark');
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.setAttribute('data-theme', theme);
    saveSettings({ theme });
  }, [theme, loaded]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
