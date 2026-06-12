---
type: notes
title: "Icon-picker vocabulary promotion + expansion — PR sequencing & status"
status: in-progress
created: 2026-06-12
parent-task: 2026-06-12-promote-icon-picker-vocabulary-to-shared.md
---

# Icon-picker vocabulary — implementation status & PR sequencing

Working notes for the three-repo rollout. Branch in quorum-desktop:
`promote-icon-picker-vocabulary-to-shared`.

## Decisions taken this session (2026-06-12)

| Decision | Resolution |
|---|---|
| Scope of this branch | Move vocabulary to shared **+ expand the icon set + full layout work** (sticky header + scroll + search). |
| Who drives the shared PR | **User** drives quorum-shared PR + version bump. Claude prepped the shared content. |
| Icon set size | **49 → 92** icons. 43 added from the already-renderable set (zero mapping work). |
| Dropped from the user's pick | `trash` and `close` (read as UI actions, can confuse). Net +43, not +45. |
| `FILLED_ICONS` | 33 → **61** (+28). Every added entry verified to have a real `…Filled` in `@tabler/icons-react`. |
| Tiering | Merged into existing tiers 1-9 thematically (not appended at the bottom). |
| Category menu | Rejected as overkill at 92. Chose **scroll + name/category search** instead (task said add search past ~80). |
| Layout | **Sticky header** (variant toggle + colors + search) pinned; **only the grid scrolls** inside the popover's existing 340px max-height. Width unchanged (320px / 8-col). |
| Color-storage format | **Named enum** (desktop's existing format). Mobile converges to named + resolves to hex via shared `getIconColorHex`. Recorded in mobile-tasks-pending row 7.3. |
| Desktop `.native.tsx` | **Left unchanged** — it's dead in desktop (`index.ts` hardcodes `./IconPicker.web`; the `.native.tsx` is not in the tsc program and desktop has no react-native dep). Native search/scroll parity belongs to the mobile task. |

## PR sequence (must land in this order)

### STATUS (2026-06-12, later)
- ✅ **Step 1 done** — quorum-shared [#39](https://github.com/QuilibriumNetwork/quorum-shared/pull/39) squash-merged to `master` (`39833f4`). Shared `dist/` rebuilt (`yarn build`); ESM + CJS + `.d.ts` all carry the 92-icon vocabulary.
- ✅ **Step 2 done** — desktop `types.ts` swapped to re-export the vocabulary from `@quilibrium/quorum-shared` (keeps `IconPickerProps` local). `npx tsc --noEmit` exit 0; `yarn lint` clean. Picker components + the 2 hook consumers unchanged (still import via `./types`, which re-exports shared).
- ⏳ **Step 3** — quorum-mobile consumption, tracked in [mobile-tasks-pending.md](mobile-tasks-pending.md) row 7.3.
- Remaining: live in-app visual smoke; shared version bump/publish at next release (desktop uses `link:../quorum-shared` so it doesn't need a published version).

### 1. quorum-shared PR (user drives) — additive, no breaking change
**Files (already written in the working copy):**
- `src/primitives/Icon/pickerVocabulary.ts` — NEW. The full vocabulary: `IconColor`, `IconOption`, `ColorOption`, `ICON_OPTIONS` (92), `ICON_COLORS`, `FOLDER_COLORS`, `FILLED_ICONS` (61), `getIconColorHex`, `getFolderColorHex`, `getIconColorClass`.
- `src/primitives/Icon/index.ts` — re-exports the vocabulary from the Icon barrel.
- `src/primitives/index.ts` — surfaces it through the primitives barrel (and the root barrel re-exports primitives, so it reaches `@quilibrium/quorum-shared`).

**Then:** bump version (`2.1.0-29` → next), `yarn build` (regenerates `dist/`), publish.

**Verification done:** `yarn typecheck` clean for the new file + barrels (the one pre-existing `Input.native.tsx` error is unrelated — present on the untouched file). All 61 `FILLED_ICONS` confirmed to have real Tabler filled variants; all 92 `ICON_OPTIONS` names are valid `IconName`s; no dupes; no dead `FILLED_ICONS` entries.

### 2. quorum-desktop PR (this branch) — swap imports + layout/expansion
**Already done on the branch:**
- `src/components/space/IconPicker/types.ts` — expanded `ICON_OPTIONS` (92) + `FILLED_ICONS` (61) **in place** (so desktop stays green before the shared publish).
- `IconPicker.web.tsx` + `IconPicker.scss` — sticky header, scrollable grid, search box, empty-state.

**Pending (gated on step 1 publishing):** the actual import swap.
Once shared's new version is published and desktop's `@quilibrium/quorum-shared` is bumped to it:
- In `types.ts`, **delete** the moved constants/helpers (`ICON_OPTIONS`, `ICON_COLORS`, `FOLDER_COLORS`, `FILLED_ICONS`, `IconColor`, `IconOption`, `ColorOption`, `getIconColorHex`, `getFolderColorHex`, `getIconColorClass`) and **re-export them from `@quilibrium/quorum-shared`** instead. KEEP `IconPickerProps` and `IconPickerProps`-only types local (the component props interface is NOT moving).
- Recommended shim so the picker components and the 2 hook consumers (`useChannelManagement.ts`, `useGroupManagement.ts` import `IconColor` from the local barrel) don't all need edits:
  ```ts
  // types.ts — after the shared publish
  export {
    ICON_OPTIONS, ICON_COLORS, FOLDER_COLORS, FILLED_ICONS,
    getIconColorHex, getFolderColorHex, getIconColorClass,
  } from '@quilibrium/quorum-shared';
  export type { IconColor, IconOption, ColorOption } from '@quilibrium/quorum-shared';
  // IconPickerProps stays defined here locally.
  ```
  This keeps every existing import path (`from './types'`, `from '../space/IconPicker'`) working — only `types.ts` changes.
- Re-run `npx tsc --noEmit` + `yarn lint` + visual smoke of the picker.

### 3. quorum-mobile (tracked, not done here)
Row **7.3** in [mobile-tasks-pending.md](mobile-tasks-pending.md) — consume the shared vocabulary, converge to the named-color enum. Blocked on step 1 publish.

## Why the swap can't happen on this branch yet
Desktop resolves `@quilibrium/quorum-shared` via its built `dist/` (`main: ./dist/index.js`), even though the package is symlinked to the working copy. The new `pickerVocabulary.ts` is in shared's `src/` but not its `dist/` until shared runs `yarn build`. So importing the vocabulary from shared today would fail to resolve. Desktop therefore keeps the expanded data in its local `types.ts` until the shared package is rebuilt/published, then swaps (step 2 pending item).

## Scratch artifacts (delete before finalizing)
- `_icon-analysis.cjs`, `_icon-analysis.json` — candidate analysis (parses shared map + desktop picker, cross-refs Tabler for filled variants).
- `_build-icon-preview.cjs`, `icon-picker-preview.html` — the browsable 171-candidate picker used to choose the set.
- `_build-layout-preview.cjs`, `icon-picker-layout-preview.html` — the 92-icon popover layout mock for visual smoke.

*Last updated: 2026-06-12*
