# Docs refresh after new-UI shell migration

> **Read this whole file before doing anything.** Then read the ground-truth files in §1 before touching any doc. The previous session built the new shell across `feat/new-UI` (currently 30+ commits ahead of `main`); the docs in `.agents/docs/features/` still describe the deleted NavMenu architecture. Your job is to bring them up to date — accurately, not just by find-and-replace.

## Self-orientation for a fresh agent

You are coming in cold to a branch where the UI shell was rebuilt. The old shell lived in `src/components/navbar/` (NavMenu, FolderContainer, SpaceButton, ExpandableNavMenu) and is **gone** — every file in `navbar/` was deleted or moved. The replacement lives in `src/components/shell/` (structural) and `src/components/space/` (spaces-specific).

If you see a doc that says "see `src/components/navbar/NavMenu.tsx`", that's a stale reference. The doc was written against the old code. Your job is to make the doc accurate against the new code.

Before you touch a doc, you must understand the new architecture. §1 below tells you exactly which files to read first. Do not skip §1.

---

## §1 — Ground truth: read these files first (in this order)

Spend 20–30 minutes reading these. Take notes. They are the canonical implementation; the docs must reflect them, not the other way around.

### Structural shell
1. [src/components/shell/AppShell.tsx](../../src/components/shell/AppShell.tsx) — 3-column layout (rail + sidebar + main), drag-to-resize handle, phone drawer with focus trap. Look at `useShellState` consumers and how `sidebarWidth` flows.
2. [src/components/shell/NavRail.tsx](../../src/components/shell/NavRail.tsx) — the left rail. Items are `dm`, `spaces`, `discover`. DM unread dot via `useDirectMessageUnreadCount`.
3. [src/components/shell/Sidebar.tsx](../../src/components/shell/Sidebar.tsx) — dispatcher: picks `DirectMessageContactsList`, `ChannelList`, or `SpacesSidebar` based on `useSidebarMode`.
4. [src/components/shell/useShellState.ts](../../src/components/shell/useShellState.ts) — sidebar width state, viewport (phone/tablet/desktop), drawer state. Note the `sidebarWidth` migration from the legacy `sidebarCollapsed` boolean.
5. [src/components/shell/useSidebarMode.ts](../../src/components/shell/useSidebarMode.ts) — route-driven (`dm` / `spaces` / `channels` / `hidden`).

### Spaces sidebar (replaces NavMenu's space list)
6. [src/components/space/SpacesSidebar.tsx](../../src/components/space/SpacesSidebar.tsx) — owns the `DragStateProvider + DndContext + SortableContext + DragOverlay` stack. Iterates `navItems` (folders + standalone spaces). Surfaces `useSpaceUnreadCounts`, `useSpaceMentionCounts`, `useSpaceReplyCounts`, `useMutedSpacesSet`, `useSpaceContextMenu`.
7. [src/components/space/SpacesSidebarRow.tsx](../../src/components/space/SpacesSidebarRow.tsx) — per-space row. Two-line layout (expanded) or 56px icon strip (compact). `parentFolderId` prop says it's inside a folder. Wires `useSortable`, `useSpaceMembers`, `useSpaceOwner`. Owner crown + muted badge.
8. [src/components/space/SpacesSidebarFolder.tsx](../../src/components/space/SpacesSidebarFolder.tsx) — the fork of `navbar/FolderContainer`. Renders `FolderButton` for the header and `SpacesSidebarRow` for nested rows. Long-press for folder edit. `collapsed` prop switches between the strip layout (rail-like) and the row layout. Aggregates `folderMentionCount` from per-space counts.
9. [src/components/space/SpaceIcon.tsx](../../src/components/space/SpaceIcon.tsx) — avatar primitive. `notifs` prop controls a small accent dot at `left: -15px`; `mentionCount` prop renders the top-right number bubble.
10. [src/components/space/FolderButton.tsx](../../src/components/space/FolderButton.tsx) — folder header tile. Used inside `SpacesSidebarFolder`. NOT the same as the deleted `FolderContainer` — this is just the colored tile, not the wrapper.

### DM sidebar (mostly unchanged; only positioning of the unread dot moved)
11. [src/components/direct/DirectMessageContactsList.tsx](../../src/components/direct/DirectMessageContactsList.tsx) — list of conversations.
12. [src/components/direct/DirectMessageContact.tsx](../../src/components/direct/DirectMessageContact.tsx) — per-contact row. Note that the unread dot moved from the row edge to the avatar wrapper (uses the shared `.icon-unread-dot` class).

### DnD and folders (data layer — unchanged from the old NavMenu era)
13. [src/hooks/business/folders/useFolderDragAndDrop.ts](../../src/hooks/business/folders/useFolderDragAndDrop.ts) — 9 drag scenarios (SPACE_TO_SPACE, SPACE_TO_FOLDER, FOLDER_SPACE_TO_FOLDER, SPACE_OUT_OF_FOLDER, etc.). Optimistic update + action queue.
14. [src/hooks/business/folders/useNavItems.ts](../../src/hooks/business/folders/useNavItems.ts) — derives ordered `navItems` from `config.items`.
15. [src/hooks/business/folders/useFolderStates.ts](../../src/hooks/business/folders/useFolderStates.ts) — localStorage-backed expand/collapse.
16. [src/context/DragStateContext.tsx](../../src/context/DragStateContext.tsx) — visual feedback state (`activeItem`, `dropTarget`, `isDragging`).

### Notification/badge counts (the "needs attention" pipeline)
17. [src/hooks/business/messages/useDirectMessageUnreadCount.ts](../../src/hooks/business/messages/useDirectMessageUnreadCount.ts) — total DM unread, drives NavRail dot.
18. [src/hooks/business/messages/useSpaceUnreadCounts.ts](../../src/hooks/business/messages/useSpaceUnreadCounts.ts) — per-space unread.
19. [src/hooks/business/mentions/useSpaceMentionCounts.ts](../../src/hooks/business/mentions/useSpaceMentionCounts.ts) — per-space mentions.
20. [src/hooks/business/replies/useSpaceReplyCounts.ts](../../src/hooks/business/replies/useSpaceReplyCounts.ts) — per-space replies. Mentions + replies are merged for the "needs attention" mention bubble; this is distinct from unread count.

### Shared visual primitives (CSS)
21. [src/styles/_components.scss](../../src/styles/_components.scss) — search for `.icon-unread-dot`, `.icon-mention-bubble` (canonical visuals; positions relative to a `position: relative` avatar wrapper), `.muted-badge`, `.sidebar-row-chrome` (hover/accent/merge-target chrome shared between row and folder header), `.sidebar-row-chrome--merge-target`, `.sidebar-search-row`, `.sidebar-header*`.
22. [src/components/space/SpacesSidebar.scss](../../src/components/space/SpacesSidebar.scss) — row + strip layouts, drag visuals.
23. [src/components/space/Folder.scss](../../src/components/space/Folder.scss) — folder container + header variants. Note the `--row` / `--strip` modifier split.

### How startup data-sync works (new)
24. [src/components/StartupEffects.tsx](../../src/components/StartupEffects.tsx) — currently only mounts `useSpaceTagStartupRefresh`. This component is intentionally side-effect-only; if you see a doc explaining startup behavior, this is the new mount point (NOT NavMenu).

---

## §2 — Files to update

For each, the format is:

- **Path**
- **Confidence** (HIGH = clear delta, MEDIUM = needs judgement, LOW = unclear)
- **Stale claims** (the specific wrong things, with line numbers from the prior audit)
- **What's true now** (the replacement facts grounded in §1)
- **Scope of change** (path-only / paragraph rewrite / section rewrite)

### Already path-rewritten this session
- [avatar-initials-system.md](../../.agents/docs/features/avatar-initials-system.md)
  - **Confidence:** HIGH (done)
  - **What changed:** `src/components/navbar/SpaceIcon.tsx` → `src/components/space/SpaceIcon.tsx`; "Navbar space icons" → "Space sidebar icons"
  - **Action:** Re-read for coherence. The text around the renamed paths should still flow naturally. No further edits unless something reads broken.

### Path-only updates (small)
- [channel-space-mute-system.md](../../.agents/docs/features/channel-space-mute-system.md)
  - **Confidence:** HIGH
  - **Stale claims:**
    - Line 66: "Space Context Menu | [NavMenu.tsx](src/components/navbar/NavMenu.tsx) | Space-level mute toggle"
    - Line 222: "**File**: [NavMenu.tsx](src/components/navbar/NavMenu.tsx)"
  - **What's true now:** The space-level mute toggle is a context-menu item built by [useSpaceContextMenu](../../src/hooks/business/spaces/useSpaceContextMenu.tsx) (the hook returns a `Mute / Unmute Space` `MenuItem`). The hook is invoked from [SpacesSidebar.tsx](../../src/components/space/SpacesSidebar.tsx) via `openRowContextMenu(...)` triggered by right-click on a `SpacesSidebarRow`.
  - **Action:** Replace both references. The doc's surrounding explanation of *how mute works* (`useChannelMute`, notification settings) is still correct — only the entry-point references need to change.

- [mute-conversation-system.md](../../.agents/docs/features/mute-conversation-system.md)
  - **Confidence:** MEDIUM
  - **Stale claims:**
    - Line ~18 and ~74: references "NavMenu DM badge" as the muted-conversation indicator surface
    - `useDirectMessageUnreadCount.ts:11` JSDoc still says "used for the NavMenu Direct Messages icon indicator"
  - **What's true now:** The cross-section DM unread dot is in [NavRail.tsx](../../src/components/shell/NavRail.tsx) (small accent dot via `.icon-unread-dot` when `dmUnreadCount > 0`). The per-row muted state is in [DirectMessageContact.tsx](../../src/components/direct/DirectMessageContact.tsx) (`.dm-muted-badge` on the avatar wrapper). The unread badge on the avatar uses the shared `.icon-unread-dot`.
  - **Action:** Update the badge surface references. Also update the JSDoc in `useDirectMessageUnreadCount.ts:11` from "NavMenu Direct Messages icon indicator" to "NavRail DM unread dot".

- [modals.md](../../.agents/docs/features/modals.md)
  - **Confidence:** MEDIUM
  - **Stale claims:**
    - Lines 21, 24, 40: modals are "triggered from NavMenu"; z-index warning mentions NavMenu stacking
  - **What's true now:** Modal triggers are spread across the new shell. The Add Space / Create Space flow is triggered from the SpacesSidebar `+` button → ContextMenu with two items routing to `AddSpaceModal` (join) or `CreateSpaceModal` (create). User settings is from the NavRail user avatar at the bottom. Other modals (image, edit history, reactions) are still triggered from chat messages, unchanged. The z-index advice (ContextMenu must sit above the floating modal layer) is still correct in spirit — verify by reading the current z-index hierarchy in `_components.scss` and the modals.
  - **Action:** Rewrite the "triggered from" sentence. Keep the z-index advice but rename the surface that motivates it.

### Architecture rewrites (substantive)
- [notification-indicators-system.md](../../.agents/docs/features/notification-indicators-system.md)
  - **Confidence:** HIGH that the component map is stale; MEDIUM on the rest (read the file fully).
  - **Stale claims:**
    - Lines 22, 76–100, 194, 285–289 describe the indicator pipeline as flowing through `navbar/FolderContainer.tsx`, `navbar/NavMenu.tsx`, `navbar/SpaceIcon.tsx`.
  - **What's true now:**
    - The pipeline now flows: `useSpaceUnreadCounts` → secondary text badge on `SpacesSidebarRow` (`.spaces-sidebar__row-badge`); `useSpaceMentionCounts + useSpaceReplyCounts` (merged as `spaceMentionPlusReplyCounts` in `SpacesSidebar.tsx`) → `mentionCount` prop on `SpacesSidebarRow` → `SpaceIcon`'s mention bubble (`.space-icon-mention-bubble` or shared `.icon-mention-bubble`).
    - For folders: `SpacesSidebarFolder.tsx` computes `folderMentionCount = sum(spaceMentionCounts[child])` and passes it to `FolderButton`.
    - For DMs: `useDirectMessageUnreadCount` drives the rail dot in `NavRail.tsx`. Per-row DM unread uses `.icon-unread-dot` inside the avatar wrapper in `DirectMessageContact.tsx`.
    - Shared CSS lives in `_components.scss`: `.icon-unread-dot` (positions a 6px accent dot at `left: -15px` of any `position: relative` wrapper) and `.icon-mention-bubble` (top-right number badge).
  - **Action:** Rewrite the component map (the table-style listing of which file owns which indicator) and the data-flow diagram if there is one. Keep the conceptual explanation of "unread vs mention vs reply" because that's still accurate — only the rendering layer changed. Cross-link to §1 files.

- [space-folders.md](../../.agents/docs/features/space-folders.md)
  - **Confidence:** HIGH that the architecture sections are stale; verify each by reading first.
  - **Stale claims:** Per the prior audit, lines 75–93, 108, 234, 317, 412–468, 478, 537–547, 584, 597. The whole doc treats `navbar/FolderContainer.tsx`, `navbar/SpaceButton.tsx`, `navbar/FolderContextMenu.tsx` as the implementation.
  - **What's true now:**
    - `SpacesSidebarFolder.tsx` is the fork of `FolderContainer`. Same DnD wiring (`useSortable`, `useFolderDragAndDrop`), same expand/collapse animation, same touch long-press for opening the folder editor. Different: renders nested rows via `SpacesSidebarRow` (two-line layout) instead of `SpaceButton` (icon tile). The `collapsed` prop toggles between strip (72px rail-like) and row (two-line) layout.
    - The data hooks — `useFolderDragAndDrop`, `useNavItems`, `useFolderStates` — are unchanged. The doc's data-flow descriptions of these hooks should still be correct; verify by re-reading the hooks.
    - The drop-target visual is no longer a wiggle outline at row scale — that was the right choice for 72px icon tiles, but looks wrong on full-width rows. The new visual: `.sidebar-row-chrome--merge-target` (translucent accent background + accent left bar). The wiggle animation is kept but applied only to the inner `SpaceIcon` avatar (via `.spaces-sidebar__row-avatar--wiggle`) and to the `FolderButton` itself.
    - Reorder drop indicators are `.spaces-sidebar__row-drop-indicator` (a thin accent bar rendered above or below a row depending on `dropTarget.intent === 'reorder-before' / 'reorder-after'`).
    - All 9 drag scenarios from `useFolderDragAndDrop` still apply: SPACE_TO_SPACE (creates folder from 2 standalone spaces), SPACE_TO_FOLDER (drop on folder header), SPACE_TO_FOLDER_SPACE (drop on row inside folder), FOLDER_SPACE_TO_FOLDER (move between folders), FOLDER_SPACE_TO_SPACE (create new folder from a folder-space + a standalone), SPACE_OUT_OF_FOLDER (drag a folder-space out), FOLDER_REORDER (reorder folders), SPACE_REORDER_STANDALONE (reorder standalone spaces), SPACE_REORDER_IN_FOLDER (reorder inside a folder).
    - Collapsed-strip DnD is also implemented now (was deferred originally). `SpacesSidebarRow compact` participates in DnD; folders render via `SpacesSidebarFolder collapsed`.
  - **Action:** This is the longest rewrite. Plan ~1 hour. Section-by-section: read the existing prose, then rewrite the architecture sections against §1 files. Keep historical context where it adds clarity (e.g. "the old `FolderContainer` rendered children as 72px icon tiles; the new `SpacesSidebarFolder` uses the two-line row layout for visual consistency with top-level rows"). Keep all DnD logic descriptions — they still apply.

- [responsive-layout.md](../../.agents/docs/features/responsive-layout.md)
  - **Confidence:** HIGH
  - **Stale claims:** Lines 25, 57, 65, 71, 76, 98 describe NavMenu widths (74px / 50px) and reference `navbar/NavMenu.scss` for CSS.
  - **What's true now:**
    - NavRail: `$rail-width-collapsed: 72px`, `$rail-width-expanded: 236px`. Defined in `src/styles/_variables.scss`.
    - Sidebar: `$sidebar-width: 300px`, `$sidebar-width-collapsed: 72px`. Defined in `_variables.scss`. **User-resizable** via the drag handle on the sidebar's right edge, persisted as `shell.sidebarWidth` in localStorage. The legacy `shell.sidebarCollapsed` boolean is read on first load for migration.
    - Drag handle hover-arms after 500ms hover (data attribute `data-hover-armed="true"`), accent color tint via `--shell-drag-handle-hover-color`. Disabled on phone / tablet (drag handle isn't rendered).
    - Viewport breakpoints in `useShellState.ts`: `PHONE_MAX = 767`, `TABLET_MAX = 1023`. Returns `'phone' | 'tablet' | 'desktop'`.
    - Phone uses a slide-in drawer (not the sidebar). See `AppShell.tsx` for the drawer mount + focus trap; `useShellState`'s `openDrawer` / `closeDrawer` for state.
    - Channels mode pins the sidebar to a fixed 300px (`CHANNELS_SIDEBAR_WIDTH` in `AppShell.tsx`) regardless of the user's persisted width.
  - **Action:** Rewrite the width/breakpoint sections. The "responsive" framing of the doc (what changes at each viewport) is still valid — just update the dimensions and behaviors.

### JSDoc + inline comment refresh (same task; minimal effort, useful coherence)
- `src/hooks/business/messages/useDirectMessageUnreadCount.ts:11` — "used for the NavMenu Direct Messages icon indicator" → "used by NavRail's DM unread dot"
- `src/components/space/SpacesSidebar.tsx:54-66` — JSDoc still says "minimal first pass (step 8)" and lists deferred items that are shipped or removed. Rewrite to reflect the current scope (folders + DnD shipped; favorites and hide-muted removed; last-message previews not planned for spaces).
- `src/components/space/SpacesSidebar.tsx:79-81` — comment references `FolderContainer` as a child; should be `SpacesSidebarFolder`.

### Task file housekeeping (lower priority)
- `.agents/tasks/2026-01-07-channel-ordering-feature.md` — line refs into deleted `NavMenu.tsx` and `SpaceButton.tsx`. Replace with analogous lines in `SpacesSidebar.tsx` / `SpacesSidebarRow.tsx`, or note "this pattern moved to <file>". Don't rewrite the task; just refresh its references so it stays usable.

---

## §3 — Worked example: the small `channel-space-mute-system.md` rewrite

To calibrate tone and depth, here's what the small rewrite should look like.

**Before (line 66 in `channel-space-mute-system.md`):**

```markdown
| Space Context Menu | [NavMenu.tsx](src/components/navbar/NavMenu.tsx) | Space-level mute toggle |
```

**After:**

```markdown
| Space Context Menu | [useSpaceContextMenu.tsx](src/hooks/business/spaces/useSpaceContextMenu.tsx) | Space-level mute toggle as a `MenuItem` (rendered when right-clicking a row in [SpacesSidebar.tsx](src/components/space/SpacesSidebar.tsx)) |
```

**Before (line 222):**

```markdown
**File**: [NavMenu.tsx](src/components/navbar/NavMenu.tsx)

The NavMenu shows a "Mute Space" / "Unmute Space" toggle at the top of the
space's right-click context menu.
```

**After:**

```markdown
**File**: [useSpaceContextMenu.tsx](src/hooks/business/spaces/useSpaceContextMenu.tsx)

The space context menu (right-click on a row in `SpacesSidebar`) shows a
"Mute Space" / "Unmute Space" toggle. The menu is built by
`useSpaceContextMenu` and rendered by the shared `ContextMenu` primitive.
```

Notes on what this example demonstrates:
- The new reference is more *precise* (names the hook, names the surface that triggers it). When the implementation is split across multiple files, the doc says so.
- The new reference links to the **canonical implementation file**, not the consumer. `useSpaceContextMenu` defines the menu items; `SpacesSidebar` just mounts it.
- The voice is the same — short, factual, no boilerplate.
- The cross-link to `SpacesSidebar.tsx` lets the reader pivot from the hook to "where is this rendered".

Apply this style to the other small rewrites.

---

## §4 — Approach (in order)

1. **Read §1 in full.** Take notes — the file locations and key responsibilities. Don't skim.
2. **Path-only rewrites first** (`channel-space-mute-system.md`, `mute-conversation-system.md`, `modals.md`). These are calibration warm-ups and shake out tooling issues before the harder rewrites.
3. **Architecture rewrites next** (`notification-indicators-system.md`, `responsive-layout.md`, then `space-folders.md` last because it's biggest).
4. **JSDoc sweep** at the end. Quick.
5. **Verification.** See §5.

For each file: read it in full first, then make the edits. Don't sed blindly. The line numbers in §2 are starting points, not authoritative — the agent that wrote this might be off by a few lines depending on whether other edits happened.

---

## §5 — Verification (do not skip)

After every doc you edit, run these checks:

1. **`grep -i navbar` on the file** — must return zero results.
2. **`grep "NavMenu\|FolderContainer\|SpaceButton"` on the file** — must return zero results unless they're in a "historical context" block clearly labeled as such (e.g. "previously, NavMenu owned X").
3. **Click-test the markdown links.** Every `[name](src/...)` link should resolve to a file that exists. Run `for link in $(grep -oP '\(src/[^)]+\)' file.md); do ls "${link:1:-1}" 2>/dev/null || echo MISSING: $link; done`.
4. **Read the doc top-to-bottom** as if you'd never seen it. Does it still flow? Did a path-rewrite leave a dangling sentence ("the X is owned by Y" where Y no longer makes sense)?
5. **Cross-check one factual claim** by opening the file the doc points at and verifying the doc's description matches the code. Pick a non-obvious claim — e.g. "useSpaceContextMenu builds a `MenuItem[]` that includes the mute toggle conditionally" — and confirm in the actual hook source.

If any check fails, do not move on. Either fix or open a `// TODO(docs):` note in the doc and explain in your final report.

After all files are done, run **`grep -rn "navbar/\|NavMenu" .agents/docs/features/`** — must return zero results across the whole feature-docs directory.

---

## §6 — Hard rules

- **Do not touch any code in `src/`** other than the listed JSDoc one-liners. This task is doc-refresh, not code refactoring. If you find a code bug, file a separate task — don't fix it inline.
- **Do not refresh docs not on the §2 list.** README, AGENTS.md, CLAUDE.md, `.agents/docs/` outside `features/` — out of scope.
- **Do not refresh tasks already in `.agents/tasks/.done/`.** They are historical records.
- **Do not invent new architecture.** If the docs claim something and §1 doesn't confirm it, ask the user — don't guess.
- **Date-stamp your final commit and add a footer to each updated doc** with the format `*Last updated: 2026-06-XX*` (project convention; check existing docs for tone — this is a freshness signal, not a changelog).
- **One commit per doc.** Don't bundle 7 doc rewrites into one commit. Granular history is more useful when something needs to be reverted.

---

## §7 — What success looks like

When you finish:

- All 7 listed feature docs accurately describe the new architecture.
- `grep -rn "navbar/\|NavMenu\|FolderContainer\|SpaceButton" .agents/docs/features/` returns zero results.
- Each doc has at least one cross-link to a file in §1.
- The JSDoc comments listed in §2 are updated.
- 7 commits (one per doc) plus the JSDoc sweep commit on the branch.
- A short summary message back to the user covering: what was rewritten, what surprised you, anything you flagged as `TODO(docs):`.

---

## §8 — Out of scope (explicit)

- Plans in `.agents/tasks/.done/` — historical.
- New feature docs that don't exist yet (drag-to-resize sidebar, shared row chrome, StartupEffects). If those gaps are felt during the rewrite, file a follow-up task; don't try to create the missing docs here.
- Any code change beyond the JSDoc comments listed in §2.
- Translations / localization of doc content.
- README updates.

---

*Created: 2026-06-04 — captures the doc-refresh queue identified during the new-UI shell migration audit. Pre-flight reading list, worked example, and verification checklist added in §1, §3, §5 so a fresh-session agent can start cold without re-deriving context.*
