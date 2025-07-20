# CLAUDE.md

This is a React project using Vite and Electron.

## Dependencies

The main dependencies are:

- React
- Vite
- Electron
- TypeScript
- ESLint
- Prettier
- Lingui for i18n

## Scripts

- `dev`: Starts the Vite development server
- `build`: Builds the project using Vite
- `electron:dev`: Runs the Electron app in development mode
- `electron:build`: Builds the Electron app for production
- `lint`: Lints the code using ESLint
- `format`: Formats the code using Prettier
- `lingui:extract`: Extracts i18n messages
- `lingui:compile`: Compiles i18n messages

## Instructions

- Use `yarn` for package management
- Follow the existing coding style
- Run `yarn lint` and `yarn format` only on the files you modified during each task
- When you insert any new text that must be readby users, always use the Lingui sintax for localization
- When editign anything, you must be very careful to not cause destructive changes or conflicts with other functionalities, as the app is pretty complex with many shared styles and features
- Think always mobile first, and when making layout/css edits, always think at the final result for both desktop and mobile users for an optimal UX/UI

## React Hooks Rules - IMPORTANT

**NEVER violate React's Rules of Hooks:**
- Call all hooks at the top level of components (not inside functions, conditionals, or loops)
- Call hooks in the same order on every render
- NEVER put conditional returns (early exits) before any hooks
- If you need conditional logic, put it AFTER all hooks or inside the hooks themselves

Example of what NOT to do:
```tsx
// ❌ BAD - Conditional return before hooks
if (someCondition) return <SomeComponent />;
useEffect(() => {...}, []);  // This hook is called conditionally!

// ✅ GOOD - All hooks before conditionals
useEffect(() => {...}, []);
if (someCondition) return <SomeComponent />;
```

## Claude Code Development Resources

The `.claude/` folder tracks tasks, bugs, features, and development context.

### Important Claude Locations

- `.claude/` — Main Claude context
- `.claude/INDEX.md` - Index of all the docs available in `.claude/`
- `.claude/docs/` — Documentation on custom features (Look here when you work on specific things (e.g. Modals, Search, etc.))
- `.claude/bugs/` — Bug reports and solutions
- `.claude/screenshots/` — Debug/reference screenshots (use the image with the highest number when referenced)
- `.claude/tasks/` — Task management folders:
  - `todo/`: Future tasks
  - `ongoing/`: Tasks in progress
  - `done/`: Completed tasks

---

## Styling

This project uses Tailwind CSS with semantic CSS layers for flexibility and scalability.

### Tailwind Setup

- Main config: `tailwind.config.js`
- Base styles: `src/index.css`
- Semantic classes and CSS variables are defined globally in `src/index.css`

### Color System

There are two themes: **light** and **dark**, controlled via the `dark` class on the `<html>` element.

**Accent Colors:**

- `accent-50` → `accent-900`
- `accent` (default alias: `--accent-500`)

**Surface Colors:**

- `surface-00` → `surface-10`

**Text Colors:**

- `color-text-strong`
- `color-text-main`
- `color-text-subtle`
- `color-text-muted`

**Utility Colors:**

- `danger`, `warning`, `success`, `info` (with opacity support)
- `danger-hex`, `warning-hex`, `success-hex`, `info-hex` (solid hex values)

### Semantic CSS Classes

In addition to utility classes, we define **semantic classes** in `src/index.css`. Prefer using them when the same styling appears across components.

Examples:

- `bg-app` — App main background
- `bg-sidebar` — Sidebar background
- `bg-chat` — Chat panel background
- `text-strong` — Emphasized text
- `text-main` — Default readable text
- `text-subtle` — Secondary/less important text
- `border-default` — Common border style

---

## Styling Philosophy

- Use Tailwind utility classes for unique or one-off component styles
- Extract shared patterns using `@apply` for consistency and maintainability
- Embrace Tailwind's design system (spacing, color, font, radius)
- Keep custom CSS minimal and focused on things Tailwind can't handle

---

## Styling Best Practices

### 1. Use Tailwind Utilities for One-Off Components

Style components directly using Tailwind utility classes if they don't share their style with others.

```html
<!-- Good -->
<div class="bg-surface-0 p-4 rounded shadow-md">
  <h2 class="text-xl font-bold mb-2">Card Title</h2>
  <p class="text-main">Card content goes here.</p>
</div>
```

### 2. Extract Reusable Styles with `@apply`

If two or more components share similar styling, define a semantic class with `@apply`.

```css
/* styles/components.css */
.btn-primary {
  @apply bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700;
}
```

```html
<button class="btn-primary">Click Me</button>
```

### 3. Use `clsx` or `classnames` for Dynamic Styling

Cleanly manage conditional logic in JS/TS components.

```tsx
import clsx from 'clsx';

<div className={clsx('text-sm', isActive && 'font-bold')} />;
```

### 4. Extend Tailwind via `tailwind.config.js`

Use the config file to centralize design tokens like colors and spacing.

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      brand: '#5D3FD3',
    },
  },
},
```

### 5. Keep Custom CSS Minimal

Write raw CSS only when needed for:

- Keyframe animations
- Scrollbar styling
- Third-party integration quirks

Avoid rebuilding what's already covered by Tailwind utilities or your semantic class layer.

### 6. Purge & Optimize

Ensure unused styles are purged from production builds using the `content` config:

```js
// tailwind.config.js
content: ['./src/**/*.{js,ts,jsx,tsx,html}'];
```

---

Stick to Tailwind's strengths, extract wisely, and keep your design system DRY, scalable, and clear.