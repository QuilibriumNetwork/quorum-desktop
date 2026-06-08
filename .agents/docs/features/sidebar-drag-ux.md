# Sidebar Drag & Minimize UX

How the section sidebar (DMs / Spaces / Channels / Discover) behaves when the user resizes or minimizes it. This is the spec — the source of truth for "what should happen when..." questions about sidebar width. Implementation lives in [`src/components/shell/useShellState.ts`](../../../src/components/shell/useShellState.ts) and [`src/components/shell/AppShell.tsx`](../../../src/components/shell/AppShell.tsx).

For broader responsive-layout context (rail, drawer, breakpoints), see [responsive-layout.md](./responsive-layout.md).

## Mental model

There is **one sidebar** that shows different content depending on route. Width is a property of the sidebar (like a window), not of each content mode. The user sized it; it should stay sized as they navigate.

**Two minimize states exist**, because the two content categories have different minimum-usable widths:
- **DM / Spaces / Discover** can collapse to a 72px icon strip (still functional — you can see avatars / space icons / section icons).
- **Channels** has a 144px floor (channel names truncate heavily but the list is still navigable). Channels cannot fully collapse to 72 — that would defeat the purpose of being in a channel.

## State (persisted in localStorage)

| Key | Type | Meaning |
|---|---|---|
| `shell.sidebarWidth` | number (240–480) | The user's "free width" — what the sidebar shows when not minimized. Same value used by all modes. |
| `shell.sidebarCollapsed` | boolean | True when DM/Spaces/Discover is currently in its 72px collapsed strip. |
| `shell.channelsFloored` | boolean | True when channels is currently at the 144px floor. |
| `shell.lastFreeWidth` | number | Mirror of `sidebarWidth` for backwards compatibility. |

## State (ephemeral, in `ShellState` context only)

| Field | Meaning |
|---|---|
| `dragWidth` | The live cursor-tracked width during an active drag (`null` when not dragging). |
| `sidebarLiveCollapsed` | Derived: `dragWidth !== null ? dragWidth <= 72 : sidebarCollapsed`. Sidebar content components (`DirectMessageContactsList`, `SpacesSidebar`, `DiscoverSidebar`) read THIS — not `sidebarCollapsed` — so the expanded layout appears as soon as the user starts pulling. If the user releases in the snap zone (< 200), `sidebarCollapsed` flips back true and content returns to the collapsed strip. |

## Resting (non-drag) effective width

```
channels mode:
  channelsFloored          → 144
  otherwise                → max(sidebarWidth, 144)

DM / Spaces / Discover:
  sidebarCollapsed         → 72
  otherwise                → sidebarWidth
```

## Drag behaviour

**Channels mode:**
- Dragging clamps the live width to `[144, 480]`.
- On release at exactly 144 → set `channelsFloored = true` (also sets `sidebarCollapsed = true`, see propagation rule below).
- On release above 144 → set `channelsFloored = false`, persist new width to `sidebarWidth`.

**DM / Spaces / Discover:**
- Dragging clamps live width to `[72, 480]`; below the 200px snap threshold the visible width follows the cursor down to the 72 collapsed strip.
- On release ≤ 200 → set `sidebarCollapsed = true`. `sidebarWidth` is preserved (so the next expand restores the prior free width).
- On release > 200 → set `sidebarCollapsed = false`, persist new width to `sidebarWidth`.

**Keyboard (arrow keys, Home, End on the drag handle):**
- Channels: clamp to `[144, 480]`. Pressing into the floor sets `channelsFloored = true`.
- DM/Spaces: clamp to `[240, 480]`. Keyboard never snap-to-collapses (only mouse drag does).

## Cross-mode propagation (the asymmetric rule)

**One propagation only:** setting `channelsFloored = true` also sets `sidebarCollapsed = true`.

Everything else is independent:
- Setting `channelsFloored = false` does NOT auto-clear `sidebarCollapsed`.
- Setting `sidebarCollapsed` (true or false) does NOT change `channelsFloored`.
- Setting `sidebarWidth` (drag above the floor in either mode) is purely shared — both modes will pick up the new width when next expanded.

### Why asymmetric?

- **Minimize is a global mood.** When the user shrinks one mode to its floor, they're usually saying "I want more room for content right now" — that intent applies broadly. Propagating minimize matches it.
- **Maximize is local.** Expanding channels usually has a channel-specific reason (long channel names); it's not a statement about DM/Spaces. Don't propagate.
- **Collapse-from-DM/Spaces shouldn't floor channels** because entering a channel from a collapsed-Spaces state almost always means the user wants to see the channel list. Forcing 144px there would surprise.
- **Collapse intent has a canonical destination** (72 or 144); width intent is a continuum — propagating "expand" would force a width choice on the other mode.

## Scenario table

The model resolved against the scenarios that drove the design:

| # | Start state | User action | Expected outcome | Why |
|---|---|---|---|---|
| 1 | Spaces at 280 | Switch to channels | Channels at 280 | Same `sidebarWidth`, `channelsFloored=false`. |
| 2 | Channels at 280, user drags to 400 | Switch to Spaces | Spaces at 400 | Width is shared; drag persisted to `sidebarWidth`. |
| 3 | Channels at 400, user drags to 144 | Switch to Spaces | Spaces collapsed at 72 | Floor → both flags set. |
| 4 | Spaces collapsed (72), user clicks a space icon → enters channel | Channels opens at 280 (or whatever last `sidebarWidth` was) | Collapsing Spaces doesn't floor channels. |
| 5 | Channels at 400, user drags to 144 (collapses Spaces), user drags back to 400 | Channels at 400; Spaces stays collapsed | Asymmetric un-collapse: dragging channels back up is one action; user didn't ask to un-collapse Spaces. |
| 6 | Spaces collapsed (72), user drags handle out to 350 | Spaces at 350 (`sidebarCollapsed=false`, `sidebarWidth=350`) | Standard expand. If now switching to channels, channels at 350. |
| 7 | Channels at 400, switch to Spaces (also 400), drag Spaces to 72 (collapse) | Spaces collapsed; switch back to channels → channels still at 400 | Collapsing Spaces does NOT floor channels. |
| 8 | First-time user | — | `sidebarWidth=280`, both flags false. Every mode renders at 280. | Clean defaults. |

## Constants (in [`useShellState.ts`](../../../src/components/shell/useShellState.ts))

```typescript
export const SIDEBAR_COLLAPSED_WIDTH = 72;   // DM/Spaces collapsed-strip width
export const SIDEBAR_MIN_WIDTH = 240;        // DM/Spaces minimum free width
export const SIDEBAR_MAX_WIDTH = 480;        // shared max
export const SIDEBAR_SNAP_THRESHOLD = 200;   // mouse drag below this → snap to collapsed
export const CHANNELS_SIDEBAR_FLOOR = 144;   // channels mode minimum
const DEFAULT_SIDEBAR_WIDTH = 280;           // first-time-user default
```

Mirror in [`_variables.scss`](../../../src/styles/_variables.scss): `$sidebar-width: 280px`, `$sidebar-width-collapsed: 72px`.

## Touch / phone

Phone collapses both the rail and the sidebar into a focus-trapped off-canvas drawer (see [responsive-layout.md](./responsive-layout.md)). The drag handle is suppressed on touch (`@media (hover: none)` in [`AppShell.scss`](../../../src/components/shell/AppShell.scss)). All width/minimize state is desktop-only — tablet and phone force `sidebarCollapsed = true` for visual layout, but the underlying desktop preferences are preserved untouched.

## Migration

Pre-existing users may have `shell.sidebarWidth = 72` from the old model that wrote the collapsed-strip width directly into the width key. On first load with the new model, `resolveInitialState` detects width ≤ 72 and treats the user as collapsed: it restores their prior free width from `lastFreeWidth` (or falls back to the 280 default) and sets `sidebarCollapsed = true`. Old `shell.channelsWidth` keys from an interim model are simply ignored — the new model doesn't read them.

---

*Last updated: 2026-06-08*
