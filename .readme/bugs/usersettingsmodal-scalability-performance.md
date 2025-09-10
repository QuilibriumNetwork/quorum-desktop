# Performance Issue: UserSettingsModal Save Times Scale Poorly with Number of Spaces

Added to Github Issues: https://github.com/QuilibriumNetwork/quorum-desktop/issues/65

## Problem Summary

The UserSettingsModal save operation has fundamental scalability issues that make it unusable for users with many spaces. While recent optimizations improved the situation, the core architectural problems remain and will cause severe performance degradation as users join more spaces.

## Current Performance Issues

### 1. Database Queries Scale Linearly O(n)
Every profile save executes database queries proportional to the number of spaces:
- Each space requires 2 database calls: `getSpaceKeys()` + `getEncryptionStates()`  
- User with 30 spaces = 60 database queries per save
- Even with parallel execution, this creates significant I/O overhead

### 2. Payload Size Grows with Space Count
The encrypted user config includes ALL space keys and encryption states:
- More spaces = larger JSON payload
- Larger payload = slower encryption + network transmission
- Exponential growth in memory usage

### 3. API Bottleneck Gets Worse
The `postUserSettings` API call currently takes 7-8 seconds (as noted in commit f4000e58). This scales poorly:
- Current (4 spaces): ~8 seconds total
- Projected (30 spaces): ~25-30 seconds total

### 4. All-or-Nothing Sync Model
Currently, ANY profile change forces a complete re-sync of ALL space data, regardless of what actually changed.

## Code Location

**File:** `src/components/context/MessageDB.tsx:5252-5269`

```typescript
const spaces = await messageDB.getSpaces();

// Fetch all space keys and encryption states in parallel
const spaceKeysPromises = spaces.map(async (space) => {
  const [keys, encryptionState] = await Promise.all([
    messageDB.getSpaceKeys(space.spaceId),
    messageDB.getEncryptionStates({
      conversationId: space.spaceId + '/' + space.spaceId,
    })
  ]);
  return {
    spaceId: space.spaceId,
    encryptionState: encryptionState[0],
    keys: keys,
  };
});

config.spaceKeys = await Promise.all(spaceKeysPromises);
```

## Performance Timeline

This issue has existed since the very beginning of the project:

- **January 19, 2025** (commit 43f3fa4d): Initial public commit - sequential spaceKeys processing included from day one
- **September 9, 2025** (commit f4000e58): Parallel processing implemented - partial improvement

## Impact Assessment

### Current Impact (4-6 spaces)
- Save times: ~8 seconds
- Acceptable but noticeable delay

### Projected Impact (10+ spaces)  
- Save times: 12-20+ seconds
- Unusable user experience
- Potential timeouts and failures

### Power User Impact (20+ spaces)
- Save times: 25-30+ seconds  
- Application appears frozen
- Users may abandon profile updates

## Proposed Solutions

### 1. Lazy Loading (Quick Win) 🟡
Only sync spaces that have changed since last sync:
```typescript
const changedSpaces = spaces.filter(space => 
  space.lastModified > config.lastSyncTimestamp
);
```

**Pros:** Easy to implement, immediate improvement  
**Cons:** Still processes all spaces on first sync

### 2. Incremental Sync (Better) 🟠
Separate user profile from space data syncing:
```typescript
// Only sync what actually changed
if (profileChanged) {
  await postUserProfile(profileData);
}
if (spaceKeysChanged) {
  await postUserSpaceKeys(onlyChangedSpaces);
}
```

**Pros:** Scales better, more targeted syncing  
**Cons:** Requires API changes, more complex state tracking

### 3. Background Sync (Best) 🟢
Save profile immediately, sync spaces asynchronously:
```typescript
// Instant user feedback
await saveProfileLocally(config);

// Background sync without blocking UI
backgroundSync.queue(() => syncSpacesToServer(config));
```

**Pros:** Best UX, true scalability  
**Cons:** Most complex, requires offline-first architecture

### 4. Hybrid Approach 🔵
Combine multiple strategies:
- Instant local save + background sync for spaces
- Lazy loading for changed spaces only
- Batch API calls to reduce round trips

## Acceptance Criteria

### Immediate (Next Release)
- [ ] Profile saves complete in <2 seconds regardless of space count
- [ ] Users receive immediate feedback when saving
- [ ] No UI blocking during save operations

### Long-term (Future Releases)  
- [ ] Support for 50+ spaces without performance degradation
- [ ] Offline-capable profile editing
- [ ] Incremental sync with conflict resolution

## Testing Strategy

### Performance Testing
- [ ] Test with 5, 10, 20, 50 spaces
- [ ] Measure save times across different scenarios
- [ ] Monitor memory usage during large syncs

### User Experience Testing  
- [ ] Test with slow network connections
- [ ] Verify save state indicators work correctly
- [ ] Test error handling for failed syncs

## Priority

**High** - This will become a critical blocker as the platform grows and users join more spaces. The current architecture makes the application unusable for power users.

## Related Issues

- Performance optimization in commit f4000e58
- User settings architecture
- API scalability concerns

## Tyler's comment

we need to make a background sync queue. This will be useful for all sorts of actions, including this one.

The importance is to essentially capture the action (and any context) needing to be done and add it to an offline queue, then once it's there the user UI is freed back up for the user to go about as they wish while the activity they submitted happens in the background. There are things to consider, e.g. saving user profile should automatically update first in the local database and then submit (if they have sync enabled) to the remote sync API endpoint.

This queue should be generic enough to be used for almost any actions.

E.g. send a message, save profile, etc.

How this would be done is you'd have a list of valid actions/task types, 'send-message'. You'd save a list of these activities in the DB with a data schema something like:

ID, auto incremented
task type; send-message/delete-message/update-profile/etc.
context; data that goes with each task, message content, message ID, profile info
And then the Queue works through each task in the order they are submitted (top down). It removes tasks after successful completion and sends a toast to the user. If it fails, it toasts the user with the error.

There may be a library for this such that we don't have to re-invent the wheel on this.

---

*Created: 2025-09-09*