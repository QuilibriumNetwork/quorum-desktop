---
type: task
title: "Dependency Updates Audit"
status: open
complexity: high
ai_generated: true
reviewed_by:
  - feature-analyzer
  - security-analyst
created: 2026-02-24
updated: 2026-02-24
related_docs:
  - ".agents/docs/development/unused-dependencies-analysis.md"
---

# Dependency Updates Audit

> **Warning: AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent, security-analyst agent

**Files**:
- `package.json`
- `yarn.lock`
- `web/vite.config.ts`
- `web/electron/main.cjs`
- `tailwind.config.js`
- `postcss.config.js`
- `eslint.config.js`

## What & Why

The project has accumulated significant dependency drift across quorum-desktop. Many packages are multiple minor or major versions behind their latest releases. Keeping dependencies current reduces security vulnerabilities, improves performance, and ensures access to bug fixes and new features.

**Constraint**: Tailwind CSS v4 is explicitly blocked because the current stack (PostCSS plugin architecture, `tailwind.config.js`, `withOpacityValue` pattern) is incompatible with v4's new engine. Stay on v3.x.

**Security urgency**: Electron 33.x bundles Chromium 130.x which has multiple high-severity CVEs patched in later versions, including CVE-2025-4609 (critical sandbox escape) and CVE-2025-2783. For a messaging app handling cryptographic keys and plaintext messages, this is high priority.

## Context
- **Package manager**: Yarn 1.x (never use npm)
- **Build tool**: Vite 6.x with plugin ecosystem
- **Desktop**: Electron 33.x (Chromium 130.x — multiple known CVEs)
- **React**: 19.0.0 (but types are still v18)
- **Tailwind**: 3.4.x (v4 blocked)
- **Cross-repo dependency**: `@quilibrium/quorum-shared@2.1.0-2` is hard-pinned (no `^`)
- **Related analysis**: Previous unused-deps audit in `.agents/docs/development/unused-dependencies-analysis.md`

**Note on version numbers**: Specific version numbers in this task reflect a snapshot from `yarn outdated`. Always run `yarn upgrade` to get the actual latest within declared ranges rather than targeting specific versions listed here.

**Note on `autoprefixer`/`postcss`**: The earlier `unused-dependencies-analysis.md` incorrectly listed these as unused. They ARE actively used via `postcss.config.js` for the Tailwind build pipeline. Do not remove them.

## Prerequisites
- [ ] Branch created from `develop`
- [ ] No conflicting PRs modifying `package.json` or `yarn.lock`
- [ ] Current `yarn build` passes before starting
- [ ] Run `yarn audit` to establish a baseline of existing advisories
- [ ] Commit current `yarn.lock` as a clean snapshot before starting (enables bisection if regressions occur)
- [ ] Verify whether `@lingui/core` needs to be explicitly added to `package.json` (flagged as missing in `unused-dependencies-analysis.md`)
- [x] Check `@quilibrium/quorum-shared@2.1.0-2` exports for React 19 type compatibility — **CLEAR: no blocker**. Package exports only domain types, React Query hooks, and pure utilities. Zero React component/FC/forwardRef/ReactNode usage.

## Implementation

### Phase 1: Safe Within-Range Updates
Run `yarn upgrade` to pull all packages to their latest versions within existing `^` semver ranges.

**Packages covered:**
- [ ] `@lingui/*` (4 packages) — minor bump
- [ ] `@tabler/icons-react` — minor bump
- [ ] `@tanstack/react-query` — minor bump
- [ ] `react-router` / `react-router-dom` — minor bump
- [ ] `react-tooltip` — minor bump
- [ ] `react-virtuoso` — minor bump
- [ ] `sass` / `sass-embedded` — minor bump (note: both are installed; verify no Vite warnings about duplicate Sass implementations)
- [ ] `typescript-eslint` — minor bump
- [ ] `eslint` ecosystem patches (eslint-plugin-react, react-hooks, react-refresh)
- [ ] `autoprefixer` — patch bump (used in `postcss.config.js`)
- [ ] `tailwindcss` — patch bump (stays on v3.x)
- [ ] `prettier` — minor bump
- [ ] `react-dropzone` — minor bump (within v14.x)
- [ ] `@testing-library/*` — patches
- [ ] `@types/react` — patch bump (within v18.x range)
- [ ] `@types/prismjs` — patch bump
- [ ] `@iden3/js-crypto` — patch bump

**Commit `yarn.lock` after this phase** for bisection if later phases introduce regressions.

**Verify:**
- `yarn build` succeeds
- `yarn lint` succeeds
- `yarn test:run` passes
- `yarn audit --level high` — no new high/critical advisories

### Phase 2: Fix React Types Mismatch + react-native-web
App runs React 19.0.0 but uses `@types/react@18.x` and `@types/react-dom@18.x`. These should match the runtime version.

**quorum-shared compatibility**: Verified — `@quilibrium/quorum-shared@2.1.0-2` exports only domain types, React Query hooks, and pure utility functions. It has zero React component exports, no `React.FC`, no `forwardRef`, no `ReactNode` usage. **No blocker** for the React 19 types upgrade.

```bash
yarn add -D @types/react@^19.0.0 @types/react-dom@^19.0.0
```

- [ ] Upgrade `react-native-web` 0.20.0 → 0.21.x in the same step (v0.21 adds React 19 support; running React 19 types with react-native-web 0.20 is an untested combination)
- [ ] Update `eslint.config.js` react version setting from `'18.3'` to `'19.0'`

**Verify:**
- `npx tsc --noEmit --jsx react-jsx --skipLibCheck` passes
- No new type errors introduced
- `yarn lint` passes with updated react version setting

### Phase 3: Electron Upgrade (security priority)
**Prioritized before Vite 7** due to active CVE exposure in Chromium 130.x (Electron 33.x):
- CVE-2025-4609: Critical sandbox escape in Chromium's Mojo component (Windows)
- CVE-2025-2783: Patched in Electron 34.4.1+
- AIKIDO-2025-10340: Policy enforcement issue in Electron 34.0-34.5.6 and 35.0-35.4.0

Upgrade Electron from 33.x to 36.x (3 major versions behind):

- [ ] Review breaking changes for Electron 34, 35, and 36
- [ ] Review CVE advisories for Chromium versions 131-136
- [ ] `electron` 33.2.1 → 36.x
- [ ] `electron-builder` 25.1.8 → 26.x
- [ ] Update `web/electron/main.cjs` if API changes require it
- [ ] Verify `session.clearStorageData()` still works correctly (Electron 36 deprecates the `quota` property — relevant if used for secure session cleanup)

**Pre-existing security issues to address during this phase:**
- [ ] **`webSecurity: isDev ? false : true`** (`main.cjs:52`) — disables same-origin policy entirely in dev mode. Consider replacing with a Vite dev server proxy configuration.
- [ ] **Unvalidated `quorum://` protocol handler** (`main.cjs:91-98`) — `app.setAsDefaultProtocolClient('quorum')` has no `open-url` event handler to validate incoming URLs. Add URL validation against an allowlist.

**Verify:**
- `yarn electron:build` succeeds
- App launches correctly on desktop
- IPC communication still works
- Window management behaves correctly
- `yarn audit --level high` — no new advisories
- Review `yarn.lock` diff for unexpected registry source URLs

### Phase 4: Vite 7 + Ecosystem Migration (requires Phase 1)
Upgrade Vite and its tightly-coupled ecosystem together:

- [ ] Read Vite 7 migration guide
- [ ] `vite` 6.3.5 → 7.x
- [ ] `@vitejs/plugin-react` — upgrade to latest version compatible with Vite 7 (check actual version, don't assume 5.x). Verify the Babel pipeline still works with `@lingui/babel-plugin-lingui-macro`.
- [ ] `vitest` / `@vitest/ui` — upgrade to latest version compatible with Vite 7 (likely 3.x, not 4.x — vitest versions track Vite major versions)
- [ ] `vite-plugin-static-copy` 2.3.2 → 3.x
- [ ] `vite-plugin-node-polyfills` 0.24.0 → 0.25.0 (the custom `resolvePolyfillShims()` plugin in `vite.config.ts` has a hardcoded path into `node_modules/vite-plugin-node-polyfills/shims/` — verify this still resolves correctly)
- [ ] `vite-plugin-favicons-inject` — verify compatibility with Vite 7 plugin API (the custom `injectFaviconsInto404` wrapper depends on `transformIndexHtml` hook behavior)
- [ ] Update `web/vite.config.ts` if API changes require it

**Verify:**
- `yarn build` succeeds
- `yarn dev` starts without errors
- `yarn test:run` passes
- Static copy of emoji assets still works
- Favicons appear correctly in both `index.html` and `dist/web/404.html`
- Mobile workspace (`yarn mobile`) still builds (Metro doesn't use Vite, but check for transitive dependency effects)

### Phase 5: Other Major Version Bumps (evaluate individually)
Each of these should be evaluated for breaking changes before upgrading:

- [ ] `react-dropzone` 14.x → 15.0.0 — check for API changes in file upload flows
- [ ] `jsdom` 25.0.1 → 26.1.0 — test-only, low risk
- [ ] `globals` 15.12.0 → 16.3.0 — ESLint globals definitions
- [ ] `@eslint/js` 9.x → 10.x — evaluate config migration needs

## DO NOT Upgrade

These packages are explicitly excluded from this task:

| Package | Current | Latest | Reason |
|---------|---------|--------|--------|
| `tailwindcss` | 3.4.x | 4.2.x | Stack incompatible (PostCSS plugin arch, config format, `withOpacityValue`) |
| Browserify polyfills | various | various | Pinned for web compatibility (`assert`, `stream-browserify`, `string_decoder`, `crypto-browserify`, `buffer`, etc.) |
| `@expo/metro-runtime` | 5.0.x | 6.x | Pinned to Expo 53 SDK version — check `mobile/package.json` for Expo version before any update |

**Note on polyfills**: `vm-browserify@0.0.4` (from 2013) is security-sensitive — it evaluates code in an iframe context. Ensure it is not used in any code path that processes untrusted peer-supplied content. Migration to `vite-plugin-node-polyfills` built-in shims is a follow-up task once Vite 7 migration (Phase 4) is stable.

## Supply Chain Security Notes

- **Commit `yarn.lock` changes per-phase** (not consolidated) for reviewable diffs and blast radius isolation
- **Run `yarn audit` after Phases 1, 3, and 4** (highest dependency surface change)
- **Use `yarn install --frozen-lockfile` in CI** — never let CI re-resolve packages
- **Review `yarn.lock` diffs for unexpected registry URLs** — all resolved URLs should point to `registry.yarnpkg.com`
- **First-party `@quilibrium/*` packages** are resolved to local paths in `vite.config.ts`, reducing supply chain risk for those

## Rollback Strategy

If any phase introduces a regression that cannot be quickly fixed:
1. Revert to the pre-phase `yarn.lock` commit: `git checkout <sha> -- yarn.lock`
2. Run `yarn install --frozen-lockfile` to restore the previous state
3. Per-phase commits enable targeted rollback without losing other phases' work

## Verification

**After each phase:**

1. **Build passes**: `yarn build`
2. **Lint passes**: `yarn lint`
3. **Tests pass**: `yarn test:run`
4. **Types check**: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
5. **Dev server works**: `yarn dev` loads without errors
6. **No console errors** in browser
7. **Security audit**: `yarn audit --level high`

**Phase 3 additionally:**
- Electron app builds and launches
- Desktop-specific features work (window management, IPC)
- Session/storage clearing works correctly

## Definition of Done
- [ ] Phase 1: All within-range updates applied and verified
- [ ] Phase 2: React types upgraded to v19 + react-native-web 0.21.x and verified
- [ ] Phase 3: Electron upgraded, desktop build verified, pre-existing security issues addressed
- [ ] Phase 4: Vite 7 migration complete and verified
- [ ] Phase 5: Other major bumps evaluated and applied where safe
- [ ] All verification checks pass (including `yarn audit`)
- [ ] No regressions in functionality
- [ ] Each phase committed separately for bisection
