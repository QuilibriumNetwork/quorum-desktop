/** @type {import('tailwindcss').Config} */

function withOpacityValue(variable) {
  return ({ opacityValue }) =>
    opacityValue === undefined
      ? `rgb(var(${variable}))`
      : `rgb(var(${variable}) / ${opacityValue})`;
}

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@quilibrium/quilibium-js-sdk-channels/dist/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    {
      pattern:
        /^(absolute|text-center|top-0|left-0|w-full|p-4|font-light|text-xl|left-1\/3|w-1\/3|border|border-t-0|border-stone-300\/20|border-stone-300\/30|bg-stone-200.*|bg-stone-300.*|drop-shadow-2xl|rounded-none|rounded-b-2xl|fixed|text-stone|text-white|top-0|left-0|backdrop-blur-lg|transition|ease-in-out|duration-600|w-full|h-full|bg-stone-900.*|relative|z-100|inline-block|font-bold|transition|ease-in-out|duration-300|mb-4|border|border-stone-100.*|rounded-full|p-2|bg-cover|mx-4|bg-red-600|border-red-300|bg-stone-800.*|border-stone-800.*|bg-green-600|border-green-200)$/,
      variants: ['md', 'hover'],
    },
  ],
  theme: {
    extend: {
      colors: {
        // Primary accent color
        primary: {
          DEFAULT: 'var(--primary)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
        },

        // surface raw variables (legacy/direct use if needed)
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

        // Utilities (opacity support)
        danger: withOpacityValue('--danger'),
        'danger-hover': withOpacityValue('--danger-hover'),
        warning: withOpacityValue('--warning'),
        success: withOpacityValue('--success'),
        info: withOpacityValue('--info'),

        // Utilities HEX variables
        'danger-hex': 'var(--danger-hex)',
        'danger-hover-hex': 'var(--danger-hover-hex)',
        'warning-hex': 'var(--warning-hex)',
        'success-hex': 'var(--success-hex)',
        'info-hex': 'var(--info-hex)',
      },

      backgroundColor: {
        app: 'var(--color-bg-app)',

        icon: 'var(--color-bg-icon)',
        input: 'var(--color-bg-input)',
        card: 'var(--color-bg-card)',
        tooltip: 'var(--color-bg-tooltip)',
      },

      borderColor: {
        DEFAULT: 'var(--color-border-default)',
        strong: 'var(--color-border-strong)',
      },

      textColor: {
        main: 'var(--color-text-main)',
        subtle: 'var(--color-text-subtle)',
        muted: 'var(--color-text-muted)',
      },
    },
  },
  plugins: [],
};
