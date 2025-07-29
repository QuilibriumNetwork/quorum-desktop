import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Theme, AccentColor } from './colors';
import { getColors } from './colors';

// Cross-platform theme context interface
interface CrossPlatformThemeContextType {
  // Theme state
  theme: Theme;
  accent: AccentColor;
  resolvedTheme: Theme;

  // Theme setters
  setTheme: (value: Theme) => void;
  setAccent: (value: AccentColor) => void;

  // Color access for React Native
  colors: ReturnType<typeof getColors>;
  getColor: (path: string) => string;
}

const CrossPlatformThemeContext = createContext<CrossPlatformThemeContextType>({
  theme: 'light',
  accent: 'blue',
  resolvedTheme: 'light',
  setTheme: () => {},
  setAccent: () => {},
  colors: getColors('light', 'blue'),
  getColor: () => '#0287f2',
});

export const useCrossPlatformTheme = () =>
  useContext(CrossPlatformThemeContext);

interface CrossPlatformThemeProviderProps {
  children: React.ReactNode;
  // For React Native: disable web-specific features
  disableWebFeatures?: boolean;
}

export const CrossPlatformThemeProvider: React.FC<
  CrossPlatformThemeProviderProps
> = ({ children, disableWebFeatures = false }) => {
  const [theme, setThemeState] = useState<Theme>('light');
  const [accent, setAccentState] = useState<AccentColor>('blue');
  const [resolvedTheme, setResolvedTheme] = useState<Theme>('light');

  // Get colors for current theme and accent
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

  // Web-specific theme application (CSS classes)
  const applyWebTheme = (themeValue: Theme) => {
    if (disableWebFeatures || typeof document === 'undefined') return;

    const html = document.documentElement;
    html.classList.remove('light', 'dark');

    if (themeValue === 'light' || themeValue === 'dark') {
      html.classList.add(themeValue);
      setResolvedTheme(themeValue);
    }
  };

  // Web-specific accent application (CSS classes)
  const applyWebAccent = (accentValue: AccentColor) => {
    if (disableWebFeatures || typeof document === 'undefined') return;

    const html = document.documentElement;

    // Remove all accent classes
    const accentColors: AccentColor[] = [
      'blue',
      'purple',
      'fuchsia',
      'orange',
      'green',
      'yellow',
    ];
    accentColors.forEach((color) => {
      html.classList.remove(`accent-${color}`);
    });

    // Add new accent class
    html.classList.add(`accent-${accentValue}`);
  };

  // Theme setter that works for both platforms
  const setTheme = (value: Theme) => {
    setThemeState(value);

    // Web: Apply CSS classes and localStorage
    if (!disableWebFeatures) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('theme', value);
      }
      applyWebTheme(value);
    } else {
      // React Native: Just update state
      setResolvedTheme(value);
    }
  };

  // Accent setter that works for both platforms
  const setAccent = (value: AccentColor) => {
    setAccentState(value);

    // Web: Apply CSS classes and localStorage
    if (!disableWebFeatures) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('accent-color', value);
      }
      applyWebAccent(value);
    }
    // React Native: State update is sufficient
  };

  // Initialize theme and accent from storage (web only)
  useEffect(() => {
    if (disableWebFeatures) {
      // React Native: Use default values or props
      return;
    }

    // Web: Load from localStorage and apply
    const savedTheme = (localStorage?.getItem('theme') as Theme) || 'light';
    const savedAccent =
      (localStorage?.getItem('accent-color') as AccentColor) || 'blue';

    setThemeState(savedTheme);
    setAccentState(savedAccent);

    applyWebTheme(savedTheme);
    applyWebAccent(savedAccent);
  }, [disableWebFeatures]);

  const value: CrossPlatformThemeContextType = {
    theme,
    accent,
    resolvedTheme,
    setTheme,
    setAccent,
    colors,
    getColor,
  };

  return (
    <CrossPlatformThemeContext.Provider value={value}>
      {children}
    </CrossPlatformThemeContext.Provider>
  );
};

// Backward compatibility: Re-export for existing web usage patterns
export const useTheme = useCrossPlatformTheme;
export const ThemeProvider = CrossPlatformThemeProvider;
