---
type: task
title: "Add DM-Specific Action Queue Handlers"
status: done
complexity: high
created: 2025-12-18
updated: 2026-01-09
---

# Add DM-Specific Action Queue Handlers

> **AI-Generated**: May contain errors. Verify before use.


**Completed**: 2025-12-18
**Related Audit**: [003-DM-message-code-comparison-audit.md](../reports/action-queue/003-DM-message-code-comparison-audit.md)

**Files Modified**:
- `src/types/actionQueue.ts`
- `src/services/ActionQueueHandlers.ts`
- `src/hooks/business/messages/useMessageActions.ts`
- `src/components/message/MessageEditTextarea.tsx`
- `src/components/message/Message.tsx`
- `src/components/direct/DirectMessage.tsx`

## What & Why

**Prior State**: DM reactions, deletes, and edits were working via the legacy `onSubmitMessage` path (WebSocket outbound message queue). This path worked both online and offline, but:
- Actions didn't appear in the offline banner counter ("n actions queued")
- Less visibility into pending operations
- No deduplication support

**Implemented State**: All DM secondary actions (reactions, deletes, edits) now route through the action queue with proper Double Ratchet encryption, providing:
- Visibility in offline banner counter
- Deduplication via dedupe keys
- Consistent infrastructure with Space actions
- Legacy fallback preserved for resilience

**Value**: Improved consistency and visibility - DM actions now use the same action queue infrastructure as Space actions, while maintaining the legacy fallback path for edge cases.

## Context

- **Existing pattern**: The `send-dm` handler in `ActionQueueHandlers.ts` correctly implements Double Ratchet encryption for DMs
- **Constraints**: Must use Double Ratchet (not Triple Ratchet) and WebSocket transport (not Hub)
- **Dependencies**: Requires `self`, `counterparty`, `keyset` context passed via `dmContext` prop

## Implementation Summary

### Phase 1: Add Action Types - DONE

- [x] **Added new action types** (`src/types/actionQueue.ts`)
  - Added `'reaction-dm' | 'delete-dm' | 'edit-dm'` to ActionType union

### Phase 2: Create DM Handlers - DONE

- [x] **Extracted `encryptAndSendDm()` helper method** (`src/services/ActionQueueHandlers.ts`)
  - Private method containing Double Ratchet encryption logic
  - Handles encryption per inbox, stale state cleanup, WebSocket transport
  - Reused by all DM handlers

- [x] **Created `reactionDm` handler** (`src/services/ActionQueueHandlers.ts`)
  - Registered in `getHandler()` map as `'reaction-dm'`
  - Uses `encryptAndSendDm()` helper
  - Accepts `reactionMessage: ReactionMessage | RemoveReactionMessage`

- [x] **Created `deleteDm` handler** (`src/services/ActionQueueHandlers.ts`)
  - Registered in `getHandler()` map as `'delete-dm'`
  - Uses `encryptAndSendDm()` helper
  - Accepts `deleteMessage: RemoveMessage`

- [x] **Created `editDm` handler** (`src/services/ActionQueueHandlers.ts`)
  - Registered in `getHandler()` map as `'edit-dm'`
  - Uses `encryptAndSendDm()` helper
  - Accepts `editMessage` with edit content

### Phase 3: Update Routing - DONE

- [x] **Updated `useMessageActions.ts`** for reactions and deletes
  - Added `DmContext` interface for type safety
  - Added `buildDmActionContext()` helper to construct handler context
  - DM detection via `spaceId === channelId`
  - Routes to `reaction-dm` / `delete-dm` handlers when `dmContext` available
  - Falls back to legacy `onSubmitMessage` if context unavailable

- [x] **Updated `MessageEditTextarea.tsx`** for edits
  - Added `DmContext` interface (same as useMessageActions)
  - Added `dmContext` prop to component
  - Routes to `edit-dm` handler when `dmContext` available
  - Falls back to legacy `submitMessage` if context unavailable

### Phase 4: Wire Up dmContext Prop - DONE

- [x] **Updated `Message.tsx`**
  - Pass `dmContext` to `useMessageActions` hook
  - Pass `dmContext` to `MessageEditTextarea` component

- [x] **Updated `DirectMessage.tsx`**
  - Construct `dmContext` from existing `self.registration` and `registration.registration`
  - Pass `dmContext` to `MessageList` component

### Deduplication Keys

| Action Type | Dedupe Key Format |
|-------------|-------------------|
| `reaction-dm` | `reaction-dm:${address}:${messageId}:${emoji}` |
| `delete-dm` | `delete-dm:${address}:${messageId}` |
| `edit-dm` | `edit-dm:${address}:${messageId}` |

## Verification Results

- [x] **DM reactions work offline** - Action queued, syncs when online
- [x] **DM deletes work offline** - Action queued, syncs when online
- [x] **DM edits work offline** - Action queued, syncs when online
- [x] **TypeScript compiles** - `npx tsc --noEmit` passes
- [x] **No regressions in Space actions** - Space reactions/deletes/edits unchanged
- [x] **Legacy fallback works** - When dmContext unavailable, uses onSubmitMessage

## Definition of Done

- [x] All 3 new handlers implemented with Double Ratchet encryption
- [x] `useMessageActions.ts` routes DM reactions/deletes to new handlers
- [x] `MessageEditTextarea.tsx` routes DM edits to new handler
- [x] `dmContext` prop wired through component hierarchy
- [x] All online tests pass
- [x] All offline tests pass
- [x] TypeScript compiles without errors
- [x] Legacy fallback preserved for resilience
- [ ] Update `.agents/docs/features/action-queue.md` with new DM action types (optional follow-up)

## Notes

### Architecture Decision: Keep Legacy Fallback

The legacy `onSubmitMessage` path is intentionally preserved as a fallback when `dmContext` is unavailable. This can happen due to:
- Race conditions during component mounting
- Error states in registration/keyset retrieval
- Edge cases with component hierarchy

The legacy path uses the WebSocket outbound message queue, which also supports offline operation (just without action queue visibility).

### Key Insight

The implementation extracts shared Double Ratchet encryption logic into `encryptAndSendDm()` helper method, avoiding duplication of 200+ lines of encryption boilerplate across handlers.

## Edge Cases Handled

1. **Missing dmContext**: Falls back to legacy path (works online and offline)
2. **Missing keyset**: Falls back to legacy path with warning
3. **Counterparty has no active inboxes**: Handled by stale state cleanup in encryptAndSendDm
4. **Queued actions while offline**: Actions execute in order when online
5. **Deduplication**: Same action won't be queued twice (via dedupe key)

---


_Completed: 2025-12-18_
