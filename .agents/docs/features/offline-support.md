# Offline Support

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

The application provides comprehensive offline support allowing users to continue using the app when network connectivity is unavailable. This includes viewing cached data, navigating between conversations, and queuing actions for later execution.

Offline support is built on two complementary systems:
1. **React Query networkMode configuration** - Ensures IndexedDB queries run regardless of network state
2. **Action Queue** - Persists and retries user actions when connectivity is restored

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     OFFLINE CAPABILITIES                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │  Navigation     │    │  Data Viewing   │    │  Actions    │ │
│  │  (IndexedDB)    │    │  (IndexedDB)    │    │  (Queued)   │ │
│  └────────┬────────┘    └────────┬────────┘    └──────┬──────┘ │
│           │                      │                     │        │
│           ▼                      ▼                     ▼        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      IndexedDB                               ││
│  │  - Spaces, Channels, Messages                                ││
│  │  - Conversations, Encryption States                          ││
│  │  - User Config, Bookmarks                                    ││
│  │  - Action Queue Tasks                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## React Query Configuration

### The Problem

React Query v5 defaults to `networkMode: 'online'`, which pauses all queries when `navigator.onLine` returns `false`. This blocks even IndexedDB queries (which don't need network) from executing.

### The Solution

All IndexedDB-based query hooks specify `networkMode: 'always'` to bypass React Query's network detection:

```typescript
return useSuspenseQuery({
  queryKey: buildSpaceKey({ spaceId }),
  queryFn: buildSpaceFetcher({ messageDB, spaceId }),
  refetchOnMount: true,
  networkMode: 'always', // This query uses IndexedDB, not network
});
```

### Configured Hooks

| Hook | Data Source | Purpose |
|------|-------------|---------|
| `useSpace` | IndexedDB | Space metadata |
| `useSpaces` | IndexedDB | List of all spaces |
| `useSpaceMembers` | IndexedDB | Space member list |
| `useSpaceOwner` | IndexedDB | Space ownership |
| `useMessages` | IndexedDB | Channel/DM messages |
| `useConfig` | IndexedDB | User configuration |
| `useConversation` | IndexedDB | Single conversation metadata |
| `useConversations` | IndexedDB | Conversation list |
| `useEncryptionStates` | IndexedDB | DM encryption states |
| `useMutedUsers` | IndexedDB | Muted user list |
| `useBookmarks` | IndexedDB | User bookmarks |

## Space Navigation (Fully Offline)

Space navigation works completely offline because all required data is stored in IndexedDB.

### Data Flow

```
User clicks Space icon
    │
    ▼
navigate('/space/:spaceId/:channelId')
    │
    ▼
Space.tsx renders
    ├─► useSpace({ spaceId }) → IndexedDB ✅
    ├─► useSpaceMembers({ spaceId }) → IndexedDB ✅
    └─► useMessages({ spaceId, channelId }) → IndexedDB ✅
```

### What Works Offline

| Feature | Status | Notes |
|---------|--------|-------|
| Navigate between spaces | ✅ Works | All data in IndexedDB |
| View channel messages | ✅ Works | Messages cached locally |
| See member list | ✅ Works | Members cached locally |
| Send messages | ⚠️ Queued | Via Action Queue |
| Reactions | ⚠️ Queued | Via Action Queue |

## DM Navigation (Graceful Degradation)

DM navigation uses a hybrid approach: IndexedDB for cached data with network fallback for registration data.

### The Challenge

`DirectMessage.tsx` requires registration data to display user info and enable message sending. This data comes from a network API (`apiClient.getUser()`).

### Solution: Non-Suspense Query with Fallback

```typescript
// Uses useQuery instead of useSuspenseQuery
const { data: registration } = useRegistrationOptional({ address: address! });

// Fallback chain for user display info
const members = useMemo(() => {
  if (conversation?.conversation) {
    // Priority 1: Use conversation data from IndexedDB (available offline)
    return { displayName, userIcon, address };
  } else if (registration?.registration) {
    // Priority 2: Use registration data from network API
    return { displayName, userIcon, address };
  } else {
    // Priority 3: Offline fallback - use address as identifier
    return { displayName: 'Unknown User', userIcon: defaultIcon, address };
  }
}, [registration, conversation, address]);
```

### useRegistrationOptional Hook

A non-suspense version of `useRegistration` that fails gracefully when offline:

```typescript
// src/hooks/queries/registration/useRegistrationOptional.ts
const useRegistrationOptional = ({ address }: { address: string }) => {
  const { apiClient } = useQuorumApiClient();

  return useQuery({
    queryKey: buildRegistrationKey({ address }),
    queryFn: buildRegistrationFetcher({ apiClient, address }),
    networkMode: 'always',   // Allow query to run offline (will fail gracefully)
    staleTime: Infinity,     // Don't refetch if we have data
    gcTime: Infinity,        // Keep in cache forever
    retry: false,            // Don't retry failed requests when offline
  });
};
```

### What Works Offline

| Feature | Status | Notes |
|---------|--------|-------|
| View DM conversation list | ✅ Works | `useConversations` uses IndexedDB |
| Navigate to DM conversation | ✅ Works | Component renders with fallback |
| View message history | ✅ Works | Messages cached in IndexedDB |
| See user display name | ⚠️ Partial | Falls back to cached conversation data or "Unknown User" |
| See user avatar | ⚠️ Partial | Falls back to cached conversation data or default |
| Send messages | ❌ Blocked | Requires registration data for encryption |
| Reactions/Edits/Deletes | ❌ Blocked | Requires registration data |

### Sending Limitation

DM message sending requires registration data for Double Ratchet encryption. When offline, the send handler returns early:

```typescript
if (!self?.registration || !registration?.registration) {
  console.warn('Cannot send message: registration data unavailable (offline?)');
  return;
}
```

## Action Queue Integration

The [Action Queue](action-queue.md) handles offline actions by persisting them to IndexedDB and processing when connectivity is restored.

### Supported Offline Actions

**Space Actions** (fully offline-capable):
- Send channel message
- Add/remove reactions
- Pin/unpin messages
- Edit/delete messages
- Save user config
- Update space settings

**DM Actions** (require prior online session):
- Send direct message
- Add/remove reactions
- Edit/delete messages

### Visibility

The offline banner displays queued action count:
```
┌─────────────────────────────────────────┐
│ ⚠️ You're offline (3 actions queued)    │
└─────────────────────────────────────────┘
```

## Technical Decisions

### Why networkMode: 'always' for IndexedDB queries?

React Query v5's default `networkMode: 'online'` checks `navigator.onLine` before executing queries. This is appropriate for network requests but blocks local IndexedDB queries unnecessarily. Setting `networkMode: 'always'` tells React Query the query doesn't depend on network connectivity.

### Why useRegistrationOptional instead of caching?

Options considered:
1. **Cache registration in IndexedDB** - Full offline support but requires schema migration and cache invalidation
2. **Use React Query stale data** - Works within session but lost on refresh
3. **Non-suspense query with fallback** - Minimal changes, graceful degradation (chosen)

The chosen approach provides the best balance of implementation simplicity and user experience. Most DM offline use cases involve reading existing conversations (which works), not sending to new contacts.

### Why not queue DM sends when offline?

DM encryption requires the counterparty's registration data (public keys, inbox addresses). Without network access, we can't obtain this data for new conversations. For existing conversations where the data was previously cached in React Query's memory cache, sending could theoretically work, but the implementation complexity wasn't justified for this edge case.

## Key Components

| File | Purpose |
|------|---------|
| [useRegistrationOptional.ts](src/hooks/queries/registration/useRegistrationOptional.ts) | Non-suspense registration query for offline resilience |
| [DirectMessage.tsx](src/components/direct/DirectMessage.tsx) | DM component with fallback logic |
| [ActionQueueService.ts](src/services/ActionQueueService.ts) | Offline action persistence and retry |
| [OfflineBanner.tsx](src/components/ui/OfflineBanner.tsx) | Offline status and queue count display |

## Known Limitations

1. **DM sending requires network** - Cannot send DMs when offline due to encryption requirements
2. **New DM conversations** - Cannot start new conversations offline (no registration data)
3. **Profile updates** - Changes to other users' profiles won't be visible until back online
4. **First-time navigation** - Navigating to a conversation never opened online shows "Unknown User"

## Related Documentation

- [Action Queue](action-queue.md) - Offline action handling and retry logic
- [DM Offline Navigation Bug (Solved)](../../bugs/.solved/dm-offline-navigation-empty.md) - Implementation details
- [Space Offline Navigation Bug (Solved)](../../bugs/.solved/offline-navigation-issues.md) - Root cause analysis

---

*Updated: 2025-12-19*
