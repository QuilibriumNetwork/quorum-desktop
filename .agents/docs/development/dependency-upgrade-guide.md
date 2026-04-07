---
type: doc
title: "Dependency Upgrade Guide"
status: done
ai_generated: true
created: 2026-04-07
updated: 2026-04-07
related_docs:
  - ".agents/docs/development/unused-dependencies-analysis.md"
related_tasks:
  - ".agents/tasks/dependency-updates-audit.md"
---

# Dependency Upgrade Guide

> **Warning: AI-Generated**: May contain errors. Verify before use.

## Overview

This guide documents the upgrade constraints, architecture-specific pitfalls, and resolution patterns for the quorum-desktop dependency stack. It exists because several packages have non-obvious upgrade blockers, and the Vite 8 (Rolldown) bundler has different behavior from Vite 6 (esbuild) that affects plugin hooks, polyfill resolution, and dependency optimization.

## Package Upgrade Blockers

These packages cannot be upgraded to their latest major versions without addressing specific incompatibilities first.

### Tailwind CSS (stay on 3.x)

v4 is a full rewrite with an entirely different architecture:
- Replaces the PostCSS plugin + `tailwind.config.js` pattern with a new CSS-first engine
- The `withOpacityValue` helper pattern used in `tailwind.config.js` does not exist in v4
- Migration requires rewriting all config, removing the PostCSS plugin, and adopting the new `@theme` directive syntax
- This is a large standalone task, not something to bundle with other upgrades

### @vitejs/plugin-react (stay on 5.x)

v6 drops Babel entirely in favor of Oxc transforms. The Lingui i18n pipeline depends on Babel:
- `@lingui/babel-plugin-lingui-macro` runs as a Babel plugin via `react({ babel: { plugins: [...] } })`
- v5.x supports Vite 8 while keeping Babel integration
- **Unblock condition**: Lingui ships an Oxc-native plugin (tracked in [lingui/js-lingui#2283](https://github.com/lingui/js-lingui/issues/2283))

### vite-plugin-static-copy (stay on 3.x)

v4 switches from `fast-glob` to `tinyglobby`, which defaults to `onlyFiles: true`:
- The emoji copy pattern `node_modules/emoji-datasource-twitter/img/twitter/*` relies on matching directories
- v3.x supports Vite 8 and uses `fast-glob` which handles directories
- **Unblock condition**: Adjust glob patterns to work with `tinyglobby`, or pass `onlyFiles: false` if v4 exposes that option

### ESLint ecosystem (stay on 9.x)

ESLint 10.x is a major config overhaul. All ecosystem plugins (`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `@eslint/js`) are version-tied. This is a separate migration task.

## Vite 8 (Rolldown) Architecture

Vite 8 replaces esbuild with Rolldown as the bundler for both production builds and the dev server dependency optimizer. Key behavioral differences:

### Build Phase: `rollupOptions` -> `rolldownOptions`

The `build.rollupOptions` config key is renamed to `build.rolldownOptions`. The options are largely compatible but some Rollup-specific fields may not exist in Rolldown.

### Plugin Hooks in the Optimizer

**Critical difference**: In Vite 6 (esbuild optimizer), Vite plugin `resolveId` hooks ran during dependency pre-bundling. In Vite 8 (Rolldown optimizer), **they do not**. Only `resolve.alias` entries are applied during the optimizer phase.

This means plugins that rewrite specifiers (like `vite-plugin-node-polyfills` rewriting `buffer` to `vite-plugin-node-polyfills/shims/buffer`) produce bare specifiers that nothing can resolve during pre-bundling.

**Workaround**: Do not force-include packages that import Node built-ins in `optimizeDeps.include`. Let Vite serve them as native ES modules in dev mode, where the full plugin pipeline runs.

### Dependency Optimizer: Late Discovery and Stale Hashes

The Rolldown optimizer scans entry points upfront but discovers additional transitive dependencies during page load. When new deps are found, it re-bundles everything, producing new chunk hashes. If the browser already loaded modules referencing old hashes, it gets `Pre-transform error: The file does not exist` errors and blank pages.

**Fix**: Pre-include all deps that get discovered late in `optimizeDeps.include`:

```ts
optimizeDeps: {
  include: [
    '@dnd-kit/core',
    '@dnd-kit/sortable',
    '@noble/hashes/sha2',
    '@quilibrium/quorum-shared > @tabler/icons-react', // linked package transitive dep
    'remark-parse',
    'remark-stringify',
    'strip-markdown',
    'unified',
    'vite-plugin-node-polyfills/shims/buffer',
    'vite-plugin-node-polyfills/shims/global',
    'vite-plugin-node-polyfills/shims/process',
  ],
}
```

**How to diagnose**: Run `yarn dev`, load the page, and look for `new dependencies optimized:` messages in the terminal. Any dep listed there should be added to `optimizeDeps.include`. If you see `optimized dependencies changed. reloading` followed by `Pre-transform error`, that's a stale hash issue.

**Linked packages**: For deps that live in a linked package's `node_modules` (not ours), use the `parent > child` syntax: `'@quilibrium/quorum-shared > @tabler/icons-react'`.

### esbuild Deprecation Warning

`vite-plugin-node-polyfills` 0.26.0 sets both `esbuild` and `oxc` transform options. Vite 8 shows a deprecation warning but uses the `oxc` path correctly. The polyfills work fine. This warning disappears when the plugin releases a Vite 8-native version.

## Polyfill Shim Resolution Architecture

The project uses `vite-plugin-node-polyfills` to polyfill Node built-ins (`buffer`, `process`, `global`) for browser environments. The resolution has two code paths because of how Vite serves modules differently in dev vs build:

### How It Works

1. **`nodePolyfills` plugin** rewrites Node built-in imports (e.g. `import { Buffer } from 'buffer'`) to bare shim specifiers (e.g. `vite-plugin-node-polyfills/shims/buffer`)

2. **Build phase** (`yarn build`): The `resolvePolyfillShims()` custom plugin catches these bare specifiers via a `resolveId` hook and maps them to absolute paths in `node_modules/vite-plugin-node-polyfills/shims/*/dist/index.js`

3. **Dev server** (`yarn dev`): The `resolve.alias` entries in the Vite config catch the same bare specifiers during on-demand module transforms

Both paths use the same `polyfillShimAliases` map defined at the top of `web/vite.config.ts`.

### Why Two Paths Are Needed

- `resolve.alias` runs once before plugins, so it catches specifiers in the initial source. But when `nodePolyfills` rewrites specifiers mid-pipeline, `resolve.alias` doesn't get a second pass in the build phase. The `resolveId` hook does.
- In the dev server, each module is transformed on-demand and the alias applies per-request, so it catches the rewritten specifiers correctly.

### When Modifying Polyfills

If adding new Node built-in polyfills:
1. Add the shim path to `polyfillShimAliases` in `web/vite.config.ts`
2. The `resolvePolyfillShims()` plugin and `resolve.alias` both spread from the same object, so a single addition covers both paths
3. Add the shim specifier to `optimizeDeps.include` to prevent late discovery in dev mode

## Linked Package Considerations

`@quilibrium/quorum-shared` is linked locally (`link:../quorum-shared`). This creates several resolution challenges:

- **Must be in `optimizeDeps.exclude`**: Source files need `.web.tsx` platform-specific resolution, which pre-bundling skips
- **React deduplication**: Both the main app and quorum-shared import `react`. Without explicit aliases, the dev server may resolve two separate React instances, causing hooks to fail. The `resolve.alias` entries for `react`, `react-dom`, `react/jsx-runtime`, and `react/jsx-dev-runtime` force everything to the same instance
- **Transitive deps**: Deps installed in quorum-shared's `node_modules` (not hoisted to the root) need the `parent > child` syntax in `optimizeDeps.include`

## Useful Commands

| Command | Purpose |
|---------|---------|
| `yarn dev` | Start dev server |
| `yarn dev:clean` | Clear `.vite` cache and start dev server (use after config changes) |
| `yarn build` | Production build (~15-20s with Vite 8) |
| `yarn test:run` | Run all tests (383 as of 2026-04-07) |
| `npx tsc --noEmit --jsx react-jsx --skipLibCheck` | Type check without building |

## Related Documentation

- [Unused Dependencies Analysis](.agents/docs/development/unused-dependencies-analysis.md)
- [Dependency Updates Audit Task](.agents/tasks/dependency-updates-audit.md)
- [Vite 8 Migration Guide](https://vite.dev/guide/migration.html)

---

*Created: 2026-04-07*
