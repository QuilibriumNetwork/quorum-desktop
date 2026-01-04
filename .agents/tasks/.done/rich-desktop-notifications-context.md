# Add Context to Desktop Notifications

> **Reviewed by**: feature-analyzer agent (4 passes) + manual code review

**Status**: Pending
**Complexity**: Medium
**Created**: 2026-01-04
**Files**:
- `src/services/NotificationService.ts:220-238` (pending count methods)
- `src/services/MessageService.ts:3542-3549` (DM path)
- `src/services/MessageService.ts:3578-3613` (space path - **already has mention/reply detection**)
- `src/components/context/WebsocketProvider.tsx:118-122`

## What & Why

**Current state**: All desktop notifications show the same generic message: "You have a new unread message" - users can't tell if it's a DM, mention, or reply.

**Desired state**: Notifications should show contextual information:
- DM: "New message from Alice"
- @you mention: "Bob mentioned you in Space Name"
- @everyone mention: "Bob mentioned @everyone in Space Name"
- @role mention: "Bob mentioned @Admins in Space Name"
- Reply: "Carol replied to your message in Space Name"

**Value**: Users can prioritize notifications - @you is more urgent than @everyone, @role gives context about topic.

## Context

- **Current implementation**: `showUnreadMessagesNotification(count)` in `NotificationService.ts:94-130`
- **Privacy**: No message content, only sender name and location
- **Constraint**: Must work with existing 5-second throttle
- **Simplification**: Use count + latest metadata (not array) per feature-analyzer recommendation
- **Role mentions**: Already working via `isMentionedWithSettings()` at MessageService.ts:3599

---

## Implementation

### Phase 1: Define Notification Types

- [ ] **Add notification metadata type** (`src/services/NotificationService.ts`)
    ```typescript
    export type NotificationMetadata = {
      type: 'dm' | 'mention' | 'reply';
      senderName: string;
      spaceName?: string;
      mentionType?: 'user' | 'role' | 'everyone';  // Excludes null from MentionType
      roleName?: string;          // Only for mentionType='role'
    };
    ```
    - Done when: Type is **exported** and importable
    - Note: `mentionType` uses 'user' (displays as "@you"), 'role', or 'everyone'
    - **Important**: Must use `export type` to ensure it's accessible from MessageService

- [ ] **Update pending notification tracking** (`src/services/NotificationService.ts`)
    Use count + latest metadata (simpler than array):
    ```typescript
    private pendingNotificationCount = 0;
    private latestNotification: NotificationMetadata | null = null;

    public resetPendingNotificationCount(): void {
      this.pendingNotificationCount = 0;
      this.latestNotification = null;
    }

    public addPendingNotification(metadata: NotificationMetadata): void {
      this.pendingNotificationCount++;
      this.latestNotification = metadata;
    }

    public getPendingNotificationData(): { count: number; metadata: NotificationMetadata | null } {
      return { count: this.pendingNotificationCount, metadata: this.latestNotification };
    }
    ```
    - Done when: NotificationService tracks count + latest metadata

### Phase 2: Pass Metadata from MessageService

> **Note**: Commit 413fb69 (DM mute feature) already added the space mention/reply detection logic
> at lines 3578-3613. This phase enhances that existing code to pass metadata.
>
> **Design Decision**: Mention type detection is inlined at the call site rather than creating
> a separate helper function. This avoids duplicating logic already in `isMentionedWithSettings()`.

- [ ] **Update DM notification call** (`src/services/MessageService.ts:3548`)
    ```typescript
    // Current (line 3548):
    notificationService.incrementPendingNotificationCount();

    // Change to (profileToUse is already computed with fallback at line 3529):
    const senderDisplayName = profileToUse.display_name ?? t`Unknown`;
    notificationService.addPendingNotification({
      type: 'dm',
      senderName: senderDisplayName,
    });
    ```
    - Done when: DM notifications include sender name
    - Note: `profileToUse` is defined at line 3529 with fallback chain already applied

- [ ] **Update space notification call** (`src/services/MessageService.ts:3609-3611`)
    ```typescript
    // Current (lines 3609-3611):
    if (isMentioned || isReplyToMe) {
      notificationService.incrementPendingNotificationCount();
    }

    // Change to (inline mention type detection - mirrors isMentionedWithSettings logic):
    if (isMentioned || isReplyToMe) {
      // Get sender name
      const member = await this.messageDB.getSpaceMember(spaceId, decryptedContent.content.senderId);
      const senderName = member?.display_name ?? t`Someone`;

      // Determine mention type inline (priority: user > role > everyone)
      let mentionType: 'user' | 'role' | 'everyone' | undefined;
      let roleName: string | undefined;

      if (isMentioned) {
        const mentions = decryptedContent.mentions;
        if (mentions?.memberIds?.includes(self_address)) {
          mentionType = 'user';
        } else if (mentions?.roleIds && userRoles.length > 0) {
          const matchedRoleId = userRoles.find(roleId =>
            mentions.roleIds?.includes(roleId)
          );
          if (matchedRoleId) {
            mentionType = 'role';
            const role = space?.roles?.find(r => r.roleId === matchedRoleId);
            roleName = role?.displayName ?? role?.roleTag ?? t`a role`;
          }
        } else if (mentions?.everyone === true) {
          mentionType = 'everyone';
        }
      }

      notificationService.addPendingNotification({
        type: isMentioned ? 'mention' : 'reply',
        senderName,
        spaceName: space?.spaceName ?? t`a space`,
        mentionType,
        roleName,
      });
    }
    ```
    - Done when: Space notifications include mention type and role name
    - Note: Reuses `space` object already fetched at line 3593, `isMentioned`/`isReplyToMe`/`userRoles` already exist

### Phase 3: Update Notification Display

- [ ] **Add contextual notification method** (`src/services/NotificationService.ts`)
    ```typescript
    public showContextualNotification(
      count: number,
      metadata: NotificationMetadata | null
    ): Notification | null {
      if (!this.canShowNotifications() || count === 0 || !metadata) return null;

      const body = this.formatNotificationBody(count, metadata);
      const options: any = {
        body,
        tag: 'quorum-unread-messages',
        requireInteraction: false,
        silent: false,
      };

      if (!this.isSafari()) {
        options.icon = this.quorumIcon;
      }

      try {
        const notification = new Notification('Quorum', options);

        setTimeout(() => {
          notification.close();
        }, 5000);

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return notification;
      } catch (error) {
        console.error(t`Error showing notification:`, error);
        return null;
      }
    }

    private formatNotificationBody(count: number, metadata: NotificationMetadata): string {
      if (count === 1) {
        if (metadata.type === 'dm') {
          return t`New message from ${metadata.senderName}`;
        }
        if (metadata.type === 'mention') {
          if (metadata.mentionType === 'user') {
            return t`${metadata.senderName} mentioned you in ${metadata.spaceName}`;
          }
          if (metadata.mentionType === 'everyone') {
            return t`${metadata.senderName} mentioned @everyone in ${metadata.spaceName}`;
          }
          if (metadata.mentionType === 'role') {
            return t`${metadata.senderName} mentioned @${metadata.roleName} in ${metadata.spaceName}`;
          }
        }
        if (metadata.type === 'reply') {
          return t`${metadata.senderName} replied to your message in ${metadata.spaceName}`;
        }
      }

      // Multiple notifications - show count with most recent context
      return t`${count} new notifications`;
    }
    ```
    - Done when: Notifications show contextual messages by type

- [ ] **Update WebsocketProvider** (`src/components/context/WebsocketProvider.tsx:118-122`)
    ```typescript
    // Current:
    const notificationCount = notificationService.getPendingNotificationCount();
    if (notificationCount > 0) {
      showNotificationForNewMessages(notificationCount);
    }

    // Change to:
    const { count, metadata } = notificationService.getPendingNotificationData();
    if (count > 0) {
      notificationService.showContextualNotification(count, metadata);
    }
    ```
    - Done when: WebsocketProvider uses new contextual method

---

## Verification

- [ ] **DM notification shows sender name**
   - Test: Background app -> receive DM from "Alice" -> "New message from Alice"

- [ ] **@you mention shows correct message**
   - Test: Background app -> someone @mentions you -> "Bob mentioned you in Space Name"

- [ ] **@everyone mention shows correct message**
   - Test: Background app -> someone sends @everyone -> "Bob mentioned @everyone in Space Name"

- [ ] **@role mention shows role name**
   - Test: Background app -> someone @mentions your role -> "Bob mentioned @Admins in Space Name"

- [ ] **Reply notification shows context**
   - Test: Background app -> someone replies -> "Carol replied to your message in Space Name"

- [ ] **TypeScript compiles**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority |
|----------|-------------------|--------|----------|
| Sender name missing | Show "Someone" fallback | Handle in code | P0 |
| Space name missing | Show "a space" fallback | Handle in code | P0 |
| Role name missing | Show "a role" fallback | Handle in code | P0 |
| Multiple notifications | Show count + "new notifications" | Handle in code | P1 |
| Multiple mention types in one message | Priority: user > role > everyone | Handle in code | P1 |

---

## Definition of Done

- [ ] All Phase 1-3 checkboxes complete
- [ ] TypeScript compiles without errors
- [ ] All verification tests pass
- [ ] Fallbacks work for missing data
- [ ] Notifications are i18n-ready (use Lingui `t` macro)
- [ ] Desktop notifications doc updated

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2026-01-04 - Claude**: Initial task creation

**2026-01-04 - Claude**: Updated based on feature-analyzer review:
- Simplified from array to count + latest metadata
- Fixed incorrect field names (spaceName not name, senderId not senderName)
- Added getMentionType function for granular mention types
- Added distinct messages for @you, @everyone, @role mentions
- Added space name to reply notifications for context

**2026-01-04 - Claude**: Second feature-analyzer review - critical fixes:
- Added Phase 0 prerequisite: uncomment role detection in existing `getMentionType()`
- Fixed MentionType to use existing type from mentionUtils.ts ('user' not 'you')
- Renamed new function to `getMentionDetails()` to avoid conflict with existing `getMentionType()`
- Fixed DM sender name access pattern (use `updatedUserProfile` in scope)
- Reuse `space` object already fetched, avoid duplicate DB queries
- Added role name fallback `t'a role'`
- Added edge case: multiple mention types in single message (priority order)

**2026-01-04 - Claude**: Updated after commit 413fb69 (DM mute feature):
- Space mention/reply notification detection already implemented at MessageService.ts:3578-3613
- Updated line numbers: DM path now 3548, space path now 3609-3611
- Phase 3 now enhances existing code rather than adding new detection logic
- Note: `isMentioned`, `isReplyToMe`, `userRoles`, `space` variables already exist in scope

**2026-01-04 - Claude**: Third feature-analyzer review - corrections:
- Fixed Phase 0 line numbers: 110-115 (not 109-115)
- Added explicit import step for `getMentionDetails` in Phase 3
- Added dependency note: Phase 3 requires Phase 2 completion
- Added emphasis on `export type` for NotificationMetadata
- Verified: `resetPendingNotificationCount()` is already called at WebsocketProvider.tsx:99
- Verified all variable scopes are correct (conversation, profileToUse, space, userRoles, etc.)

**2026-01-04 - Claude**: Fourth pass (manual review + feature-analyzer validation):
- **Removed Phase 0**: `getMentionType()` is not used in notification flow; role detection already works via `isMentionedWithSettings()`
- **Removed Phase 2 (getMentionDetails function)**: Eliminated code duplication; inline mention type detection at call site instead
- **Fixed NotificationMetadata type**: Changed `mentionType?: MentionType` to `mentionType?: 'user' | 'role' | 'everyone'` to avoid double-optional (undefined | null)
- **Simplified DM sender name**: `profileToUse.display_name ?? t'Unknown'` instead of redundant fallback chain (profileToUse already has fallback applied)
- **Renumbered phases**: Now Phase 1 (types), Phase 2 (MessageService), Phase 3 (display)
- **Updated Definition of Done**: Now references Phase 1-3 (was 0-4)
