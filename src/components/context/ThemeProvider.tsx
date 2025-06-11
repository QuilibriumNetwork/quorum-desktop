import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (value: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('system');

  const applyTheme = (value: Theme) => {
    const html = document.documentElement;
    html.classList.remove('light', 'dark');

    if (value === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      html.classList.add(value);
    }
  };

  const setTheme = (value: Theme) => {
    setThemeState(value);
    localStorage.setItem('theme', value);
    applyTheme(value);
  };

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as Theme) || 'system';
    setTheme(saved); // this will call applyTheme internally

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (saved === 'system') applyTheme('system');
    };

    mediaQuery.addEventListener('change', onSystemChange);
    return () => mediaQuery.removeEventListener('change', onSystemChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
