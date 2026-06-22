---
type: task
title: Adopt FloatingPopover across the remaining trigger-anchored surfaces
status: open
created: 2026-06-22
scope: desktop
priority: medium
related:
  - .agents/tasks/2026-06-08-userprofile-positioning-floating-ui.md (the migration that introduced the primitive)
---

# Adopt FloatingPopover across the remaining trigger-anchored surfaces

## Why this exists

The 2026-06-08 task migrated the `UserProfile` card to `@floating-ui/react`
and, while doing it, built a reusable primitive: [`FloatingPopover`](../../src/components/ui/FloatingPopover.tsx).
That work shipped (commits `91d92147` + `262c03f8` on `feat/floating-ui-userprofile`).

During that migration an audit of the whole codebase found that UserProfile was
**not** the only place hand-rolling trigger-anchored positioning — there are
**8 distinct floating surfaces**, each independently re-implementing the same
"measure a trigger rect, then flip/clamp to stay on screen" logic with its own
magic numbers and edge-case bugs. UserProfile is now done; this task is to
migrate the rest onto the same primitive so the pattern lives in exactly one
place.

`FloatingPopover` already encapsulates: flip + shift + (cross-axis) flip-upward
fit, `strategy: 'fixed'` body-portalling, reactive `elements.reference`, the
`isPositioned`-free reveal, escape / outside-press dismissal, dialog role +
focus management, and the `closeOnScroll` option for anchors inside the
virtualized message list. Most of the surfaces below need a subset of that.

## Surfaces to migrate (from the audit)

Each currently hand-rolls positioning; migrate to `<FloatingPopover>` (or a
small variant of it where the trigger differs, e.g. a caret/virtual reference).

| # | Surface | Current implementation | Notes for migration |
|---|---|---|---|
| 1 | Emoji picker (desktop) | `useEmojiPicker.ts` manual flip-up, magic `pickerHeight` constant; opened from `MessageActions` | Lives in the virtualized message list → pass `closeOnScroll`. Anchor = the "more reactions" button rect. |
| 2 | @mention autocomplete dropdown | `MentionDropdown.tsx` portal + `caretCoordinates.ts` mirror-div; flips above/below caret | Trigger is a **caret position**, not an element → use a virtual reference element (`getBoundingClientRect` returning the caret rect) via floating-ui's virtual-element support. |
| 3 | Message actions menu (kebab) | `MessageActionsMenu.tsx` invisible measure-on-mount + flip-x/clamp-y | In the message list → `closeOnScroll`. Anchor = the dots button. |
| 4 | Context menu (right-click) | `ContextMenu.tsx` estimated-height-from-item-count, flip-x/y | Opens at `clientX/clientY` → virtual reference at the pointer. Used for spaces/folders/DM contacts/channels. |
| 5 | Icon / color picker popover | `IconPicker.web.tsx` `rect.bottom + 4`, **no flip** (latent bottom-clip bug) | Straightforward anchor to the trigger button; `flip()` fixes the existing latent clip. |
| 6 | Markdown formatting toolbar | `MarkdownToolbar.tsx` + `toolbarPositioning.ts` mirror-div selection bounds; duplicated inline in `MessageComposer.tsx` | Trigger is a **text selection** → virtual reference from the selection range rect. Migrating also lets us delete the duplicate in MessageComposer. |

### Explicitly OUT of scope

- **`Select` dropdown** — lives in `@quilibrium/quorum-shared`
  (`Select.web.tsx`), not this repo. Migrating it needs a coordinated
  quorum-shared change and must not break React Native. Track separately.
- **Centered modals** (`Modal` primitive, `ConfirmationModal`, image modal) —
  backdrop-overlay, not trigger-anchored. Floating UI is the wrong tool.
- **Right-aligned header panels** (Notification / Bookmarks / Pinned / Threads
  via `DropdownPanel`) — viewport-corner-pinned, not anchored to a trigger.
- **MobileDrawer** and the **"Jump to present" button** — not trigger-anchored.

## Suggested approach

1. Start with the **easy wins** that already anchor to a real element and only
   need flip/shift: **Icon picker (5)** and **Message actions menu (3)**.
   These validate the primitive on non-UserProfile surfaces with minimal risk.
2. Then the **virtual-reference** cases (context menu, mention dropdown,
   markdown toolbar): these need `FloatingPopover` to accept a virtual
   reference (a `{ getBoundingClientRect }` object) instead of an
   `HTMLElement` anchor. Extend the primitive's `anchor` prop type to accept
   `HTMLElement | VirtualElement | null` and pass it straight through to
   `elements.reference` — floating-ui supports virtual elements natively.
3. Emoji picker last (it's the most behaviour-heavy; `closeOnScroll` applies).
4. As each surface migrates, delete its bespoke positioning util:
   `caretCoordinates.ts`, `toolbarPositioning.ts`, the manual flip code in
   `useEmojiPicker.ts`, the constant-based estimates in `ContextMenu.tsx`, and
   the duplicate toolbar positioning in `MessageComposer.tsx`.

Do these as **separate PRs per surface** (or small clusters) — they touch hot
paths (message rendering, composer) and are easier to review and revert
individually than one big sweep.

## Done when

- Surfaces 1–6 use `FloatingPopover` (or its virtual-reference variant).
- The bespoke positioning utilities listed above are deleted.
- Each migrated surface smoke-tested near viewport edges (the flip/shift the
  hand-rolled code got wrong in places now comes for free).

---

*Created 2026-06-22 after shipping the UserProfile FloatingPopover migration.
Source: the codebase audit run during that migration.*
