// Re-export shared types and colors
export { getColors, getColor, themeColors, accentColors } from './colors';
export type { Theme, AccentColor } from './colors';
export type {
  ThemeContextType,
  PrimitivesThemeContextType,
} from './ThemeProvider';

// Platform-specific theme provider resolution
// Vite will resolve ThemeProvider.web.tsx for web, Metro will resolve ThemeProvider.native.tsx for mobile
export { useTheme, ThemeProvider } from './ThemeProvider';
