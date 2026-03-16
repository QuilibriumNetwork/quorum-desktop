---
type: task
title: "Primitives Migration Prep: Decisions & Cleanup Before Moving to quorum-shared"
status: open
complexity: medium
created: 2026-03-15
depends_on:
  - "tasks/.done/2026-03-15-mobile-primitives-audit.md"
---

# Primitives Migration Prep

Pre-work before migrating primitives from `quorum-desktop` to `quorum-shared`.
This captures remaining decisions and cleanup tasks identified during the audit.

---

## Decisions Made

### Drop Container Primitive
- Only 3 production files use it: `UserProfile.tsx`, `Layout.tsx`, `DevNavMenu.tsx`
- The audit noted it "caused layout issues so reverted to raw HTML divs" in one case
- On web: replace with `<div>` + style props
- On native: replace with `<View>` + style props
- **Action**: Refactor the 3 files, remove Container from primitives

### Make ModalContainer Internal to Modal
- Only imported by `Modal.web.tsx` — it's an internal building block, not a standalone primitive
- Handles backdrop, animation, escape key, focus trap — all Modal concerns
- **Action**: Move ModalContainer into the Modal folder as a private module, remove from primitives barrel export

### Primitives Platform Classification
When migrating to `quorum-shared`, primitives will be organized by platform:

| Primitive | Platform | Files |
|-----------|----------|-------|
| Button | Cross-platform | `.web.tsx` + `.native.tsx` |
| Flex | Cross-platform | `.web.tsx` + `.native.tsx` |
| Icon | Cross-platform | `.web.tsx` + `.native.tsx` |
| Input | Cross-platform | `.web.tsx` + `.native.tsx` |
| TextArea | Cross-platform | `.web.tsx` + `.native.tsx` |
| Select | Cross-platform | `.web.tsx` + `.native.tsx` |
| Switch | Cross-platform | `.web.tsx` + `.native.tsx` |
| Modal | Cross-platform | `.web.tsx` + `.native.tsx` |
| Callout | Cross-platform | `.web.tsx` + `.native.tsx` |
| RadioGroup | Cross-platform | `.web.tsx` + `.native.tsx` |
| ColorSwatch | Cross-platform | `.web.tsx` + `.native.tsx` |
| FileUpload | Cross-platform | `.web.tsx` + `.native.tsx` |
| Tooltip | Cross-platform | `.web.tsx` + `.native.tsx` |
| ScrollContainer | Cross-platform | `.web.tsx` + `.native.tsx` |
| Spacer | Cross-platform | `.web.tsx` + `.native.tsx` |
| OverlayBackdrop | Cross-platform | `.web.tsx` + `.native.tsx` |
| Text | Cross-platform* | `.web.tsx` + `.native.tsx` (web version deprecated, native-only in production) |
| Portal | Web-only | `.web.tsx` only |
| ThemeProvider | Cross-platform | `.web.tsx` + `.native.tsx` |
| Theme colors | Cross-platform | `colors.ts` (shared, two-layer architecture) |

*Text has a `.web.tsx` file but it's deprecated for production web code. Web uses HTML + CSS typography classes instead.

---

## Action Items

### 1. Drop Container Primitive — DONE
- [x] Replaced Container with `<div>` across 45+ web files
- [x] Replaced Container with `<View>` across 5 native files
- [x] Converted Container-specific props (padding, backgroundColor) to className/style
- [x] Removed `Container/` folder from primitives
- [x] Removed Container exports from primitives barrel
- [x] Removed Container playground example
- [x] Fixed RolePreview text hierarchy after Container swap

### 2. Make ModalContainer Internal — DONE
- [x] Moved `ModalContainer/` into `Modal/ModalContainer/`
- [x] Updated `Modal.web.tsx` import path
- [x] Removed ModalContainer from primitives barrel export
- [x] Updated test mock paths

### 3. RadioGroup — Bordered Variant Review — DONE
- [x] Checked web usage: bordered variant only used in playground, not in production
- [x] Moved `variant` prop to web-only types (`RadioGroupWebProps`), removed from shared `RadioGroupProps`

### 4. Colors System
- [x] Fixed 3 color mismatches (dark text.danger, link colors)
- [x] Added missing tokens (border.muted/subtle, mention, contextMenu, spaceTag, sidebarAccent)
- [x] Restructured with two-layer palette/semantics architecture
- [ ] **Note**: Colors will likely need further tuning once primitives are in `quorum-shared` and being tested on real mobile screens

### 5. Documentation — DONE
- [x] Updated all 6 primitives doc files to reflect audit changes
- [x] Updated docs to remove Container references and reflect ModalContainer reorganization

---

## Migration Execution Plan

### Branches
- **quorum-desktop**: `feat/shared-primitives-migration` (prep work committed)
- **quorum-shared**: `feat/shared-primitives-migration` (created from `feat/shared-types-migration`)

### Steps

#### Step 1: Commit prep work on quorum-desktop — DONE
- [x] All audit fixes, Container removal, type cleanup committed
- [x] Branch: `feat/shared-primitives-migration`

#### Step 2: Create branch on quorum-shared — DONE
- [x] Branch `feat/shared-primitives-migration` created from `feat/shared-types-migration`
- This ensures primitives migration builds on top of the types migration

#### Step 3: Copy primitives to quorum-shared — DONE
- [x] Copied 18 primitive folders + theme/ to `quorum-shared/src/primitives/`
- [x] Removed SCSS imports (styles stay in consuming app)
- [x] Fixed internal imports (logger → relative, self-references)
- [x] Made business-layer deps injectable (UserAvatar → renderAvatar prop, processAvatarImage → onProcessImage prop)
- [x] Added ReactTooltip wrapper inside Tooltip folder
- [x] Fixed strict TypeScript errors for React 19 compatibility
- [x] Removed @lingui/core — plain English defaults, apps pass translated strings
- [x] Set up barrel exports (`src/index.ts` exports `./primitives`)
- [x] Added peer dependencies (react-native, tabler icons, expo, clsx, etc.)
- [x] 0 TypeScript errors in quorum-shared
- [x] Committed: `d9f6678` (deps) + `ebe1b5a` (primitives)

#### Step 4: Update quorum-desktop to use shared primitives
**Approach**: Direct migration — no intermediate re-export layer.

**4a. Rework `primitives/index.ts`** — DONE
- [x] Replaced barrel with: SCSS imports + re-exports from `@quilibrium/quorum-shared`
- [x] All 12 SCSS files stay in their current folders (web bundler needs them)
- [x] Updated 14+ files importing from primitive subfolders to use barrel
- [x] Fixed main.tsx, Titlebar.jsx theme imports
- [x] Added Vite `optimizeDeps.exclude` for quorum-shared (source needs .web.tsx resolution)
- [x] Switched package.json from `file:` to `link:` for live development

**4b. Delete local primitive source files** — DONE
- [x] Removed 64 .tsx/.ts source files from local primitives (-8,437 lines)
- [x] Kept only 12 .scss files + barrel index.ts
- [x] Deleted theme/, Icon/iconMapping.ts, Icon/icons/ (now in quorum-shared)
- [x] Updated IconGallery dev file to use `iconNames` from barrel

**4c. Fix Lingui translation defaults** — DONE
- [x] Audited all Select usages — most use compactMode (no visible placeholder)
- [x] SpaceSettingsModal/Account already had explicit `t` props
- [x] Added `selectAllLabel={t\`All\`}` and `clearAllLabel={t\`Clear\`}` to 3 multi-select usages (ChannelEditor, NotificationPanel, Roles)
- [x] FileUpload error messages: no action needed (errors shown via app-level error handling, not default labels)

**4d. Update mobile test screen imports** — DONE
- [x] Updated 17 test screen files + AppTest.tsx to use primitives barrel
- [x] Replaced all subpath imports (theme/, Icon/, Callout/, etc.)
- [x] Removed Container → replaced with View from react-native
- [x] Removed FlexCenter/FlexRow references
- [x] Configured Metro: added quorum-shared to watchFolders + extraNodeModules
- [x] Blocked quorum-shared/node_modules in Metro to prevent duplicate react-native
- [x] Fixed ReactTooltip.tsx → ReactTooltip.web.tsx (was crashing native with window.addEventListener)
- [x] Bundle verified: 7265 modules, zero errors
- [x] Visual verification: mobile test screens render primitives correctly from quorum-shared

**4e. Verify** — DONE
- [x] Web app loads and renders correctly
- [x] Mobile test screens render primitives correctly
- [x] Metro bundle: 7265 modules, zero errors

#### Step 5: Local development linking — DONE
- [x] Switched from `file:` to `link:` protocol for live symlink development
- [x] Vite: excluded quorum-shared from optimizeDeps (source needs .web.tsx resolution)
- [x] Metro: added quorum-shared to watchFolders + extraNodeModules
- **Before merging**: switch `link:` back to published registry version

### Commit Strategy
- **quorum-shared**:
  1. Separate commit for `package.json` changes (dependencies, peer deps, version bump)
  2. One big commit for all primitives files (the actual migration)
  3. Separate commits for any fixes, import adjustments, or non-primitive changes
- **quorum-desktop**: Separate commits for import updates, cleanup, fixes
- Keep commits minimal — the primitives migration itself is one atomic unit

### Follow-up: Hardcoded Colors in Native Primitives
Some native primitives still use hardcoded hex/rgba values instead of `useTheme()`. Fixed so far:
- [x] Spacer — `'#e5e7eb'` → `theme.colors.border.default`
- [x] ScrollContainer — `'rgba(255, 255, 255, 0.1)'` → `theme.colors.border.default`

Still need review:
- [ ] ColorSwatch — accent color map uses hardcoded hex values + check icon `color="#ffffff"`
- [ ] Select.native — `color: '#fff'` (line 915) — white text, wrong in light mode
- [ ] Tooltip.native — overlay `backgroundColor: 'rgba(0, 0, 0, 0.1)'`
- Note: `shadowColor: '#000'` and modal backdrop `rgba(0, 0, 0, 0.5)` are OK to keep hardcoded (always dark)

### 6. Remove Lingui from Shared Primitives — DONE
Primitives in a shared library should not depend on a specific i18n framework.
- [x] Replaced all `t` tagged template literals with plain English string defaults in FileUpload and Select
- [x] Removed `@lingui/core/macro` imports from all 4 files (Select.web, Select.native, FileUpload.web, FileUpload.native)
- [x] Removed `@lingui/core` from quorum-shared peerDependencies and peerDependenciesMeta
- **Approach**: Consuming apps provide translated strings via props (e.g., `<Select placeholder={t\`Select an option\`} />`)
- **Pattern**: Follows industry standard (shadcn/ui, Radix, MUI) — library uses English defaults, apps override with translations
- **Action for consuming apps**: When using Select or FileUpload, pass `t\`...\`` wrapped props for any user-facing strings that need translation

### Follow-up: Proper Build Setup for Published Package (REQUIRED before merge)
Currently quorum-shared points `module`/`import` to source (`src/index.ts`) because tsup can't resolve `.web.tsx`/`.native.tsx` platform files. This works for local `file:` development but is NOT publishable to npm.

**Before merging the quorum-shared PR**, we need one of these approaches:

**Option A: Dual platform builds (recommended for cross-platform libraries)**
- Build two separate entry points: `dist/web/index.mjs` and `dist/native/index.mjs`
- Use `exports` conditions in package.json:
  ```json
  "exports": {
    ".": {
      "react-native": "./src/index.ts",
      "import": "./dist/web/index.mjs",
      "require": "./dist/web/index.js"
    }
  }
  ```
- Metro (React Native) uses the `react-native` condition and resolves `.native.tsx` from source
- Vite/webpack uses `import` condition and gets pre-built web code
- Used by: `react-native-web`, `tamagui`, `nativewind`

**Option B: Ship source only**
- Set `"main": "src/index.ts"` and require consuming apps to compile
- Add `"sideEffects": false` for tree-shaking
- Used by: many private/monorepo packages, `@radix-ui/react-*`

**Option C: Single build with externalized platform files**
- Build only shared code (types, theme, utils)
- Ship `.web.tsx` and `.native.tsx` as source alongside the build
- Consumer's bundler resolves platform files from source

**Current state**: Using Option B (source-only) during development. Must resolve before publishing.

### Stacked PRs Workflow
```
feat/shared-types-migration          ← PR #1
  └── feat/shared-primitives-migration      ← PR #2 (this work)
        └── feat/shared-hooks-utils-migration  ← PR #3
```

This prep task feeds into the actual migration plan at `tasks/2026-03-15-stacked-prs-workflow.md` → Plan 1.

---

_Created: 2026-03-15_
_Updated: 2026-03-16_
