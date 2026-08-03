/**
 * The app version, as a display string.
 *
 * The value comes from `package.json` and is inlined at build time by Vite as
 * `__APP_VERSION__` (see the `define` block in web/vite.config.ts). package.json
 * is the single source of truth, so the number shown in the UI can never drift
 * from the released tag.
 *
 * The `typeof` guard is load-bearing, not defensive noise: this module is
 * reachable from two bundlers that do NOT define the constant.
 *   - Metro, because mobile/babel.config.js aliases `@` to ../src, so anything
 *     under src/ can be pulled into the in-repo Expo app.
 *   - Vitest, whose config has no `define` block.
 * Without the guard, either one would throw a ReferenceError on an undeclared
 * global. With it they get an empty string, and callers render nothing.
 *
 * Format is `<network-version>-<build>`, e.g. `2.1.0-1`. The base tracks the
 * Quilibrium network release the app runs against and only moves when the
 * network does; the counter increments every release and resets on a base
 * change. See .claude/skills/release/SKILL.md.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';
