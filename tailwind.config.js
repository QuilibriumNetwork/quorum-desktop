/** @type {import('tailwindcss').Config} */

function withOpacityValue(variable) {
  return ({ opacityValue }) =>
    opacityValue === undefined
      ? `rgb(var(${variable}))`
      : `rgb(var(${variable}) / ${opacityValue})`;
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}', '!./node_modules/**'],
  safelist: [
    // === LEGACY/OLD PASSKEY MODAL STYLES (keep until new modal style is live) ===
    {
      pattern:
        /^(absolute|text-center|top-0|left-0|w-full|p-4|font-light|text-xl|left-1\/3|w-1\/3|border|border-t-0|border-stone-300\/20|border-stone-300\/30|bg-stone-200.*|bg-stone-300.*|drop-shadow-2xl|rounded-none|rounded-b-2xl|fixed|text-stone|text-white|top-0|left-0|backdrop-blur-lg|transition|ease-in-out|duration-600|w-full|h-full|bg-stone-900.*|relative|z-100|inline-block|font-bold|transition|ease-in-out|duration-300|mb-4|border|border-stone-100.*|rounded-full|p-2|bg-cover|mx-4|bg-red-600|border-red-300|bg-stone-800.*|border-stone-800.*|bg-green-600|border-green-200)$/,
      variants: ['md', 'hover', 'focus', 'active'],
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
        danger: 'var(--color-text-danger)',
      },

      animation: {
        modalOpen: 'modalOpen 0.3s ease-out',
      },

      keyframes: {
        modalOpen: {
          from: {
            opacity: '0',
            transform: 'scale(0.95)',
          },
          to: {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
      },
    },
  },
  plugins: [],
};
