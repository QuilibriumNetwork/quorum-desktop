// Re-export shared types and colors
export { getColors, getColor, themeColors, accentColors } from './colors';
export type { Theme, AccentColor } from './colors';
export type { ThemeContextType, PrimitivesThemeContextType } from './ThemeProvider';

// Platform-specific theme provider resolution
// For React Native, explicitly import from .native file since Metro resolution isn't working
export { useTheme, ThemeProvider } from './ThemeProvider.native';
