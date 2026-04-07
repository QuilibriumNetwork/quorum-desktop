---
type: task
title: "Dependency Updates Audit"
status: in-progress
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

**Branch**: `chore/dependency-updates` (6 commits, based on `main`)
**Files**:
- `package.json`
- `yarn.lock`
- `web/vite.config.ts`
- `vitest.config.ts`
- `eslint.config.js`

## What & Why

The project had significant dependency drift. Many packages were multiple minor or major versions behind their latest releases. Keeping dependencies current reduces security vulnerabilities, improves performance, and ensures access to bug fixes and new features.

**Constraint**: Tailwind CSS v4 is explicitly blocked because the current stack (PostCSS plugin architecture, `tailwind.config.js`, `withOpacityValue` pattern) is incompatible with v4's new engine. Stay on v3.x.

**Security urgency**: Electron 33.x bundled Chromium 130.x which had multiple high-severity CVEs (CVE-2025-4609, CVE-2025-2783). Resolved by upgrading to Electron 41.

## Context
- **Package manager**: Yarn 1.x (never use npm)
- **Build tool**: Vite 8.x with Rolldown bundler (upgraded from Vite 6.x with Rollup)
- **Desktop**: Electron 41.x (upgraded from 33.x)
- **React**: 19.2.4 (upgraded from 19.0.0), types now v19 (upgraded from v18)
- **Tailwind**: 3.4.x (v4 blocked)
- **Cross-repo dependency**: `@quilibrium/quorum-shared` is linked locally (`link:../quorum-shared`)
- **Related analysis**: Previous unused-deps audit in `.agents/docs/development/unused-dependencies-analysis.md`

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

### Phase 4: Vite 8 + Ecosystem Migration - PARTIALLY DONE
**Commits**: `316fedd9`, `38e1c641`

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

**KNOWN ISSUE - Dev server optimizer fails** (see Remaining Work below).

**Verified**: production build passes, all 383 tests pass. Dev server does NOT work yet.

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
| `react-dropzone` | 14.4.1 | 15.0.0 | Peer dep says `react >= 16.8 \|\| 18.0.0`, doesn't include React 19 |
| `base58-js` | 2.0.0 | 3.0.3 | Only used in `crypto.native.ts` (mobile, not desktop build) |

## Remaining Work

### BLOCKER: Dev Server Optimizer Crash

**Status**: Unsolved. Production build works fine, dev server (`yarn dev`) crashes.

**Error**:
```
[UNLOADABLE_DEPENDENCY] Error: Could not load vite-plugin-node-polyfills/shims/buffer
╭─[ ../quilibrium-js-sdk-channels/dist/index.esm.js:1:36 ]
│
1 │ import { Buffer as Buffer$1 } from 'buffer';
│                                    ────┬───
│                                        ╰─── os error 3
───╯
```

**Root cause analysis**:
- `@quilibrium/quilibrium-js-sdk-channels` is in `optimizeDeps.include` (force pre-bundled)
- During optimizer pre-bundling, Rolldown encounters `import { Buffer } from 'buffer'`
- The `nodePolyfills` plugin's alias rewrites `buffer` -> `vite-plugin-node-polyfills/shims/buffer` (a bare specifier)
- In Vite 6 (esbuild optimizer), our `resolvePolyfillShims()` plugin's `resolveId` hook caught this and resolved it to the absolute path
- In Vite 8 (Rolldown optimizer), **Vite plugin `resolveId` hooks do NOT run during the optimizer phase**
- Adding the aliases to `resolve.alias` doesn't help either, because the alias plugin runs once and doesn't do a second pass after the nodePolyfills plugin rewrites the specifier

**What was tried**:
1. Adding polyfill aliases to `resolve.alias` - aliases don't catch specifiers produced mid-pipeline by other plugins
2. Adding polyfill aliases to `optimizeDeps.rolldownOptions.resolve.alias` - Rolldown's `InputOptions` type doesn't actually have a `resolve.alias` field (despite the research agent suggesting it)
3. Removing the `resolvePolyfillShims()` plugin and relying solely on aliases - breaks production build too

**Possible approaches to investigate**:
1. **Pass a Rolldown plugin via `optimizeDeps.rolldownOptions.plugins`** with a `resolveId` hook (the optimizer does accept plugins)
2. **Skip pre-bundling the SDK**: remove `@quilibrium/quilibrium-js-sdk-channels` from `optimizeDeps.include` and see if the dev server works without it (the comment says "Force Vite to pre-bundle or app doesn't load (WSL)" but this may be a Vite 6 issue that Vite 8 solved)
3. **Upgrade vite-plugin-node-polyfills**: check if there's a newer version or PR that handles Vite 8's optimizer natively
4. **Use the nodePolyfills plugin's own Rolldown-aware code path**: the plugin already has `this?.meta?.rolldownVersion` detection (line ~91-96 of source). It may need a config change or bug fix to also alias the shim specifiers in the optimizer context, not just the Node built-in names
5. **File an issue on vite-plugin-node-polyfills** referencing the existing [issue #142](https://github.com/davidmyersdev/vite-plugin-node-polyfills/issues/142)

### Manual Testing Needed

Once the dev server issue is resolved:

1. **Dev server** (`yarn dev`): Does the app load? Hot reloads?
2. **Electron** (`yarn electron:dev`): Desktop app launch, window controls, protocol handler
3. **Emoji rendering**: Open a chat, type an emoji, confirm `/twitter/64/*.png` images load
4. **WASM modules**: Crypto/signing modules load (try any action that triggers encryption)
5. **quorum-shared integration**: Primitives render correctly, hooks work, types resolve

### Not In Scope (separate tasks)

- ESLint 10.x migration (large config overhaul)
- Tailwind CSS 4.x migration (architecture-incompatible)
- `webSecurity: false` in dev mode (pre-existing)
- Unvalidated `quorum://` protocol handler (pre-existing)

## Commit History (branch: chore/dependency-updates)

```
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

**NOT yet verified**:
- `yarn dev` (blocked by optimizer issue)
- `yarn electron:dev` / `yarn electron:build`
- Manual UI testing

---

*Updated: 2026-04-07*
