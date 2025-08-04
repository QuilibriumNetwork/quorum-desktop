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