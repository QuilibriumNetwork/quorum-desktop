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
- `dev`: Starts the Vite development server.
- `build`: Builds the project using Vite.
- `electron:dev`: Runs the Electron app in development mode.
- `electron:build`: Builds the Electron app for production.
- `lint`: Lints the code using ESLint.
- `format`: Formats the code using Prettier.
- `lingui:extract`: Extracts i18n messages.
- `lingui:compile`: Compiles i18n messages.

## Instructions
- Use `yarn` for package management.
- Follow the existing coding style.
- Make sure to run `yarn lint` and `yarn format` before committing.

## Claude Development Resources

**Important locations for Claude:**

- **`.claude/` folder**: Contains all Claude-related resources and context
- **`.claude/screenshots/`**: Screenshots for debugging/reference (when mentioned, use the image with the highest number in filename)
- **`.claude/tasks/`**: Task management with 3 folders:
  - `done/`: Completed tasks
  - `ongoing/`: Current work
  - `todo/`: Future tasks
- **Component README.md files**: When working with components, check for README.md files in component directories for context and documentation

## Styling

The project uses Tailwind CSS for styling. The configuration is in `tailwind.config.js` and the main CSS file is `src/index.css`.

### Colors

The color palette is defined in `src/index.css` using CSS variables. There are two themes: light and dark.

**Accent Colors:**
- `accent-50` to `accent-900`
- `accent` (default: `--accent-500`)

**Surface Colors:**
- `surface-00` to `surface-10`

**Text Colors:**
- `color-text-strong`
- `color-text-main`
- `color-text-subtle`
- `color-text-muted`

**Utility Colors:**
- `danger`, `warning`, `success`, `info` (with opacity support)
- `danger-hex`, `warning-hex`, `success-hex`, `info-hex` (solid colors)

**Semantic CSS classes:**
In addition to Tailwind, the project uses semantic CSS classes for some elements. These are defined in `src/index.css`. It is preferable to use these classes when possible.

Here are some examples:
- `bg-app`: The main background of the application.
- `bg-sidebar`: The background for the sidebar.
- `bg-chat`: The background for the chat panel.
- `text-strong`: For important text.
- `text-main`: For regular text.
- `text-subtle`: For less important text.
- `border-default`: For standard borders.


**Tailwind Configuration**
The `tailwind.config.js` file extends the default Tailwind theme with the custom colors defined in `src/index.css`. It also includes a safelist of classes to prevent them from being purged.


### Themes

The dark theme is enabled by adding the `dark` class to the `html` element. The color variables are redefined for the dark theme in `src/index.css`.

### Font

The project uses the 'Sen' font, which is a variable font.

## Key Components Structure

### Message Editor
The message editor components (`Channel.tsx` and `DirectMessage.tsx`) use a clean flexbox layout with:
- Consistent button alignment using `flex items-center gap-2`
- Minimal padding (6px) for tight spacing
- Buttons positioned with `flex items-center justify-center` for perfect centering

### Styling Best Practices
- Use flexbox for alignment rather than absolute positioning when possible
- Maintain consistent spacing with Tailwind gap classes
- Follow the existing color system with CSS variables
- Keep button styling minimal and consistent across components
