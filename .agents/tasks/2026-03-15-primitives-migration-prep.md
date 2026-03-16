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

**4a. Rework `primitives/index.ts`**
- [ ] Replace the barrel file with: SCSS imports + re-exports from `@quilibrium/quorum-shared`
- [ ] All 12 SCSS files stay in their current folders (web bundler needs them)
- [ ] The barrel imports them all, so they're loaded when any primitive is used
- [ ] Re-exports only primitive components/types from `@quilibrium/quorum-shared`
- This preserves all existing `import { X } from '../primitives'` paths — zero changes needed across the codebase

**4b. Delete local primitive source files**
- [ ] Remove all `.web.tsx`, `.native.tsx`, `types.ts`, `index.ts` from each primitive subfolder
- [ ] Keep only `.scss` files in each subfolder
- [ ] Keep `theme/` folder locally only if web app has custom ThemeProvider setup, otherwise delete
- [ ] Keep `Icon/iconMapping.ts` and `Icon/icons/` if referenced directly by non-primitive code

**4c. Fix Lingui translation defaults**
Since quorum-shared primitives no longer use `t` macros, the web app must provide translated strings explicitly:
- [ ] Audit all Select usages (~10) — add `placeholder={t\`Select an option\`}` where relying on default
- [ ] Audit all FileUpload usages — add explicit error message props if needed
- [ ] Audit `selectAllLabel` / `clearAllLabel` — add `t` wrapped props where multi-select is used

**4d. Update mobile test screen imports**
- [ ] Update imports in `mobile/test/primitives/` to reference `@quilibrium/quorum-shared`
- [ ] These bypass the barrel file, so they need direct import updates

**4e. Verify**
- [ ] Run `npx tsc --noEmit` — zero new errors
- [ ] Run `yarn build` — web app builds
- [ ] Visual check: open web app, test Select dropdowns, FileUpload, modals
- [ ] Commit

#### Step 5: Local development linking
- quorum-desktop already has `"@quilibrium/quorum-shared": "file:../quorum-shared"` in package.json
- This means quorum-desktop will automatically use the local quorum-shared checkout
- **Before merging**: switch back to published registry version

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
