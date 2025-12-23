# Persist DM Contact Profile from Message Data

> **AI-Generated**: May contain errors. Verify before use.

**Status**: Done
**Complexity**: Low
**Created**: 2025-12-22
**Files**:
- `src/components/context/MessageDB.tsx:315` (addOrUpdateConversation)
- `src/services/MessageService.ts` (callers)

## What & Why

Currently, DM conversation `displayName` and `icon` are set when the conversation is first created ("Unknown User") and only updated in the React Query cache when messages are received. If the user refreshes the page, the profile reverts to stale data because the cache updates never persist to IndexedDB.

This task fixes `addOrUpdateConversation()` to also persist profile updates to IndexedDB, ensuring profile data survives page refreshes.

## Privacy Design (Important)

**Profile is revealed ONLY when counterparty replies:**
- When you message a new user → They see "Unknown User" (privacy preserved)
- When they reply → Their profile is extracted from the message envelope and stored
- This is intentional: you only learn someone's identity when they choose to respond

**Conversation deletion resets profile:**
- `deleteConversation()` in [MessageService.ts:4184](src/services/MessageService.ts#L4184) already deletes the conversation record
- Also calls `deleteUser()` to remove cached profile (line 4188)
- Result: Messaging the same person again starts fresh with "Unknown User"

**No changes needed for deletion** - privacy is already preserved.

## Current Problem

```
Message received → addOrUpdateConversation() → React Query cache only ❌
                                            ↘ IndexedDB NOT updated

Page refresh → IndexedDB loaded → Stale "Unknown User" shown
```

## Implementation

Modify `addOrUpdateConversation` in [MessageDB.tsx:315](src/components/context/MessageDB.tsx#L315) to also write to IndexedDB:

```typescript
const addOrUpdateConversation = async (
  queryClient: QueryClient,
  address: string,
  timestamp: number,
  lastReadTimestamp: number,
  updatedUserProfile?: Partial<{ user_icon?: string; display_name?: string }>
) => {
  const conversationId = address + '/' + address;

  // 1. Persist to IndexedDB when we have profile data
  if (updatedUserProfile?.display_name || updatedUserProfile?.user_icon) {
    try {
      const existing = await messageDB.getConversation({ conversationId });
      if (existing?.conversation) {
        await messageDB.saveConversation({
          ...existing.conversation,
          displayName: updatedUserProfile.display_name ?? existing.conversation.displayName,
          icon: updatedUserProfile.user_icon ?? existing.conversation.icon,
          timestamp: Math.max(timestamp, existing.conversation.timestamp),
        });
      }
    } catch (error) {
      console.warn('Failed to persist conversation profile update:', error);
    }
  }

  // 2. Update React Query cache (existing logic unchanged)
  queryClient.setQueryData(
    buildConversationsKey({ type: 'direct' }),
    (oldData: InfiniteData<any>) => {
      // ... existing code ...
    }
  );
  invalidateConversation({ conversationId });
};
```

### Callers (No Changes Needed)

The function is called in 3 places in MessageService.ts, all already pass `updatedUserProfile`:
- Line 1924: Initial DM inbox setup
- Line 2075: Session establishment with envelope profile
- Line 3230: Regular DM message with profile

## Why This Approach

| Aspect | This Approach | useEffect in DirectMessage |
|--------|---------------|---------------------------|
| Extra API calls | None | Yes (registration fetch) |
| Works offline | Yes (data from messages) | No (needs online) |
| Updates when DM closed | Yes | No |
| Code location | Data layer | UI component |
| Complexity | Low (complete existing logic) | Medium (new hook + guards) |

## Security Analysis

**Data being stored:**
- `icon` = URL string (e.g., `/unknown.png`, IPFS URL)
- `displayName` = User-chosen display name

**Risk Assessment:**
| Data | Risk | Notes |
|------|------|-------|
| `displayName` | Low | Already shown in UI, React auto-escapes |
| `icon` | Low | URL only, used as img src (safe pattern) |

**Already happening:** These fields are already stored when conversation is created. This just updates them.

## Verification

- [ ] Profile persists after page refresh (was broken, now fixed)
- [ ] Profile updates when receiving message from user who changed their profile
- [ ] Conversation settings (isRepudiable) preserved
- [ ] New conversation still shows "Unknown User" until reply received
- [ ] Deleting conversation resets profile (privacy preserved)
- [ ] TypeScript compiles: `npx tsc --noEmit`

## Definition of Done

- [ ] `addOrUpdateConversation` made async
- [ ] IndexedDB save added before React Query update
- [ ] Existing conversation fields preserved (especially `isRepudiable`)
- [ ] Callers in MessageService.ts handle async if needed
- [ ] Manual testing confirms profile persists across refresh
- [ ] Privacy verified: delete conversation → message again → shows "Unknown User"

---

*Updated: 2025-12-22 18:45*
