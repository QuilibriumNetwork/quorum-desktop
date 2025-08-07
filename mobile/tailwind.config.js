const colors = require('tailwindcss/colors');

module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    '../src/components/**/*.{js,jsx,ts,tsx}', // Include shared components
  ],
  theme: {
    extend: {
      // Import shared color system (simplified version for mobile)
      colors: {
        // Basic accent colors
        'accent': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9', // Default accent
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Surface colors
        'surface': {
          0: '#ffffff',
          1: '#fafafa', 
          2: '#f5f5f5',
          3: '#f0f0f0',
          4: '#dedede',
          5: '#c2c2c2',
          6: '#979797',
          7: '#818181',
          8: '#606060',
          9: '#3c3c3c',
          10: '#000000',
        },
        // Utility colors
        danger: '#ef4444',
        warning: '#f59e0b', 
        success: '#10b981',
        info: '#3b82f6',
      },
      // Text color shortcuts
      textColor: {
        'main': 'var(--color-text-main)',
        'subtle': 'var(--color-text-subtle)',
        'strong': 'var(--color-text-strong)',
        'muted': 'var(--color-text-muted)',
      },
    },
  },
  plugins: [],
  // Make sure Tailwind processes the shared SCSS files
  darkMode: 'class',
};