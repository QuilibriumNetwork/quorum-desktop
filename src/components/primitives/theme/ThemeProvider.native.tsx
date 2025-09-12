import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [theme, setThemeState] = useState<Theme>('system');
  const [accent, setAccentState] = useState<AccentColor>('blue');
  const [isLoading, setIsLoading] = useState(true);

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

  // Load persisted values on mount
  useEffect(() => {
    const loadPersistedValues = async () => {
      try {
        const savedTheme = (await AsyncStorage.getItem(
          'theme'
        )) as Theme | null;
        const savedAccent = (await AsyncStorage.getItem(
          'accent-color'
        )) as AccentColor | null;

        if (savedTheme) {
          setThemeState(savedTheme);
        }
        if (savedAccent) {
          setAccentState(savedAccent);
        }
      } catch (error) {
        console.warn('Failed to load theme settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPersistedValues();
  }, []);

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

  // Theme setter for React Native with persistence
  const setTheme = async (value: Theme) => {
    setThemeState(value);
    try {
      await AsyncStorage.setItem('theme', value);
    } catch (error) {
      console.warn('Failed to persist theme:', error);
    }
  };

  // Accent setter for React Native with persistence
  const setAccent = async (value: AccentColor) => {
    setAccentState(value);
    try {
      await AsyncStorage.setItem('accent-color', value);
    } catch (error) {
      console.warn('Failed to persist accent color:', error);
    }
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

  // Don't render until persisted values are loaded
  if (isLoading) {
    return null; // You could return a loading screen here
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
