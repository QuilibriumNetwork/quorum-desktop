---
type: task
title: "Application-owned scroll anchoring for the message list (β)"
status: in-progress
priority: high
ai_generated: true
created: 2026-05-24
updated: 2026-05-24
related_bug: ../bugs/2026-05-24-virtuoso-measurement-scroll-reset.md
branch: fix/virtuoso-scroll-jank
---

# Application-owned scroll anchoring for the message list (β)

## Context

This task implements the fix for the scroll-jank bug class documented in [`bugs/2026-05-24-virtuoso-measurement-scroll-reset.md`](../bugs/2026-05-24-virtuoso-measurement-scroll-reset.md). Read that document first for the full diagnostic history (16 sessions, two confirmed bug classes B1 and B2, six β iterations).

Summary of why we are here: `react-virtuoso`'s measurement callback writes incorrect `scrollTop` values in response to measurement events, and the library has many independent measurement triggers. Per-trigger fix attempts close at most one trigger while leaving others open. The architectural reframing is to target the consequence (the wrong `scrollTop` write) rather than the cause (the trigger inventory) by overwriting the value at the application layer.

## Current state (end-of-day 2026-05-24)

**β checkpoint committed as `64663d6d`.** Implementation went through six iterations (β.1-β.6, fully documented in the bug doc Session 15). The current architecture is a **pure-reactive scroll listener**: on every scroll event, if `scrollTop` dropped backward AND the user was anchored on the previous event, the hook attributes the drop to Virtuoso and overwrites `scrollTop` back to the bottom.

**Files in the current checkpoint:**

- `src/components/message/useScrollAnchor.ts` — the hook (~110 lines)
- `src/components/message/MessageList.tsx` — `followOutput={false}` + hook mounted + `scrollToBottom` imperative uses hook's `snapToBottom`
- `src/components/direct/DirectMessage.tsx` — `setTimeout` snap block removed
- `src/components/space/Channel.tsx` — passes `anchorSpaceId` / `anchorChannelId` props (currently unused by hook; reserved for hybrid path)

**What works:**
- Single-word sender-side: zero suspect events, visually clean.
- Existing imperative paths (hash navigation, scrollToMessageId, jump-to-present) unaffected — hook respects `hasJumpedToOldMessage` flag.

**What doesn't yet work (the gap to close next session):**
- Multi-line sender-side: message appears partially visible, then snaps UP. Single-frame visible flash. This is because Virtuoso doesn't always write `scrollTop` when content extends BELOW the viewport (multi-line message added; user at bottom), so the pure-reactive hook has nothing to absorb.
- Receiver-side: NOT TESTED with current implementation. Was the larger of the two bug magnitudes pre-fix (~130px residual after R3).

## Next-step plan: HYBRID architecture

Re-add the cache subscription path that β.4 implemented and β.6 dropped. The earlier subscription logic was correct in concept; β.6 removed it as part of an over-aggressive simplification. Specifically:

**Hook becomes a hybrid:**

1. **Reactive path (current implementation, KEEP):** scroll listener absorbs Virtuoso's backward writes when user was anchored.
2. **Proactive path (TO ADD):** cache subscription on `buildMessagesKeyPrefix({ spaceId, channelId })`. On `updated` events where the last-page length grew OR the last-message OBJECT REFERENCE changed (not id; optimistic and server-confirmed share ids), AND `wasAnchored` was true, call `performSnap()` directly. No delayed snaps. No additional gates beyond `hasJumpedToOldMessage` + `deletionInProgress` + `wasAnchored`.

**Why hybrid and not pure-cache-driven:**

- Cache subscription catches APPENDS (proactive snap on new content below viewport).
- Scroll listener catches Virtuoso's LATE backward writes (member data resolving 200ms+ after the cache write; image loads; internal measurement re-passes).
- Together they cover both classes of trigger without overlap.

**Why hybrid and not pure-scroll-listener (the current checkpoint):**

- Scroll listener only fires on scrollTop change. When Virtuoso adds content below the viewport without scrolling (multi-line message; gap=0 before and after the write because Virtuoso preserved scrollTop), the listener never fires.
- Cache subscription provides the missing signal.

## Implementation steps for next session

1. **Test receiver-side with the current checkpoint** (`64663d6d`). Establishes baseline for the hybrid to improve on.
2. **Re-add cache subscription to `useScrollAnchor`:**
   - Add `queryClient`, `spaceId`, `channelId` to options interface (already accepted by MessageList from Channel/DirectMessage props).
   - Seed `lastSeenLastPageLen` and `lastSeenLastMessage` from the current cache state at subscription time (β.4's seed-from-cache logic was correct; do not regress to first-observation null-init).
   - On `event.type === 'updated'` with matching query-key prefix, compare last-page length and last-message object reference. Snap if length grew OR reference changed AND `wasAnchored` AND not suppressed.
   - Filter implementation: `next.pages.at(-1).messages.length > prev` OR `next.pages.at(-1).messages.at(-1) !== prev.last`.
3. **Test sender single + multi-line + receiver-side.** Acceptance criteria below.
4. **Strip diagnostic `scrollDebug.log` calls** from `useScrollAnchor.ts` (every-scroll-event log + ABSORB log were diagnostic-only).
5. **Move hook** to `src/hooks/ui/useScrollAnchor.ts` per project convention (`useScrollTracking.ts` already lives there).
6. **Strip working comments** from hook — β.X iteration suffixes, "previously did X" narratives. Keep JSDoc header + terse "why not the alternative" comments.
7. **Remove instrumentation:**
   - Delete `src/components/message/__scrollDebug.ts`.
   - Grep `TEMPORARY DEBUG` and remove all blocks in MessageList.tsx, DirectMessage.tsx, MessageService.ts.
8. **Functional regression manual checks** (see acceptance criteria).
9. **Open PR.**

## Acceptance criteria

### Telemetry pass

Existing instrumentation in `src/components/message/__scrollDebug.ts` captures everything needed. Run three sessions per side; each session = one message sent or received:

- **Sender-side (channel), single-word:** zero `🔴 scroll-untracked` events with negative Δ.
- **Sender-side (channel), multi-line:** zero suspect events AND no visible scroll-up flash (the gap currently in the checkpoint).
- **Receiver-side (channel):** zero suspect events.
- **Sender-side (DM):** zero suspect events.
- **Receiver-side (DM):** zero suspect events.

### Functional regression (manual)

After telemetry passes:

- Hash navigation: click a search result; message scrolls into view and highlights for 8s.
- `scrollToMessageId` / auto-jump-to-first-unread: open a channel with unread messages; auto-jumps to first unread with New Messages separator visible.
- Jump-to-present: scroll up 500+ px; button appears; click; immediate snap to latest message.
- Pagination top: scroll to top; `fetchPreviousPage` fires; older messages appear without scroll jump.
- Pagination bottom: after hash navigation, scroll down; `fetchNextPage` fires.
- Thread panel: open a thread; scrolls and behaves identically to current behavior.
- New-messages separator: receive a message while scrolled up; separator appears; scroll to it; separator dismisses on scroll-past.
- Delete a message: list reflows without scroll jump.
- React to a message (own and other): list reflows without scroll jump.

### Failure mode

If after the hybrid implementation telemetry STILL shows residual jank or visible flash that can't be eliminated by tuning thresholds, do NOT ship. Reopen the architecture conversation. Custom virtualizer (Discord pattern) becomes the next candidate.

## Original design notes (for reference; superseded above)

The original task doc was written before implementation revealed β needed six iterations to land. The original sections (Mechanism, Cache-update filter, Threshold decisions, Snap scheduling, Initialization gate, Suppression interop, hasNextPage handling, Scope, Risk register, Acceptance criteria) below are preserved for context but the **"Next-step plan"** section above supersedes them.

## Goal

Eliminate both observable bug classes:

- **B1 (sender-side):** ~24-85px backward scroll on send, caused by row-height change after optimistic insertion and/or item-mount-above-viewport on server confirm.
- **B2 (receiver-side):** ~350-420px backward scroll on inbound, caused by new `messageList` array reference triggering a Virtuoso re-window with items mounting above the viewport.

Acceptance is binary: zero suspect events in the instrumentation across three consecutive captures per side. No "partial fix" ship.

## Design

### Architectural approach

Replace Virtuoso's `followOutput` mechanism with application-owned anchoring. Virtuoso continues to handle windowing, measurement, and item recycling — the parts of the library that work correctly. The scroll-position management is moved into the application via a new hook.

The hook:

1. Subscribes to the React Query message cache and detects when a new message is appended to the last page.
2. Maintains a `wasAnchoredAtBottom` ref from a passive scroll listener on the Virtuoso scroller element.
3. On a qualifying cache update, if `wasAnchoredAtBottom === true`, writes `scrollTop = scrollHeight - clientHeight` via `useLayoutEffect` (synchronous with React commit, before paint).

### File layout

- New file: `src/components/message/useScrollAnchor.ts` — the hook, with full inline documentation.
- Modified: `src/components/message/MessageList.tsx` — replace the `followOutput` body with `followOutput={false}` and mount the hook. Wire `snapToBottom` into `useImperativeHandle` for parent callers.
- Modified: `src/components/direct/DirectMessage.tsx` — remove the `setTimeout(snap, 100/300/600)` block from `handleSubmitMessage`. The hook covers this case via the optimistic `addMessage` cache write.
- Modified (verify): `src/components/space/Channel.tsx` — grep for analogous ad-hoc snap calls; remove any found.

### Cache-update filter (addresses Concern 1)

`MessageService.ts` makes seven distinct `setQueriesData` calls against `buildMessagesKeyPrefix`. Only one path appends to `pages[last].messages`:

| Path | Line | Operation | Should fire snap? |
|---|---|---|---|
| `updateMessageStatus` | 1230 | sendStatus flip on existing item | No |
| `addMessage` reaction branch | 1280 | reaction update on existing item | No |
| `addMessage` new text/embed | 1892 | **append to last page** | **Yes** |
| Delete path | 1513 | remove item | No |
| Pin/unpin | 1614 | flag update on existing item | No |
| `retryMessage` (channel) | 5094 | sendStatus on existing item | No |
| `retryMessage` (DM) | 5211 | sendStatus on existing item | No |

The hook MUST NOT treat every cache update as a snap trigger. Implementation: in the subscription callback, capture the previous and next `InfiniteData`, compute `newLastPageLen = next.pages.at(-1)?.messages.length ?? 0` and `prevLastPageLen = previous.pages.at(-1)?.messages.length ?? 0`. Only proceed with the snap evaluation when `newLastPageLen > prevLastPageLen`.

Use `queryClient.getQueryCache().subscribe()` and filter `event.type === 'updated'` events whose `event.query.queryKey` matches the messages-key prefix for the active channel/conversation. The previous data is available via `event.query.state.dataUpdateCount` history or by holding a ref to the last-seen `InfiniteData` and comparing each invocation.

### Threshold decisions (addresses Concern 2)

Two distinct semantic concepts that have been conflated in prior code/discussion:

| Concept | Threshold | Used for |
|---|---|---|
| **Anchor threshold** | **100px** | New hook: deciding whether the user is "watching live" and a snap should fire |
| **Jump-button visibility threshold** | **5000px** (current value at MessageList ~line 657) | Existing `atBottomThreshold` on Virtuoso, drives `useScrollTracking` |

Rationale: the anchor threshold is tight because a user 500px from bottom is intentionally reading history and should not be yanked. The jump-button threshold is loose because the button is a UX cue to "return to live" that should appear once the user has clearly disengaged from the live feed.

These are independent values. They are NOT consolidated. Document this distinction explicitly in the hook's header comment.

(The previous draft's claim of "50px matches `useScrollTracking`" was factually incorrect — `useScrollTracking` has no threshold of its own; it wraps Virtuoso's `atBottomThreshold`. Verified at `src/hooks/ui/useScrollTracking.ts` lines 15-18.)

### Snap scheduling (addresses Concern 3)

The previous code used 10 rAF frames + two setTimeouts and still failed to catch all of Virtuoso's writes. Continuing to chase Virtuoso's writes with rAFs is unsound — Virtuoso may write multiple times across multiple frames as items mount.

Use `useLayoutEffect` from day one. The effect is bound to a state value that increments on each qualifying cache-update event. React guarantees `useLayoutEffect` runs synchronously after commit and before the browser paints — so the `scrollTop` write is guaranteed to land before the user sees a wrong frame.

The effect performs a single write: `scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight`.

Multiple back-to-back cache updates increment the state multiple times in a single batch (React 18+ auto-batches). The `useLayoutEffect` fires once per commit with the final state — naturally coalescing the rapid-fire case.

If telemetry shows residual jank after this — meaning Virtuoso's measurement callback writes `scrollTop` AFTER our `useLayoutEffect` has committed — the next escalation is to also schedule a follow-up `requestAnimationFrame` snap (cheap belt-and-suspenders). This is documented as the fallback path but `useLayoutEffect` is implemented as the primary mechanism, not as an escalation.

### Initialization gate (addresses Concern 4)

The hook must not snap during initial mount when Virtuoso is performing its own `initialTopMostItemIndex` scroll. The previous draft's "first scroll event" gate is unreliable because Virtuoso's initial scroll is imperative and doesn't generate a DOM scroll event.

Use Virtuoso's `atBottomStateChange` callback as the readiness signal. The first time it fires with `atBottom === true` after mount, set `isReadyRef.current = true`. Snapping is gated on `isReadyRef.current`.

This callback is already wired in MessageList via `handleBottomStateChange`. The hook receives a setter from MessageList that toggles `isReadyRef` true on the first such event.

### Suppression interop

The hook respects two existing suppression signals:

- `hasJumpedToOldMessage` — user navigated to an old message via hash or scrollToMessageId. Auto-snap disabled until cleared by user clicking jump-to-present or `hasNextPage` becomes false.
- `deletionInProgressRef` — synchronous flag set during message deletion to prevent snapping during the brief deletion cycle.

Both already exist in MessageList; the hook receives them as refs.

### Handling `hasNextPage=true`

Unlike the existing `followOutput` body which short-circuits when `hasNextPage=true`, the new hook does NOT suppress in this case. Rationale: when the user is at the bottom of the loaded window, a new message arrives, and there are still forward pages to load, the correct behavior is to snap to the newly-added message — that is exactly the situation that produces the receiver-side B2 jump. The existing `hasNextPage=true` suppression was part of the workaround stack we're replacing.

### Snap function exposure

The hook returns `{ snapToBottom: () => void }`. `MessageList` wires this into `useImperativeHandle` as `scrollToBottom`, used by:
- Jump-to-present button (`handleJumpToPresent` at MessageList ~line 253)
- Parent components via `MessageListRef.scrollToBottom()` (currently calls Virtuoso's `scrollToIndex`; can either be replaced with the direct snap or kept calling Virtuoso — they should produce equivalent results, but the direct snap avoids Virtuoso's measurement callback re-firing)

## Scope

### Modified files

- `src/components/message/MessageList.tsx` (~15 line delta net)
  - `followOutput` reduced to constant `false`
  - Existing rAF + setTimeout snap loop in followOutput body removed
  - `useScrollAnchor` mounted with channel/conversation context
  - First-ready signal wired from `handleBottomStateChange` into the hook
  - `useImperativeHandle.scrollToBottom` updated to use hook's `snapToBottom`
- `src/components/direct/DirectMessage.tsx` (~10 line removal)
  - `setTimeout(snap, 100/300/600)` block removed from `handleSubmitMessage`
- `src/components/space/Channel.tsx` (TBD — pre-implementation grep)
  - Any analogous ad-hoc snap calls removed

### New files

- `src/components/message/useScrollAnchor.ts` (~100 lines including comments and the cache-diff logic)

### Unchanged

- `react-virtuoso` dependency, version, core configuration (`alignToBottom`, `firstItemIndex`, `initialTopMostItemIndex`, `computeItemKey`, `itemContent`, `rangeChanged`, `overscan`, `atTopStateChange`, `atBottomStateChange`, `atBottomThreshold`).
- All other Virtuoso usages in the codebase (Channel members ×2, EmojiPicker, SearchResults, PinnedMessagesPanel, BookmarksPanel).
- Hash navigation, `scrollToMessageId`, jump-to-present button (functional behavior unchanged; internal implementation may now call the hook's snap), new-messages-separator dismissal, pagination top/bottom triggers, thread panel reuse with `alignToTop={true}`.
- The Fix R3 overscan cap (committed as `09361de7`) and Fix R4 stable rowRenderer (committed as `dd966df7`) — both kept.

## Risk register

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Virtuoso writes scrollTop AFTER our `useLayoutEffect` snap, producing a residual jump | Implementation uses `useLayoutEffect` as primary (synchronous with commit, before paint) rather than `rAF`. If telemetry shows residual writes, add a follow-up `rAF` belt-and-suspenders. |
| R2 | Cache subscription fires on non-append updates (reactions, pins, status changes), causing spurious snaps | Filter implemented as `next.pages.at(-1).messages.length > previous.pages.at(-1).messages.length`. Explicit unit-level reasoning in hook comments. |
| R3 | Anchor threshold mis-tuned: snaps when user wants to stay scrolled up, OR fails to snap when user is "basically at bottom" | 100px chosen as the anchor threshold (separate from Virtuoso's 5000px `atBottomThreshold`). Re-tunable based on telemetry. |
| R4 | Hook snaps during initial mount before Virtuoso has measured | `isReadyRef` gate driven by Virtuoso's first `atBottomStateChange(true)` event (not by DOM scroll event, which doesn't fire for Virtuoso's imperative initial scroll). |
| R5 | Conflict with imperative scrolls (hash nav, `scrollToMessageId`, jump-to-present) | Hook respects existing `hasJumpedToOldMessage` flag. Direct hook invocations from imperative callers bypass the cache-update path. |
| R6 | Cache subscription performance at 100K-1M message scale | Subscription is filtered by query-key prefix; callback runs O(1) per cache write (length comparison, no iteration). |
| R7 | Rapid-fire cache writes (3+ messages back-to-back) | React 18+ auto-batches state updates. `useLayoutEffect` coalesces to one snap per commit. |
| R8 | False-negative when `hasNextPage=true` (user at bottom of loaded window, new message arrives, hook fails to snap) | Hook does NOT replicate the existing `hasNextPage=true` suppression in followOutput. Snap fires regardless of `hasNextPage`. |
| R9 | Concurrent React rendering interleaves with Virtuoso's effects in unexpected ways | `useLayoutEffect` is synchronous with React's commit phase and runs before browser paint, predictable across React 18+ concurrent mode. |

## Acceptance criteria

### Telemetry pass

Existing instrumentation in `src/components/message/__scrollDebug.ts` captures everything needed. Run three sessions per side, each session = one message sent or received:

- **Sender-side (channel):** zero `🔴 scroll-untracked` events with negative `Δ` across all three captures. Item-resize events on the optimistic message MAY still occur — they must NOT be followed by a backward scroll.
- **Receiver-side (channel):** same — zero `🔴 scroll-untracked` events with negative `Δ` across three inbound captures.
- **Sender-side (DM):** same.
- **Receiver-side (DM):** same.

### Functional regression checks (manual)

After telemetry passes:

- Hash navigation: click a search result; message scrolls into view and highlights for 8s.
- `scrollToMessageId`: open a channel with unread messages; auto-jumps to first unread with New Messages separator visible.
- Jump-to-present: scroll up 500+ px; button appears; click; immediate snap to latest message.
- Pagination top: scroll to top; `fetchPreviousPage` fires; older messages appear without scroll jump.
- Pagination bottom: after hash navigation, scroll down; `fetchNextPage` fires.
- Thread panel: open a thread; scrolls and behaves identically to current behavior.
- New-messages separator: receive a message while scrolled up; separator appears; scroll to it; separator dismisses on scroll-past.
- Delete a message: list reflows without scroll jump.
- React to a message (own and other): list reflows without scroll jump (this currently has a documented bug; verify no regression).

### Failure mode

If telemetry shows residual suspect events after the `useLayoutEffect` implementation:

1. Add follow-up `requestAnimationFrame` snap as belt-and-suspenders. Re-test.
2. If still failing, run a focused diagnostic session to identify what Virtuoso is doing AFTER `useLayoutEffect` to overwrite `scrollTop`. Update this doc with findings.
3. Do NOT ship with residual jank. Reopen architecture conversation if (2) does not yield a path forward.

## Implementation order

1. Pre-implementation: grep `Channel.tsx` and any other component that mounts `MessageList` for ad-hoc snap-to-bottom calls. Inventory them in this doc.
2. Write `useScrollAnchor.ts` with the cache-diff filter, threshold constant, and `useLayoutEffect` snap.
3. Modify `MessageList.tsx`: set `followOutput={false}`, mount hook, wire ready signal and suppression refs, replace `scrollToBottom` imperative.
4. Modify `DirectMessage.tsx`: remove `setTimeout` snap block.
5. Modify `Channel.tsx`: remove any ad-hoc snap calls found in step 1.
6. Type-check + smoke-test (no console errors on channel/DM mount, scroll, send).
7. Run telemetry sessions per acceptance criteria.
8. Iterate on threshold / fallback rAF if criteria not met.
9. Pass acceptance → proceed to post-merge cleanup checklist below.

## Post-implementation cleanup

After β is verified clean:

- Remove `src/components/message/__scrollDebug.ts` (the debug recorder).
- Remove all `TEMPORARY DEBUG` blocks in: `MessageList.tsx`, `DirectMessage.tsx`, `MessageService.ts`. Grep for `TEMPORARY DEBUG` to find every site.
- Verify `npx tsc --noEmit` and `yarn lint` clean.
- Update the related bug doc with the closeout entry (Session 14: β shipped, criteria met).
- Open PR.

## Reviewed by

Independent expert review agent, 2026-05-24. Verdict: YELLOW (proceed with four spec-level changes). All four changes incorporated into this document:

1. Cache-update filter explicit (Concern 1) — see "Cache-update filter" section.
2. Anchor threshold separated from Virtuoso's `atBottomThreshold` (Concern 2) — see "Threshold decisions" section.
3. `useLayoutEffect` as primary (not fallback) mechanism (Concern 3) — see "Snap scheduling" section.
4. Initialization gate uses Virtuoso's `atBottomStateChange` not DOM scroll event (Concern 4) — see "Initialization gate" section.

Additional risk R8 added per reviewer's "false-negative when `hasNextPage=true`" observation.

---

*Last updated: 2026-05-24*
