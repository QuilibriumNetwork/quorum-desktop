---
type: bug
title: "vite-plugin-favicons-inject fails with NO_FILES_FOUND during production build"
status: open
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

Not yet fixed. Possible approaches:
1. Use absolute path for the favicon source: `resolve(__dirname, '../public/quorumicon-blue.svg')`
2. Check if `outDir` resolution conflicts with the plugin's asset lookup
3. Consider replacing `vite-plugin-favicons-inject` with a simpler favicon setup if the plugin doesn't support custom root/outDir configurations

## Prevention

When changing Vite's `root` or `outDir` settings, verify all plugins that interact with the filesystem still resolve paths correctly. Run `yarn build` (not just `yarn dev`) to catch `closeBundle`-phase issues.
