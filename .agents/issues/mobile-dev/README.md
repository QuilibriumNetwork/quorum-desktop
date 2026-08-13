---
type: task
title: "mobile-dev — historical reference (single-repo era)"
status: archived
priority: low
created: 2026-06-12
updated: 2026-08-13
---

# mobile-dev — historical cross-platform planning

> **⚠️ Two claims below were checked on 2026-08-13 and did not hold. Verify before acting on this file.**
>
> 1. **The Passkey-SDK / WASM blocker is resolved.** `2025-08-08-mobile-sdk-integration-issue.md` is listed below as "still unresolved" and "a live constraint for `quorum-mobile`". It is not. `quorum-mobile` went around the problem entirely: it ships a native Expo module, `modules/quorum-crypto/`, with UniFFI Rust bindings (`libchannel.so` per ABI, `Channel.xcframework`, `QuorumCryptoModule.kt`) and has **no dependency on `@quilibrium/quilibrium-js-sdk-channels`**. Do not copy that doc there; it describes an approach they abandoned.
> 2. **`2026-01-09-mobile-touch-transition-plan.md` is a `quorum-desktop` doc.** It audits *this* repo's mobile-**browser** touch UX (`MobileDrawer`, `MessageActionsDrawer`, `EmojiPickerDrawer`) and concludes they are kept and correct, because desktop-browser-on-a-phone is a supported case here. Only its closing "Template Usage Strategy" section faces mobile. It belongs in this repo.
>
> The `mobile/` workspace and all 30 `.native.tsx` files this folder planned around were deleted on 2026-08-13 — see [`../2026-08-13-remove-single-repo-cross-platform-leftovers.md`](../2026-08-13-remove-single-repo-cross-platform-leftovers.md). This folder is now purely a record of a decision, which is why its status is `archived`.

> **What this folder is.** Planning + reference docs from the **original cross-platform effort** (2025-08 → 2026-01), when the plan was to build the mobile app **inside `quorum-desktop`** as a single cross-platform repo. **That approach was abandoned.** The current architecture is multi-repo:
> - `quorum-desktop` — web + Electron (this repo)
> - `quorum-mobile` — React Native + Expo (separate repo)
> - `quorum-shared` — npm package: shared types, hooks, sync protocol, UI primitives (the middle ground)
>
> Canonical current-architecture docs: [`../../docs/quorum-shared-architecture.md`](../../docs/quorum-shared-architecture.md). The live desktop↔mobile gap inventory is [`../port-to-mobile/candidates.md`](../port-to-mobile/candidates.md); mobile task tracking is [`../quorum-shared-migration/mobile-tasks-pending.md`](../quorum-shared-migration/mobile-tasks-pending.md).

## Cleanup pass 2026-06-12

Audited all 18 files against the current architecture. Result:

### Kept as reference (root) — philosophy/findings still valid

These 5 already carry a 2026-04-09 "Architecture Status" banner reconciling them with the multi-repo model, and contain guidance still cited by active work:

- [`2026-01-09-components-shared-arch-masterplan.md`](2026-01-09-components-shared-arch-masterplan.md) — the architectural philosophy (3-layer primitives/business/app model). Path examples now mean `quorum-shared`.
- [`2025-08-01-business-logic-extraction-plan.md`](2025-08-01-business-logic-extraction-plan.md) — Phase 1 (hook extraction) shipped; the "Lessons Learned" hook-extraction patterns are evergreen.
- [`2025-08-08-mobile-sdk-integration-issue.md`](2025-08-08-mobile-sdk-integration-issue.md) — the Passkey-SDK/WASM-vs-React-Native blocker. ~~Still unresolved; live constraint for `quorum-mobile`.~~ **Corrected 2026-08-13: resolved.** `quorum-mobile` sidestepped the WASM SDK with a native UniFFI module (`modules/quorum-crypto/`). Historical only.
- [`2026-01-09-mobile-touch-transition-plan.md`](2026-01-09-mobile-touch-transition-plan.md) — ~~useful for `quorum-mobile` devs.~~ **Corrected 2026-08-13:** this is a `quorum-desktop` doc about this repo's mobile-*browser* touch UX, which is kept and correct. Only its closing "Template Usage Strategy" section faces native.
- [`docs/component-architecture-workflow-explained.md`](docs/component-architecture-workflow-explained.md) — the only developer-facing explanation of the primitive/business/app model; banner already updated.

### Archived (`.archived/`) — obsolete approach OR work already shipped

Moved here 2026-06-12 (joining the 5 already archived):

- `2026-01-09-cross-platform-hooks-refactoring-plan.md` — marked `superseded`; single-repo adapter plan, replaced by shared-migration work.
- `2026-01-09-css-to-mobile-colors-sync.md` — target file never created; mobile manages its own colors now.
- `2026-01-09-file-upload-hooks-consolidation.md` — primitive never shipped; cross-platform driver gone.
- `2026-01-09-mobile-image-compression.md` — **shipped** in `quorum-mobile` (`services/media/imageAttachment.ts` + `expo-image-manipulator`).
- `2026-01-09-upgrade-to-react-80.md` — **moot**; mobile is already on RN 0.81.5 / Expo SDK 54 (past 0.80).
- `2026-01-09-internationalization-i18n-implementation-plan.md` — i18n is **still genuinely pending on mobile**, so the plan was preserved, but it's now tracked in the current system: [`port-to-mobile/candidates.md` #19](../port-to-mobile/candidates.md#19-mobile-i18n--language-switcher--feature-port-detailed-plan-exists) + a row in [`mobile-tasks-pending.md`](../quorum-shared-migration/mobile-tasks-pending.md). The detailed plan lives in `.archived/` as the reference the candidate points to.
- `mobile-desktop-audit.md` — superseded by [`port-to-mobile/candidates.md`](../port-to-mobile/candidates.md) (the actual, richer cross-repo audit it was a plan to produce).
- `third-party-component-migration-report.md` — its native-lib recommendations are mostly wrong vs what mobile actually chose (`@shopify/flash-list`, `expo-*`, `@tabler/icons-react-native`).

Plus the 5 pre-existing archives (`mobile-dev-plan.md`, `native-business-components-plan.md`, `plan-quick-recap.md`, `primitive-migration-audit.md`, `sdk-shim-temporary-solutions.md`) — all the original single-repo execution plans + their snapshots.

> **For new mobile work, don't start here.** Use [`port-to-mobile/candidates.md`](../port-to-mobile/candidates.md) (what to port) and [`mobile-tasks-pending.md`](../quorum-shared-migration/mobile-tasks-pending.md) (a signpost to mobile's live trackers — `STATUS.md` / `RECAP.md` in the mobile repo). This folder is history + a few still-useful reference reads.

*Last updated: 2026-08-13*
