// Static color exports (safe - no hooks)
export { getColors, getColor, themeColors, accentColors } from './colors';
export type { Theme, AccentColor } from './colors';

// Factory functions for theme providers (prevents hook loading during module init)
export const createThemeProvider = () => {
  const { ThemeProvider } = require('./ThemeProvider');
  return ThemeProvider;
};

export const createCrossPlatformThemeProvider = () => {
  const { CrossPlatformThemeProvider } = require('./ThemeProvider');
  return CrossPlatformThemeProvider;
};

export const createThemeHook = () => {
  const { useTheme } = require('./ThemeProvider');
  return useTheme;
};

export const createCrossPlatformThemeHook = () => {
  const { useCrossPlatformTheme } = require('./ThemeProvider');
  return useCrossPlatformTheme;
};
