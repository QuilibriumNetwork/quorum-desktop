---
type: bug
title: "vite-plugin-favicons-inject fails with NO_FILES_FOUND during production build"
status: solved
priority: medium
ai_generated: true
created: 2026-03-18
updated: 2026-03-18
---

# vite-plugin-favicons-inject fails with NO_FILES_FOUND during production build

> **AI-Generated**: May contain errors. Verify before use.

## Symptoms

Running `yarn build` fails at the `closeBundle` stage after all 7733 modules transform successfully:

```
vite v6.3.5 building for production...
✓ 7733 modules transformed.
✗ Build failed in 18.27s
error during build:
[vite-plugin-favicon-inject] NO_FILES_FOUND
    at Object.closeBundle (node_modules/vite-plugin-favicons-inject/dist/cjs/index.js:94:15)
```

Dev server (`yarn dev`) is unaffected — favicons are not processed in dev mode.

## Root Cause

The favicon source file `public/quorumicon-blue.svg` exists, but the plugin's `closeBundle` hook can't find generated favicon assets in the output directory. Likely caused by the `root`/`outDir` configuration in `web/vite.config.ts:90-113`:

- `root` is set to project root (`resolve(__dirname, '..')`)
- `outDir` is `dist/web`
- Build input switches between `web/index.html` (dev) and root `index.html` (build)

The plugin may be looking for generated assets relative to the wrong directory, or the favicon generation step silently fails before `closeBundle` runs.

**Key file:** `web/vite.config.ts:121-124` — plugin config:
```typescript
vitePluginFaviconsInject('public/quorumicon-blue.svg', {
  appName: 'Quorum',
  appDescription: 'Quorum is a decentralized social media platform.',
}),
```

## Solution

Removed `vite-plugin-favicons-inject` entirely and replaced with static `<link>` tags in all HTML files (`index.html`, `web/index.html`, `public/404.html`):
```html
<link rel="icon" type="image/svg+xml" href="/quorumicon-blue.svg" />
<link rel="icon" type="image/png" href="/quorumicon-blue.png" />
<link rel="apple-touch-icon" href="/quorumicon-blue.png" />
```
Also removed the `injectFaviconsInto404` Vite plugin (no longer needed) and the package dependency.

## Prevention

When changing Vite's `root` or `outDir` settings, verify all plugins that interact with the filesystem still resolve paths correctly. Run `yarn build` (not just `yarn dev`) to catch `closeBundle`-phase issues.
