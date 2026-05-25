---
type: doc
title: "Message-list scroll anchoring"
status: stable
ai_generated: true
created: 2026-05-25
updated: 2026-05-25
related_bug: ../../../bugs/2026-05-24-virtuoso-measurement-scroll-reset.md
---

# Message-list scroll anchoring

How the message list keeps itself pinned to the latest message, scrolls correctly when messages arrive or are sent, and avoids the upstream `react-virtuoso` scroll-anchoring bugs.

## The problem this solves

`react-virtuoso`'s internal measurement callback writes incorrect `scrollTop` values in response to item-measurement events. The library has many independent triggers for these measurements: row resize, item mount above viewport, function-reference identity change, array-reference change, image load, async-resolved data (member lookups), and more. Each trigger can produce a wrong-scrollTop write at a slightly different moment.

The library has had this class of bug since at least 2021 (issues #1273, #1026, #1145, #423 + Cline's #4780 maintainer comment "fundamental to Virtuoso's algorithm"). The maintainer closes them pointing to troubleshooting docs rather than fixing. Migration to other virtualizers was evaluated and rejected — TanStack Virtual has the same bug class open since 2021, no MIT-licensed library matches Virtuoso's chat primitives, and Discord/Element wrote custom virtualizers rather than use any.

We solved this at the **application layer** by owning the scroll anchoring ourselves and letting Virtuoso handle only what it does well (windowing, item recycling, dynamic measurement).

## Architecture

Three signals drive scroll anchoring, all funneling through a single hook:

```
                         ┌─────────────────────────┐
   user scroll event ───►│                         │
                         │     useScrollAnchor     │
   cache "append" ──────►│                         ├──► scrollTop = bottom
                         │   (src/hooks/ui/...)    │
   imperative call ─────►│                         │
                         └─────────────────────────┘
```

### Signal 1: Scroll listener (reactive)

A passive `scroll` event listener on Virtuoso's scroller element. Maintains a `wasAnchoredRef` boolean: true when the user is within 100px of the bottom on the most recent scroll event. **Currently the absorb logic on backward scrollTop writes is disabled** (it caused user scroll-up to snap back); the listener exists only to maintain `wasAnchoredRef`.

### Signal 2: Cache subscription (proactive)

Subscribes to the React Query cache for `buildMessagesKeyPrefix({ spaceId, channelId })`. On every `updated` event:

- Detect whether the last-page length grew (APPEND) OR the last-message object reference changed (REPLACE — optimistic message being swapped for the server-confirmed copy).
- If APPEND or REPLACE AND `wasAnchoredRef.current` AND not suppressed → snap to bottom.

This catches the case where new content extends below the viewport but Virtuoso doesn't write `scrollTop` (notably DM sends, and some channel cases with images).

### Signal 3: Imperative snap

`snapToBottom()` exposed on `MessageListRef`. Called by:
- The jump-to-present button (`handleJumpToPresent` in `MessageList.tsx`)
- Send handlers in `Channel.tsx` and `DirectMessage.tsx`, after submit
- Parent components via the imperative ref

Imperative snap **also force-sets** `wasAnchoredRef.current = true` so any cache update that lands shortly after is treated as anchored. Without this, send-from-up-in-history would not re-snap on the server-confirmed message.

## Code locations

| File | Role |
|---|---|
| `src/hooks/ui/useScrollAnchor.ts` | The hook. Owns scroll listener, cache subscription, snap function. |
| `src/components/message/MessageList.tsx` | Mounts the hook. Passes `anchorSpaceId`/`anchorChannelId` from the consuming component (Channel/DirectMessage). Exposes `snapToBottom` on `MessageListRef`. `followOutput={false}` permanently. |
| `src/components/space/Channel.tsx` | Calls `messageListRef.current?.scrollToBottom()` after submit. |
| `src/components/direct/DirectMessage.tsx` | Same explicit snap call after submit. |
| `src/dev/scrollDebug.ts` | Dev-only recorder for debugging this code path. Not wired into production. See file header for usage. |

## Suppression flags

The hook respects two suppression flags from MessageList:

- `hasJumpedToOldMessageRef` — set true by hash navigation and `scrollToMessageId` (auto-jump-to-first-unread). When true, the cache subscription does NOT snap. User is intentionally viewing historical content.
- `deletionInProgressRef` — set true via `onBeforeDelete` callback during a message deletion. Same suppression.

The imperative `snapToBottom` does NOT honor these flags — when the user explicitly clicks Jump-to-Present or sends a message, they intend to be at the bottom regardless.

## Defense in depth

The system intentionally has multiple paths that can fire on the same event. This is by design — they handle different timing scenarios:

| Scenario | Caught by |
|---|---|
| User sends → optimistic addMessage in cache | Cache subscription (APPEND) |
| Server confirms → cache update with same id but new object | Cache subscription (REPLACE) |
| Image loads in newly-mounted message → row grows | (currently unhandled by the hook; would need ResizeObserver path) |
| User clicks Jump-to-Present button | Imperative snap |
| Send while scrolled up in history | Imperative snap + cache subscription re-armed by imperative snap setting `wasAnchored=true` |

## Configuration constants

In `useScrollAnchor.ts`:

- **`ANCHOR_THRESHOLD_PX = 100`** — how close to the bottom the user must be for the cache subscription to consider them "anchored" and trigger a snap on append. Tight (100px) so users reading history aren't yanked.
- **`BACKWARD_JUMP_THRESHOLD_PX = 10`** — currently unused (the absorb branch is disabled), but the constant is kept in case the absorb is re-enabled in a different form.

Separately, `MessageList.tsx` has `atBottomThreshold={5000}` (in props passed to Virtuoso). This is for the Jump-to-Present button visibility, **not** the snap. Five thousand pixels (~5 screens) is intentional: the button should only appear once the user has clearly disengaged from the live feed.

## What was tried and rejected

See the bug doc's session log for full receipts. Briefly:

| Approach | Outcome |
|---|---|
| Fix R2 — stable `InfiniteData` reference on no-op cache writes | No measurable improvement. Reverted. |
| Fix R3 — cap `increaseViewportBy` from `height` (~800px) to 300px | Real improvement (420 → 130px receiver jump). Kept. |
| Fix R4 — stable `rowRenderer` via ref | Render-efficiency improvement. Kept; not relevant to bug after β. |
| Fix C — freeze `isCompact` for sending messages | Disproved the predecessor-flip theory (the cause was members data resolving async, not cache mutation). Reverted. |
| Migrate to TanStack Virtual | Rejected — same bug class open since 2021, would require rebuilding `alignToBottom` + `followOutput` ourselves. |
| Migrate to plain scroll | Rejected — not viable at 100K-1M message scale targets. |
| Custom virtualizer (Discord pattern) | Out of scope; ~1-2 weeks of work. Reserved as fallback if non-determinism returns. |
| Reactive scroll listener only (no cache subscription) | Insufficient — silently fails when Virtuoso doesn't write scrollTop (multi-line sends, DMs). |
| Cache subscription only (no scroll listener) | Insufficient — misses Virtuoso's late re-window writes. |
| Hybrid (current architecture) | Works. Single-frame flash remains on some sends; final state lands correctly. |

## Known limitations

- **Single-frame visual flash on some sends.** The optimistic message can briefly appear partially visible before the snap lands. Settles correctly within ~1 frame. Telemetry-clean.
- **DM bottom-spacer is smaller than Channel.** Channel has the composer-overlay treatment from PR #153; DM kept the sticky-in-flow layout. DM's last message sits closer to the composer. (May be addressed separately — see related bug doc.)
- **Cache subscription does not fire on receiver-side messages in some sync states.** When the WebSocket sync is down, the receiver simply doesn't get the cache event.

## What to check first if this regresses

In order of likelihood:

1. **Did `followOutput={false}` get removed from `MessageList.tsx`?** If something restored Virtuoso's `followOutput`, the two anchoring systems will fight and produce non-deterministic behavior.
2. **Did the `messageListRef.current?.scrollToBottom()` get removed from a submit handler?** Without explicit snap on send, the cache subscription's anchor-gate suppresses send-from-up-in-history.
3. **Did `anchorSpaceId`/`anchorChannelId` props stop being passed from `Channel.tsx` or `DirectMessage.tsx`?** Without these, the cache subscription doesn't subscribe and the proactive path is dead.
4. **Did a new code path start writing the messages cache without going through `setQueriesData` with the messages key prefix?** The cache subscription filter wouldn't catch it.
5. **Did `MessageList.tsx` start passing a different `MessageListRef` shape that lacks `scrollToBottom`?** TypeScript should catch this but worth verifying.

Use `src/dev/scrollDebug.ts` to capture telemetry of a failing scenario — temporarily import it from MessageList or wherever you need a signal, call `scrollDebug.attach()` on the Virtuoso scroller, then run a session from DevTools console (see file header for the exact procedure). Reports show every scroll event, every cache event, and every snap fired.

## Related

- **Original bug investigation:** [`bugs/2026-05-24-virtuoso-measurement-scroll-reset.md`](../../../bugs/2026-05-24-virtuoso-measurement-scroll-reset.md) — full receipts, 18+ investigation sessions.
- **Auto-jump to first unread:** [`auto-jump-first-unread.md`](./auto-jump-first-unread.md) — sets `hasJumpedToOldMessage=true`, the suppression flag this hook respects.
- **Hash navigation:** [`hash-navigation-to-old-messages.md`](./hash-navigation-to-old-messages.md) — also uses `hasJumpedToOldMessage`.
- **DM receipts:** [`dm-receipts.md`](./dm-receipts.md) — cache writes for read/delivered receipts also go through `setQueriesData` for the messages key; our filter correctly ignores them (no length growth, no last-message reference change).

---

*Last updated: 2026-05-25*
