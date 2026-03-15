/**
 * Cross-Platform Theme Color System
 *
 * Two-layer architecture:
 *   Layer 1 — Palette: raw color values (surfaces, accents, utility colors)
 *   Layer 2 — Semantics: purpose-based tokens that reference palette values
 *
 * Semantic tokens are split into:
 *   - "Shared" — mirrors web CSS variables from _colors.scss
 *   - "Mobile-specific" — optimized for mobile (field colors, etc.)
 *
 * Components access colors via useTheme().colors (the getColors() output).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Theme = 'light' | 'dark' | 'system';
export type AccentColor =
  | 'blue'
  | 'purple'
  | 'fuchsia'
  | 'orange'
  | 'green'
  | 'yellow';

// ---------------------------------------------------------------------------
// Layer 1 — Palette
// ---------------------------------------------------------------------------

/** Surface colors — raw palette, matches CSS --surface-* exactly */
const surfaces = {
  light: {
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
  dark: {
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
} as const;

/** Accent color palettes — matches CSS .accent-* classes exactly */
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
    50: '#fef9c3',
    100: '#fef08a',
    200: '#fde047',
    300: '#facc15',
    400: '#eab308',
    500: '#ca8a04',
    600: '#a16207',
    700: '#854d0e',
    800: '#713f12',
    900: '#5a3310',
    DEFAULT: '#ca8a04',
    rgb: 'rgb(202, 138, 4)',
  },
};

/** Utility colors — matches CSS --danger/--warning/--success/--info */
const utilityColors = {
  light: {
    danger: '#e74a4a',
    'danger-hover': '#ec3333',
    warning: '#e7b04a',
    success: '#46c236',
    info: '#3095bd',
  },
  dark: {
    danger: '#c73737',
    'danger-hover': '#b83030',
    warning: '#d09a3d',
    success: '#379e2b',
    info: '#267b9e',
  },
} as const;

export const commonColors = {
  white: '#ffffff',
  transparent: 'transparent',
  black: '#000000',
};

// ---------------------------------------------------------------------------
// Layer 2 — Semantic Tokens
// ---------------------------------------------------------------------------

/**
 * Build semantic color tokens for a given theme.
 *
 * Shared tokens mirror web CSS variables from _colors.scss.
 * Where mobile intentionally diverges (e.g. stronger borders for visibility),
 * the comment explains why.
 */
const buildSemanticColors = (theme: 'light' | 'dark') => {
  const s = surfaces[theme];
  const u = utilityColors[theme];

  return {
    // Raw palette access (for direct surface usage)
    surface: s,

    // --- Text colors (matches CSS --color-text-*) ---
    text: {
      strong: theme === 'light' ? '#3b3b3b' : '#f8f7fa',
      main: theme === 'light' ? '#363636' : '#f4f1f6',
      subtle: theme === 'light' ? '#818181' : '#bfb5c8',
      muted: theme === 'light' ? '#b6b6b6' : '#84788b',
      danger: theme === 'light' ? '#e74a4a' : '#e15151',
    },

    // --- Link colors (matches CSS --color-link-*) ---
    // Overridden by getColors() with dynamic accent
    link: {
      default: theme === 'light' ? '#0287f2' : '#3aa9f8', // light: accent-500, dark: accent-400
      hover: theme === 'light' ? '#48adf5' : '#6fc3ff', // light: accent-300, dark: accent-200
    },

    // --- Background colors (matches CSS --color-bg-*) ---
    // Mobile uses slightly different surface levels for better mobile aesthetics
    bg: {
      app: s['00'],
      sidebar: s['1'],
      'sidebar-hover': theme === 'light' ? s['4'] : s['5'],
      'sidebar-active': theme === 'light' ? s['3'] : s['4'],
      chat: s['2'],
      'chat-hover': s['3'],
      'chat-input': theme === 'light' ? s['0'] : s['0'],
      modal: s['5'], // mobile uses surface-5 for modals (darker than web)
      'modal-cat-hover': s['6'],
      'modal-cat-active': s['5'],
      overlay: 'rgba(0, 0, 0, 0.6)',
      tooltip: s['00'],
      icon: s['00'],
      input: s['3'],
      card: s['0'],
    },

    // --- Border colors ---
    // Mobile uses one step stronger borders for better visibility on mobile
    border: {
      muted: s['3'],
      subtle: s['4'],
      default: s['6'], // intentionally darker than web CSS (surface-5)
      strong: s['7'],
      stronger: s['8'],
    },

    // --- Utility colors (matches CSS --danger/--warning/--success/--info) ---
    utilities: u,

    // --- Context menu colors ---
    contextMenu: {
      bg: s['00'],
      hover: s['1'],
    },

    // --- Space tag colors ---
    spaceTag: {
      bg: s['4'],
      bgHover: s['5'],
    },

    // --- Sidebar accent colors ---
    // Overridden by getColors() with dynamic accent
    sidebarAccent: {
      activeBg: 'rgba(2, 135, 242, 0.25)',
      dmIcon: theme === 'light' ? s['9'] : s['5'],
    },

    // --- Mention colors ---
    // Overridden by getColors() with dynamic accent
    mention: {
      bg: 'rgba(2, 135, 242, 0.2)',
      bgHover: theme === 'light' ? 'rgba(2, 135, 242, 0.4)' : 'rgba(2, 135, 242, 0.5)',
      link: theme === 'light' ? '#0287f2' : '#3aa9f8',
      linkHover: theme === 'light' ? '#025ead' : '#a6d9ff',
    },

    // === MOBILE-SPECIFIC FIELD COLORS ===
    // Optimized for contrast on mobile modal backgrounds — DO NOT sync with web CSS
    field: {
      bg: s['2'], // darker than web (surface-0) for contrast on mobile surface-1
      bgFocus: s['1'],
      bgError: s['2'],

      border: s['6'], // stronger than web for mobile visibility
      borderHover: s['7'],
      borderFocus: '#0287f2', // overridden by getColors() with dynamic accent
      borderError: u.danger,

      text: theme === 'light' ? '#363636' : '#f4f1f6',
      placeholder: theme === 'light' ? '#818181' : '#bfb5c8', // text.subtle (more visible than text.muted)

      focusShadow: 'rgba(2, 135, 242, 0.1)',
      errorFocusShadow: theme === 'light' ? 'rgba(231, 74, 74, 0.1)' : 'rgba(199, 55, 55, 0.1)',

      // Dropdown/options (for Select component)
      optionsBg: s['00'],
      optionHover: s['3'],
      optionSelected: s['2'],
      optionText: theme === 'light' ? '#363636' : '#f4f1f6',
      optionTextSelected: '#0287f2', // overridden by getColors() with dynamic accent
    },
  };
};

// Pre-built semantic tokens (used as base by getColors)
const semanticColors = {
  light: buildSemanticColors('light'),
  dark: buildSemanticColors('dark'),
};

// Keep themeColors export for backwards compatibility (barrel export)
export const themeColors = semanticColors;

// ---------------------------------------------------------------------------
// getColors() — main entry point for components
// ---------------------------------------------------------------------------

/**
 * Get the complete color object for a theme + accent combination.
 * This is what components access via useTheme().colors.
 *
 * Accent-dependent colors (links, mentions, field focus, sidebar accent)
 * are computed here so they update when the user changes their accent color.
 */
export const getColors = (
  theme: 'light' | 'dark' = 'light',
  accent: AccentColor = 'blue'
) => {
  const base = semanticColors[theme];
  const ac = accentColors[accent];

  // Extract RGB components for opacity-based colors
  const rgbMatch = ac.rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  const [r, g, b] = rgbMatch
    ? [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
    : ['2', '135', '242'];

  // Accent-derived values
  const accentDefault = ac.DEFAULT;
  const linkDefault = theme === 'light' ? ac[500] : ac[400];
  const linkHover = theme === 'light' ? ac[300] : ac[200];
  const mentionLink = theme === 'light' ? ac[500] : ac[400];
  const mentionLinkHover = theme === 'light' ? ac[600] : ac[150];

  return {
    ...base,
    accent: ac,
    ...commonColors,

    // Accent-aware overrides
    link: {
      default: linkDefault,
      hover: linkHover,
    },
    field: {
      ...base.field,
      borderFocus: accentDefault,
      optionTextSelected: accentDefault,
    },
    mention: {
      bg: `rgba(${r}, ${g}, ${b}, 0.2)`,
      bgHover: `rgba(${r}, ${g}, ${b}, ${theme === 'light' ? '0.4' : '0.5'})`,
      link: mentionLink,
      linkHover: mentionLinkHover,
    },
    sidebarAccent: {
      ...base.sidebarAccent,
      activeBg: `rgba(${r}, ${g}, ${b}, 0.25)`,
    },
  };
};
