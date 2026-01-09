---
type: task
title: Extend Desktop Notifications to Space Mentions and Replies
status: done
complexity: low
ai_generated: true
created: 2026-01-04T00:00:00.000Z
updated: '2026-01-09'
---

# Extend Desktop Notifications to Space Mentions and Replies

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent


**Files**:
- `src/services/MessageService.ts:~3573` (after saveMessage in space path)
- `src/utils/mentionUtils.ts` (existing, no changes needed)

## What & Why

**Current state**: Desktop notifications only trigger for DM posts from other users. Users receive no desktop notifications when they are @mentioned or replied to in spaces, even though they have per-space notification preferences configured in Space Settings.

**Desired state**: Desktop notifications should also trigger for:
- @you mentions in spaces (when enabled in user's space settings)
- @everyone mentions in spaces (when enabled)
- @role mentions in spaces (when enabled and user has the role)
- Replies to user's messages in spaces (when enabled)

**Value**: Users won't miss important mentions and replies in spaces when the app is backgrounded, completing the notification system that already has UI settings in place.

## Context

- **Existing pattern**: DM notification increment at `MessageService.ts:3541-3546` - follow this exact pattern
- **Mention detection**: `isMentionedWithSettings()` in `src/utils/mentionUtils.ts` (reuse, don't modify)
- **Reply detection**: `decryptedContent.replyMetadata?.parentAuthor`
- **Settings storage**: IndexedDB `user_config.notificationSettings[spaceId]`
- **Related task**: Completed: `.agents/tasks/.done/fix-false-desktop-notifications-background-tab.md`

---

## Implementation

### Single Change: Add Space Notification Check

**Location**: `src/services/MessageService.ts` after line ~3573 (after `saveMessage` in the space message `else` block)

- [ ] **Add import for mention detection** (top of file)
    ```typescript
    import { isMentionedWithSettings } from '../utils/mentionUtils';
    ```

- [ ] **Add space notification check** (after `saveMessage` in space path, ~line 3573)
    ```typescript
    // Check if this space message should trigger a desktop notification
    if (
      decryptedContent?.content?.type === 'post' &&
      decryptedContent.content.senderId !== self_address
    ) {
      const spaceId = conversationId.split('/')[0];
      const config = await this.messageDB.getUserConfig({ address: self_address });
      const settings = config?.notificationSettings?.[spaceId];

      // Don't notify if space is muted
      if (settings?.isMuted !== true) {
        const enabledTypes = settings?.enabledNotificationTypes ??
          ['mention-you', 'mention-everyone', 'mention-roles', 'reply'];

        // Get user's roles for @role mention checking
        const spaceMember = await this.messageDB.getSpaceMember(spaceId, self_address);
        const userRoles = spaceMember?.roleIds ?? [];

        // Check for mentions
        const isMentioned = isMentionedWithSettings(decryptedContent, {
          userAddress: self_address,
          enabledTypes,
          userRoles,
        });

        // Check for reply to user's message
        const isReplyToMe = enabledTypes.includes('reply') &&
          decryptedContent.replyMetadata?.parentAuthor === self_address;

        if (isMentioned || isReplyToMe) {
          notificationService.incrementPendingNotificationCount();
        }
      }
    }
    ```
    - Done when: Space mentions/replies increment the notification counter
    - Reference: Follows exact pattern from DM notification at lines 3541-3546

- [ ] **Verify SpaceMember type has roleIds**
    - Check `src/db/messages.ts` or types to confirm `SpaceMember` includes `roleIds: string[]`
    - If not, may need to load roles differently

---

## Verification

✅ **@you mention triggers notification**
   - Test: Background app → another user sends "@yourname hello" in space → notification appears
   - Test: Disable @you in space settings → no notification

✅ **@everyone mention triggers notification**
   - Test: Background app → "@everyone announcement" in space → notification appears
   - Test: Disable @everyone in space settings → no notification

✅ **@role mention triggers notification**
   - Test: Background app → "@admin please help" (you have admin role) → notification appears
   - Test: "@admin" when you don't have admin role → no notification

✅ **Reply to your message triggers notification**
   - Test: Background app → someone replies to your message → notification appears
   - Test: Disable replies in space settings → no notification

✅ **Muted space respects setting**
   - Test: Mute space in settings → @mention → no notification

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority |
|----------|-------------------|--------|----------|
| Space is muted | No notifications | ⚙️ Handled in code | P0 |
| Settings not loaded | Use defaults (all enabled) | ⚙️ Handled in code | P1 |
| User has no roles | @role mentions don't match | ✅ Already works | P1 |
| Multiple mentions in one message | Count as 1 notification | ✅ Already works | P2 |

---

## Definition of Done

- [ ] Import added for `isMentionedWithSettings`
- [ ] Space notification check added after saveMessage
- [ ] TypeScript compiles without errors
- [ ] All verification tests pass
- [ ] Desktop notifications doc updated (`.agents/docs/features/desktop-notifications.md`)

---

## Future Enhancement: Global Notification Categories

If granular global controls are needed in UserSettingsModal (DMs on/off, Mentions on/off, Replies on/off), add a simple check:

```typescript
// In NotificationService
public areMentionNotificationsEnabled(): boolean {
  return this.globalSettings?.mentions !== false;
}

// In MessageService, before incrementing
if (notificationService.areMentionNotificationsEnabled() && (isMentioned || isReplyToMe)) {
  notificationService.incrementPendingNotificationCount();
}
```

This is ~2 lines when needed, not now.

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2026-01-04 - Claude**: Initial task creation
**2026-01-04 - Claude**: Simplified after feature-analyzer review - removed over-engineering (shouldNotifyForType abstraction, settings caching). Now follows DM pattern exactly with ~20 lines inline.
