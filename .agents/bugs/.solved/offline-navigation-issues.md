---
type: bug
title: Offline Navigation Issues
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2025-12-19T00:00:00.000Z
---

# Offline Navigation Issues

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Status: RESOLVED (Issue 1) / OPEN (Issue 2)

## Symptoms

When the browser is set to "Network > Offline" in DevTools:

1. **~~Space Navigation Fails Silently~~** - **FIXED**: Clicking space icons in NavMenu now works offline
2. **DM Navigation Shows Empty**: Navigating to a different DM conversation results in an empty view (still open)

Both issues occurred while the user was already on a space or DM conversation (where queued actions work correctly).

---

## Issue 1: Space Navigation - RESOLVED

### Root Cause

**React Query v5's default `networkMode: 'online'`** was blocking IndexedDB queries when offline.

Despite all space-related queries using **local IndexedDB** (not network), React Query v5 has a default behavior where queries are **paused** when `navigator.onLine` returns `false`. This caused:

1. User clicks space icon → `navigate()` fires → URL changes
2. `Space.tsx` renders → calls `useSpace({ spaceId })`
3. `useSuspenseQuery` checks `navigator.onLine` → returns `false`
4. Query is **paused** (fetcher never called) → component suspends indefinitely
5. User sees nothing happen

**Key insight**: The IndexedDB fetcher was never even called - React Query blocked it before execution.

### Debugging Evidence

```
[DEBUG] Space component rendering
[DEBUG] Space params: {spaceId: '...', channelId: '...'}
[DEBUG] useSpace called, spaceId: ... messageDB exists: true
// ❌ buildSpaceFetcher NEVER called - query paused by networkMode
```

After fix:
```
[DEBUG] useSpace called, spaceId: ... messageDB exists: true
[DEBUG] buildSpaceFetcher called for: ...
[DEBUG] buildSpaceFetcher got response: ...
[DEBUG] Space data loaded: ...  // ✅ Works!
```

### Solution

Added `networkMode: 'always'` to all IndexedDB-based queries to tell React Query these queries don't depend on network connectivity:

```typescript
return useSuspenseQuery({
  queryKey: buildSpaceKey({ spaceId }),
  queryFn: buildSpaceFetcher({ messageDB, spaceId }),
  refetchOnMount: true,
  networkMode: 'always', // This query uses IndexedDB, not network
});
```

### Files Modified

| File | Change |
|------|--------|
| [useSpace.ts](src/hooks/queries/space/useSpace.ts) | Added `networkMode: 'always'` |
| [useSpaceMembers.ts](src/hooks/queries/spaceMembers/useSpaceMembers.ts) | Added `networkMode: 'always'` |
| [useMessages.ts](src/hooks/queries/messages/useMessages.ts) | Added `networkMode: 'always'` |
| [useSpaceOwner.ts](src/hooks/queries/spaceOwner/useSpaceOwner.ts) | Added `networkMode: 'always'` |
| [useConfig.ts](src/hooks/queries/config/useConfig.ts) | Added `networkMode: 'always'` |
| [useSpaces.ts](src/hooks/queries/spaces/useSpaces.ts) | Added `networkMode: 'always'` |
| [useConversation.ts](src/hooks/queries/conversation/useConversation.ts) | Added `networkMode: 'always'` |
| [useMutedUsers.ts](src/hooks/queries/mutedUsers/useMutedUsers.ts) | Added `networkMode: 'always'` |

---

## Issue 2: DM Navigation Shows Empty - STILL OPEN

### Root Cause (Confirmed)

`useRegistration()` makes a **network API call** and uses `useSuspenseQuery`:

```
DirectMessage.tsx
  → useRegistration({ address })            // Line 92-98
  → useSuspenseQuery                         // Line 10 of useRegistration.ts
  → apiClient.getUser(address)               // Network call!
```

When offline:
- The API call fails (network unavailable)
- `useSuspenseQuery` suspends waiting for network
- The component never renders, showing empty/loading state

Unlike space queries (IndexedDB), registration data is **only available via network API**.

### Files Involved

- [DirectMessage.tsx:92-98](src/components/direct/DirectMessage.tsx#L92-L98) - Two `useRegistration()` calls
- [useRegistration.ts:10-13](src/hooks/queries/registration/useRegistration.ts#L10-L13) - `useSuspenseQuery` with `refetchOnMount: true`
- [buildRegistrationFetcher.ts:6](src/hooks/queries/registration/buildRegistrationFetcher.ts#L6) - `apiClient.getUser()` network call

### Potential Solutions

**Option A: Cache registration in IndexedDB**
- Store registration data locally when fetched online
- Fall back to cached data when offline
- Requires schema change and cache invalidation strategy

**Option B: Use React Query's stale data**
```typescript
useSuspenseQuery({
  queryKey: buildRegistrationKey({ address }),
  queryFn: buildRegistrationFetcher({ apiClient, address }),
  staleTime: Infinity,          // Don't refetch if we have data
  gcTime: Infinity,             // Keep data in cache forever
});
```
- Only works if user visited that DM conversation before while online

**Option C: Use non-suspense query with loading state**
```typescript
const { data: registration, isLoading, error } = useQuery({
  // ...same config but not useSuspenseQuery
});
// Show placeholder UI when offline/loading
```

---

## Prevention Guidelines

For future development:

1. **Always add `networkMode: 'always'` to IndexedDB queries** - React Query v5 defaults to `'online'` which pauses queries when offline

2. **Audit query data sources** - Clearly distinguish between:
   - Local queries (IndexedDB) → `networkMode: 'always'`
   - Network queries (API) → Consider offline fallback strategy

3. **Consider caching network data locally** - For critical paths like registration, cache data in IndexedDB for offline access

4. **Test offline scenarios** - Add offline navigation to testing checklist

---

## Related Documentation

- [React Query v5 Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)
- [Action Queue Feature](../.agents/docs/features/action-queue.md) - Handles offline actions correctly

---
