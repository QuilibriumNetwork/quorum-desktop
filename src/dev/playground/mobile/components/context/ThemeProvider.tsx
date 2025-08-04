import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (value: Theme) => void;
  resolvedTheme: Theme;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<Theme>('system');

  // we need to keep track of the resolved theme because the theme
  // can be set to system, but the resolved theme is the actual theme
  // that is applied to the document.
  const [resolvedTheme, setResolvedTheme] = useState<Theme>('system');

  const applyTheme = (value: Theme) => {
    // Check if we're in a web environment
    if (typeof document !== 'undefined') {
      // Web implementation
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
    } else {
      // React Native implementation
      if (value === 'system') {
        // For now, default to light for system theme in React Native
        // In a real app, you'd use Appearance.getColorScheme() from react-native
        setResolvedTheme('light');
      } else {
        setResolvedTheme(value);
      }
    }
  };

  const setTheme = (value: Theme) => {
    console.log('🔥 ThemeProvider - setTheme ENTRY with:', value);
    console.log('🔥 ThemeProvider - Current theme state before update:', theme);
    
    try {
      console.log('🔥 ThemeProvider - Calling setThemeState...');
      setThemeState(value);
      console.log('🔥 ThemeProvider - setThemeState called successfully');
      
      // Save to storage (cross-platform)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('theme', value);
        console.log('🔥 ThemeProvider - Saved to localStorage');
      }
      // In React Native, you'd use AsyncStorage here
      
      console.log('🔥 ThemeProvider - Calling applyTheme...');
      applyTheme(value);
      console.log('🔥 ThemeProvider - applyTheme completed');
      
      console.log('🔥 ThemeProvider - setTheme function EXIT');
    } catch (error) {
      console.error('🚨 ThemeProvider - setTheme ERROR:', error);
    }
  };

  useEffect(() => {
    // Load saved theme (cross-platform)
    let saved: Theme = 'system';
    if (typeof localStorage !== 'undefined') {
      saved = (localStorage.getItem('theme') as Theme) || 'system';
    }
    setTheme(saved); // this will call applyTheme internally

    // Web-only initialization
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      // Initialize accent color
      const savedAccent = localStorage.getItem('accent-color') || 'blue';
      document.documentElement.classList.add(`accent-${savedAccent}`);

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const onSystemChange = () => {
        if (saved === 'system') applyTheme('system');
      };

      mediaQuery.addEventListener('change', onSystemChange);
      return () => mediaQuery.removeEventListener('change', onSystemChange);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
