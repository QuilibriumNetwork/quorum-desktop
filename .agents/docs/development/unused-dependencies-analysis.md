---
type: doc
title: Unused Dependencies Analysis
status: done
created: 2026-01-09
updated: 2026-03-18
---

# Unused Dependencies Analysis

Full audit of `package.json` after the primitives migration to `@quilibrium/quorum-shared`.
Method: source code import search (`src/`, configs, scripts) + Vite/build config analysis.

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

## Phase 3 — Misplaced Dependencies (Confidence: MEDIUM)

These are build-time/tooling deps incorrectly in `dependencies` instead of `devDependencies`.

**Why not 100% confidence:** `electron-builder` may use the `dependencies` field to determine what to bundle into the Electron app. Moving things out could break Electron packaging. Needs verification of `electron-builder` config behavior before acting.

| Package | Confidence | Used In |
|---|---|---|
| `typescript-eslint` | **90%** | `eslint.config.js` only |
| `sass` | **85%** | Vite SCSS compilation (build-time) |
| `@lingui/babel-plugin-lingui-macro` | **85%** | Babel plugin in `web/vite.config.ts` |
| `@lingui/cli` | **90%** | CLI tool for `lingui:extract` / `lingui:compile` scripts |
| `@lingui/vite-plugin` | **85%** | Vite plugin in `web/vite.config.ts` |
| `vite-plugin-static-copy` | **85%** | Vite plugin in `web/vite.config.ts` |

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

_Analysis Date: 2026-03-18_
_Method: Source import search + config file analysis (grep across src/, web/, mobile/, configs)_
_Previous analysis: 2025-01-11 (fully superseded)_
