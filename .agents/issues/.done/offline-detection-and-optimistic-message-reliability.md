---
type: task
title: Offline Detection and Optimistic Message Reliability
status: done
complexity: medium
ai_generated: true
created: 2025-12-20T00:00:00.000Z
updated: '2026-01-09'
---

# Offline Detection and Optimistic Message Reliability

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent (Issue 1, Issue 2)


**Related Documentation**:
- [Offline Support](../docs/features/offline-support.md)
- [Action Queue](../docs/features/action-queue.md)
- [Message Sending Indicator](../docs/features/messages/message-sending-indicator.md)

**Files**:
- `src/components/context/ActionQueueContext.tsx:64-108`
- `src/components/context/WebsocketProvider.tsx:31, 173-176, 225`
- `src/components/ui/OfflineBanner.tsx:27-30`
- `src/services/ActionQueueService.ts:123`
- `web/main.tsx:22-23`
- `src/hooks/queries/messages/useMessages.ts`

## What & Why

Two related issues affect the reliability of offline messaging UX:

1. **Offline banner doesn't appear when Wi-Fi disconnects** - The app uses `navigator.onLine` events which don't reliably fire on Wi-Fi disconnect in many browsers (Brave/Chrome). Meanwhile, the WebSocket already detects the connection loss via `onclose` but this state isn't shared with the OfflineBanner.

2. **Optimistic messages disappear when navigating between DM and Space** - Messages with `sendStatus: 'sending'` exist only in React Query cache. The global `gcTime: 100ms` causes aggressive cache eviction, so navigating away loses the optimistic message. When returning, refetch from IndexedDB doesn't have the message yet (ActionQueue hasn't processed).

**Value**: Users should have consistent offline feedback and never lose visibility of pending messages.

## Context

### Current Connectivity Detection Architecture

```
WebsocketProvider                    ActionQueueContext
      │                                     │
      ▼                                     ▼
ws.onclose → setConnected(false)     window.offline event → setIsOnline(false)
      │                                     │
      ▼                                     ▼
[Knows offline correctly]            [Never fires on Wi-Fi disconnect]
      │                                     │
      ▼                                     ▼
(unused for banner)                  OfflineBanner uses isOnline
```

### Current Message Cache Flow

```
Send DM
    ↓
Add to React Query cache with sendStatus: 'sending'
    ↓
Navigate to Space (DM component unmounts)
    ↓
gcTime: 100ms → Cache entry evicted
    ↓
Navigate back to DM
    ↓
Refetch from IndexedDB → Message not there yet!
    ↓
Message invisible until ActionQueue processes
```

---

## Issue 1: Unified Offline Detection

### Feature Analyzer Recommendation: Option A Refined ✅

**Rating**: 9/10 - Solves problem, handles edge cases, stays simple

| Option | Verdict | Rating |
|--------|---------|--------|
| Option A (Simple) | Good, but missing edge case handling | 7/10 |
| **Option A (Refined)** | **RECOMMENDED** | 9/10 |
| Option B (checkOffline callback) | Wrong tool - doesn't solve root cause | 2/10 |
| Option C (Hybrid multi-signal) | Over-engineered, violates project pragmatism | 3/10 |

### Why Option A Refined?

**Core logic** - combine both signals with boolean AND:
```typescript
const { connected: wsConnected } = useWebSocket();
const [navOnline, setNavOnline] = useState(navigator.onLine);

// Offline if EITHER signal says offline
const isOnline = wsConnected && navOnline;
```

**Why this works**:
- WebSocket `onclose` fires reliably on Wi-Fi disconnect (primary signal)
- `navigator.onLine = false` is reliable - only the `true` state is unreliable
- Boolean AND: show offline banner if **either** says offline
- Handles edge case: captive portals where WebSocket connects but no real internet

### Implementation Steps

- [ ] **1. Update ActionQueueContext** (`src/components/context/ActionQueueContext.tsx`)
  - Import `useWebSocket` from WebsocketProvider
  - Get `connected` state from WebSocket context
  - Combine: `isOnline = wsConnected && navOnline`
  - Keep `navigator.onLine` listeners as defense in depth
  - ~15 lines changed

- [ ] **2. Update ActionQueueService** (`src/services/ActionQueueService.ts:123`)
  - **Critical**: Currently checks `navigator.onLine` directly - will block queue even when `isOnline` is fixed
  - Change to use ActionQueueContext state via callback
  - ~5 lines changed

- [ ] **3. No changes needed to**:
  - WebSocketProvider (already exports `connected`)
  - OfflineBanner (already uses `isOnline` from context)

### Key Insights from Analysis

1. **Hidden fix needed**: `ActionQueueService.ts:123` also checks `navigator.onLine` directly - must fix or queue won't process on Wi-Fi disconnect even with banner fixed

2. **Backend down = offline is correct UX**: If WebSocket disconnects because server crashed, showing "offline" is appropriate since app can't function

3. **No debounce needed initially**: Only add reconnection flicker debounce if users report it

4. **Mobile needs verification**: Test on mobile after implementing - may have different network detection behavior

---

## Issue 2: Optimistic Message Persistence

### Feature Analyzer Recommendation: Option A ✅

**Rating**: 9/10 - Simple fix, follows existing patterns, solves the problem

| Option | Verdict | Rating |
|--------|---------|--------|
| **Option A (Cache retention)** | **RECOMMENDED** | 9/10 |
| Option B (IndexedDB persistence) | Over-engineering - duplicates ActionQueue | 3/10 |
| Option C (Conditional gcTime) | Not supported by React Query | 2/10 |

### Why Option A?

**Root cause confirmed**: The `gcTime: 100ms` global default in `web/main.tsx` is unusably aggressive. Other hooks already override with sensible values (5-10 minutes).

**Why this works**:
- ActionQueue already persists signed messages - we just need cache to survive navigation
- Messages are invalidated via WebSocket when new ones arrive
- 10-minute retention is far more than needed (messages send in <2 seconds online)
- Follows established pattern used by `useGlobalSearch`, `useConversationPreviews`

**Why Option B is over-engineering**:
- Violates single responsibility (IndexedDB = confirmed messages, not UI state)
- Creates data sync issues with ActionQueue
- Adds schema migration complexity
- ActionQueue **already provides the persistence layer**

**Why Option C doesn't work**:
- React Query doesn't support conditional `gcTime` based on data state
- Would require hacky workarounds breaking internal consistency

### Implementation Steps

- [ ] **1. Add cache retention to useMessages** (`src/hooks/queries/messages/useMessages.ts`)
  ```typescript
  staleTime: 5 * 60 * 1000,  // 5 minutes
  gcTime: 10 * 60 * 1000,    // 10 minutes
  ```
  - ~2 lines added

- [ ] **2. Fix global defaults** (`web/main.tsx:22-23`)
  - Current: `staleTime: 100, gcTime: 100` (appears to be dev artifact)
  - Change to: `staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000`
  - Matches mobile app defaults
  - Benefits entire application, not just messages
  - ~2 lines changed

### Key Insights from Analysis

1. **Global defaults are the real problem**: The 100ms setting forces every hook to override, creating inconsistency

2. **Mobile already uses sensible defaults**: Mobile test app uses 5/10 minute defaults

3. **No schema changes needed**: ActionQueue already handles persistence correctly

4. **Performance impact minimal**: Text messages are small; 10-minute retention is negligible

5. **Cross-platform compatible**: React Query works identically on web, mobile, Electron

---

## Verification

✅ **Offline banner shows on Wi-Fi disconnect**
   - Disconnect Wi-Fi (not DevTools)
   - Banner should appear within 1-2 seconds
   - Reconnect → banner disappears

✅ **Messages persist during navigation while offline**
   - Go offline
   - Send DM → see "Sending..." indicator
   - Navigate to Space
   - Navigate back to DM → message still visible with indicator
   - Go online → message sends, indicator clears

✅ **No regressions**
   - Online messaging works normally
   - Fast networks: "Sending..." indicator hidden (1s delay)
   - Slow networks: indicator visible appropriately
   - DevTools "Offline" mode still works

## Definition of Done

- [ ] Offline banner appears reliably on Wi-Fi disconnect
- [ ] Optimistic messages visible during navigation while offline
- [ ] No duplicate messages after reconnect
- [ ] TypeScript compiles
- [ ] Manual testing on Brave/Chrome
- [ ] Documentation updated (offline-support.md, action-queue.md)
- [ ] Mobile platform testing (if applicable)

## Notes

- The WebSocket already knows connectivity state - this is about surfacing it
- The `gcTime: 100` in web/main.tsx may have been set for development/testing
- Consider if mobile has similar issues (different network detection)
- Total implementation for Issue 1: ~20 lines of code changes
- Total implementation for Issue 2: ~4 lines of code changes
- Combined implementation: ~24 lines - minimal, targeted fixes

---
