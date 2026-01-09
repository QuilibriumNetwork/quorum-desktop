---
type: bug
title: Channel/Group Save Race Condition
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# Channel/Group Save Race Condition

## Issue
Channel and Group settings changes were non-deterministic - sometimes visible only after refresh, sometimes not saving at all.

## Root Cause
1. `updateSpace()` calls in `useChannelManagement` and `useGroupManagement` hooks were not awaited
2. Modal used `saveWithTimeout` which closed after fixed 3 seconds regardless of actual save completion
3. This created a race condition where modal could close before save/cache invalidation completed

## Solution
1. Added `await` before all `updateSpace()` calls in both hooks
2. Changed from `saveWithTimeout` to `saveUntilComplete` in both editors
3. Added 10-second maxTimeout as failsafe (instead of default 30s)

## Files Modified
- `/src/hooks/business/channels/useChannelManagement.ts` - Added await to updateSpace calls
- `/src/hooks/business/channels/useGroupManagement.ts` - Added await to updateSpace calls
- `/src/components/space/ChannelEditor.tsx` - Changed to saveUntilComplete with 10s timeout
- `/src/components/space/GroupEditor.tsx` - Changed to saveUntilComplete with 10s timeout

## Result
Modal now closes only when save actually completes, ensuring UI shows updated data immediately.

---
*Fixed: 2025-01-17*
