// Shared theme provider types and interfaces for cross-platform compatibility

import type { Theme, AccentColor } from './colors';

// Base theme context interface that both web and native providers must implement
export interface ThemeContextType {
  theme: Theme;
  setTheme: (value: Theme) => void | Promise<void>;
  resolvedTheme: 'light' | 'dark'; // Always resolved to actual theme, never 'system'
  accent: AccentColor;
  setAccent: (value: AccentColor) => void | Promise<void>;
}

// Extended interface for primitives (React Native) with additional color access
export interface PrimitivesThemeContextType extends ThemeContextType {
  colors: any; // From getColors function
  getColor: (path: string) => string;
}

// Platform-specific exports will be resolved by bundler based on file extensions
// Web bundlers will look for ThemeProvider.web.tsx
// React Native bundlers will look for ThemeProvider.native.tsx

// For React Native, export from .native file explicitly since Metro resolution isn't always reliable
export { useTheme, ThemeProvider } from './ThemeProvider.native';
