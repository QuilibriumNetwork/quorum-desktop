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
- Always run `yarn lint` and `yarn format` before committing
- do not run `yarn dev`, `yarn build` unless specifically instructed  

## Claude Code Development Resources

The `.claude/` folder tracks tasks, bugs, features, and development context.

### Important Claude Locations

- `.claude/` — Main Claude context  
- `.claude/docs/` — Documentation on custom features  
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


