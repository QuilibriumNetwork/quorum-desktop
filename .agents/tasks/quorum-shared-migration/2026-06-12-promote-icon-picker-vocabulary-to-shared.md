---
type: task
title: "Promote the icon-picker vocabulary (icon set + colors + filled-variant) to quorum-shared"
status: open
created: 2026-06-12
runtime-test: not-required (data move; visual smoke on both apps)
priority: medium (unblocks mobile channel/group icon parity — port-to-mobile rows 31/32)
source-audit: D:\GitHub\Quilibrium\quorum-desktop\.agents\tasks\port-to-mobile\candidates.md (rows 31/32; "Channel & group icons" detailed entry)
related:
  - quorum-mobile/.agents/tasks/2026-06-12-channel-group-icon-and-settings.md (the mobile consumer)
  - quorum-mobile/.agents/tasks/2026-06-09-migrate-iconsymbol-to-shared-icon-primitive.md (Phase 2b flags this exact vocabulary-alignment, gated on a design call)
---

# Promote the icon-picker vocabulary to quorum-shared

## Why

Desktop's channel/group icon picker offers **49 curated Tabler icons**, an **8-color named palette**, and an **outline/filled variant** toggle. Mobile reimplemented its own picker with only **20 SF-Symbol-named icons**, **no variant**, and **raw-hex colors** — so the two platforms offer different icons and store colors in incompatible formats (desktop `'blue'` vs mobile `'#3b82f6'`). The fix is to make the *picker vocabulary* shared, so both apps draw from one list.

**What's ALREADY shared (don't re-do):** the `Icon` primitive itself + `IconName` / `IconVariant` types are in `@quilibrium/quorum-shared` (`src/primitives/Icon/`). Desktop's picker imports `IconName`/`IconVariant` from the primitives barrel. Only the **curated picker data** is desktop-local.

**What's NOT shared (this task moves it):** `quorum-desktop/src/components/space/IconPicker/types.ts` holds:
- `ICON_OPTIONS` — the curated list of 49 icons (9 tiers) shown in the picker
- `ICON_COLORS` — the 8 named colors (`default/blue/purple/fuchsia/green/orange/yellow/red`) + their hex
- `FOLDER_COLORS` — folder-specific palette
- `FILLED_ICONS` — the `Set<IconName>` of icons that have a filled variant (drives the outline/filled toggle)
- helpers `getIconColorHex`, `getFolderColorHex`, `getIconColorClass`, type `IconColor`, `IconOption`, `ColorOption`

## Scope

Move the **data + pure helpers** (the bulleted items above) from `quorum-desktop/src/components/space/IconPicker/types.ts` into `quorum-shared` (e.g. `src/icons/pickerVocabulary.ts` or alongside the existing `Icon` primitive), and re-export from the package root. Desktop's `IconPicker.web.tsx` / `IconPicker.native.tsx` then import the vocabulary from shared instead of the local `types.ts`. The picker *components* (`.web.tsx`/`.native.tsx`/`.scss`) can stay in desktop — only the vocabulary/helpers move. (Optional stretch: move the whole `IconPicker` component into shared as a primitive, since it already has both `.web` and `.native` variants — but that's a bigger lift; the vocabulary move alone unblocks mobile.)

**Pure-data move = low risk.** `ICON_OPTIONS`/`ICON_COLORS`/`FILLED_ICONS` are constant arrays/sets; the helpers are pure functions. No platform APIs involved.

## The color-storage decision (resolve before mobile consumes)

Desktop stores `iconColor` as a **named enum** (`'blue'`); mobile stores **raw hex** (`'#3b82f6'`). They must converge or cross-device icon colors mismatch. **Recommended: named enum** (desktop's format) — it's theme-aware (`getIconColorHex` resolves to the right hex per theme) and already what the shared `Channel`/`Group` types carry from desktop writes. Mobile should migrate its picker to write named values and resolve to hex at render time via the shared `getIconColorHex`. Confirm with lead (it's a stored-data format question; existing desktop-written values are already named, so aligning mobile to named is also the lower-migration path).

## Cross-repo workflow

Follow [cross-repo-workflow.md](cross-repo-workflow.md). Shape:
1. **quorum-shared PR**: add the picker vocabulary + helpers, re-export from root, bump version. Additive — no breaking change.
2. **quorum-desktop PR**: swap `IconPicker`'s local `types.ts` imports to the shared exports (keep the components). Verify the picker still renders all 49 icons + variant toggle + colors.
3. **quorum-mobile**: consume the shared vocabulary in its picker — tracked in the mobile task ([`2026-06-12-channel-group-icon-and-settings.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/2026-06-12-channel-group-icon-and-settings.md)) + add a `mobile-tasks-pending.md` row.

## Connection to the existing icon-shim task

Mobile task `2026-06-09-migrate-iconsymbol-to-shared-icon-primitive.md` Phase 2b already calls for aligning mobile's `IconPicker.tsx` `ICON_OPTIONS` to desktop's vocabulary, but flagged it **gated on a "skin-icon vocabulary" design decision** (SF names vs semantic keys). This task is the upstream half: once the vocabulary is in shared, that Phase 2b alignment becomes "import from shared" instead of "hand-copy desktop's list." Coordinate so the two don't diverge.

## Verification

- [ ] quorum-shared: vocabulary + helpers exported from root; `yarn build` + tests clean.
- [ ] quorum-desktop: `IconPicker` imports from shared; tsc + lint clean; picker renders 49 icons, outline/filled toggle, 8 colors (visual smoke).
- [ ] No behavior change on desktop (same icons, same colors, same variant toggle).
- [ ] `mobile-tasks-pending.md` row added for the mobile consumption leg.

*Last updated: 2026-06-12*
