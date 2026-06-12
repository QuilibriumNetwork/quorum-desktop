---
type: task
title: "Promote + expand the icon-picker vocabulary (icon set + colors + filled-variant) to quorum-shared"
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

## Expand the icon set (do while moving it — user request 2026-06-12)

Since `ICON_OPTIONS` is being lifted into shared anyway, expand it in the same PR (one review of the new list). There are **three layers** — keep them distinct:

| Layer | Count today | What it is |
|---|---|---|
| Tabler library (`@tabler/icons-react`) | ~5,900 | The universe of available icons |
| Shared `IconName` whitelist + `iconComponentMap` (`quorum-shared/src/primitives/Icon/`) | **232** | Names the shared `Icon` primitive can actually render |
| `ICON_OPTIONS` (the picker's curated list) | **49** | What the channel/group picker offers users |

**Layer A — grow the picker from the already-renderable set (cheap, primary).** 183 of the 232 whitelisted names are NOT yet in the picker, so they can be added with **zero mapping work** — pure data. BUT ~half of those 183 are **UI-chrome** icons (`arrow-*`, `chevron-*`, `check`, `circle`, `2xl`/`3xl`, `at`, `bold`, etc.) that exist for the app interface, not as decorative channel/group icons. **The work is curation, not counting:** pick the thematic/decorative ones a user would actually want next to a channel name (more shapes, objects, symbols, categories), tier them sensibly in `ICON_OPTIONS`, and add any with a Tabler filled variant to `FILLED_ICONS`. Run `git diff` on `IconName` vs `ICON_OPTIONS` to see the candidate pool (the 183).

**Layer B — add genuinely new icons to the map (targeted, as needed).** When a desired icon isn't in the 232-name whitelist yet (the user notes we've done this before), add it: a member to the `IconName` union (`types.ts`) + an entry to `iconComponentMap` (`iconMapping.ts`, mapping the semantic name → the `IconXxx` Tabler component) + the picker entry + (if it has one) `FILLED_ICONS`. Verify the Tabler component name exists in `@tabler/icons-react` (and that both the outline `IconXxx` and filled `IconXxxFilled` exist if you want the variant). This grows the bundle slightly per icon (tree-shaken to what's mapped), so add deliberately, not wholesale.

**Do NOT** open the whitelist to arbitrary runtime Tabler names — that was considered and rejected (loses type-safety, complicates `.native`/bundle). Keep `IconName` a closed, curated union.

**Sequencing within this task:** (1) move the vocabulary to shared as-is (the low-risk part); (2) in the same PR or a tight follow-up, expand `ICON_OPTIONS` (Layer A curation) and add any new Layer-B icons the team wants. Get a quick sign-off on the proposed expanded list before finalizing — it's a product/design choice which decorative icons ship.

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
- [ ] quorum-desktop: `IconPicker` imports from shared; tsc + lint clean; picker renders the (expanded) icon set, outline/filled toggle, 8 colors (visual smoke).
- [ ] No regression on desktop (existing icons/colors/variant still work); the expanded list renders.
- [ ] **Picker layout holds with the larger set** — see "Picker layout" below: scroll container in place, picker doesn't overflow the viewport on web at common widths/heights, mobile picker scrolls cleanly.
- [ ] `mobile-tasks-pending.md` row added for the mobile consumption leg.

## Picker layout with the expanded set (user note 2026-06-12)

A bigger `ICON_OPTIONS` will overflow the current desktop picker (it's sized for ~49 in a grid). Address in the same desktop PR that expands the list:

- **Primary: cap the grid height + scroll.** Give the icon grid in `IconPicker.web.tsx` (`IconPicker.scss`) a `max-height` + `overflow-y: auto` (a `ScrollContainer`, which the project already uses — the `.native.tsx` picker already imports `ScrollContainer`). The grid stays a fixed footprint regardless of icon count; users scroll. Lowest-risk, scales to any size.
- **Consider alongside:** a wider/repositioned popover so more icons fit per row before scrolling (the picker is a popover/dropdown — check it doesn't clip off-screen at the edges; the project uses floating-ui elsewhere for edge-aware positioning), and/or **search/filter** within the picker if the set gets large enough that scrolling alone is tedious (a small text filter over icon names — high value once the list is, say, 80+).
- **Mobile:** `IconPicker.native.tsx` already wraps in `ScrollContainer`, so it largely handles growth — just verify the sheet height + scroll behavior with the bigger set.
- **Tiers help:** keep `ICON_OPTIONS` tiered/sectioned (it already is) so the scrollable list has visual grouping rather than one flat wall of icons.

Decide scroll-only vs scroll+search based on the final list size — scroll-only is fine up to ~60-80; add search beyond that.

*Last updated: 2026-06-12*
