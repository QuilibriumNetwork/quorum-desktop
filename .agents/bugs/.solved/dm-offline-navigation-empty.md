# DM Offline Navigation Shows Empty View

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Status: RESOLVED

## Symptoms

When the browser is set to "Network > Offline" in DevTools:
- Navigating to a different DM conversation results in an empty view
- The DM conversation list loads correctly (uses IndexedDB)
- Clicking on any conversation shows nothing - component never renders

## Root Cause

`DirectMessage.tsx` requires **network API calls** via `useRegistration()` hook that cannot complete offline:

```typescript
// DirectMessage.tsx:92-95
const { data: registration } = useRegistration({ address: address! });
const { data: self } = useRegistration({
  address: user.currentPasskeyInfo!.address,
});
```

The data flow:
1. User clicks DM conversation → `navigate()` fires → URL changes
2. `DirectMessage.tsx` renders → calls `useRegistration({ address })`
3. `useRegistration` → `useSuspenseQuery` → `apiClient.getUser(address)`
4. Network call fails (offline) → query suspends indefinitely
5. Component never renders → user sees empty view

**Key insight**: Unlike space queries (which use IndexedDB), registration data is **only available via network API**. There is no local cache.

## Files Involved

| File | Role |
|------|------|
| [DirectMessage.tsx:92-95](src/components/direct/DirectMessage.tsx#L92-L95) | Two `useRegistration()` calls that block rendering |
| [useRegistration.ts](src/hooks/queries/registration/useRegistration.ts) | `useSuspenseQuery` with network-dependent fetcher |
| [buildRegistrationFetcher.ts](src/hooks/queries/registration/buildRegistrationFetcher.ts) | `apiClient.getUser()` network call |

## Why This Differs from Space Navigation

Space navigation was fixed by adding `networkMode: 'always'` because space queries use **IndexedDB** (local storage). Registration queries use **network API calls** - they genuinely need network connectivity.

| Feature | Data Source | Offline Fix |
|---------|-------------|-------------|
| Space navigation | IndexedDB | `networkMode: 'always'` ✅ Fixed |
| DM navigation | Network API | Requires fallback solution |

---

## Solution: Non-Suspense Query with Fallback UI (Recommended)

Switch from `useSuspenseQuery` to `useQuery` so the component renders immediately even when registration data is unavailable. Use data from `useConversation` (already cached in IndexedDB) as fallback.

**Why this is the best approach:**
- **Minimal code changes** - Just switch query type and add fallback logic
- **No schema migration** - No new IndexedDB tables needed
- **No cache invalidation complexity** - No need to track when registration data changes
- **Data already exists** - `useConversation` already caches displayName/icon in IndexedDB
- **Handles the real use case** - Users reading existing conversations offline

### Implementation

**Step 1: Create non-suspense version of useRegistration**

```typescript
// src/hooks/queries/registration/useRegistrationOptional.ts
import { useQuery } from '@tanstack/react-query';
import { buildRegistrationFetcher } from './buildRegistrationFetcher';
import { buildRegistrationKey } from './buildRegistrationKey';
import { useApiClient } from '../../../components/context/useApiClient';

const useRegistrationOptional = ({ address }: { address: string }) => {
  const { apiClient } = useApiClient();

  return useQuery({
    queryKey: buildRegistrationKey({ address }),
    queryFn: buildRegistrationFetcher({ apiClient, address }),
    networkMode: 'always',   // Allow query to run offline (will fail gracefully)
    staleTime: Infinity,     // Don't refetch if we have data
    gcTime: Infinity,        // Keep in cache forever
    retry: false,            // Don't retry failed requests when offline
  });
};

export { useRegistrationOptional };
```

**Step 2: Update DirectMessage.tsx to use fallback data**

```typescript
// DirectMessage.tsx - Replace suspense queries with optional queries
const { data: registration } = useRegistrationOptional({ address: address! });
const { data: self } = useRegistrationOptional({
  address: user.currentPasskeyInfo!.address,
});
const { data: conversation } = useConversation({
  conversationId: conversationId,
});

// Build members with fallback from conversation data (IndexedDB)
const members = useMemo(() => {
  const m = {} as { [address: string]: { displayName?: string; userIcon?: string; address: string } };

  // Priority: conversation data (IndexedDB) > registration data (network) > defaults
  if (conversation?.conversation) {
    m[address!] = {
      displayName: conversation.conversation.displayName ?? t`Unknown User`,
      userIcon: conversation.conversation.icon ?? DefaultImages.UNKNOWN_USER,
      address: address!,
    };
  } else if (registration?.registration) {
    m[registration.registration.user_address] = {
      displayName: registration.registration.display_name ?? t`Unknown User`,
      userIcon: registration.registration.pfp_url ?? DefaultImages.UNKNOWN_USER,
      address: registration.registration.user_address,
    };
  } else {
    // Offline fallback - use address as identifier
    m[address!] = {
      displayName: t`Unknown User`,
      userIcon: DefaultImages.UNKNOWN_USER,
      address: address!,
    };
  }

  // Self data - use passkey context as primary source (always available)
  m[user.currentPasskeyInfo!.address] = {
    address: user.currentPasskeyInfo!.address,
    userIcon: user.currentPasskeyInfo!.pfpUrl,
    displayName: user.currentPasskeyInfo!.displayName,
  };

  return m;
}, [registration, conversation, address, user.currentPasskeyInfo]);
```

### What Works Offline with This Approach

| Feature | Works Offline? | Notes |
|---------|---------------|-------|
| View conversation | ✅ Yes | Uses IndexedDB messages |
| See message history | ✅ Yes | Already cached locally |
| See user display name | ✅ Partial | Falls back to conversation cache or "Unknown User" |
| See user avatar | ✅ Partial | Falls back to conversation cache or default avatar |
| Send messages | ⚠️ Queued | Action queue handles offline messages |
| See sent messages | ✅ Yes | Optimistic updates work |

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/queries/registration/useRegistrationOptional.ts` | **New file** - non-suspense version |
| `src/hooks/index.ts` | Export new hook |
| `src/components/direct/DirectMessage.tsx` | Use `useRegistrationOptional`, update `members` logic |

---

## Alternative Solutions

### Alternative A: Cache Registration in IndexedDB

Store registration data locally when fetched online, fall back to cached data when offline.

**Pros:**
- Full offline support for previously-visited conversations
- Consistent with space navigation behavior

**Cons:**
- Requires IndexedDB schema change and migration
- Needs cache invalidation strategy (registration data can change)
- More complex implementation
- Overkill for the actual use case

**Implementation outline:**
1. Add `registrations` table to IndexedDB schema
2. When `apiClient.getUser()` succeeds, cache result in IndexedDB
3. Modify `buildRegistrationFetcher` to check IndexedDB first when offline
4. Add `networkMode: 'always'` to `useRegistration`

### Alternative B: Use React Query's Stale Data

```typescript
useSuspenseQuery({
  queryKey: buildRegistrationKey({ address }),
  queryFn: buildRegistrationFetcher({ apiClient, address }),
  staleTime: Infinity,          // Don't refetch if we have data
  gcTime: Infinity,             // Keep data in cache forever
  networkMode: 'always',        // Allow query to run offline
});
```

**Pros:**
- Minimal code change
- Works for conversations visited in current session

**Cons:**
- Only works if user visited that DM conversation while online in same session
- Data lost on page refresh/app restart
- Not a true offline solution

---

## Related Documentation

- [Offline Navigation Issues](offline-navigation-issues.md) - Parent bug tracking both issues (Issue 1 resolved)
- [Action Queue Feature](../docs/features/action-queue.md) - Offline action handling (works correctly)

## Prevention Guidelines

For future network-dependent queries:

1. **Consider offline use case** during design
2. **Cache critical data in IndexedDB** for offline access
3. **Document data source** clearly in hook comments (network vs local)
4. **Test offline scenarios** as part of feature development

---

_Created: 2025-12-19_
