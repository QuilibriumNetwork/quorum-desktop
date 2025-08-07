// Re-export shared types and colors
export { getColors, getColor, themeColors, accentColors } from './colors';
export type { Theme, AccentColor } from './colors';
export type { ThemeContextType, PrimitivesThemeContextType } from './ThemeProvider';

// Platform-specific theme provider resolution
// Metro/React Native will resolve to ThemeProvider.native.tsx automatically
// Vite/Web will resolve to ThemeProvider.web.tsx automatically
export { useTheme, ThemeProvider } from './ThemeProvider';
