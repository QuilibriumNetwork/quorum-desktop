# Refactor Message Highlighting System

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Status**: Pending
**Complexity**: High
**Created**: 2025-12-05
**Files**:
- `src/hooks/business/messages/useMessageHighlight.ts` (main hook - needs refactor)
- `src/components/message/Message.tsx:255-270` (highlight logic)
- `src/components/message/Message.tsx:436-456` (reply click handler)
- `src/components/message/MessageList.tsx:140, 314-360` (hash detection)
- `src/components/message/PinnedMessagesPanel.tsx:157-186` (jump to message)
- `src/components/bookmarks/BookmarksPanel.tsx:115-135` (jump to bookmark)
- `src/components/notifications/NotificationPanel.tsx:111-119` (notification click)
- `src/hooks/business/messages/useViewportMentionHighlight.ts` (mention auto-highlight)
- `src/hooks/business/search/useGlobalSearchNavigation.ts` (search result click)
- `src/components/message/Message.scss:1-34` (CSS animations)
- `src/utils/messageLinkUtils.ts` (message link parsing)

## What & Why

The message highlighting system has **fundamental architectural flaws**. The `useMessageHighlight` hook claims to be "centralized" but uses local `useState`, meaning each component gets isolated state that cannot communicate across components. The system **accidentally works** through URL hash as shared state, while most programmatic `highlightMessage()` calls are effectively dead code.

**Current Problems**:
1. Hook creates isolated state per component instance (not centralized)
2. `highlightMessage()` calls in PinnedMessagesPanel/BookmarksPanel do nothing
3. Timer durations don't match CSS animation durations
4. Inconsistent hash cleanup timing across components
5. Two competing mechanisms (hash vs state) with unclear priority

**Goal**: Simplify to a single, reliable mechanism that actually works.

## Highlight System Overview

### CSS Animations (src/components/message/Message.scss)

| Class | Animation | Duration | Color | Opacity |
|-------|-----------|----------|-------|---------|
| `.message-highlighted` | `flash-highlight` | 8s | `--warning` (yellow/gold) | 0.2 → 0 |
| `.message-highlighted-mention` | `flash-highlight-mention` | 61s | `--warning` (yellow/gold) | 0.1 → 0 |

**IMPORTANT**: Both highlights use the SAME color (`--warning` = yellow/gold `#e7b04a`). The difference is:
- **Default highlight**: 8 seconds, 20% opacity, fades after 4s
- **Mention highlight**: 61 seconds, 10% opacity (more subtle), stays solid for 57s then fades over 4s

### All Entry Points That Trigger Highlighting

| Source | File | Method | Hash Cleanup |
|--------|------|--------|--------------|
| Reply snippet click | `Message.tsx:436-456` | Hash navigation | Yes (2000ms) |
| Pinned message click | `PinnedMessagesPanel.tsx:167` | Hash navigation | No ❌ |
| Bookmark click | `BookmarksPanel.tsx:121,125` | Hash navigation | No ❌ |
| Notification click | `NotificationPanel.tsx:118` | Hash navigation | No ❌ |
| Search result click | `useGlobalSearchNavigation.ts:27,30` | Hash navigation | No ❌ |
| Message link click | `Message.tsx:816, 962` | Hash navigation | No ❌ |
| URL hash on load | `MessageList.tsx:314-337` | Hash detection | Yes (1000ms) |
| Mention viewport entry | `useViewportMentionHighlight.ts:58` | Local state | N/A |

### Message Link Formats
- Space channel: `/spaces/{spaceId}/{channelId}#msg-{messageId}`
- DM: `/messages/{dmAddress}#msg-{messageId}`
- Copy message link: `useMessageActions.ts:115`

## Context

- **What works**: URL hash (`#msg-{messageId}`) is the actual shared state mechanism
- **What's broken**: The hook-based state only works for self-highlighting (mentions)
- **Constraint**: Must maintain mention viewport highlighting (uses local state correctly)
- **Existing pattern**: Reply snippet click (recently fixed) uses hash-only approach correctly

## Prerequisites

- [x] Review .agents documentation for context
- [x] Feature analyzed by feature-analyzer agent
- [x] Deep codebase analysis of all highlight entry points
- [ ] Branch created from `develop`

## Implementation

### Phase 1: Remove Dead Code

- [ ] **Remove useless `highlightMessage` calls**
  - `src/components/message/PinnedMessagesPanel.tsx:175` - remove line
  - `src/components/bookmarks/BookmarksPanel.tsx:133` - remove line
  - These calls set state in the Panel's hook instance, not the target Message
  - Done when: Lines removed, highlighting still works via hash
  - Verify: Click pinned message → scrolls and highlights correctly

- [ ] **Remove useless `scrollToMessage` calls from panels**
  - `src/components/message/PinnedMessagesPanel.tsx:172` - remove line
  - `src/components/bookmarks/BookmarksPanel.tsx:132` - remove line
  - The hash navigation already triggers scroll in MessageList
  - Done when: Lines removed, scroll behavior unchanged
  - Verify: Both features still scroll to target message

- [ ] **Remove hook imports from panels**
  - `src/components/message/PinnedMessagesPanel.tsx:158` - remove `useMessageHighlight` import/call
  - `src/components/bookmarks/BookmarksPanel.tsx:44` - remove `useMessageHighlight` import/call
  - Done when: No more dead hook usage
  - Verify: Files still compile, features work

### Phase 2: Standardize Hash Cleanup

Currently inconsistent:
- MessageList: 1000ms cleanup
- Reply click: 2000ms cleanup
- Everything else: No cleanup ❌

- [ ] **Add hash cleanup to PinnedMessagesPanel**
  - Location: `src/components/message/PinnedMessagesPanel.tsx` after navigate call
  - Add: `setTimeout(() => history.replaceState(null, '', window.location.pathname + window.location.search), 8000);`
  - Done when: Hash is cleaned up after highlight fades
  - Verify: URL returns to clean state after clicking pinned message

- [ ] **Add hash cleanup to BookmarksPanel**
  - Location: `src/components/bookmarks/BookmarksPanel.tsx` after navigate call
  - Same pattern as PinnedMessagesPanel
  - Done when: Hash cleaned up consistently
  - Verify: URL returns to clean state after clicking bookmark

- [ ] **Add hash cleanup to NotificationPanel**
  - Location: `src/components/notifications/NotificationPanel.tsx:118` after navigate call
  - Same pattern
  - Done when: Hash cleaned up
  - Verify: URL returns to clean state after clicking notification

- [ ] **Add hash cleanup to search navigation**
  - Location: `src/hooks/business/search/useGlobalSearchNavigation.ts:27,30`
  - Same pattern
  - Done when: Hash cleaned up
  - Verify: URL returns to clean state after clicking search result

- [ ] **Standardize existing cleanup timing**
  - `MessageList.tsx:331-337`: Change 1000ms → 8000ms (match CSS animation)
  - `Message.tsx:449-455`: Change 2000ms → 8000ms
  - Done when: All hash cleanups use 8000ms
  - Verify: Hash persists for full animation duration

### Phase 3: Fix Timer/CSS Duration Mismatch

The `highlightMessage()` calls that DO work (mention self-highlighting) have wrong durations:

- [ ] **Update MessageList highlight duration**
  - File: `src/components/message/MessageList.tsx:327`
  - Change: `{ duration: 6000 }` → `{ duration: 8000 }`
  - Done when: Timer matches CSS animation (8s)
  - Verify: Highlight doesn't disappear before animation completes

- [ ] **Verify mention duration is correct**
  - File: `src/hooks/business/messages/useViewportMentionHighlight.ts:58`
  - Current: `{ duration: 61000, variant: 'mention' }` ✅ (matches CSS 61s)
  - No change needed, just verify

### Phase 4: Simplify Hook Architecture

Keep only what's actually used. The mention highlighting uses local state correctly (self-highlighting).

- [ ] **Document the actual architecture**
  - Add clear comments explaining:
    - Hash is for cross-component highlighting
    - Local state is for self-highlighting (mentions only)
  - Update hook JSDoc to remove "centralized" claim
  - Done when: Code accurately describes what it does

- [ ] **Consider removing unused exports**
  - `scrollToMessage()` - may still be useful as utility
  - Keep `highlightMessage()` - needed for mention self-highlighting
  - Keep `isHighlighted()` - needed for Message to check state
  - Keep `getHighlightVariant()` - needed for mention vs default CSS class
  - Done when: Only useful functions exported

- [ ] **Update Message.tsx highlight check**
  - File: `src/components/message/Message.tsx:258-263`
  - Current logic is correct: checks BOTH hash AND local state
  - Hash: for cross-component (pinned, bookmarks, search, links)
  - State: for self-highlighting (mentions)
  - Add comment explaining dual mechanism
  - Done when: Logic documented

## Verification

✅ **Reply snippet click highlights target**
   - Click reply snippet → original message scrolls into view and highlights
   - Uses yellow/gold color (--warning) at 20% opacity
   - Hash appears in URL, cleans up after 8s

✅ **Pinned message click highlights target**
   - Open pinned messages panel → click message → scrolls and highlights
   - Hash cleans up after 8s

✅ **Bookmark click highlights target**
   - Open bookmarks panel → click bookmark → scrolls and highlights
   - Works for both channel and DM bookmarks
   - Hash cleans up after 8s

✅ **Notification click highlights target**
   - Click notification → navigates to channel, scrolls to message, highlights
   - Hash cleans up after 8s

✅ **Search result click highlights target**
   - Click search result → navigates to message location, highlights
   - Hash cleans up after 8s

✅ **Message link click highlights target**
   - Click inline message link → navigates and highlights
   - Hash cleans up after 8s

✅ **Hash navigation from URL works**
   - Navigate to `#msg-{id}` → message scrolls into view and highlights
   - Hash cleans up after 8s

✅ **Mention auto-highlighting works**
   - Scroll past unread mention → highlights for 61 seconds
   - Uses yellow/gold color (--warning) at 10% opacity (more subtle)
   - Uses local state (self-highlighting), not hash

✅ **TypeScript compiles**
   - Run: `cmd.exe /c "cd /d D:\GitHub\Quilibrium\quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck"`

✅ **No console errors**
   - Test all highlight scenarios, check for warnings/errors

## Definition of Done

- [ ] All dead code removed (useless highlightMessage/scrollToMessage calls)
- [ ] Hash cleanup added to all navigation sources (8000ms)
- [ ] Timer durations match CSS animations (8s default, 61s mention)
- [ ] Code comments accurately describe architecture
- [ ] All verification tests pass
- [ ] TypeScript compiles
- [ ] No console errors
- [ ] Task updated with implementation notes

## Technical Notes

### Why URL Hash Works as Shared State
- `window.location.hash` is global browser state
- React Router's `useLocation()` subscribes to hash changes
- Each Message component re-renders when hash changes
- Check at `Message.tsx:260`: `location.hash === '#msg-${message.messageId}'`

### Why Local State Doesn't Work Cross-Component
- `useState` creates isolated state per hook call
- PinnedMessagesPanel calling `setHighlightedMessageId("msg-123")` only affects its own state
- Message component with id "msg-123" has its own separate `highlightedMessageId` state (null)
- No communication channel between these isolated states

### Mention Highlighting Exception (Why It Works)
- `useViewportMentionHighlight` is called FROM the Message component itself
- It receives `highlightMessage` callback from the SAME Message's hook instance
- When it calls `highlightMessage(messageId)`, it updates THAT Message's local state
- This works because it's **self-highlighting**, not cross-component communication

### Dual Mechanism Design (Keep Both)
The current design actually makes sense once understood:
1. **Hash** (`#msg-{id}`): Cross-component communication via URL
2. **Local State**: Self-highlighting for mentions when they enter viewport

Both are needed because:
- Hash can't easily trigger on viewport entry (would need to set hash for every visible message)
- Local state can't communicate across components (but mentions don't need to)

## Related Documentation

- `.agents/tasks/.done/message-highlight-system-optimization.md` - Original implementation docs
- `.agents/tasks/.done/mention-highlight-60s-duration.md` - 60s mention duration research
- `.agents/bugs/message-hash-navigation-conflict.md` - Known hash conflict with deletion
- `src/components/message/Message.scss:1-34` - CSS animation definitions

---

_Created: 2025-12-05_
_Updated: 2025-12-05_
