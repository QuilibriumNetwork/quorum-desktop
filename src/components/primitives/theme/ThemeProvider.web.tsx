import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Theme, AccentColor, ThemeContextType } from './ThemeProvider';
import { getColors } from './colors';

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
  accent: 'blue',
  setAccent: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const ACCENT_COLORS: AccentColor[] = [
  'blue',
  'purple',
  'fuchsia',
  'orange',
  'green',
  'yellow',
];

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [accent, setAccentState] = useState<AccentColor>('blue');

  // we need to keep track of the resolved theme because the theme
  // can be set to system, but the resolved theme is the actual theme
  // that is applied to the document.
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  const applyTheme = (value: Theme) => {
    const html = document.documentElement;
    html.classList.remove('light', 'dark');

    if (value === 'system') {
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;
      html.classList.add(prefersDark ? 'dark' : 'light');
      setResolvedTheme(prefersDark ? 'dark' : 'light');
    } else {
      html.classList.add(value);
      setResolvedTheme(value);
    }
  };

  const setTheme = (value: Theme) => {
    setThemeState(value);
    localStorage.setItem('theme', value);
    applyTheme(value);
  };

  const applyAccent = (value: AccentColor) => {
    const html = document.documentElement;
    // Remove all accent classes
    ACCENT_COLORS.forEach((color) => {
      html.classList.remove(`accent-${color}`);
    });
    // Add new accent class
    html.classList.add(`accent-${value}`);
  };

  const setAccent = (value: AccentColor) => {
    setAccentState(value);
    localStorage.setItem('accent-color', value);
    applyAccent(value);
  };

  useEffect(() => {
    // Load saved theme
    const savedTheme = (localStorage.getItem('theme') as Theme) || 'system';
    setTheme(savedTheme); // this will call applyTheme internally

    // Load saved accent
    const savedAccent =
      (localStorage.getItem('accent-color') as AccentColor) || 'blue';
    setAccent(savedAccent); // this will call applyAccent internally

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (theme === 'system') applyTheme('system');
    };

    mediaQuery.addEventListener('change', onSystemChange);
    return () => mediaQuery.removeEventListener('change', onSystemChange);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, resolvedTheme, accent, setAccent }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
