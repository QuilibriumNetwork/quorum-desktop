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

### 3. RadioGroup — Bordered Variant Review (Deferred from Audit)
- [ ] Check if the web bordered variant is visually useful on mobile
- [ ] Decision: implement on native, or remove `variant` from types entirely

### 4. Colors System
- [x] Fixed 3 color mismatches (dark text.danger, link colors)
- [x] Added missing tokens (border.muted/subtle, mention, contextMenu, spaceTag, sidebarAccent)
- [x] Restructured with two-layer palette/semantics architecture
- [ ] **Note**: Colors will likely need further tuning once primitives are in `quorum-shared` and being tested on real mobile screens

### 5. Documentation
- [x] Updated all 6 primitives doc files to reflect audit changes
- [ ] Update docs to remove Container references and reflect ModalContainer reorganization

---

## Context for Migration

The primitives migration is part of the stacked PRs workflow:
```
feat/shared-types-migration          ← PR #1
  └── feat/shared-primitives-migration      ← PR #2 (this work)
        └── feat/shared-hooks-utils-migration  ← PR #3
```

This prep task feeds into the actual migration plan at `tasks/2026-03-15-stacked-prs-workflow.md` → Plan 1.

---

_Created: 2026-03-15_
