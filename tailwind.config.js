/** @type {import('tailwindcss').Config} */

function withOpacityValue(variable) {
  return ({ opacityValue }) =>
    opacityValue === undefined
      ? `rgb(var(${variable}))`
      : `rgb(var(${variable}) / ${opacityValue})`;
}

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@quilibrium/quilibium-js-sdk-channels/dist/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    {
      pattern: /^(accent-.*|bg-accent|hover:bg-accent)$/,
      variants: ['hover', 'focus', 'active'],
    },
  ],
  theme: {
    extend: {
      colors: {
        // accent color
        accent: {
          50: 'var(--accent-50)',
          100: 'var(--accent-100)',
          150: 'var(--accent-150)',
          200: 'var(--accent-200)',
          300: 'var(--accent-300)',
          400: 'var(--accent-400)',
          500: 'var(--accent-500)',
          600: 'var(--accent-600)',
          700: 'var(--accent-700)',
          800: 'var(--accent-800)',
          900: 'var(--accent-900)',
          DEFAULT: 'var(--accent)',
          rgb: 'var(--accent-rgb)',
        },

        // surface raw variables (direct use if needed)
        'surface-00': 'var(--surface-00)',
        'surface-0': 'var(--surface-0)',
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        'surface-4': 'var(--surface-4)',
        'surface-5': 'var(--surface-5)',
        'surface-6': 'var(--surface-6)',
        'surface-7': 'var(--surface-7)',
        'surface-8': 'var(--surface-8)',
        'surface-9': 'var(--surface-9)',
        'surface-10': 'var(--surface-10)',

        // utilities (opacity support)
        danger: withOpacityValue('--danger'),
        'danger-hover': withOpacityValue('--danger-hover'),
        warning: withOpacityValue('--warning'),
        success: withOpacityValue('--success'),
        info: withOpacityValue('--info'),

        // utilities HEX variables
        'danger-hex': 'var(--danger-hex)',
        'danger-hover-hex': 'var(--danger-hover-hex)',
        'warning-hex': 'var(--warning-hex)',
        'success-hex': 'var(--success-hex)',
        'info-hex': 'var(--info-hex)',
      },
      
      // === semantic variables === //
      
      backgroundColor: {
        app: 'var(--color-bg-app)',
        sidebar: 'var(--color-bg-sidebar)',
        'sidebar-hover': 'var(--color-bg-sidebar-hover)',
        'sidebar-active': 'var(--color-bg-sidebar-active)',

        modal: 'var(--color-bg-modal)',
        'modal-cat-hover': 'var(--color-bg-modal-cat-hover)',
        'modal-cat-active': 'var(--color-bg-modal-cat-active)',
        overlay: 'var(--color-bg-overlay)',

        chat: 'var(--color-bg-chat)',
        'chat-hover': 'var(--color-bg-chat-hover)',
        'chat-input': 'var(--color-bg-chat-input)',

        icon: 'var(--color-bg-icon)',
        input: 'var(--color-bg-input)',
        card: 'var(--color-bg-card)',
        tooltip: 'var(--color-bg-tooltip)',
      },

      borderColor: {
        DEFAULT: 'var(--color-border-default)',
        strong: 'var(--color-border-strong)',
        stronger: 'var(--color-border-stronger)',
      },

      textColor: {
        strong: 'var(--color-text-strong)',
        main: withOpacityValue('--color-text-main'),
        subtle: 'var(--color-text-subtle)',
        muted: 'var(--color-text-muted)',
      },
    },
  },
  plugins: [],
};
