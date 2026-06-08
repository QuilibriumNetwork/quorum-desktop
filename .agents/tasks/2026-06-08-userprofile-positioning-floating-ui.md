---
type: task
title: Migrate UserProfile card positioning to @floating-ui/react
status: open
created: 2026-06-08
scope: desktop
priority: low
related:
  - .agents/tasks/port-from-mobile/2026-06-08-port-per-space-bio.md (the PR that surfaced this)
---

# Migrate UserProfile card positioning to @floating-ui/react

## Why this exists

The per-space bio port (2026-06-08) made the in-channel `UserProfile` card noticeably taller. Triggers near the bottom of the viewport (a recent message, a member at the end of the sidebar) showed the card clipping past the viewport bottom. A short-term clamp was added in `src/utils/modalPositioning.ts` that bounds `position.top` so the card always fits — that ships with the bio PR. This task is the proper architectural fix that the clamp defers.

## The current positioning architecture (problem statement)

`UserProfile` is positioned three different ways depending on how it's opened. Each path has its own assumptions and edge cases:

| Trigger | Code path | What it does |
|---|---|---|
| Click avatar on a message | `Message.tsx` sets `userProfileDirection` ('upwards' or 'downwards') based on whether the click was above or below the viewport's vertical midpoint; applies a negative top margin in JSX | Hand-rolled flip; no horizontal bound check; renders the card inline inside the message DOM |
| Click @mention in message text | `useUserProfileModal.handleUserClick` → `calculateModalPosition` with `context: 'mention'` | Returns `{ top: elementRect.top, left: calculateHorizontalPosition(...) }`. Left flips when off-screen; top has no bound check (now clamped, but as a patch, not as design). |
| Click a user in the right sidebar | `Channel.tsx` renders the card with hardcoded `top: ${modalPosition.top}px` + `left: calc(100vw - ${getSidebarRightWidth()}px - 320px)` | Mixes JS-computed top with a CSS calc() for left; the 320 is a magic number tied to `MODAL_DIMENSIONS.USER_PROFILE_WIDTH`. |

`MODAL_DIMENSIONS.USER_PROFILE_HEIGHT = 280` is a guess. The real height depends on:

- Whether `props.user.bio` is present (adds ~50-80px depending on bio length)
- Number of roles (each row is ~26px)
- Whether the personal note is open (textarea adds ~96px)
- Whether moderation buttons are shown (Mute/Kick add ~40px)

The 280 estimate is wrong in both directions: profiles with no bio + no roles + no note are ~140px; profiles with bio + 5 roles + open note + moderation buttons are ~480px. The current clamp uses 280 as the assumed height for the bottom bound, so a really tall card still clips — just less.

## Proposed solution: Floating UI

Replace all three positioning paths with `@floating-ui/react`. The library is the de-facto standard for this problem and is used by Radix, Headless UI, shadcn, MUI v6, Mantine, and most modern React UI libraries.

### What the new code shape looks like

```ts
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';

// Inside UserProfile (the card component itself):
const { refs, floatingStyles } = useFloating({
  placement: 'right-start',         // sensible default for sidebar; mention/message-avatar can override
  middleware: [
    offset(8),                       // SPACING.MODAL_ELEMENT_GAP
    flip(),                          // flips to left-start if right is off-screen; replaces userProfileDirection logic
    shift({ padding: 16 }),          // slides along the perpendicular axis to stay in viewport; replaces the bottom clamp
  ],
  whileElementsMounted: autoUpdate, // recompute on scroll, resize, layout changes
});
```

Then the trigger ref is `refs.setReference` and the floating element ref is `refs.setFloating`. Position style comes from `floatingStyles`.

### What that removes / replaces

| Today | After |
|---|---|
| `src/utils/modalPositioning.ts` (78 lines) | Delete entirely |
| `src/constants/ui.ts` `USER_PROFILE_HEIGHT`, `USER_PROFILE_WIDTH`, `MODAL_EDGE_PADDING`, `VIEWPORT_BOTTOM_PADDING`, `MODAL_ELEMENT_GAP` | Replace with Floating UI's `offset(8)` + `shift({ padding: 16 })` middleware config |
| `Message.tsx` `userProfileDirection` state + `setUserProfileDirection` handler + the upwards/downwards JSX margin | Delete — `flip()` middleware handles it |
| `Channel.tsx` hardcoded `calc(100vw - ${getSidebarRightWidth()}px - 320px)` | Replace with `refs.setFloating` ref + `style={floatingStyles}` |
| Each click-handler manually computing positions before opening | Trigger becomes a ref attached to the avatar/mention element |
| The "sidebar" / "mention" / "message-avatar" context discriminator | Disappears — Floating UI middleware is composable per call site |

### Accessibility wins (free)

- Focus management: `useDismiss`, `useRole({ role: 'dialog' })`, `useFocus` middleware
- Escape key close
- Outside click close
- `aria-haspopup`, `aria-expanded` on trigger
- `aria-labelledby` wiring on floating panel

All currently re-implemented (poorly) across the three call sites.

## Migration plan

PR scope is medium. Recommend a single feature PR; the surfaces it touches are small enough.

1. `yarn add @floating-ui/react` (~15KB gzipped). Verify no existing transitive dep already pulls it in (Floating UI is used by many libs).
2. Refactor `UserProfile.tsx` to expose a `useFloatingUserProfile` hook OR accept `floatingStyles` + ref as props. Pick whichever lets the card stay a pure presentational component.
3. Refactor each call site:
   - `Message.tsx`: replace inline JSX positioning + `userProfileDirection` state with the floating-ui trigger ref.
   - `useUserProfileModal.ts`: this hook can probably be removed entirely — Floating UI's `useFloating` + `useClick` replaces it. Audit consumers.
   - `Channel.tsx` sidebar render block (~L1900-1934): replace with the floating-ui-controlled element.
   - `BookmarksPage.tsx`: same as Channel.tsx — uses `useUserProfileModal` today.
4. Delete `src/utils/modalPositioning.ts` and the unused constants in `ui.ts`.
5. Smoke test: each of the four call sites (message avatar, mention, sidebar member click, bookmarks user click) on tall and short profiles, near viewport top, middle, and bottom.

## Why this is "low priority"

The viewport clamp in the bio PR is good enough for the realistic distribution of profile heights. The architectural problem (multiple positioning paths, magic numbers, no flip on non-message contexts) is real but doesn't cause user-visible breakage today.

Worth picking up when:

- Another UserProfile-shaped surface is added (e.g. a hover card on member-list rows, a profile preview in the threads sidebar) — that would be the third+ duplication and warrants doing it right.
- An accessibility audit finds the modal fails WAI-ARIA dialog/popover conformance.
- A user reports a clipping bug the clamp doesn't handle (extreme content + tiny viewport).

## Out of scope

- Migrating other modal-style surfaces (ConfirmationModal, SpaceSettingsModal). Those use `<Modal>` from `primitives/` — different shape entirely (centered, backdrop-overlay) and not anchored to a trigger. Floating UI is the wrong tool there.
- Touching the mobile drawer path in `Channel.tsx` (~L1937). Mobile uses `MobileDrawer`, not a positioned modal.

---

*Created 2026-06-08 during the per-space bio port. Surfaced because the bio addition made the UserProfile card tall enough to clip in the bottom of the viewport for the first time consistently.*
