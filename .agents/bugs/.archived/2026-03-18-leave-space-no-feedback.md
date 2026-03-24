---
type: bug
title: "Leave Space - No Loading Feedback and UI Not Refreshing"
status: archived
priority: low
tags: [UX, space-management]
ai_generated: true
created: 2026-03-18
updated: 2026-03-19
archived: 2026-03-19
archive_reason: "Symptom 1 (no loading feedback) is not reproducible — the leave operation completes fast enough that loading feedback is unnecessary. Symptom 2 (UI not refreshing / stale sidebar) may be a deeper sync/delivery issue but was not consistently reproduced. Re-open if the slow leave or stale UI issues resurface with real data."
---

# Leave Space - No Loading Feedback and UI Not Refreshing

> **Warning AI-Generated**: May contain errors. Verify before use.

## Status: Archived

**2026-03-19**: Investigated and attempted fix. The loading feedback issue (symptom 1) turned out to be a non-problem — the leave operation completes quickly and the UX is acceptable without a spinner. We attempted two approaches (adding `isLeaving` state to the hook + `ModalSaveOverlay`) but neither was needed since the operation is fast.

The UI-not-refreshing issue (symptom 2) was observed once on 2026-03-18 but could not be consistently reproduced. It may be related to the fire-and-forget outbound message queue or stale React Query cache, but needs more investigation if it resurfaces.

**Note for future**: The Button primitive does NOT have a `loading` prop. For modal loading feedback, use `ModalSaveOverlay` + `useModalSaveState` hook (see KickUserModal for reference).

## Original Symptoms

1. **No loading feedback**: Clicking the "Leave Space" button (after confirmation click) shows no visual indicator that the operation is in progress.

2. **UI doesn't refresh after leaving**: After the leave operation completes, the user is navigated to `/messages` but:
   - The space may still appear in the sidebar until a manual page refresh
   - No "user X left" system message appears in the space chat for other members
   - The leaving user still appears in the channel member list for other members

## Key Files
- [useSpaceLeaving.ts](src/hooks/business/spaces/useSpaceLeaving.ts) - Leave space hook
- [LeaveSpaceModal.tsx](src/components/modals/LeaveSpaceModal.tsx) - Leave space modal
- `src/services/SpaceService.ts` - `deleteSpace()` method with fire-and-forget outbound

---
_Created: 2026-03-18_
_Archived: 2026-03-19_
