---
type: report
title: Web-to-Native Feature Sync Compatibility Analysis
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Web-to-Native Feature Sync Compatibility Analysis

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Status Update

> ✅ **CONFIRMED: Native app preserves unknown fields during serialization.**
>
> **Data loss is NOT a concern.** All web-only fields (bookmarks, notification settings, channel properties, etc.) will be preserved when native app syncs.

---

## Executive Summary

This report analyzes features implemented in the web app that are not yet available in the native app. Since native app preserves unknown fields, **the primary concern is now behavior enforcement**, not data preservation.

### The Core Issue: Data Preservation ≠ Behavior Enforcement

| Concern | Status |
|---------|--------|
| **Data Loss** | ✅ Resolved - Native preserves unknown fields |
| **Behavior Enforcement** | ⚠️ **Gap exists** - Native won't enforce web-only permissions |

### Priority: Permission-Based Features Need Native Implementation

Permission-based features create **security gaps** if native doesn't enforce them. These should be prioritized for native implementation:

| Feature | Security Impact | Risk |
|---------|----------------|------|
| **Read-Only Channels** | Users can bypass posting restrictions | 🔴 HIGH |
| **Manager Roles** | Low risk if isReadOnly is implemented - just reduced functionality | 🟢 LOW |
| **@everyone Permission** | Low risk - native can't trigger notifications without mention metadata | 🟢 LOW |
| **Message Pin Permission** | Low risk - native can't pin without implementing the feature | 🟢 LOW |
| **User Kick Permission** | Low risk - native only allows owner to kick (more restrictive) | 🟢 LOW |
| **Message Delete Permission** | Already existed in develop - native should have this | 🟢 LOW |

---

## Permission-Based Behaviors Requiring Native Implementation

### 1. Read-Only Channels (`isReadOnly`, `managerRoleIds`)

**Security Risk**: 🔴 **HIGH** - Users can bypass posting restrictions

**How it works on web** (`src/utils/channelPermissions.ts`):
```typescript
canPostMessage(): boolean {
  // Space owners can post anywhere
  if (isSpaceOwner) return true;

  // Read-only channels: ONLY managers can post
  if (channel?.isReadOnly) {
    return this.isReadOnlyChannelManager();
  }

  // Regular channels: Everyone can post
  return true;
}
```

**Enforcement points**:
- `src/components/space/Channel.tsx` - Hides composer for non-managers
- `src/services/MessageService.ts` - Validates before sending

**Gap on native**: If native doesn't check `isReadOnly`, users can post to "announcements-only" channels.

**Minimum implementation needed**: Just check `channel.isReadOnly` and only allow space owner to post. Manager roles (`managerRoleIds`) can be added later - without it, native is simply more restrictive (only owner can post), which is safe.

---

### 2. @everyone Mention Permission (`mention:everyone`)

**Security Risk**: 🟢 **LOW** - No real spam risk

**How it works on web** (`src/services/MessageService.ts:2798`):
```typescript
// Check if user has permission to use @everyone
hasPermission(selfAddress, 'mention:everyone', space, isSpaceOwner)
```

**Enforcement points**:
- `src/hooks/business/mentions/useMentionInput.ts` - Controls autocomplete visibility
- `src/components/space/Channel.tsx:1045` - Checks permission before allowing
- `src/services/MessageService.ts` - Validates and sets `message.mentions.everyone = true`

**Why low risk on native**: If native doesn't implement mention parsing, typing `@everyone` is just plain text. Notifications only fire when `message.mentions.everyone === true` in the message metadata - not based on raw text content. Native can't set this metadata without implementing the mention system.

---

### 3. Message Pin Permission (`message:pin`)

**Security Risk**: 🟢 **LOW** - Feature not available on native

**How it works on web** (`src/utils/channelPermissions.ts`):
```typescript
canPinMessage(message: MessageType): boolean {
  if (isSpaceOwner) return true;

  if (channel?.isReadOnly) {
    return this.isReadOnlyChannelManager();
  }

  return this.hasTraditionalRolePermission('message:pin');
}
```

**Enforcement points**:
- `src/components/message/MessageActions.tsx` - Conditionally shows pin button
- `src/hooks/business/messages/usePinnedMessages.ts` - Validates before pinning

**Why low risk on native**: The pinned messages feature doesn't exist on native. Users can't pin/unpin messages without the feature being implemented. When native implements pinning, they should also implement the permission check.

---

### 4. User Kick Permission (`user:kick`)

**Security Risk**: 🟢 **LOW** - Native is more restrictive

**How it works on web** (`src/utils/channelPermissions.ts`):
```typescript
canKickUser(): boolean {
  if (isSpaceOwner) return true;

  // Read-only channel managers do NOT get kick permissions
  return this.hasTraditionalRolePermission('user:kick');
}
```

**Enforcement points**:
- `src/components/user/UserProfile.tsx:203` - Conditionally shows kick button
- `src/services/SpaceService.ts:664` - Validates before kicking

**Why low risk**: Native only allows space owners to kick. Web adds role-based kick permissions (`user:kick`). This means native is MORE restrictive - users with the kick role permission simply can't use it on native. This is acceptable graceful degradation, not a security gap.

---

### 5. Message Delete Permission (`message:delete`)

**Security Risk**: 🟢 **LOW** - Already existed in develop branch

**How it works on web** (`src/utils/channelPermissions.ts`):
```typescript
canDeleteMessage(message: MessageType): boolean {
  // Users can always delete their own messages
  if (message.content.senderId === userAddress) return true;

  if (isSpaceOwner) return true;

  if (channel?.isReadOnly) {
    return this.isReadOnlyChannelManager();
  }

  return this.hasTraditionalRolePermission('message:delete');
}
```

**Enforcement points**:
- `src/components/message/MessageActions.tsx` - Conditionally shows delete button
- `src/hooks/business/messages/useMessageActions.ts` - Validates before deletion

**Why low risk on native**: The `message:delete` permission type already existed in the develop branch. Native should already have this permission check implemented.

---

## New Permission Types (Not in develop branch)

The following permission types were added in cross-platform branch:

```typescript
// src/api/quorumApi.ts
export type Permission =
  | 'message:delete'    // Existed in develop
  | 'message:pin'       // NEW
  | 'user:kick'         // NEW
  | 'mention:everyone'; // NEW
```

**Native team needs to implement checks for all these permission types.**

---

## New Channel/Group Properties (Not in develop branch)

These fields exist in web but not in develop (and likely not native):

### Channel Properties
| Field | Purpose | Enforcement Needed? |
|-------|---------|---------------------|
| `isReadOnly` | Restrict posting to managers | ✅ YES - Security critical |
| `managerRoleIds` | Define who can post in read-only | ✅ YES - Security critical |
| `isPinned` | Pin channel to top of list | ❌ No - UI only |
| `pinnedAt` | Ordering for pinned channels | ❌ No - UI only |
| `icon` | Custom channel icon | ❌ No - UI only |
| `iconColor` | Custom icon color | ❌ No - UI only |

### Group Properties
| Field | Purpose | Enforcement Needed? |
|-------|---------|---------------------|
| `icon` | Custom group icon | ❌ No - UI only |
| `iconColor` | Custom icon color | ❌ No - UI only |

### Space Properties
| Field | Purpose | Enforcement Needed? |
|-------|---------|---------------------|
| `description` | Space description text | ❌ No - UI only |
| `saveEditHistory` | Track message edit history | ❌ No - UI only |

### Role Properties
| Field | Purpose | Enforcement Needed? |
|-------|---------|---------------------|
| `isPublic` | Hide role in user profiles | ❌ No - UI only |

### UserConfig Properties
| Field | Purpose | Enforcement Needed? |
|-------|---------|---------------------|
| `bookmarks` | Saved messages | ❌ No - UI only |
| `deletedBookmarkIds` | Sync tombstones | ❌ No - UI only |
| `notificationSettings` | Per-space notification prefs | ❌ No - UI only |

---

## Recommendations

### Priority 1: Security-Critical (Implement ASAP)

1. **Read-Only Channel Enforcement** (minimum implementation)
   - Check `channel.isReadOnly` before allowing message submission
   - If `isReadOnly === true`, only allow space owner to post
   - Manager roles (`managerRoleIds`) can be added later as enhancement
   - Files to reference: `src/utils/channelPermissions.ts`

### Priority 2: Low Risk / UI Features (Can Wait)

These are display-only, already implemented, more restrictive on native, or features not available on native:

**Already in develop (native should have):**
- `message:delete` permission - Already existed in develop branch

**More restrictive on native (safe):**
- **User kick permission** - Native only allows owners to kick; web adds role-based kick
- **Manager roles for read-only channels** - If isReadOnly implemented, native only allows owner; web adds manager roles

**Features not available on native (can't be abused):**
- **@everyone permission** - Native can't trigger notifications without implementing mentions
- **Message pinning permission** - Native can't pin without implementing the feature

**UI-only features (no security impact):**
- Channel/Group icons and colors
- Channel pinning (pin to top)
- Space description
- Bookmarks
- Notification settings
- Role visibility (isPublic)

---

## Key Files for Native Team Reference

### Permission System
- `src/utils/permissions.ts` - Basic permission checks
- `src/utils/channelPermissions.ts` - **Full permission system with read-only channel support**
- `src/api/quorumApi.ts` - Type definitions including Permission type

### Enforcement Points
- `src/services/MessageService.ts` - Message submission validation
- `src/services/SpaceService.ts` - User kick validation
- `src/hooks/business/mentions/useMentionInput.ts` - @everyone permission check

### UI Components (for reference)
- `src/components/space/Channel.tsx` - Read-only channel UI
- `src/components/message/MessageActions.tsx` - Action button visibility
- `src/components/user/UserProfile.tsx` - Kick button visibility

---

## Related Documentation

- [Read-Only Channels System](../docs/space-permissions/read-only-channels-system.md)
- [Space Roles System](../docs/space-permissions/space-roles-system.md)
- [Space Permissions Architecture](../docs/space-permissions/space-permissions-architecture.md)
- [Mention Notification System](../docs/features/mention-notification-system.md)
- [Pinned Messages Feature](../docs/features/messages/pinned-messages.md)
- [Bookmarks Feature](../docs/features/messages/bookmarks.md)

---


_Report Type: Compatibility Analysis / Security Gap Assessment_
