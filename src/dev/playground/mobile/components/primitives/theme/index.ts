// Re-export shared types and colors
export { getColors, getColor, themeColors, accentColors } from './colors';
export type { Theme, AccentColor } from './colors';
export type { ThemeContextType, PrimitivesThemeContextType } from './ThemeProvider';

// Mobile playground uses React Native theme provider directly
export { useTheme, ThemeProvider } from './ThemeProvider.native';
