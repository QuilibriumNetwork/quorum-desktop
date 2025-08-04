// Cross-platform shared theme system
// These values EXACTLY match the CSS variables in _colors.scss
// DO NOT modify without updating CSS variables accordingly

export type Theme = 'light' | 'dark' | 'system';
export type AccentColor =
  | 'blue'
  | 'purple'
  | 'fuchsia'
  | 'orange'
  | 'green'
  | 'yellow';

// Base theme definitions that mirror _colors.scss exactly
export const themeColors = {
  light: {
    // Raw surface colors (matches CSS --surface-* variables)
    surface: {
      '00': '#ffffff',
      '0': '#fefeff',
      '1': '#f6f6f9',
      '2': '#eeeef3',
      '3': '#e6e6eb',
      '4': '#dedee3',
      '5': '#d5d5db',
      '6': '#cdccd3',
      '7': '#c4c4cb',
      '8': '#bbbbc3',
      '9': '#a2a2aa',
      '10': '#939399',
    },

    // Text colors (matches CSS --color-text-* variables)
    text: {
      strong: '#3b3b3b',
      main: '#363636', // rgb(54 54 54) from CSS
      subtle: '#818181',
      muted: '#b6b6b6',
      danger: '#e74a4a', // matches --color-text-danger in light theme
    },

    // Semantic background colors (matches CSS --color-bg-* variables)
    bg: {
      app: '#ffffff', // var(--surface-00)
      sidebar: '#f6f6f9', // var(--surface-1)
      'sidebar-hover': '#dedee3', // var(--surface-4)
      'sidebar-active': '#e6e6eb', // var(--surface-3)
      chat: '#eeeef3', // var(--surface-2)
      'chat-hover': '#e6e6eb', // var(--surface-3)
      'chat-input': '#fefeff', // var(--surface-0)
      modal: '#d5d5db', // var(--surface-5)
      'modal-cat-hover': '#cdccd3', // var(--surface-6)
      'modal-cat-active': '#d5d5db', // var(--surface-5)
      overlay: 'rgba(0, 0, 0, 0.6)',
      tooltip: '#ffffff', // var(--surface-00)
      icon: '#ffffff', // var(--surface-00)
      input: '#e6e6eb', // var(--surface-3)
      card: '#fefeff', // var(--surface-0) - changed for better field contrast
    },

    // Border colors (matches CSS --color-border-* variables)
    border: {
      default: '#cdccd3', // var(--surface-6)
      strong: '#c4c4cb', // var(--surface-7)
      stronger: '#bbbbc3', // var(--surface-8)
    },

    // Utility colors (matches CSS --*-hex variables)
    utilities: {
      danger: '#e74a4a',
      'danger-hover': '#ec3333',
      warning: '#e7b04a',
      success: '#46c236',
      info: '#3095bd',
    },

    // Utility colors with RGB values for opacity (matches CSS --* variables)
    utilitiesRgb: {
      danger: 'rgb(231, 74, 74)',
      'danger-hover': 'rgb(236, 51, 51)',
      warning: 'rgb(231, 176, 74)',
      success: 'rgb(70, 194, 54)',
      info: 'rgb(48, 149, 189)',
    },

    // === MOBILE-SPECIFIC FIELD COLORS (DO NOT SYNC WITH WEB APP COLORS) ===
    // Optimized for mobile modal backgrounds (surface-1: #f6f6f9)
    field: {
      // Background colors - need good contrast on surface-1
      bg: '#eeeef3', // surface-2 - provides visible contrast on surface-1
      bgFocus: '#f6f6f9', // surface-1 - lighter focus state
      bgError: '#eeeef3', // surface-2 - same as default

      // Border colors - lighter borders for surface-1 background
      border: '#cdccd3', // surface-6 - visible but not too strong
      borderHover: '#c4c4cb', // surface-7 - slightly stronger on hover
      borderFocus: '#0287f2', // accent blue - focus state
      borderError: '#e74a4a', // danger color

      // Text colors
      text: '#363636', // same as text.main
      placeholder: '#818181', // same as text.subtle

      // Focus shadows (using rgba for opacity)
      focusShadow: 'rgba(2, 135, 242, 0.1)', // accent with opacity
      errorFocusShadow: 'rgba(231, 74, 74, 0.1)', // danger with opacity

      // Dropdown/options colors (for Select component)
      optionsBg: '#ffffff', // surface-00 - clean white dropdown
      optionHover: '#e6e6eb', // surface-3 - hover state
      optionSelected: '#eeeef3', // surface-2 - selected state
      optionText: '#363636', // text.main
      optionTextSelected: '#0287f2', // will be overridden by getColors() with dynamic accent
    },
  },

  dark: {
    // Dark theme surface colors (matches CSS html.dark --surface-* variables)
    surface: {
      '00': '#100f11',
      '0': '#1d1a21',
      '1': '#241f27',
      '2': '#2c252e',
      '3': '#312935',
      '4': '#3a313f',
      '5': '#443b49',
      '6': '#584d5e',
      '7': '#716379',
      '8': '#92829b',
      '9': '#a999b3',
      '10': '#bfadca',
    },

    // Dark theme text colors (matches CSS html.dark --color-text-* variables)
    text: {
      strong: '#f8f7fa',
      main: '#f4f1f6', // rgb(244 241 246) from CSS
      subtle: '#bfb5c8',
      muted: '#84788b',
      danger: '#d46767', // matches --color-text-danger in dark theme
    },

    // Dark theme semantic backgrounds
    bg: {
      app: '#100f11', // var(--surface-00)
      sidebar: '#241f27', // var(--surface-1)
      'sidebar-hover': '#443b49', // var(--surface-5)
      'sidebar-active': '#3a313f', // var(--surface-4)
      chat: '#2c252e', // var(--surface-2)
      'chat-hover': '#312935', // var(--surface-3)
      'chat-input': '#1d1a21', // var(--surface-0)
      modal: '#443b49', // var(--surface-5)
      'modal-cat-hover': '#584d5e', // var(--surface-6)
      'modal-cat-active': '#443b49', // var(--surface-5)
      overlay: 'rgba(0, 0, 0, 0.6)',
      tooltip: '#100f11', // var(--surface-00)
      icon: '#100f11', // var(--surface-00)
      input: '#312935', // var(--surface-3)
      card: '#1d1a21', // var(--surface-0) - changed for better field contrast
    },

    // Dark theme border colors
    border: {
      default: '#584d5e', // var(--surface-6)
      strong: '#716379', // var(--surface-7)
      stronger: '#92829b', // var(--surface-8)
    },

    // Dark theme utility colors (matches CSS html.dark --*-hex variables)
    utilities: {
      danger: '#c73737',
      'danger-hover': '#b83030',
      warning: '#d09a3d',
      success: '#379e2b',
      info: '#267b9e',
    },

    // Dark theme utility colors with RGB values
    utilitiesRgb: {
      danger: 'rgb(199, 55, 55)',
      'danger-hover': 'rgb(184, 48, 48)',
      warning: 'rgb(208, 154, 61)',
      success: 'rgb(55, 158, 43)',
      info: 'rgb(38, 123, 158)',
    },

    // === MOBILE-SPECIFIC FIELD COLORS (DO NOT SYNC) ===
    // Optimized for mobile modal backgrounds (surface-1: #241f27)
    field: {
      // Background colors - need good contrast on dark surface-1
      bg: '#2c252e', // surface-2 - provides visible contrast on dark surface-1
      bgFocus: '#241f27', // surface-1 - lighter focus state
      bgError: '#2c252e', // surface-2 - same as default

      // Border colors - need visibility on dark surface-1 background
      border: '#584d5e', // surface-6 - visible on dark background
      borderHover: '#716379', // surface-7 - stronger on hover
      borderFocus: '#0287f2', // accent blue - same as light
      borderError: '#c73737', // danger color for dark theme

      // Text colors
      text: '#f4f1f6', // same as text.main
      placeholder: '#bfb5c8', // same as text.subtle

      // Focus shadows (using rgba for opacity)
      focusShadow: 'rgba(2, 135, 242, 0.1)', // accent with opacity
      errorFocusShadow: 'rgba(199, 55, 55, 0.1)', // dark danger with opacity

      // Dropdown/options colors (for Select component)
      optionsBg: '#100f11', // surface-00 - dark dropdown background
      optionHover: '#312935', // surface-3 - hover state
      optionSelected: '#2c252e', // surface-2 - selected state
      optionText: '#f4f1f6', // text.main
      optionTextSelected: '#0287f2', // will be overridden by getColors() with dynamic accent
    },
  },
};

// Accent color definitions (matches CSS .accent-* classes exactly)
export const accentColors: Record<AccentColor, any> = {
  blue: {
    50: '#eef7ff',
    100: '#daeeff',
    150: '#a6d9ff',
    200: '#6fc3ff',
    300: '#48adf5',
    400: '#3aa9f8',
    500: '#0287f2',
    600: '#025ead',
    700: '#034081',
    800: '#0a0733',
    900: '#060421',
    DEFAULT: '#0287f2',
    rgb: 'rgb(2, 135, 242)',
  },
  purple: {
    50: '#f5f2ff',
    100: '#e9e3ff',
    150: '#d3c6ff',
    200: '#bda8ff',
    300: '#a78bff',
    400: '#916eff',
    500: '#7c52ff',
    600: '#6233e8',
    700: '#4b27b3',
    800: '#281566',
    900: '#140b33',
    DEFAULT: '#7c52ff',
    rgb: 'rgb(124, 82, 255)',
  },
  fuchsia: {
    50: '#fdf4ff',
    100: '#fae8ff',
    200: '#f5d0fe',
    300: '#f0abfc',
    400: '#e879f9',
    500: '#d946ef',
    600: '#c026d3',
    700: '#a21caf',
    800: '#86198f',
    900: '#701a75',
    DEFAULT: '#d946ef',
    rgb: 'rgb(217, 70, 239)',
  },
  orange: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
    DEFAULT: '#f97316',
    rgb: 'rgb(249, 115, 22)',
  },
  green: {
    50: '#f0f9eb',
    100: '#e1f3d6',
    150: '#c3e7ad',
    200: '#a5d984',
    300: '#87cc5b',
    400: '#69be32',
    500: '#4fa81a',
    600: '#3b7e14',
    700: '#27540e',
    800: '#142b07',
    900: '#0a1504',
    DEFAULT: '#4fa81a',
    rgb: 'rgb(79, 168, 26)',
  },
  yellow: {
    50: '#fefce8',
    100: '#fef9c3',
    200: '#fef08a',
    300: '#fde047',
    400: '#facc15',
    500: '#eab308',
    600: '#ca8a04',
    700: '#a16207',
    800: '#854d0e',
    900: '#713f12',
    DEFAULT: '#eab308',
    rgb: 'rgb(234, 179, 8)',
  },
};

// Common colors used across themes
export const commonColors = {
  white: '#ffffff',
  transparent: 'transparent',
  black: '#000000',
};

/**
 * Get colors for a specific theme and accent combination
 * This is the main function React Native components should use
 */
export const getColors = (
  theme: 'light' | 'dark' = 'light',
  accent: AccentColor = 'blue'
) => {
  const baseColors = {
    ...themeColors[theme],
    accent: accentColors[accent],
    ...commonColors,
  };

  // Override field focus colors to use the current accent
  const accentDefault = accentColors[accent].DEFAULT;
  
  return {
    ...baseColors,
    field: {
      ...baseColors.field,
      borderFocus: accentDefault,
      bgFocus: baseColors.field.bgFocus, // Keep existing bgFocus
      optionTextSelected: accentDefault, // Dynamic accent for selected options
    },
  };
};

/**
 * Get a specific color value with dot notation
 * Example: getColor('surface.3', 'dark') returns '#312935'
 */
export const getColor = (
  colorPath: string,
  theme: Theme = 'light',
  accent: AccentColor = 'blue'
): string => {
  const colors = getColors(theme, accent);
  const path = colorPath.split('.');

  let current: any = colors;
  for (const key of path) {
    current = current[key];
    if (current === undefined) {
      console.warn(`Color path "${colorPath}" not found in theme "${theme}"`);
      return colors.accent.DEFAULT; // Fallback
    }
  }

  return current;
};
