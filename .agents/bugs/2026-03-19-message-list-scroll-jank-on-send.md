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

### Re-renders disproven as cause (Phases 16-18)

- **Phase 16**: `React.memo` on MessageList — no effect. Parent re-renders aren't the cause.
- **Phase 17**: Disabling `showDeliveryReceipts` — no effect.
- **Phase 18**: Replacing `<Flex>` wrapper with exact same `<div>` as channels — no effect. DOM structure compared via parent chain dumps shows identical flex/overflow/height properties.

### DOM structure comparison (Phase 18)

Parent chain dumps show both DM and Channel have **identical layout properties**: same `flex: 1 1 0%`, same `overflow: auto` on scroller and `.message-list`, same hierarchy depths. The only difference is class names (`min-w-0` vs `relative`, `justify-start` vs not) — but computed styles are the same.

### New observation

On page refresh in DMs, initial scroll position is 2-3 message lines above the bottom. This suggests the issue affects initial layout too, not just `followOutput`.

### Most likely remaining cause: `sendStatus` height change

DM messages added via optimistic update have `sendStatus: 'sending'`, which renders a "Sending..." indicator (`Message.tsx:1237-1241`). When the `enqueueOutbound` completes and calls `addMessage` again (without `sendStatus`), the indicator disappears and the **message height changes**. This height change triggers Virtuoso's re-measurement callback, which recalculates and resets `scrollTop` incorrectly.

Channel optimistic updates also have `sendStatus: 'sending'` but resolve via ActionQueue which may complete faster or differently. This needs verification.

**However**, this doesn't fully explain why the initial page load scroll position is also wrong in DMs. There may be multiple contributing issues.

### What hasn't been tried

1. **Disable the "Sending..." indicator entirely** — test if removing the visual `sendStatus` indicator (Message.tsx:1237-1241) prevents the height change that triggers re-measurement
2. **Reserve space for the indicator** — give the message a fixed min-height that accounts for the indicator, preventing height change when it disappears
3. **Profile React renders** with React DevTools Profiler to see exactly which components re-render between "followOutput fires" and "+16ms scrollTop reset"

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

### 4. followOutput workaround (MessageList.tsx)
- `followOutput` returns `false` when `isAtBottom && hasNextPage === false` (bypasses Virtuoso's broken scroll)
- Schedules aggressive rAF-based `scrollTop` correction (10 frames + delayed catches at 300ms/600ms)
- Works around Virtuoso's internal measurement callback that resets `scrollTop` at +16ms
- **Known limitation**: minor visual flash (scroll-up-then-snap-back ~1 frame) still visible

### 5. Post-send scroll-to-bottom (DirectMessage.tsx)
- `handleSubmitMessage` schedules delayed `scrollTop` corrections after sending
- Handles the case where user sends a message while scrolled up (where `followOutput` doesn't fire)

### 6. Button type fix (MessageList.tsx)
- Cast `Button` import to `React.FC<any>` to fix React version mismatch between quorum-shared and quorum-desktop

### Virtuoso config — UNCHANGED
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
| 15 | Manual rAF scrollTop correction | Partial — from-bottom mostly works, jittery |
| 16 | React.memo on MessageList + stable callbacks | No effect — re-renders aren't from parent |
| 17 | Disable showDeliveryReceipts | No effect |
| 18 | Replace `<Flex>` with exact same `<div>` as channels | No effect — DOM structure is not the cause |

**Key discoveries:**
- **(Phase 14)**: Changing Virtuoso config values (`atBottomThreshold`, `overscan`) broke channels. These are load-bearing.
- **(Phase 16)**: React.memo didn't help — the re-renders causing the bug are NOT from the parent component.
- **(Phase 18)**: DOM parent chain is identical between DM and channel (same flex, same overflow, same heights). DOM structure is not the cause.
- **The remaining untested hypothesis**: the `sendStatus: 'sending'` indicator causes message height to change when it appears then disappears, triggering Virtuoso's buggy re-measurement callback.

## Research Sources

- [Issue #423](https://github.com/petyosi/react-virtuoso/issues/423): alignToBottom flickering (still present in v4.12.3)
- [Cline Issue #4780](https://github.com/cline/cline/issues/4780): Bouncy scroll — "fundamental to Virtuoso's algorithm"
- [Discussion #1083](https://github.com/petyosi/react-virtuoso/discussions/1083): skipAnimationFrameInResizeObserver fix
- Virtuoso API docs: `alignToBottom` is layout-only, `followOutput` is the only auto-scroll mechanism

---

*Last updated: 2026-03-22*
