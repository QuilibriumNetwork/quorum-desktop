# Persist DM Registration Data for Full Offline Support

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Status**: Pending
**Complexity**: Medium
**Created**: 2025-12-20
**Files**:
- `src/db/messages.ts` - Add user_registrations store
- `src/hooks/queries/registration/useRegistration.ts` - Save to IndexedDB on fetch
- `src/hooks/queries/registration/useRegistrationOptional.ts` - Load from IndexedDB first
- `src/components/direct/DirectMessage.tsx:226` - Silent fail location

## What & Why

**Current State**: DM messages fail silently after page refresh when offline because counterparty registration data (public keys, inbox addresses) is only cached in React Query memory.

**Desired State**: DM messages work fully offline like Space messages - users can send messages, close the app, reopen it offline, and messages will queue and send when back online.

**Value**: Consistent offline UX between Spaces and DMs. Currently, Space messages survive app restart but DM messages don't, which is confusing and can lead to lost messages.

## Context

- **Existing pattern**: Space encryption keys are stored in IndexedDB (`space_keys` store) and survive refresh
- **Current limitation**: `UserRegistration` data is fetched via API and cached only in React Query (memory)
- **Root cause**: Registration data was not prioritized for offline support during initial implementation

**Related Documentation**:
- [Action Queue - Offline Support Summary](../docs/features/action-queue.md#why-space-messages-work-fully-offline-but-dm-messages-dont)
- [Offline Support](../docs/features/offline-support.md)

## ⚠️ Analysis Required

Before implementing, a more thorough codebase analysis is needed to verify:

1. **Registration data structure**: Confirm `UserRegistration` type is serializable to IndexedDB (no circular refs, functions, etc.)
2. **Data freshness**: Determine if/when cached registration should be refreshed (device changes, key rotation?)
3. **Storage size**: Estimate storage impact per user registration
4. **Existing patterns**: Check if there are other places already persisting similar data
5. **SDK constraints**: Verify the SDK's `UserRegistration` type doesn't have constraints on persistence
6. **Self vs counterparty**: Both `self` and `counterparty` registration are needed - verify both can be cached

## Proposed Implementation

### Phase 1: Database Schema
- [ ] **Add `user_registrations` store to IndexedDB** (`src/db/messages.ts`)
  - Schema version bump required
  - Key by `user_address`
  - Store full `UserRegistration` object
  - Add `cachedAt` timestamp for freshness checks

### Phase 2: Save on Fetch
- [ ] **Update registration hooks to persist** (`src/hooks/queries/registration/`)
  - After successful API fetch, save to IndexedDB
  - Consider: save in queryFn or in onSuccess?

### Phase 3: Load from Cache
- [ ] **Try IndexedDB before API** (`src/hooks/queries/registration/`)
  - Check IndexedDB first
  - If found and not stale, use cached
  - If not found or stale, fetch from API
  - Handle offline gracefully (use cached even if stale)

### Phase 4: UX Improvement (Optional)
- [ ] **Replace silent fail with user feedback** (`src/components/direct/DirectMessage.tsx:226`)
  - Show error toast or disable composer when registration unavailable
  - Currently just logs `console.warn`

## Verification
✅ **DM sends survive page refresh**
   - Test: Open DM online → go offline → send message → refresh → come back online → message sends

✅ **New DM conversations still require online**
   - Test: Starting a conversation with someone you've never messaged still needs network

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

✅ **No regression in online behavior**
   - Test: Normal DM flow works unchanged when online

## Definition of Done
- [ ] Codebase analysis completed (see Analysis Required section)
- [ ] All phases implemented
- [ ] All verification tests pass
- [ ] Documentation updated (action-queue.md, offline-support.md)
- [ ] No console errors

---

_Created: 2025-12-20_
