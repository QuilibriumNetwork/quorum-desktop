---
type: doc
title: Offline Support
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2025-12-20T00:00:00.000Z
---

# Offline Support

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

The application provides comprehensive offline support allowing users to continue using the app when network connectivity is unavailable. This includes viewing cached data, navigating between conversations, and queuing actions for later execution.

Offline support is built on three complementary systems:
1. **Offline Detection** - Combines WebSocket connection state with `navigator.onLine` for reliable detection
2. **React Query networkMode configuration** - Ensures IndexedDB queries run regardless of network state
3. **Action Queue** - Persists and retries user actions when connectivity is restored

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

## Offline Detection

Offline detection combines WebSocket connection state with `navigator.onLine` for reliable detection across all scenarios:

```typescript
// ActionQueueContext.tsx
const { connected: wsConnected } = useWebSocket();
const [navOnline, setNavOnline] = useState(navigator.onLine);

// Offline if EITHER signal says offline
const isOnline = wsConnected && navOnline;
```

The WebSocket `onclose` event fires reliably when network connectivity is lost, while `navigator.onLine` handles browser-specific offline triggers (DevTools, airplane mode).

### Detection Timing

| Event | Detection Time | Notes |
|-------|----------------|-------|
| DevTools "Offline" mode | Instant | Browser kills all connections immediately |
| Wi-Fi disconnect | 10-30 seconds | TCP timeout before WebSocket `onclose` fires |
| Airplane mode | Instant | OS-level network kill |
| Server down | 10-30 seconds | Same as Wi-Fi disconnect |

The delay for Wi-Fi disconnect is standard TCP timeout behavior at the OS level.

### Browser & Platform Compatibility

| Platform | Status | Notes |
|----------|--------|-------|
| Chrome | ✅ Supported | WebSocket API fully supported |
| Brave | ✅ Supported | Chromium-based |
| Firefox | ✅ Supported | WebSocket and Navigator APIs fully supported |
| Safari | ✅ Supported | WebSocket and Navigator APIs fully supported |
| Edge | ✅ Supported | Chromium-based |
| Electron | ✅ Supported | Uses Chromium |
| Mobile (React Native) | ⚠️ Unverified | Different WebSocket implementation |

### Components

| File | Purpose |
|------|---------|
| [ActionQueueContext.tsx](src/components/context/ActionQueueContext.tsx) | Combines WebSocket + Navigator signals for `isOnline` state |
| [WebsocketProvider.tsx](src/components/context/WebsocketProvider.tsx) | Provides `connected` state from WebSocket events |
| [ActionQueueService.ts](src/services/ActionQueueService.ts) | Uses `isOnlineCallback` to check connectivity before queue processing |
| [OfflineBanner.tsx](src/components/ui/OfflineBanner.tsx) | Displays banner when offline |

---

## React Query Configuration

All IndexedDB-based query hooks use `networkMode: 'always'` to ensure they run regardless of browser network state:

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

DM navigation uses IndexedDB for cached data with a fallback chain for registration data:

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

## Technical Notes

- **networkMode: 'always'** - IndexedDB queries use this setting because they don't depend on network connectivity. React Query's default `networkMode: 'online'` would unnecessarily block local database queries.

- **useRegistrationOptional** - Uses a non-suspense query with fallback instead of caching registration in IndexedDB. This provides graceful degradation without schema migration complexity.

- **DM sends require network** - DM encryption requires the counterparty's registration data (public keys, inbox addresses). This data must be fetched from the network, so DM sending cannot be fully queued offline.

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
