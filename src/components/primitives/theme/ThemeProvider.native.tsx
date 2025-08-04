import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import type { Theme, AccentColor } from './colors';
import type { PrimitivesThemeContextType } from './ThemeProvider';
import { getColors } from './colors';

const ThemeContext = createContext<PrimitivesThemeContextType>({
  theme: 'light',
  accent: 'blue',
  resolvedTheme: 'light',
  setTheme: () => {},
  setAccent: () => {},
  colors: getColors('light', 'blue'),
  getColor: () => '#0287f2',
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('light');
  const [accent, setAccentState] = useState<AccentColor>('blue');
  
  // React Native system theme detection
  const systemColorScheme = useColorScheme();
  
  // Helper function to resolve 'system' theme to actual theme
  const resolveTheme = (themeValue: Theme): 'light' | 'dark' => {
    if (themeValue === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeValue;
  };
  
  // Resolved theme state - always 'light' or 'dark', never 'system'
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => 
    resolveTheme(theme)
  );

  // Update resolved theme when theme or system preference changes
  useEffect(() => {
    const actualTheme = resolveTheme(theme);
    setResolvedTheme(actualTheme);
  }, [theme, systemColorScheme]);

  // Get colors for current resolved theme and accent
  const colors = getColors(resolvedTheme, accent);

  // Helper function for accessing colors by path
  const getColor = (path: string): string => {
    const pathArray = path.split('.');
    let current: any = colors;

    for (const key of pathArray) {
      current = current[key];
      if (current === undefined) {
        console.warn(`Color path "${path}" not found`);
        return colors.accent.DEFAULT;
      }
    }

    return current;
  };

  // Theme setter for React Native
  const setTheme = (value: Theme) => {
    setThemeState(value);
    // No localStorage in React Native - state management only
  };

  // Accent setter for React Native
  const setAccent = (value: AccentColor) => {
    setAccentState(value);
    // No localStorage in React Native - state management only
  };

  const value: PrimitivesThemeContextType = {
    theme,
    accent,
    resolvedTheme,
    setTheme,
    setAccent,
    colors,
    getColor,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};