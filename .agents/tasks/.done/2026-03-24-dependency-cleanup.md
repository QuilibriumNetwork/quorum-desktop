# Dependency Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unused dependencies, move misplaced deps to devDependencies, and clean up the mobile test harness — all verified by automated checks after each step.

**Architecture:** Execute in order of confidence (highest first). Each task removes a batch, then runs the full verification suite (`yarn build`, `yarn test:run`, `yarn lint`, `npx tsc --noEmit`). If verification fails, revert and investigate before proceeding. One commit per successful task.

**Tech Stack:** yarn workspaces, Vite, Vitest, ESLint, TypeScript, Expo (mobile test harness)

**Reference:** Analysis doc at `.agents/docs/development/unused-dependencies-analysis.md`

**Branch:** `chore/dependency-cleanup` (already created off `main`)

---

## Verification Protocol

Every task ends with the same verification sequence. If ANY step fails, the task is blocked — do not commit, revert and investigate.

```bash
# 1. TypeScript compilation
npx tsc --noEmit --jsx react-jsx --skipLibCheck

# 2. Vite production build
yarn build

# 3. Tests
yarn test:run

# 4. Lint
yarn lint
```

**On failure — standard rollback:**
```bash
git checkout -- package.json mobile/package.json yarn.lock && yarn install
```
This restores the last committed state. Then investigate which specific package caused the failure.

**Note:** Mobile bundling (`expo start`) cannot be verified automatically. After Task 3 (mobile cleanup) is merged, a manual `expo start` should be run to confirm the test harness still bundles.

---

### Task 1: Phase 1 — Remove unused root dependencies (HIGH confidence)

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock` (auto-updated)

These have 95–100% confidence. Zero imports, zero config references.

- [ ] **Step 1: Remove unused production deps**

```bash
yarn remove @dnd-kit/modifiers @expo/metro-runtime @iden3/js-crypto electron-is-dev
```

- [ ] **Step 2: Remove unused dev deps**

```bash
yarn remove @vitejs/plugin-basic-ssl babel-plugin-macros sass-embedded unenv
```

- [ ] **Step 3: Run verification protocol**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn build && yarn test:run && yarn lint
```

Expected: all pass. If `sass-embedded` removal causes SCSS issues, add it back and note in the analysis doc.

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: remove unused root dependencies (phase 1)

Remove 8 packages with zero imports or config references:
- Production: @dnd-kit/modifiers, @expo/metro-runtime, @iden3/js-crypto, electron-is-dev
- Dev: @vitejs/plugin-basic-ssl, babel-plugin-macros, sass-embedded, unenv"
```

---

### Task 2: Phase 3 — Move misplaced deps to devDependencies

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock` (auto-updated)

These are build-time/tooling deps in `dependencies` that belong in `devDependencies`. Verified safe: electron-builder only bundles `dist/**/*` and `web/electron/**/*`, not `node_modules`.

- [ ] **Step 1: Move deps in package.json**

Edit `package.json` directly: move these 6 entries from `"dependencies"` to `"devDependencies"`, preserving their version specifiers. Then run `yarn install` to update the lockfile. Do NOT use `yarn remove` + `yarn add -D` — that creates a transient state where packages are uninstalled.

Packages to move:
- `typescript-eslint`
- `sass`
- `@lingui/babel-plugin-lingui-macro`
- `@lingui/cli`
- `@lingui/vite-plugin`
- `vite-plugin-static-copy`

```bash
yarn install
```

- [ ] **Step 2: Run verification protocol**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn build && yarn test:run && yarn lint
```

Expected: all pass. These packages are still installed, just in the correct section.

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: move build-time deps to devDependencies (phase 3)

Move 6 packages that are only used at build/lint time:
typescript-eslint, sass, @lingui/babel-plugin-lingui-macro,
@lingui/cli, @lingui/vite-plugin, vite-plugin-static-copy

electron-builder only bundles dist/ and web/electron/, not node_modules,
so this has no effect on Electron packaging."
```

---

### Task 3: Phase 4 — Remove unused mobile workspace deps

**Files:**
- Modify: `mobile/package.json`
- Modify: `yarn.lock` (auto-updated)

The mobile workspace is a test harness only. These 13 packages are not imported anywhere — navigation, crypto polyfills, and icons belong in the standalone mobile repo.

- [ ] **Step 1: Remove all unused mobile deps in one pass**

```bash
cd mobile && yarn remove expo-document-picker expo-image-picker expo-media-library expo-device react-native-crypto react-native-randombytes react-native-get-random-values @react-navigation/bottom-tabs @react-navigation/native @react-navigation/stack react-native-screens react-native-reanimated @tabler/icons-react-native
```

- [ ] **Step 2: Run verification protocol (from root)**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn build && yarn test:run && yarn lint
```

Expected: all pass. None of these are imported in source code.

- [ ] **Step 3: Commit**

```bash
git add mobile/package.json yarn.lock
git commit -m "chore: remove unused mobile test harness deps (phase 4)

Remove 13 packages not imported in any source file:
- Unused Expo: expo-document-picker, expo-image-picker, expo-media-library, expo-device
- Crypto polyfills (SDK work belongs in standalone repo): react-native-crypto,
  react-native-randombytes, react-native-get-random-values
- Navigation (will be built in standalone repo): @react-navigation/bottom-tabs,
  @react-navigation/native, @react-navigation/stack, react-native-screens,
  react-native-reanimated
- Icons (resolved via quorum-shared primitives): @tabler/icons-react-native

Eliminates sjcl@1.0.8 (HIGH severity Dependabot alert) from lockfile."
```

---

### Task 4: Phase 2A — Remove low-risk Node polyfills

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock` (auto-updated)

These are the polyfills least likely to be needed transitively (uncommon/deprecated Node APIs).

- [ ] **Step 1: Remove batch A**

```bash
yarn remove dns.js domain-browser tty-browserify vm-browserify punycode timers-browserify
```

- [ ] **Step 2: Run verification protocol**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn build && yarn test:run && yarn lint
```

Expected: all pass. If build fails with a missing module error, add back the specific package that failed and note it in the analysis doc.

- [ ] **Step 3: Commit (only if all pass)**

```bash
git add package.json yarn.lock
git commit -m "chore: remove low-risk Node polyfills (phase 2A)

Remove 6 polyfills with no direct imports and low transitive usage:
dns.js, domain-browser, tty-browserify, vm-browserify, punycode, timers-browserify

vite-plugin-node-polyfills provides its own bundled versions as fallback."
```

---

### Task 5: Phase 2B — Remove medium-risk Node polyfills

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock` (auto-updated)

- [ ] **Step 1: Remove batch B**

```bash
yarn remove assert browserify-zlib https-browserify string_decoder url
```

- [ ] **Step 2: Run verification protocol**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn build && yarn test:run && yarn lint
```

If build fails, add back the failing package(s) individually and re-verify.

- [ ] **Step 3: Commit (only if all pass)**

```bash
git add package.json yarn.lock
git commit -m "chore: remove medium-risk Node polyfills (phase 2B)

Remove 5 polyfills with no direct imports:
assert, browserify-zlib, https-browserify, string_decoder, url"
```

---

### Task 6: Phase 2C — Remove high-risk Node polyfills

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock` (auto-updated)

These are the most commonly used as transitive deps. Highest chance of breakage.

- [ ] **Step 1: Remove batch C**

```bash
yarn remove events path-browserify readable-stream stream-browserify util
```

- [ ] **Step 2: Run verification protocol**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn build && yarn test:run && yarn lint
```

If build fails, add back packages one at a time to isolate which are actually needed. Update analysis doc with findings.

- [ ] **Step 3: Commit (only if all pass)**

```bash
git add package.json yarn.lock
git commit -m "chore: remove high-risk Node polyfills (phase 2C)

Remove 5 polyfills with no direct imports but common transitive usage:
events, path-browserify, readable-stream, stream-browserify, util

vite-plugin-node-polyfills provides bundled fallbacks for all of these."
```

---

### Task 7: Update analysis doc and finalize

- [ ] **Step 1: Update the analysis doc**

Update `.agents/docs/development/unused-dependencies-analysis.md`:
- Mark completed phases as done
- Note any packages that had to be kept back due to verification failures
- Update the date

- [ ] **Step 2: Commit**

```bash
git add .agents/docs/development/unused-dependencies-analysis.md
git commit -m "docs: update dependency analysis with cleanup results"
```

---

_Plan created: 2026-03-24_
