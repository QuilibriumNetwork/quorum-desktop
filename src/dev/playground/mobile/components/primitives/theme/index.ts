import { lazy } from 'react';

// Static color exports (safe - no hooks)
export { getColors, getColor, themeColors, accentColors } from './colors';
export type { Theme, AccentColor } from './colors';

// Environment-aware theme providers
// For web: lazy-loaded to prevent hook loading during module init
// For React Native: direct exports work fine
export const CrossPlatformThemeProvider =
  typeof window !== 'undefined'
    ? lazy(() =>
        import('./ThemeProvider').then((m) => ({
          default: m.CrossPlatformThemeProvider,
        }))
      )
    : require('./ThemeProvider').CrossPlatformThemeProvider;

export const ThemeProvider =
  typeof window !== 'undefined'
    ? lazy(() =>
        import('./ThemeProvider').then((m) => ({ default: m.ThemeProvider }))
      )
    : require('./ThemeProvider').ThemeProvider;

// Hooks are always direct exports (used inside components, not during module init)
export { useCrossPlatformTheme, useTheme } from './ThemeProvider';
