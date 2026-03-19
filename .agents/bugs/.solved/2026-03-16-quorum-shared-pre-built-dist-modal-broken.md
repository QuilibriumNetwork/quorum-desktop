 ---
type: bug
title: "Modals break when consuming quorum-shared from pre-built dist (npm pack/publish)"
status: resolved
priority: high
resolved: 2026-03-16
ai_generated: true
created: 2026-03-16
updated: 2026-03-16
related_tasks:
  - ".agents/tasks/2026-03-15-primitives-migration-prep.md"
---

# Modals break when consuming quorum-shared from pre-built dist

> **AI-Generated**: May contain errors. Verify before use.

## Summary

Modals appear not to work when quorum-shared is installed from a tarball (`npm pack`). Originally believed to be a `createPortal` / duplicate React issue. **Actually a CSS problem** — modals DO render in the DOM but are visually invisible.

## Symptoms

- Clicking buttons that should open modals has no visible effect
- ~~No DOM elements are created for modals~~ **WRONG** — DOM elements ARE created (confirmed 2026-03-16 ~15:00)
- No errors in browser console
- `document.querySelector('.quorum-modal')` returns an element with correct structure
- Modal, OverlayBackdrop, and all child content are in the DOM
- Portal component works: `createPortal` returns valid `react.portal` objects
- The modal is simply **not visible** — likely a CSS/z-index/positioning issue
- All other primitives (Button, Select, Input, Icon, etc.) render correctly
- Theme, Flex, Text, Callout all work fine

## Works With

- `link:../quorum-shared` + `optimizeDeps.exclude` + react/react-dom Vite aliases
- This is source resolution mode — Vite processes `.web.tsx` files directly

## Broken With

- `file:../quorum-shared/quilibrium-quorum-shared-2.1.0-3.tgz` (tarball)
- Broken even WITH `optimizeDeps.exclude` + react aliases
- Broken even WITHOUT `optimizeDeps.exclude` (Vite pre-bundles from dist/)

## Root Cause (REVISED — 2026-03-16 ~15:00)

### NOT a React duplication issue

**The original hypothesis was wrong.** Extensive debugging (tests 6-9) proved:
- `dist/index.mjs` loads exactly once (single module instance)
- React version inside quorum-shared = 19.0.0 (same as app)
- `createPortal` works correctly — returns valid `react.portal` objects
- Portal component mounts, fires `useEffect`, calls `createPortal` on `document.body`
- Modal DOM elements ARE in the document (verified via `document.querySelector('.quorum-modal')`)
- No "Invalid hook call" errors (hooks work fine from `dist/index.mjs`)

### Actual root cause: CSS/visibility

The modals render in the DOM but are **visually invisible**. The OverlayBackdrop (`fixed inset-0 z-[10100]`) and Modal content are present in the DOM tree but not visible on screen.

**Why this differs between `link:` and tarball:**
When using `link:`, Vite processes source files from quorum-shared as if they're part of the project. The SCSS imports in `src/components/primitives/index.ts` (e.g., `import './Modal/Modal.scss'`) reference local `.scss` files that get processed by Vite's CSS pipeline. These styles define the visual appearance of modals.

When using the tarball (pre-built `dist/index.mjs`), the component JS works but **the CSS class names reference styles that may not be loading correctly**. The Tailwind utility classes (e.g., `fixed`, `inset-0`, `z-[10100]`) should work if Tailwind is scanning the dist file, but custom classes like `quorum-modal`, `bg-overlay`, `animate-modalOpen` require the SCSS files to be imported.

### Next steps
- Check if Tailwind's content scanning includes `node_modules/@quilibrium/quorum-shared/dist/`
- Check if `bg-overlay` and other custom classes are being generated
- Check computed styles on `.quorum-modal` and `.fixed.inset-0` elements
- The SCSS files ARE imported in `src/components/primitives/index.ts` — verify they apply to dist components

## Tests Performed

| # | Configuration | Modals Work? | Session |
|---|--------------|-------------|---------|
| 1 | `link:` + `optimizeDeps.exclude` + react aliases | YES | prev |
| 2 | `link:` + `optimizeDeps.exclude` (no react aliases) | NO | prev |
| 3 | Tarball + `optimizeDeps.exclude` + react aliases | NO | prev |
| 4 | Tarball + no exclude (Vite pre-bundles) | NO | prev |
| 5 | Local primitives (before migration) | YES | prev |
| 6 | Tarball + `source` condition + NO react aliases | NO | 2026-03-16 |
| 7 | Tarball + `source` cond + `optimizeDeps.exclude` + react aliases + dedupe | NO (blank page) | 2026-03-16 |
| 8 | Tarball + `source` cond + NO `optimizeDeps.exclude` + react aliases + dedupe | NO (esbuild crash) | 2026-03-16 |

**Test 6 finding**: `source` exports condition alone is insufficient. Tarball was verified to contain `"source": "./src/index.ts"` in exports and `src/` directory. No nested `node_modules/react` in installed package. Vite with `conditions: ['source']` should resolve to source, but removing React aliases broke modals — indicating the aliases are still required.

**Test 7 finding (2026-03-16 ~14:20)**: CRITICAL. With `source` condition + `optimizeDeps.exclude` + react aliases, the app shows a **blank page** with "Invalid hook call — more than one copy of React" error. Debug instrumentation revealed:
- `[DEBUG:SRC]` confirmed the `source` condition IS working — Vite resolves to `src/index.ts`
- `[DEBUG:Portal]` logs from inside quorum-shared show React 19.0.0 (same version as app)
- **BUT every source file loads TWICE** with different Vite cache hashes (`v=c395bbb4` and `v=20115e89`)
- `ThemeProvider.web.tsx` crashes on `useState` because two React module instances exist
- Root cause: `optimizeDeps.exclude` causes Vite to serve source files from node_modules as unbundled ESM with two different resolution paths, creating duplicate module instances
- This is WORSE than the previous tarball behavior (where only modals broke) — now the entire app crashes

**Test 8 finding (2026-03-16 ~14:30)**: Without `optimizeDeps.exclude`, esbuild tries to pre-bundle the source files but **can't resolve `.web.tsx` platform extensions**. Errors: `Could not resolve "./Button"` (actual file is `./Button.web.tsx`). esbuild uses Node.js resolution and doesn't know about Vite's custom `resolve.extensions`.

### Catch-22 identified (2026-03-16 ~14:30)

The `source` exports condition approach hits an **unsolvable Vite limitation** for packages with platform-specific extensions (`.web.tsx`/`.native.tsx`):

| Scenario | What happens | Result |
|----------|-------------|--------|
| `source` + `optimizeDeps.exclude` | Vite serves individual source files as unbundled ESM from node_modules → duplicate module instances | Blank page, duplicate React crash |
| `source` + NO exclude | esbuild pre-bundles → can't resolve `.web.tsx` extensions | Build crash |
| `link:` + `optimizeDeps.exclude` | Vite treats symlink as source code (outside node_modules) → full resolver pipeline applies | Works ✓ |

The fundamental difference: `link:` makes Vite classify the package as **source code** (outside node_modules), where Vite's own resolver handles `.web.tsx` and deduplicates modules. Tarball installs live inside node_modules, where neither Vite's unbundled serving nor esbuild's pre-bundling can handle platform extensions correctly.

### New direction needed
The `source` condition approach is NOT viable for cross-platform packages with `.web.tsx`/`.native.tsx` extensions consumed via tarball/npm. Need to explore:
- **Option E**: Use the pre-built `dist/index.mjs` (which already resolves `.web.tsx` at build time) but fix the duplicate React issue at the Vite level
- **Option F**: A Vite plugin that intercepts quorum-shared resolution and applies proper deduplication
- **Option G**: Revisit why test #3 (tarball + react aliases) failed — the original test that should have worked

## Build Output Verification

The tsup build correctly externalizes all peer dependencies:
- `dist/index.mjs` (164 KB) — web ESM, react/react-dom as bare imports
- `dist/index.js` (174 KB) — web CJS
- `dist/index.native.js` (205 KB) — native CJS
- `dist/index.d.ts` — type declarations

```bash
# Verified:
grep "import.*from.*react" dist/index.mjs
# Shows: import { jsx } from "react/jsx-runtime"
# Shows: import { createPortal } from "react-dom"
# No inlined react code
```

## Investigation Completed (2026-03-16)

### Evidence gathered
- [x] Verified tarball contents: 368 files, no `node_modules/`, no React files
- [x] Verified `dist/index.mjs`: React/react-dom properly externalized as bare imports
- [x] Confirmed version mismatch: quorum-desktop has react 19.0.0, quorum-shared devDep has 19.1.0
- [x] Verified Vite pre-bundle metadata: React pre-bundled from root `node_modules/`
- [x] Researched how Tamagui, NativeBase, Dripsy, Moti, Expo, react-native-web handle this

### Industry research findings
Every successful cross-platform React/RN library uses one of:
1. **Source compilation by consumer** — Expo packages ship only `src/`, Metro and Vite compile it
2. **`source` exports condition** (Callstack/builder-bob pattern) — opt-in source resolution, pre-built fallback
3. **Pre-built dist with standard peer deps** — works IF no nested React copy exists AND bundler properly deduplicates

Pattern #3 is what we attempted and it fails in Vite. Pattern #2 is the industry best practice.

Libraries examined:
- **Tamagui**: Ships pre-built dist, requires `@tamagui/vite-plugin` for consumers
- **NativeBase/Dripsy/Moti**: `"react-native": "src/index"` for Metro, pre-built for web
- **Expo packages**: Ship only source, all bundlers compile it
- **react-native-builder-bob** (Callstack): Recommends `"source"` exports condition

## Solution: `source` Exports Condition (Testing)

### What this does
Add a `"source"` condition to quorum-shared's `package.json` exports. Consuming bundlers that opt into this condition get raw TypeScript source instead of pre-built dist. The bundler compiles it in-project, resolving all imports (including React) from the project's own dependency tree.

### Why this is correct
- **Industry standard**: Recommended by Callstack's `react-native-builder-bob`, used by Expo ecosystem
- **Eliminates the problem at the root**: Source compiled in-project = single React instance guaranteed
- **Opt-in**: Generic consumers who don't add `'source'` to their conditions fall through to pre-built dist
- **No special build config**: tsup config unchanged, no hacks in the build output
- **Works for both platforms**: Metro uses `react-native` condition (pre-built native), Vite uses `source` condition

### Changes required

**quorum-shared `package.json`** — add `"source"` condition to exports:
```json
"exports": {
  ".": {
    "react-native": { "types": "...", "default": "./dist/index.native.js" },
    "source": "./src/index.ts",    // <-- NEW: opt-in source resolution
    "import": { "types": "...", "default": "./dist/index.mjs" },
    "require": { "types": "...", "default": "./dist/index.js" }
  }
}
```

**quorum-desktop `web/vite.config.ts`** — add `'source'` to resolve conditions:
```ts
resolve: {
  conditions: ['source'],  // <-- NEW: opt into source resolution
  // ... existing alias, extensions, dedupe
}
```

**Note on React aliases** — initial hypothesis was that source condition would eliminate the need for React aliases. Test 6 disproved this. The aliases remain required because `optimizeDeps.exclude` causes Vite to serve quorum-shared files outside the pre-bundle graph, and bare `import 'react'` in those files may not resolve to the pre-bundled React instance without explicit aliasing.

### Previous options considered (not pursuing)

#### Option A: Force react resolution in tsup build
Rejected — adds complexity to the build, doesn't address the fundamental Vite resolution issue.

#### Option C: Document `optimizeDeps.exclude` as required + fix tarball
Rejected — this is a workaround, not a solution. Vite's edge cases with tarball resolution are well-documented bugs.

#### Option D: Move Portal/createPortal out of quorum-shared
Rejected — architectural compromise. Portal is a legitimate primitive. The issue is package resolution, not component design.

## Context for New Session

- Branch: `feat/shared-primitives-migration` on both `quorum-desktop` and `quorum-shared`
- Current working config: `link:../quorum-shared` in package.json
- quorum-shared has 4 clean commits on this branch
- quorum-desktop has ~15 commits for the migration
- The full migration is done and verified — only this npm publish issue remains
- Task file: `.agents/tasks/2026-03-15-primitives-migration-prep.md` (step 8)
- All primitives, theme, types, imports are working correctly in local dev

## Resolution (2026-03-16 ~15:15)

**Fix:** Added `./node_modules/@quilibrium/quorum-shared/dist/**/*.mjs` to Tailwind's `content` array in `tailwind.config.js`.

**One-line change:**
```js
// Before
content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}', '!./node_modules/**'],

// After
content: [
  './index.html',
  './src/**/*.{js,jsx,ts,tsx}',
  './node_modules/@quilibrium/quorum-shared/dist/**/*.mjs',
],
```

**Why this works:** Tailwind now scans the pre-built dist for class names, generating CSS for arbitrary values like `z-[10100]` that only exist in quorum-shared's compiled output. With `link:`, this wasn't needed because Vite processed source files as part of the project and Tailwind saw the classes in the transpiled output.

**Lesson learned:** Hours were spent investigating React duplication and Vite module resolution. The actual issue was a missing Tailwind content path. The modals were rendering in the DOM the entire time — just invisible due to `z-index: auto`. Earlier debugging focused on React internals because the symptom ("modals don't work") was assumed to mean "modals don't render," when it actually meant "modals render but are hidden."

**Pending:** Full tarball end-to-end verification including mobile test screens.

## Files Involved

| File | Role |
|------|------|
| `quorum-desktop/tailwind.config.js` | **THE FIX** — added quorum-shared dist to content scanning |
| `quorum-shared/src/primitives/Portal/Portal.web.tsx` | Uses `createPortal` from `react-dom` |
| `quorum-shared/src/primitives/Modal/ModalContainer/ModalContainer.web.tsx` | Uses `OverlayBackdrop` with `z-[10100]` |
| `quorum-shared/src/primitives/OverlayBackdrop/OverlayBackdrop.web.tsx` | Uses `z-[9999]` default |
| `quorum-shared/tsup.config.ts` | Dual platform build config |
| `quorum-shared/package.json` | exports with react-native + source conditions |
| `quorum-desktop/web/vite.config.ts` | Vite aliases, optimizeDeps, resolve config |
| `quorum-desktop/package.json` | quorum-shared dependency reference |

---

_Created: 2026-03-16_
_Updated: 2026-03-16 15:20_
