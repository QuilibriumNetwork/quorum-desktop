---
type: bug
title: "Leave Space - No Loading Feedback and UI Not Refreshing"
status: open
priority: medium
tags: [UX, space-management]
ai_generated: true
created: 2026-03-18
updated: 2026-03-18
---

# Leave Space - No Loading Feedback and UI Not Refreshing

> **Warning AI-Generated**: May contain errors. Verify before use.

## Symptoms

1. **No loading feedback**: Clicking the "Leave Space" button (after confirmation click) shows no visual indicator that the operation is in progress. The button remains in its normal state for 4-5 seconds while crypto/network operations run in the background. Users don't know if the action worked.

2. **UI doesn't refresh after leaving**: After the leave operation completes, the user is navigated to `/messages` but:
   - The space may still appear in the sidebar until a manual page refresh
   - No "user X left" system message appears in the space chat for other members (may be a sync/data issue rather than a code bug)
   - The leaving user still appears in the channel member list in the sidebar for other members viewing the space

## Root Cause

### No Loading State

The `useSpaceLeaving` hook ([useSpaceLeaving.ts](src/hooks/business/spaces/useSpaceLeaving.ts)) has no `isLoading` state. The `leaveSpace` function at line 26 is async and calls `deleteSpace(spaceId)` (line 59) which performs multiple heavy operations (crypto signing, API calls, DB cleanup), but the hook never exposes a loading indicator.

The `LeaveSpaceModal` component ([LeaveSpaceModal.tsx](src/components/modals/LeaveSpaceModal.tsx)) renders a `Button` with no `loading` prop — it uses a two-step confirmation pattern (click once to arm, click again to confirm) but once confirmed, nothing visual changes.

### UI Not Refreshing

After `deleteSpace` completes, `navigate('/messages')` is called (line 60). The space data is cleaned from IndexedDB and React Query cache inside `SpaceService.deleteSpace()`, but:

- The `enqueueOutbound()` call for broadcasting the leave message to other members is fire-and-forget — it's not awaited, so the leave notification to other space members may not be reliably delivered
- The sidebar space list may retain stale cache data since the navigation happens immediately after `deleteSpace` resolves

### Missing "User Left" Message / Stale Member List

The receiving side of leave messages is handled in `MessageService` which creates a system message and updates member data. If other members don't see the "user left" message or still see the user in the member list, this could be:
- The outbound leave message not being delivered (fire-and-forget queue)
- A sync issue where the hub doesn't broadcast the leave to remaining members
- Corrupted space data preventing proper message processing on the receiving end

**Note**: The code logic for receiving leave messages and creating system messages appears correct. The issue is more likely in the delivery/sync layer than in the message creation logic.

## Solution

### Fix 1: Add Loading State to Leave Flow

Add an `isLeaving` state to `useSpaceLeaving`:

```typescript
// useSpaceLeaving.ts
const [isLeaving, setIsLeaving] = useState(false);

const leaveSpace = useCallback(async (spaceId: string, onSuccess?: () => void) => {
  try {
    setIsLeaving(true);
    setError(null);
    // ... existing logic
  } catch (err) {
    // ... existing error handling
  } finally {
    setIsLeaving(false);
  }
}, [...]);

return { ..., isLeaving };
```

Wire the loading state to the button in `LeaveSpaceModal`:

```tsx
<Button
  type="danger"
  onClick={() => handleLeaveClick(spaceId, onClose)}
  loading={isLeaving}
  disabled={isLeaving}
  hapticFeedback={true}
>
```

### Fix 2: Prevent Modal Close During Operation

Disable modal close while leaving is in progress — either disable the `onClose` callback or keep the modal open with a loading indicator until the operation completes.

### Fix 3: Investigate Leave Message Delivery

Verify that the outbound leave message is actually being sent and received by other members. The fire-and-forget pattern in `SpaceService.deleteSpace()` may need a confirmation mechanism or at minimum a retry.

**Key files:**
- [useSpaceLeaving.ts](src/hooks/business/spaces/useSpaceLeaving.ts) - Hook with no loading state
- [LeaveSpaceModal.tsx](src/components/modals/LeaveSpaceModal.tsx) - Button with no loading indicator
- `src/services/SpaceService.ts` - `deleteSpace()` method with fire-and-forget outbound

## Prevention

- For any async operation triggered by a button click, always expose a loading state from the hook and wire it to the button's `loading`/`disabled` props
- Fire-and-forget patterns for critical operations (like notifying other members of a leave) should have fallback mechanisms or at least logging to detect failures

---
_Created: 2026-03-18_
