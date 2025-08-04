// Re-export shared types and colors
export { getColors, getColor, themeColors, accentColors } from './colors';
export type { Theme, AccentColor } from './colors';
export type { ThemeContextType, PrimitivesThemeContextType } from './ThemeProvider';

// Platform-specific theme provider resolution
// For web, we'll import from the web version by default
// React Native components should import directly from ThemeProvider.native
export { useTheme, ThemeProvider } from './ThemeProvider.web';
