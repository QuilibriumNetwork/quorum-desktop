# CLAUDE.md

This is a React project using Vite and Electron with a **cross-platform web + mobile architecture**.

## Cross-Platform Architecture - CRITICAL

**IMPORTANT**: This project uses a shared codebase with primitive components designed for both web and mobile platforms. All development must consider mobile compatibility from the start.

- **Shared Code Architecture**: Components are built using custom primitives that abstract platform differences
- **Mobile-First Approach**: Every UI change must work on both desktop and mobile
- **Primitive Components**: Use components from `src/components/primitives/` (Input, Button, Modal, FlexRow, etc.) instead of raw HTML elements
- **Reference Documentation**: See `.readme/tasks/todo/mobile-dev/docs/component-architecture-workflow-explained.md` for detailed architecture explanation

**When making any changes, always ask**: "Will this work on mobile?" If uncertain, use primitives and follow mobile-first design principles.

## Repository Structure

The repository has been restructured for cross-platform development:

```
quorum/
├── src/                          # SHARED CODE (90% of app)
│   ├── components/              # Business logic components
│   │   ├── primitives/         # Cross-platform UI components
│   │   ├── Router/             # Platform-aware routing
│   │   └── ...
│   ├── hooks/                  # 100% shared business logic
│   ├── api/                    # 100% shared API layer
│   ├── services/               # 100% shared services
│   ├── types/                  # 100% shared TypeScript types
│   └── utils/                  # 100% shared utilities (including platform detection)
│
├── web/                        # WEB-SPECIFIC FILES
│   ├── index.html             # Web HTML entry
│   ├── main.tsx               # Web React entry point
│   ├── vite.config.ts         # Vite bundler config
│   ├── public/                # Web-specific assets
│   └── electron/              # Electron desktop wrapper
│
├── mobile/                     # MOBILE-SPECIFIC FILES (placeholder)
│   ├── App.tsx                # React Native entry point (placeholder)
│   ├── app.json               # Expo configuration
│   └── assets/                # Mobile app assets
```

## Platform Detection

Use the platform utilities in `src/utils/platform.ts`:

- `isWeb()` - Check if running in web browser
- `isMobile()` / `isNative()` - Check if running in React Native
- `isElectron()` - Check if running in Electron desktop app
- `getPlatform()` - Get current platform as string
- `platformFeatures` - Object with platform-specific feature flags

## Dependencies

The main dependencies are:

- React
- Vite
- Electron
- TypeScript
- ESLint
- Prettier
- Lingui for i18n

## CRITICAL: Package Management

- **NEVER use npm commands** - this project uses Yarn exclusively
- **Always use `yarn` commands** - npm creates package-lock.json which conflicts with yarn.lock
- **If package-lock.json appears, DELETE it immediately**
- Running `npm install` instead of `yarn install` will break both web and mobile builds

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

- IMPORTANT: When committing, NEVER mention Claude or Anthropic
- Use `yarn` for package management
- Follow the existing coding style
- Run `yarn lint` and `yarn format` only on the files you modified during each task
- Do not run `yarn dev` but ask the user to do it manually for testing
- You can run `yarn build` to check if the production build has any issues
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

The `.readme/` folder tracks tasks, bugs, features, and development context.

### Important Claude Locations

- `.claude/` — Claude commands, agents, local settings
- `.readme/INDEX.md` - Index of all the docs available in `.claude/`
- `.readme/docs/` — Documentation on custom features (Look here when you work on specific things (e.g. Modals, Search, etc.))
- `.readme/bugs/` — Bug reports and solutions
- `.readme/tasks/` — Task management folders:
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
