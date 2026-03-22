---
type: bug
title: "Message list scroll jank on send — Virtuoso scroll position drift"
status: in-progress
priority: high
ai_generated: true
created: 2026-03-19
updated: 2026-03-22
---

# Message list scroll jank on send — Virtuoso scroll position drift

## Symptoms

When sending/receiving a DM, the message list scrolls up instead of staying at bottom, or doesn't scroll at all to show new messages. Channels work correctly. DMs do not.

**Desired behavior** (matching Discord): when sending a message, the view should **instantly jump** to the bottom — no smooth scroll, no visual movement. This should work regardless of current scroll position.

## Definitive Root Cause

### Virtuoso's internal measurement callback resets scrollTop (DMs only)

Stack trace evidence proves the bug is **inside react-virtuoso itself**:

```
followOutput fires:     scrollTop=674, gap=0     ← correct
+0ms (after return):    scrollTop=680, gap=0     ← Virtuoso scrolled correctly!
+16ms (next frame):     scrollTop=560, gap=120   ← Virtuoso's own code RESET it
```

Stack trace: `react-virtuoso.js:2262 → :345 → :320 → :2348` — Virtuoso's item measurement callback recalculates `scrollTop` incorrectly after items are re-measured, pulling it back up by ~120px.

### Why channels work but DMs don't

**Confirmed experimentally**: A channel with few messages (`hasNextPage=false`) + same `followOutput: 'auto'` + identical Virtuoso config works perfectly. Same `MessageList` component, same props.

The DM component tree causes **more React re-renders** during Virtuoso's measurement cycle. DirectMessage has many hooks (`useConversation`, delivery receipts, accept-chat state, auto-jump effects, etc.) that trigger re-renders when the message list changes. These extra re-renders cause Virtuoso to re-measure items, firing the buggy measurement callback that resets `scrollTop`.

Channels have a leaner component tree — fewer hooks, fewer intermediate re-renders, so Virtuoso measures once and the scroll position stays correct.

**Key evidence**: Removing the major DM effects (`setAcceptChat`, `invalidateConversation`, auto-jump) did NOT fix the scroll. Other hooks in the DM tree still cause enough re-renders to trigger the bug.

## Committed Changes (2026-03-22 baseline)

These changes are committed and confirmed not to regress channels:

### 1. DM optimistic update (MessageService.ts) — NEW
Added synchronous optimistic `addMessage` before `enqueueOutbound` in the online DM legacy path:
- `preBuiltMessage` / `preBuiltMessageIdBuffer` hoist the pre-built message
- `addMessage` with `sendStatus: 'sending'` fires before `enqueueOutbound`
- Legacy `enqueueOutbound` path reuses `preBuiltMessage` (same `messageId`) for deduplication
- Signing skipped in legacy path when `preBuiltMessage` exists

### 2. DM effects cleanup (useDirectMessagesList.ts) — CHANGED
- `setAcceptChat` effect: changed to mount-only (no `messageList` dep)
- `saveReadTime + invalidateConversation` effect: removed entirely (redundant — DirectMessage.tsx has periodic interval + unmount save via `useUpdateReadTime`)

### 3. Auto-jump effect fix (DirectMessage.tsx) — CHANGED
- Removed `messageList` from dependency array (this is a mount-only effect)
- Added `messageListLatestRef` to read current messages without triggering re-runs

### 4. followOutput cleanup (MessageList.tsx) — SIMPLIFIED
- Removed `[SCROLLBUG]` debug console.log statements
- Same logic, cleaner code

### Virtuoso config — UNCHANGED (reverted)
All Virtuoso props remain at original values (`atBottomThreshold=5000`, `overscan=height`, `alignToBottom={!alignToTop}`, etc.). Changing these caused channel regression.

## Recommended Next Step: Refactor DM component tree

The root cause is structural — the DM component tree causes too many re-renders during Virtuoso's measurement cycle. The fix is to **isolate re-render-causing hooks into sibling/child components** so their state changes don't propagate through Virtuoso:

```
// Current (broken): all hooks in DirectMessage → re-renders propagate to Virtuoso
DirectMessage
  ├── useConversation()           ← re-render affects Virtuoso
  ├── useDeliveryReceipts()       ← re-render affects Virtuoso
  ├── acceptChat state            ← re-render affects Virtuoso
  └── <MessageList> (Virtuoso)    ← gets disrupted

// Proposed: hooks isolated → re-renders don't reach Virtuoso
DirectMessage
  ├── <ConversationManager />     ← re-renders stay here
  ├── <DeliveryReceiptTracker />  ← re-renders stay here
  └── <DMMessageArea>             ← lean wrapper, minimal hooks
       └── <MessageList>          ← clean render cycle, like channels
```

Key principle: **the path from "message added to cache" → "Virtuoso renders" must have zero intermediate state changes**, matching how channels work.

## Investigation Log (Phases 1-15)

### Session 1 (2026-03-19): Phases 1-8

| Phase | Approach | Result |
|-------|----------|--------|
| 1 | Composer resize race hypothesis | Rejected — jank occurs with no resize |
| 2 | `followOutput: 'auto'` vs `'smooth'` | Jank pattern reversed, same drift |
| 3 | ResizeObserver compensation | Only helped composer-resize case |
| 4 | useEffect + scrollToIndex | Same drift — scrollToIndex also overridden |
| 5 | Disable alignToBottom | No change |
| 6 | rAF correction loop | Too aggressive — opposite bounce |
| 7 | No scroll intervention | Channels perfect, DMs don't scroll |
| 8 | followOutput: 'auto' | Channels perfect, DMs still broken |

### Session 2 (2026-03-22): Phases 9-15

| Phase | Approach | Result |
|-------|----------|--------|
| 9 | DM optimistic update + `followOutput: 'auto'` | Virtuoso drifts 50ms after followOutput |
| 10 | `followOutput: false`, `alignToBottom` alone | Sends-from-bottom: OK. Others: no scroll |
| 11 | useEffect + direct scrollTop snap | Jittery, misses |
| 12 | ResizeObserver height delta | Sends-from-bottom only |
| 13 | Defer DM effects + `followOutput(() => false)` | No movement (alignToBottom is layout-only) |
| 14 | Fix atBottomThreshold/overscan + skipAnimationFrame | Still reset by Virtuoso internally |
| 14b | Same + `alignToBottom={false}` | Same — measurement callback resets scrollTop |
| 15 | Manual rAF scrollTop correction after send | Partial — from-bottom mostly works, jittery |

**Key discovery (Phase 14)**: Changing `atBottomThreshold` from 5000→50 and `overscan` from viewport→200 broke channels. These Virtuoso config values are load-bearing and must stay at original values. The fix must be structural (component refactor), not config.

## Research Sources

- [Issue #423](https://github.com/petyosi/react-virtuoso/issues/423): alignToBottom flickering (still present in v4.12.3)
- [Cline Issue #4780](https://github.com/cline/cline/issues/4780): Bouncy scroll — "fundamental to Virtuoso's algorithm"
- [Discussion #1083](https://github.com/petyosi/react-virtuoso/discussions/1083): skipAnimationFrameInResizeObserver fix
- Virtuoso API docs: `alignToBottom` is layout-only, `followOutput` is the only auto-scroll mechanism

---

*Last updated: 2026-03-22*
