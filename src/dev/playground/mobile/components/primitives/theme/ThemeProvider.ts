// Shared theme provider types and interfaces for cross-platform compatibility

export type Theme = 'light' | 'dark' | 'system';

// Base theme context interface that both web and native providers must implement
export interface ThemeContextType {
  theme: Theme;
  setTheme: (value: Theme) => void;
  resolvedTheme: 'light' | 'dark'; // Always resolved to actual theme, never 'system'
}

// Extended interface for primitives (React Native) with additional color access
export interface PrimitivesThemeContextType extends ThemeContextType {
  accent: string;
  setAccent: (value: string) => void;
  colors: any; // From getColors function
  getColor: (path: string) => string;
}