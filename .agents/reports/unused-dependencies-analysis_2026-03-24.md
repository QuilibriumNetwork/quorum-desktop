---
type: doc
title: Unused Dependencies Analysis
status: done
created: 2026-01-09
updated: 2026-03-24
---

# Unused Dependencies Analysis

Full audit of root `package.json` and `mobile/package.json` dependencies.
Method: source code import search (`src/`, `mobile/`, configs, scripts) + Vite/build config analysis + Dependabot alert cross-reference.

---

## Phase 1 — Safe to Remove (Confidence: HIGH)

Zero source imports, zero config references. No ambiguity.

### Production Dependencies

| Package | Confidence | Reason Unused |
|---|---|---|
| `@dnd-kit/modifiers` | **100%** | Zero imports in `src/`. `@dnd-kit/core` and `@dnd-kit/sortable` are used, but modifiers is not. |
| `@expo/metro-runtime` | **100%** | Not imported in `src/` or `mobile/`. Not in `mobile/package.json`. |
| `@iden3/js-crypto` | **100%** | Not imported anywhere in any source file. |
| `electron-is-dev` | **100%** | Not imported or required. `web/electron/main.cjs` uses manual `process.env.NODE_ENV` check. |

### Dev Dependencies

| Package | Confidence | Reason Unused |
|---|---|---|
| `@vitejs/plugin-basic-ssl` | **100%** | Not imported in `web/vite.config.ts` or any config. |
| `babel-plugin-macros` | **100%** | Superseded by `@lingui/babel-plugin-lingui-macro`. Not in any config. |
| `sass-embedded` | **95%** | Redundant — `sass` (in dependencies) already provides SCSS compilation for Vite. Vite prefers `sass-embedded` when both are present, so removing it just means Vite falls back to `sass`. Very low risk. |
| `unenv` | **100%** | Not referenced in any source or config file. |

---

## Phase 2 — Node Polyfills (Confidence: MEDIUM)

These have no direct `import` statements in source code. `vite-plugin-node-polyfills` bundles its own `node-stdlib-browser` which should provide all of them.

**Why not 100% confidence:**
- `vite-plugin-node-polyfills` may resolve to the locally-installed package when present, falling back to its bundled version only when absent. Removing could change *which version* gets used.
- Transitive dependencies of `@quilibrium/quilibrium-js-sdk-channels` or other packages may expect specific versions at runtime.
- Polyfill resolution behavior may differ between `yarn dev`, `yarn build`, and Electron packaging.

**Recommendation:** Remove in small batches, running `yarn build` + smoke test after each batch.

| Package | Confidence | Direct imports? |
|---|---|---|
| `assert` | **75%** | None |
| `browserify-zlib` | **75%** | None |
| `dns.js` | **85%** | None (uncommon polyfill, unlikely transitive dep) |
| `domain-browser` | **85%** | None (deprecated Node API) |
| `events` | **70%** | None, but `events` is commonly required transitively |
| `https-browserify` | **75%** | None |
| `path-browserify` | **70%** | None, but `path` is commonly required transitively |
| `punycode` | **80%** | None |
| `readable-stream` | **70%** | None, but heavily used as transitive dep |
| `stream-browserify` | **70%** | None, but stream polyfills are tricky |
| `string_decoder` | **75%** | None |
| `timers-browserify` | **80%** | None |
| `tty-browserify` | **85%** | None |
| `url` | **75%** | None |
| `util` | **70%** | None, but commonly required transitively |
| `vm-browserify` | **85%** | None |

**Keep regardless:**
- **`buffer`** — directly imported in `src/App.tsx`
- **`process`** — referenced by Vite polyfill shims
- **`crypto-browserify`** — explicitly aliased in `web/vite.config.ts`

---

## Phase 3 — Misplaced Dependencies (Confidence: HIGH)

These are build-time/tooling deps incorrectly in `dependencies` instead of `devDependencies`.

**Verified safe:** `electron-builder.json` only bundles `dist/**/*` and `web/electron/**/*` — the pre-built Vite output. It does NOT read from `dependencies` to decide what to include, and does NOT bundle `node_modules`. All JS is self-contained after `vite build`. Moving these packages to `devDependencies` has zero effect on Electron packaging.

| Package | Confidence | Used In |
|---|---|---|
| `typescript-eslint` | **95%** | `eslint.config.js` only |
| `sass` | **95%** | Vite SCSS compilation (build-time) |
| `@lingui/babel-plugin-lingui-macro` | **95%** | Babel plugin in `web/vite.config.ts` |
| `@lingui/cli` | **95%** | CLI tool for `lingui:extract` / `lingui:compile` scripts |
| `@lingui/vite-plugin` | **95%** | Vite plugin in `web/vite.config.ts` |
| `vite-plugin-static-copy` | **95%** | Vite plugin in `web/vite.config.ts` |

---

## Verified USED — Do Not Remove

### Production Dependencies

| Package | Evidence |
|---|---|
| `@dnd-kit/core` | `useSpaceDragAndDrop.ts`, `NavMenu.tsx`, `useFolderDragAndDrop.ts` |
| `@dnd-kit/sortable` | `useSpaceDragAndDrop.ts`, `SpaceButton.tsx`, `FolderContainer.tsx` |
| `@lingui/react` | 28 files across `src/` |
| `@quilibrium/quilibrium-js-sdk-channels` | 79 files (services, hooks, API) |
| `@quilibrium/quorum-shared` | 130+ files |
| `@tanstack/react-query` | 88 files. Also peer dep of quorum-shared. |
| `@twemoji/parser` | 6 files (`remarkTwemoji.ts`, `ReactionsList.tsx`, etc.) |
| `buffer` | Direct import in `src/App.tsx` |
| `clsx` | `ListSearchInput.tsx`. Also peer dep of quorum-shared. |
| `compressorjs` | `src/utils/imageProcessing/compressor.ts` |
| `crypto-browserify` | Explicitly aliased in `web/vite.config.ts` |
| `dayjs` | `src/utils/dayjs.ts`. Also dep of quorum-shared. |
| `emoji-datasource-twitter` | `web/vite.config.ts` `viteStaticCopy` targets |
| `emoji-picker-react` | 11 files (message components, reactions, emoji picker) |
| `linkifyjs` | `useMessageFormatting.ts` |
| `minisearch` | `src/db/messages.ts` |
| `multiformats` | 4 files (`validation.ts`, `crypto.ts`). Also dep of quorum-shared. |
| `qrcode.react` | `UserSettingsModal/Privacy.tsx` |
| `qs` | `src/api/baseTypes.ts` |
| `react` / `react-dom` | Core framework |
| `react-dropzone` | 9 files. Also peer dep of quorum-shared. |
| `react-markdown` | `MessageMarkdownRenderer.tsx` |
| `react-router` / `react-router-dom` | 45+ files |
| `react-tooltip` | `ReactTooltip.tsx`. Also peer dep of quorum-shared. |
| `react-virtuoso` | 5 files (`MessageList.tsx`, `Channel.tsx`, etc.) |
| `remark-breaks` | `MessageMarkdownRenderer.tsx` |
| `remark-gfm` | `MessageMarkdownRenderer.tsx`, `markdownStripping.ts` |
| `strip-markdown` | `markdownStripping.ts` |

### Dev Dependencies

| Package | Evidence |
|---|---|
| `@eslint/js` | `eslint.config.js` |
| `@testing-library/*` | Test files and `src/dev/tests/setup.ts` |
| `@types/prismjs` | Types for `prismjs` used in `src/dev/docs/MarkdownViewer.tsx` |
| `@types/react` / `@types/react-dom` | Project-wide TypeScript types |
| `@vitejs/plugin-react` | `web/vite.config.ts`, `vitest.config.ts` |
| `autoprefixer` | `postcss.config.js` |
| `electron` / `electron-builder` | `electron:dev` / `electron:build` scripts |
| `eslint` + plugins | `eslint.config.js`, `lint` script |
| `fake-indexeddb` | `channelThreads.test.ts` |
| `globals` | `eslint.config.js` |
| `gray-matter` | `src/dev/docs/utils/scanMarkdownFiles.cjs` |
| `jsdom` | `vitest.config.ts` test environment |
| `postcss` | `postcss.config.js`, Vite CSS processing |
| `prettier` | `format` / `format:check` scripts |
| `prismjs` | `src/dev/docs/MarkdownViewer.tsx` (dev-only) |
| `tailwindcss` | `postcss.config.js`, `tailwind.config.js` |
| `vite` | Core build tool |
| `vite-plugin-favicons-inject` | `web/vite.config.ts` |
| `vite-plugin-node-polyfills` | `web/vite.config.ts` |
| `vitest` | `test` / `test:run` scripts |

---

## Phase 4 — Mobile Workspace (`mobile/package.json`)

Audit of all dependencies in the mobile workspace.

**Context:** The `mobile/` workspace in this repo is a **test harness only** — it exists for testing shared cross-platform code (`.native.ts` files) via test screens. The production mobile app lives in a standalone repo (`quorum-mobile`). Feature-oriented dependencies (navigation, icons, crypto polyfills) installed here in anticipation of "future features" are misplaced — those features will be built in the standalone repo, not here. This workspace only needs what the test screens actually import.

### Safe to Remove (Confidence: HIGH)

Not imported in any source file or config.

| Package | Confidence | Reason Unused |
|---|---|---|
| `expo-media-library` | **90%** | Not imported anywhere. |
| `expo-device` | **90%** | Not imported anywhere. |
| `react-native-crypto` | **90%** | Not imported. Installed for SDK integration that will happen in the standalone mobile repo. |
| `react-native-randombytes` | **90%** | Not imported. Peer dep of `react-native-crypto`. Pulls in vulnerable `sjcl` (HIGH severity Dependabot alert: missing ECC point-on-curve validation). |
| `react-native-get-random-values` | **90%** | Not imported. Polyfill for `crypto.getRandomValues()` — no side-effect import exists at app startup. |
| `@react-navigation/bottom-tabs` | **90%** | Not imported. Navigation will be built in the standalone repo. |
| `@react-navigation/native` | **90%** | Not imported. Navigation will be built in the standalone repo. |
| `@react-navigation/stack` | **90%** | Not imported. Navigation will be built in the standalone repo. |
| `react-native-screens` | **90%** | Not imported. Only needed as peer dep of `@react-navigation/*`. |
| `react-native-reanimated` | **90%** | Not imported. Babel plugin not configured either. Peer dep of navigation. |
**Security note:** Removing `react-native-randombytes` eliminates `sjcl@1.0.8` from the lockfile, resolving the HIGH severity Dependabot alert.

### Implicit/Runtime Dependencies — Keep

| Package | Status | Note |
|---|---|---|
| `expo-constants` | Implicit | No direct imports, but commonly required by Expo internals and other Expo packages at runtime. High risk to remove. |
| `@tabler/icons-react-native` | Transitive | Not imported in this repo's source, but required by `@quilibrium/quorum-shared` native build (`dist/index.native.js`). Removing breaks Metro bundling. |
| `expo-document-picker` | Transitive | Not imported in this repo's source, but required by `quorum-shared` native build. Removing breaks Metro bundling. |
| `expo-image-picker` | Transitive | Not imported in this repo's source, but required by `quorum-shared` native build. Removing breaks Metro bundling. |

### Mobile — Verified USED

| Package | Evidence |
|---|---|
| `@react-native-async-storage/async-storage` | `src/i18n/i18n.native.ts` |
| `expo` | `mobile/index.ts`, `metro.config.js` |
| `expo-dev-client` | `mobile/app.json` plugins |
| `expo-file-system` | `useFileDownload.native.ts` |
| `expo-haptics` | `ClickToCopyContent.native.tsx`, `MessageComposer.native.tsx` |
| `expo-image` | `MessageComposer.native.tsx`, `Login.native.tsx`, `Onboarding.native.tsx` |
| `expo-linear-gradient` | `UserInitials.native.tsx`, `OnboardingStyles.native.tsx` |
| `expo-sharing` | `useFileDownload.native.ts` |
| `expo-status-bar` | `mobile/AppTest.tsx` |
| `react-native` | Extensive use across `mobile/` and `src/**/*.native.tsx` |
| `react-native-crypto-js` | `src/utils/crypto.native.ts` (independent of the crypto polyfill chain) |
| `react-native-gesture-handler` | `mobile/AppTest.tsx` |
| `react-native-image-picker` | `useFileUpload.native.ts` |
| `react-native-safe-area-context` | `mobile/App.tsx`, `AppTest.tsx`, 20+ test screens |
| `react-native-svg` | `MessageComposer.native.tsx` |
| `react` | Core framework |
| `@babel/core` (dev) | Required by Metro/Babel pipeline |
| `babel-plugin-module-resolver` (dev) | `mobile/babel.config.js` path aliases |

### Mobile Cleanup Commands

```bash
# Phase 4 — All mobile unused deps (single pass, test harness only needs what's actually imported)
cd mobile
yarn remove expo-media-library expo-device \
  react-native-crypto react-native-randombytes react-native-get-random-values \
  @react-navigation/bottom-tabs @react-navigation/native @react-navigation/stack \
  react-native-screens react-native-reanimated
# NOTE: Do NOT remove @tabler/icons-react-native, expo-document-picker, expo-image-picker
# — they are transitive deps of quorum-shared's native build (dist/index.native.js)
```

---

## Edge Cases / Notes

| Package | Status | Note |
|---|---|---|
| `base58-js` | Native only | Only imported in `src/utils/crypto.native.ts`. Not used in web build. Could move to `mobile/package.json`. |
| `@vitest/ui` | Unclear | Not in any script or config, but useful for interactive `vitest --ui`. Low risk to remove. |
| `process` | Keep | No direct imports, but Vite polyfill shims reference it. |

---

## Cleanup Commands

### Phase 1 — Do now (safe)

```bash
# Remove unused production dependencies
yarn remove @dnd-kit/modifiers @expo/metro-runtime @iden3/js-crypto electron-is-dev

# Remove unused dev dependencies
yarn remove @vitejs/plugin-basic-ssl babel-plugin-macros sass-embedded unenv
```

### Phase 2 — Do carefully (test after each batch)

```bash
# Batch A: Least likely to be needed transitively
yarn remove dns.js domain-browser tty-browserify vm-browserify punycode timers-browserify
# → yarn build + smoke test

# Batch B: More commonly used as transitive deps
yarn remove assert browserify-zlib https-browserify string_decoder url
# → yarn build + smoke test

# Batch C: Most commonly used transitively — highest risk
yarn remove events path-browserify readable-stream stream-browserify util
# → yarn build + smoke test
```

### Phase 3 — Do after verifying electron-builder behavior

```bash
# Move misplaced deps to devDependencies
yarn remove typescript-eslint sass @lingui/babel-plugin-lingui-macro @lingui/cli @lingui/vite-plugin vite-plugin-static-copy
yarn add -D typescript-eslint sass @lingui/babel-plugin-lingui-macro @lingui/cli @lingui/vite-plugin vite-plugin-static-copy
```

---

## Verification After Each Phase

1. `yarn build` — Web build must succeed
2. `yarn test:run` — Tests must pass
3. `yarn lint` — Linting must pass
4. `cd mobile && expo start` — Mobile must bundle
5. Manual smoke test: app loads, modals work, messages send, markdown renders

---

_Analysis Date: 2026-03-24_
_Method: Source import search + config file analysis (grep across src/, web/, mobile/, configs) + Dependabot alert cross-reference_
_Previous analysis: 2026-03-18 (root package.json only), 2025-01-11 (fully superseded)_
