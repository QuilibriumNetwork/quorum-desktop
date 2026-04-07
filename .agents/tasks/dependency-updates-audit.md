---
type: task
title: "Dependency Updates Audit"
status: done
complexity: high
ai_generated: true
reviewed_by:
  - feature-analyzer
  - security-analyst
created: 2026-02-24
updated: 2026-04-07
related_docs:
  - ".agents/docs/development/unused-dependencies-analysis.md"
branch: chore/dependency-updates
---

# Dependency Updates Audit

> **Warning: AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent, security-analyst agent

**Branch**: `chore/dependency-updates` (8 commits, based on `main`)

## Summary: What Was Updated

| Package | From | To | Notes |
|---------|------|----|-------|
| **All deps** | various | latest in `^` range | Phase 1: safe semver bumps |
| `@types/react` | 18.3.12 | 19.2.14 | Phase 2 |
| `@types/react-dom` | 18.3.1 | 19.2.3 | Phase 2 |
| `electron` | 33.2.1 | 41.1.1 | Phase 3: Chromium 130->146 (security) |
| `electron-builder` | 25.1.8 | 26.8.1 | Phase 3 |
| `vite` | 6.3.5 | 8.0.5 | Phase 4: Rolldown bundler, 3x faster builds |
| `@vitejs/plugin-react` | 4.7.0 | 5.2.0 | Phase 4 |
| `vitest` | 2.1.9 | 4.1.2 | Phase 4 |
| `@vitest/ui` | 2.1.9 | 4.1.2 | Phase 4 |
| `vite-plugin-static-copy` | 2.3.2 | 3.4.0 | Phase 4 |
| `vite-plugin-node-polyfills` | 0.24.0 | 0.26.0 | Phase 4 |
| `react` | 19.0.0 | 19.2.4 | Phase 5: patch bump |
| `react-dom` | 19.0.0 | 19.2.4 | Phase 5: patch bump |
| `jsdom` | 25.0.1 | 29.0.2 | Phase 5: test-only |
| `react-dropzone` | 14.4.1 | 15.0.0 | Peer dep actually covers React 19 |
| `typescript` | (transitive) | 5.9.3 | Made explicit dev dep (hoisting fix) |
| `cross-env` | (new) | 10.1.0 | Fix: Windows-compatible npm scripts |

## Summary: What Was Skipped (and Why)

| Package | Current | Latest | Why skipped |
|---------|---------|--------|-------------|
| `tailwindcss` | 3.4.x | 4.2.x | v4 requires entirely new config format, PostCSS plugin arch incompatible |
| `@vitejs/plugin-react` | 5.2.0 | 6.0.1 | v6 drops Babel; breaks our Lingui macro pipeline |
| `vite-plugin-static-copy` | 3.4.0 | 4.0.1 | v4's tinyglobby breaks our emoji glob patterns |
| `eslint` + ecosystem | 9.x | 10.x | Large config migration, separate task |
| `react-dropzone` | 14.4.1 | 15.0.0 | v15 peer dep doesn't declare React 19 support |
| `base58-js` | 2.0.0 | 3.0.3 | Only used in mobile build, not desktop |

## Summary: Config Changes

- `web/vite.config.ts`: `build.rollupOptions` -> `build.rolldownOptions`; polyfill shim resolution refactored; `optimizeDeps.include` populated with late-discovered deps to prevent stale hash errors
- `vitest.config.ts`: React deduplication aliases added (Vitest 4 resolution change)
- `eslint.config.js`: React version setting `'18.3'` -> `'19.0'`
- `package.json`: Added `dev:clean` and `cross-env` scripts

## What & Why

The project had significant dependency drift. Keeping dependencies current reduces security vulnerabilities, improves performance, and ensures access to bug fixes and new features.

**Security urgency**: Electron 33.x bundled Chromium 130.x which had multiple high-severity CVEs (CVE-2025-4609, CVE-2025-2783). Resolved by upgrading to Electron 41.

## Context
- **Package manager**: Yarn 1.x (never use npm)
- **Build tool**: Vite 8.x with Rolldown bundler (upgraded from Vite 6.x with Rollup)
- **Desktop**: Electron 41.x (upgraded from 33.x)
- **React**: 19.2.4 (upgraded from 19.0.0), types now v19 (upgraded from v18)
- **Tailwind**: 3.4.x (v4 blocked)
- **Cross-repo dependency**: `@quilibrium/quorum-shared` is linked locally (`link:../quorum-shared`)

## Implementation Progress

### Phase 1: Safe Within-Range Updates - DONE
**Commit**: `a2b6fc5c`

Ran `yarn upgrade` to pull all packages to latest versions within existing `^` semver ranges.

**Verified**: build, tests (383 passed).

### Phase 2: Fix React Types Mismatch - DONE
**Commit**: `4c0b0ef0`

- `@types/react` 18.3.12 -> 19.2.14
- `@types/react-dom` 18.3.1 -> 19.2.3
- Updated `eslint.config.js` react version setting from `'18.3'` to `'19.0'` (both config blocks)

**Decision**: `quorum-shared` was verified safe for React 19 types (exports only domain types, React Query hooks, and pure utilities; zero React component/FC/forwardRef/ReactNode usage).

**Verified**: zero new type errors, build, tests (383 passed).

### Phase 3: Electron Upgrade - DONE
**Commit**: `db575155`

- `electron` 33.2.1 -> 41.1.1 (Chromium 130 -> 146)
- `electron-builder` 25.1.8 -> 26.8.1

**Decision**: Jumped directly to Electron 41 because our Electron usage is minimal and conservative (basic BrowserWindow, simple IPC handlers for window controls, no deprecated APIs). Research confirmed none of the breaking changes across v34-41 affect our code:
- No `session.clearStorageData()` usage (despite original task assumption)
- No clipboard API in renderer
- No session-level preloads (we use `webPreferences.preload`)
- `contextIsolation: true` and `nodeIntegration: false` already set correctly

**NOT addressed in this phase** (pre-existing issues, not introduced by upgrade):
- `webSecurity: isDev ? false : true` in `main.cjs:52`
- Unvalidated `quorum://` protocol handler in `main.cjs:91-98`

**Verified**: build, tests (383 passed). **Manual Electron testing still needed** (see Remaining Work).

### Phase 4: Vite 8 + Ecosystem Migration - DONE
**Commits**: `316fedd9`, `38e1c641`, pending commit (dev server fix)

Upgraded packages:
- `vite` 6.3.5 -> 8.0.5 (Rolldown bundler, ~3x faster builds: 44s -> 15s)
- `@vitejs/plugin-react` 4.7.0 -> 5.2.0
- `vitest` 2.1.9 -> 4.1.2
- `@vitest/ui` 2.1.9 -> 4.1.2
- `vite-plugin-static-copy` 2.3.2 -> 3.4.0
- `vite-plugin-node-polyfills` 0.24.0 -> 0.26.0

**Key decisions and rationale**:

1. **`@vitejs/plugin-react` v5.2.0 (not v6.0.1)**: v6 dropped Babel entirely in favor of Oxc. Our Lingui macro pipeline (`@lingui/babel-plugin-lingui-macro`) requires Babel integration. v5.2.0 supports Vite 8 while keeping the `babel: { plugins: [...] }` config. When Lingui ships an Oxc-native plugin (tracked in [lingui/js-lingui#2283](https://github.com/lingui/js-lingui/issues/2283)), we can upgrade to v6.

2. **`vite-plugin-static-copy` v3.4.0 (not v4.0.1)**: v4 switched from `fast-glob` to `tinyglobby`, which has `onlyFiles: true` by default. Our existing glob pattern `node_modules/emoji-datasource-twitter/img/twitter/*` relies on matching directories, which `tinyglobby` doesn't do. v3.4.0 supports Vite 8, keeps `fast-glob`, and requires no config changes.

3. **Config changes**:
   - `build.rollupOptions` renamed to `build.rolldownOptions` (Vite 8 convention)
   - Added React deduplication aliases to `vitest.config.ts` (Vitest 4 changed module resolution, causing dual React instances when testing components using quorum-shared primitives)
   - Extracted `polyfillShimAliases` constant shared between the `resolvePolyfillShims()` plugin and `resolve.alias`

**Verified**: production build passes (15s), all 383 tests pass, dev server works.

### Phase 5: Other Major Version Bumps - DONE
**Commit**: `7536b3e2`

- `react` 19.0.0 -> 19.2.4 (patch bump)
- `react-dom` 19.0.0 -> 19.2.4 (patch bump)
- `jsdom` 25.0.1 -> 29.0.2 (test-only dependency)

**Verified**: build, tests (383 passed).

### Skipped Packages (with rationale)

| Package | Current | Latest | Why skipped |
|---------|---------|--------|-------------|
| `tailwindcss` | 3.4.x | 4.2.x | Stack incompatible (PostCSS plugin arch, config format) |
| `@vitejs/plugin-react` | 5.2.0 | 6.0.1 | Drops Babel, breaks Lingui macro pipeline |
| `vite-plugin-static-copy` | 3.4.0 | 4.0.1 | Breaks glob patterns (tinyglobby vs fast-glob) |
| `eslint` | 9.39.4 | 10.2.0 | Large config migration, separate task |
| `@eslint/js` | 9.39.4 | 10.0.1 | Tied to ESLint 10 ecosystem |
| `eslint-plugin-react-hooks` | 5.2.0 | 7.0.1 | Tied to ESLint ecosystem |
| `eslint-plugin-react-refresh` | 0.4.26 | 0.5.2 | Tied to ESLint ecosystem |
| `globals` | 15.15.0 | 17.4.0 | Tied to ESLint ecosystem |
| `base58-js` | 2.0.0 | 3.0.3 | Only used in `crypto.native.ts` (mobile, not desktop build) |

## Remaining Work

### RESOLVED: Dev Server Optimizer Issues

**Issue 1 - Optimizer crash**: `@quilibrium/quilibrium-js-sdk-channels` was in `optimizeDeps.include` (a Vite 6 workaround). In Vite 8's Rolldown optimizer, plugin `resolveId` hooks don't run during pre-bundling, so `buffer` -> `vite-plugin-node-polyfills/shims/buffer` rewrite couldn't resolve. **Fix**: Removed the SDK from `optimizeDeps.include`. Vite 8 serves it as a native ES module.

**Issue 2 - Stale hash / blank page**: The optimizer discovered deps in waves during page load (`@dnd-kit/core`, `@noble/hashes/sha2`, `@tabler/icons-react`, remark plugins, polyfill shims), causing re-bundling (x2, x3). Intermediate chunks got stale hashes (e.g. `core.esm-B-qWGNUm.js`) leading to Pre-transform errors and blank pages. **Fix**: Added all late-discovered deps to `optimizeDeps.include` so the optimizer bundles everything in a single pass. Used `@quilibrium/quorum-shared > @tabler/icons-react` syntax for the linked package's transitive dep.

**Also added**: `yarn dev:clean` script (clears `.vite` cache and starts dev server).

### Manual Testing - DONE

All verified manually:

1. **Dev server** (`yarn dev`): App loads, no optimizer errors
2. **Electron** (`yarn electron:dev`): Desktop app launches (fixed cross-env for Windows)
3. **Emoji rendering**: Twitter-style emojis render correctly
4. **WASM modules**: Login + messaging work (crypto/signing functional)
5. **Drag and drop**: Server reordering in nav menu works (dnd-kit)
6. **quorum-shared integration**: Primitives render correctly

### Not In Scope (separate tasks)

- ESLint 10.x migration (large config overhaul)
- Tailwind CSS 4.x migration (architecture-incompatible)
- `webSecurity: false` in dev mode (pre-existing)
- Unvalidated `quorum://` protocol handler (pre-existing)

## Commit History (branch: chore/dependency-updates)

```
815ded28 chore: add cross-env for cross-platform npm scripts
1b3620b9 chore: fix Vite 8 dev server optimizer issues
38e1c641 chore: refactor polyfill shim resolution for Vite 8 compatibility
7536b3e2 chore: upgrade React 19.0 to 19.2.4 and jsdom 25 to 29 (Phase 5)
316fedd9 chore: upgrade to Vite 8 + ecosystem (Phase 4)
db575155 chore: upgrade Electron 33 to 41 and electron-builder 25 to 26 (Phase 3)
4c0b0ef0 chore: upgrade React types to v19 and update eslint react version (Phase 2)
a2b6fc5c chore: apply within-range dependency updates (Phase 1)
```

## Verification

**After each phase** (all passed for production build):

1. **Build passes**: `yarn build` (15-21s with Vite 8, down from 44s)
2. **Tests pass**: `yarn test:run` (383 passed, 2 todo)
3. **No new type errors**: `npx tsc --noEmit --jsx react-jsx --skipLibCheck` (2168 pre-existing, unchanged)
4. **Lint baseline**: 78 errors, 295 warnings (all pre-existing, unchanged)

**All verified** (automated + manual).

---

*Updated: 2026-04-07*
