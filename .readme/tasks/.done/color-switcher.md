# Color Switcher Implementation


Create a comprehensive implementation plan to add a "color switcher" to `UserSettingsModal.tsx`, allowing users to:

1. Choose between **light and dark themes** (ALREADY DONE)
2. Select a custom **accent color** from a predefined palette

Current Setup:

- In `index.css`, the following accent color system is defined:
  --accent-50: #eef7ff;
  --accent-100: #daeeff;
  ...
  --accent-900: #060421;

  --accent: var(--accent-500); /_ for solid use _/
  --accent-rgb: 2, 135, 242; /_ for opacity-based utilities _/

- In `tailwind.config.js`, Tailwind colors are configured as:
  colors: {
  accent: {
  50: 'var(--accent-50)',
  100: 'var(--accent-100)',
  ...
  900: 'var(--accent-900)',
  DEFAULT: 'var(--accent)',
  },
  }

The Plan Should Cover:

1. Defining More Accent Palettes in CSS  
   Add multiple accent color themes (e.g. blue, green, red, purple) as CSS variables in `index.css`. Each theme should have its own --accent-50 to --accent-900, --accent, and --accent-rgb.

2. Switching CSS Variable Groups Dynamically  
   Describe how to implement switching between these variable groups (e.g., using CSS classes like .accent-blue, .accent-red on the root element or body) so that the chosen palette overrides the default.

3. Tailwind Compatibility with Opacity Utilities  
   Ensure Tailwind works with the dynamic accent color using a withOpacityValue('--accent-rgb') helper so utilities like bg-accent/30 behave as expected.

4. Updating `UserSettingsModal.tsx`  
   Insert a color switcher UI below the existing theme switcher. The color switcher should:
   - Display visual color swatches for each accent option
   - Show the currently selected color
   - Update the active accent theme by toggling the relevant class or CSS state

Refer to the last screenshot I uploaded for visual inspiration on the layout and behavior of the color switcher.

Think trhough this and create a plan before coding.
