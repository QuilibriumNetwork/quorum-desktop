---
type: task
title: "Test thread mention notifications feature"
status: on-hold
complexity: low
ai_generated: true
created: 2026-03-14
updated: 2026-03-14
related_tasks:
  - "tasks/2026-03-14-thread-mention-notifications-plan.md"
related_docs:
  - "docs/features/messages/thread-panel.md"
  - "docs/features/mention-notification-system.md"
---

# Test thread mention notifications feature

> **Warning: AI-Generated**: May contain errors. Verify before use.

**Files**:
- `src/db/messages.ts` — thread_read_times store + CRUD methods
- `src/hooks/business/conversations/useUpdateThreadReadTime.ts`
- `src/hooks/business/mentions/useAllMentions.ts`
- `src/hooks/business/mentions/useChannelMentionCounts.ts`
- `src/hooks/business/mentions/useSpaceMentionCounts.ts`
- `src/hooks/business/replies/useAllReplies.ts`
- `src/hooks/business/replies/useReplyNotificationCounts.ts`
- `src/hooks/business/replies/useSpaceReplyCounts.ts`
- `src/components/notifications/NotificationItem.tsx`
- `src/components/notifications/NotificationPanel.tsx`
- `src/components/thread/ThreadPanel.tsx`
- `src/components/navbar/NavMenu.tsx`

## What & Why

Thread mention notifications were fully implemented (see plan task) but could not be manually tested because notification sync is currently broken for all notification types (not just threads). Once sync issues are resolved, this feature needs end-to-end verification to confirm it works correctly in production.

## Blocker

Regular (non-thread) notifications are also not landing in the NotificationPanel, indicating a sync-level issue unrelated to the thread notification code. This task should be unblocked once sync is working again.

## Test Plan

- [ ] **Verify thread mentions appear in NotificationPanel**
  1. Open the app with two accounts
  2. In Account A, create a thread on a message in a channel
  3. In Account B, open the same thread and type a message with `@AccountA`
  4. In Account A, check the Notification Panel — the mention should appear with `channel › Thread` breadcrumb

- [ ] **Verify thread mention persists when opening channel**
  1. After receiving a thread mention, navigate away from the channel
  2. Navigate back to the channel — the mention should still be in the panel
  3. The channel bubble count should still show the thread mention

- [ ] **Verify thread mention clears when opening the thread**
  1. Click the thread mention in the NotificationPanel — it should navigate to the thread and scroll to the message
  2. Wait 2+ seconds in the thread
  3. Close the notification panel and reopen — the mention should be gone
  4. The channel bubble count should have decremented

- [ ] **Verify "Mark All as Read" clears thread mentions**
  1. Receive a new thread mention
  2. Right-click the space icon → "Mark All as Read"
  3. The thread mention should be cleared from the NotificationPanel

- [ ] **Verify regular (non-thread) mentions still work**
  1. Send a regular @mention in a channel (not in a thread)
  2. Confirm it appears in the NotificationPanel as before (no `› Thread` breadcrumb)
  3. Confirm clicking it navigates to the message in the channel (not a thread)

## Definition of Done
- [ ] All test plan items pass
- [ ] No regressions in existing notification behavior
- [ ] No console errors related to thread read times

---

_Created: 2026-03-14_
