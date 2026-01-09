---
type: task
title: Role Mention Notifications Implementation
status: done
complexity: medium
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Role Mention Notifications Implementation

## Overview

Implement role mention notifications to allow users to mention entire roles (e.g., `@moderators`, `@admins`) instead of individual users. Users type `@roleTag` directly or select from autocomplete dropdown. This feature is **50% complete** - the data model, notification infrastructure, and role system are already in place. This task completes the remaining implementation.


**Priority**: Medium

**Feature-Analyzer Review**: ✅ Reviewed and simplified based on user decisions
- Fixed autocomplete pattern conflict (use `@roleTag` without brackets)
- No permission required (simpler, matches Discord)
- Plain text fallback for deleted/invalid roles
- Simplified hook refactor (separate arrays)
- Same styling as @everyone and @you mentions

**Key UX Pattern**: Users type `@roleTag` (e.g., `@moderators`) directly or select from autocomplete dropdown showing both users and roles.

**Format Decision**: Roles use `@roleTag` (NO brackets), Users use `@<address>` (WITH brackets). This avoids autocomplete pattern conflicts and simplifies extraction.

---

## Feature-Analyzer Findings

### Critical Issues Identified & Fixed

**1. Autocomplete Pattern Conflict (BLOCKING BUG)**
- **Problem**: Existing `useMentionInput` hook skips autocomplete for `@<` patterns (line 114-117)
- **Original proposal**: Use `@<roleTag>` format → autocomplete wouldn't show!
- **Fix**: Use `@roleTag` format (no brackets) for roles, keep `@<address>` for users

**2. Permission System Decision**
- **Analysis**: Feature-analyzer recommended permission for spam prevention
- **Decision**: Allow all users to mention any role (no permission needed)
- **Rationale**: Simpler, matches Discord model, role mentions are informational not destructive

**3. Over-Engineered Autocomplete Refactor**
- **Problem**: Union type with optional fields (`user?: User; role?: Role`) error-prone
- **Original proposal**: `MentionOption` with optional discriminated union
- **Fix**: Separate arrays with discriminated union for display only

**4. Deleted/Invalid Role Handling**
- **Analysis**: Feature-analyzer recommended explicit fallback styling
- **Decision**: Don't render deleted/invalid roles, treat as plain text
- **Rationale**: Simpler, cleaner UX - if role doesn't exist, user sees what they typed

### Recommendations Applied

✅ **Simplified autocomplete** - separate `users[]` and `roles[]` arrays
✅ **Format decision: `@roleTag`** (no brackets) - avoids pattern conflict
✅ **No permission required** - simpler, all users can mention roles
✅ **Plain text fallback** - deleted/invalid roles render as plain text
✅ **Mobile testing phase** - separate consideration for React Native
✅ **Consistent styling** - role mentions use same style as @everyone and @you

---

## Current State Analysis

### ✅ Already Implemented

1. **Data Model** (100%)
   - `Mentions.roleIds: string[]` exists in API types (quorumApi.ts:216)
   - `Message.mentions` field properly typed
   - Role type with `roleId`, `displayName`, `roleTag`, `members` (quorumApi.ts:5-12)

2. **Notification Infrastructure** (100%)
   - `NotificationTypeId` includes `'mention-roles'` (types/notifications.ts:21)
   - NotificationPanel has filter option (currently disabled, NotificationPanel.tsx:77-79)
   - `isMentionedWithSettings()` checks role mentions (mentionUtils.ts:155-162)
   - Database methods support filtering by enabled types

3. **Role System** (100%)
   - Full role management in SpaceSettingsModal/Roles.tsx
   - `getUserRoles()` utility to get user's roles (permissions.ts:103-112)
   - `useUserRoleDisplay` hook for role UI display
   - Role data structure includes: `roleId`, `displayName`, `roleTag`, `color`, `members[]`, `permissions[]`
   - Existing permissions: `'message:delete'`, `'message:pin'`, `'user:kick'`, `'mention:everyone'`

4. **Query Infrastructure** (100%)
   - `useChannelMentionCounts` respects enabled types including 'mention-roles'
   - `useAllMentions` supports filtering by 'mention-roles'
   - React Query cache invalidation handles all mention types

### ❌ Not Yet Implemented

1. **Mention Extraction** (0%)
   - `extractMentionsFromText()` doesn't parse `@roleTag` patterns (without brackets)
   - No role lookup during extraction
   - No `mentions.roleIds` population

2. **Permission System** (Not Needed)
   - **DECISION**: No permission required - all users can mention roles
   - Simpler implementation, matches Discord UX
   - Role mentions are informational, not destructive

3. **Mention Rendering** (0%)
   - Web: MessageMarkdownRenderer doesn't style `@role` mentions
   - Mobile: useMessageFormatting doesn't return role mention tokens
   - No visual distinction between role mentions and regular text

4. **User Role Lookup** (0%)
   - Mention hooks don't fetch current user's roleIds
   - `useAllMentions` doesn't pass userRoles to filtering logic
   - Channel.tsx doesn't provide userRoles context

---

## Implementation Plan

### Phase 1: Autocomplete Enhancement (Add Roles to Dropdown)

**Files to modify:**
- `src/hooks/business/mentions/useMentionInput.ts` - Add role filtering
- `src/components/message/MessageComposer.tsx` - Render role items in dropdown

**Context from codebase analysis:**
- Users type `@displayName` → autocomplete shows → selects → inserts `@<address>`
- **Current hook skips autocomplete** for `@<` patterns (line 114-117)
- **NEW**: Add roles to same dropdown, but use different format

**Critical Fix from Feature Analysis:**
- **Users**: `@<address>` (with brackets) - autocomplete SKIPPED for this pattern
- **Roles**: `@roleTag` (NO brackets) - autocomplete SHOWS for this pattern
- This avoids pattern conflict and simplifies the hook

**Tasks:**

1. **Update useMentionInput hook to accept roles (SIMPLIFIED APPROACH)**
   ```typescript
   // useMentionInput.ts

   interface Role {
     roleId: string;
     displayName: string;
     roleTag: string;
     color: string;
   }

   // SIMPLIFIED: Separate arrays, discriminated union for display only
   type DisplayOption =
     | { type: 'user'; data: User }
     | { type: 'role'; data: Role };

   interface UseMentionInputOptions {
     textValue: string;
     cursorPosition: number;
     users: User[];
     roles?: Role[];  // NEW - separate array
     onMentionSelect: (option: DisplayOption, mentionStart: number, mentionEnd: number) => void;
     // ... existing options
   }

   // Keep existing filterUsers, add separate filterRoles
   const filterRoles = useCallback(
     (query: string): Role[] => {
       if (!query || query.length < minQueryLength) return [];
       const queryLower = query.toLowerCase();

       return (roles || []).filter(role => {
         const name = role.displayName.toLowerCase();
         const tag = role.roleTag.toLowerCase();
         return name.includes(queryLower) || tag.includes(queryLower);
       });
     },
     [roles, minQueryLength]
   );

   // Combine for display (NOT stored as single array)
   const filteredUsers = filterUsers(query);
   const filteredRoles = filterRoles(query);

   const displayOptions: DisplayOption[] = [
     ...filteredUsers.map(u => ({ type: 'user' as const, data: u })),
     ...filteredRoles.map(r => ({ type: 'role' as const, data: r }))
   ];

   // Sort combined results by relevance
   const sortedOptions = sortByRelevance(displayOptions, query);
   ```

**Why this is better:**
- ✅ No optional fields (`user?: User` → always `data: User`)
- ✅ Type-safe access (`option.data.address` vs `option.user?.address`)
- ✅ Clear separation of concerns
- ✅ Easier to test independently
- ✅ No breaking changes to existing hook interface

2. **Update MessageComposer to pass roles**
   ```typescript
   // MessageComposer.tsx

   interface MessageComposerProps {
     // ... existing props
     users?: User[];
     roles?: Role[];  // NEW
   }

   const handleMentionSelect = useCallback(
     (option: DisplayOption, mentionStart: number, mentionEnd: number) => {
       let insertText: string;

       if (option.type === 'user') {
         insertText = `@<${option.data.address}>`;  // Users: with brackets
       } else {
         // NEW: Insert role mention WITHOUT brackets
         insertText = `@${option.data.roleTag}`;  // Roles: NO brackets
       }

       const newValue =
         value.substring(0, mentionStart) +
         insertText +
         value.substring(mentionEnd);
       onChange(newValue);

       // Set cursor after mention
       setTimeout(() => {
         const newPosition = mentionStart + insertText.length;
         textareaRef.current?.setSelectionRange(newPosition, newPosition);
       }, 0);
     },
     [value, onChange]
   );

   const mentionInput = useMentionInput({
     textValue: value,
     cursorPosition,
     users,
     roles,  // NEW
     onMentionSelect: handleMentionSelect,
   });
   ```

3. **Update dropdown rendering to show roles**
   ```typescript
   // MessageComposer.tsx - in the mention dropdown JSX

   {dropdownOpen && mentionInput.filteredOptions.length > 0 && (
     <div className="message-composer-mention-dropdown">
       <div className="message-composer-mention-container">
         {mentionInput.filteredOptions.map((option, index) => (
           <div
             key={option.type === 'user' ? option.user.address : option.role.roleId}
             className={`message-composer-mention-item ${
               index === mentionInput.selectedIndex ? 'selected' : ''
             } ${option.type === 'role' ? 'role-item' : 'user-item'}`}
             onClick={() => mentionInput.selectOption(option)}
           >
             {option.type === 'user' ? (
               <>
                 <UserAvatar
                   userIcon={option.user.userIcon}
                   displayName={option.displayName}
                   address={option.user.address}
                   size={32}
                 />
                 <div className="message-composer-mention-info">
                   <span className="message-composer-mention-name">
                     {option.displayName}
                   </span>
                   <span className="message-composer-mention-address">
                     {option.secondaryText}
                   </span>
                 </div>
               </>
             ) : (
               <>
                 {/* NEW: Role item rendering */}
                 <div
                   className="message-composer-role-badge"
                   style={{ backgroundColor: option.role.color }}
                 >
                   <Icon name="users" size="xs" />
                 </div>
                 <div className="message-composer-mention-info">
                   <span className="message-composer-mention-name">
                     {option.displayName}
                   </span>
                   <span className="message-composer-mention-role-tag">
                     {option.secondaryText}
                   </span>
                 </div>
               </>
             )}
           </div>
         ))}
       </div>
     </div>
   )}
   ```

4. **Add CSS for role items**
   ```scss
   // MessageComposer.scss

   .message-composer-role-badge {
     width: 32px;
     height: 32px;
     border-radius: 50%;
     display: flex;
     align-items: center;
     justify-content: center;
     color: white;
     font-weight: 600;
     flex-shrink: 0;
   }

   .message-composer-mention-role-tag {
     font-size: 11px;
     color: var(--text-tertiary);
     font-family: monospace;
   }

   .message-composer-mention-item.role-item {
     // Optional: subtle background to distinguish roles
     &:hover {
       background-color: var(--hover-background-subtle);
     }
   }
   ```

### Phase 2: Mention Extraction (No Permission Required)

**Files to modify:**
- `src/utils/mentionUtils.ts` - extractMentionsFromText()
- `src/services/MessageService.ts` - Pass space roles for validation

**DECISION from User:**
- No permission required - all users can mention roles
- Simpler, cleaner implementation
- Matches Discord model

**Tasks:**

1. **Add role mention parsing to extractMentionsFromText()**
   ```typescript
   // utils/mentionUtils.ts

   export function extractMentionsFromText(
     text: string,
     options?: {
       allowEveryone?: boolean;
       spaceRoles?: Role[];   // NEW - for role validation
     }
   ): Mentions {
     const mentions: Mentions = {
       memberIds: [],
       roleIds: [],
       channelIds: [],
     };

     // Remove code blocks before processing
     const textWithoutCodeBlocks = text
       .replace(/```[\s\S]*?```/g, '')
       .replace(/`[^`]+`/g, '');

     // Extract @everyone (existing)
     if (/@everyone\b/i.test(textWithoutCodeBlocks)) {
       if (options?.allowEveryone) {
         mentions.everyone = true;
       }
     }

     // Extract user mentions: @<address> (existing)
     const userMentionRegex = /@<([^>]+)>/g;
     const userMatches = Array.from(textWithoutCodeBlocks.matchAll(userMentionRegex));
     for (const match of userMatches) {
       const address = match[1];
       if (address && !mentions.memberIds.includes(address)) {
         mentions.memberIds.push(address);
       }
     }

     // NEW: Extract role mentions: @roleTag (NO brackets)
     if (options?.spaceRoles && options.spaceRoles.length > 0) {
       // Match @word pattern (alphanumeric + hyphen/underscore)
       // Negative lookahead (?!\w) ensures word boundary
       const roleMentionRegex = /@([a-zA-Z0-9_-]+)(?!\w)/g;
       const roleMatches = Array.from(textWithoutCodeBlocks.matchAll(roleMentionRegex));

       for (const match of roleMatches) {
         const possibleRoleTag = match[1];

         // Skip 'everyone' (already handled above)
         if (possibleRoleTag.toLowerCase() === 'everyone') continue;

         // Validate against space roles (case-insensitive)
         const role = options.spaceRoles.find(r =>
           r.roleTag.toLowerCase() === possibleRoleTag.toLowerCase()
         );

         // Only add if role exists and not already in list
         if (role && !mentions.roleIds.includes(role.roleId)) {
           mentions.roleIds.push(role.roleId);
         }
         // If role doesn't exist, @roleTag remains plain text (no extraction)
       }
     }

     return mentions;
   }
   ```

**Why this approach:**
- ✅ Different regex patterns for users (`@<...>`) vs roles (`@word`)
- ✅ No autocomplete conflict (roles don't use brackets)
- ✅ Case-insensitive matching for flexibility
- ✅ Exact match only (prevents false positives)
- ✅ Invalid roles remain plain text (clean, simple UX)
- ✅ No permission required (simpler implementation)

2. **Update MessageService.submitChannelMessage()**
   ```typescript
   // MessageService.ts around line 2161-2190

   // Check @everyone permission (existing)
   const canUseEveryone = hasPermission(
     currentPasskeyInfo.address,
     'mention:everyone',
     space,
     isSpaceOwner
   );

   // Get space roles for validation
   const spaceRoles = space?.roles || [];

   // Extract mentions (role mentions don't require permission)
   mentions = extractMentionsFromText(messageText, {
     allowEveryone: canUseEveryone,
     spaceRoles: spaceRoles,  // NEW: Pass roles for validation
   });
   ```

### Phase 3: User Role Lookup

**Files to modify:**
- `src/components/space/Channel.tsx`
- `src/hooks/business/mentions/useAllMentions.ts`
- `src/hooks/business/mentions/useChannelMentionCounts.ts`

**Tasks:**

1. **Add user role lookup to Channel.tsx**
   ```typescript
   // Import getUserRoles utility
   import { getUserRoles } from '../../utils/permissions';

   // Inside Channel component (around line 50-100)
   const userRoles = useMemo(() => {
     if (!space || !currentPasskeyInfo?.address) return [];
     const roles = getUserRoles(currentPasskeyInfo.address, space);
     return roles.map(r => r.roleId);
   }, [space, currentPasskeyInfo?.address]);
   ```

2. **Pass userRoles to useAllMentions**
   ```typescript
   // In Channel.tsx notification panel rendering
   <NotificationPanel
     // ... existing props ...
     userRoles={userRoles}  // NEW
   />
   ```

3. **Update NotificationPanel to use userRoles**
   ```typescript
   // NotificationPanel.tsx - add prop
   interface NotificationPanelProps {
     // ... existing props ...
     userRoles?: string[];  // NEW
   }

   // Pass to useAllMentions
   const { mentions } = useAllMentions({
     spaceId,
     channelIds,
     enabledTypes: mentionTypes,
     userRoles,  // NEW
   });
   ```

4. **Update useAllMentions hook**
   ```typescript
   // hooks/business/mentions/useAllMentions.ts
   export function useAllMentions(options: {
     spaceId: string;
     channelIds: string[];
     enabledTypes?: ('mention-you' | 'mention-everyone' | 'mention-roles')[];
     userRoles?: string[];  // NEW
   }) {
     // Pass userRoles to isMentionedWithSettings
     const filtered = allMentions.filter(msg =>
       isMentionedWithSettings(msg, {
         userAddress,
         enabledTypes: enabledTypes || defaultTypes,
         userRoles: options.userRoles || [],  // NEW
       })
     );
   }
   ```

5. **Update useChannelMentionCounts similarly**
   - Accept `userRoles` parameter
   - Pass to `isMentionedWithSettings()`

### Phase 4: Mention Rendering

**Files to modify:**
- `src/components/message/MessageMarkdownRenderer.tsx` (Web)
- `src/hooks/business/message/useMessageFormatting.ts` (Mobile)

**DECISION from User:**
- Don't render deleted/invalid roles - they remain as plain text
- Use same styling as @everyone and @you mentions
- Simpler, cleaner implementation

**Tasks:**

1. **Add role mention rendering to MessageMarkdownRenderer (Web)**
   ```typescript
   // MessageMarkdownRenderer.tsx

   // Add role mention processing (only render if role exists)
   const processRoleMentions = (text: string) => {
     if (!message.mentions?.roleIds || message.mentions.roleIds.length === 0) {
       return text;
     }

     // Get role data for existing roles only
     const roleData = message.mentions.roleIds
       .map(roleId => {
         const role = space?.roles?.find(r => r.roleId === roleId);
         return role ? { roleTag: role.roleTag, displayName: role.displayName } : null;
       })
       .filter(Boolean);  // Remove deleted roles

     // Replace @roleTag with styled span (NO brackets in text)
     let processed = text;
     roleData.forEach(({ roleTag, displayName }) => {
       // Match @roleTag pattern (without brackets)
       const regex = new RegExp(`@${roleTag}(?!\\w)`, 'g');

       processed = processed.replace(
         regex,
         `<span class="mention-role" title="${displayName}">@${roleTag}</span>`
       );
     });

     return processed;
   };

   // Apply in rendering pipeline
   const processedText = processRoleMentions(rawText);
   ```

2. **Add CSS for role mentions (same as @everyone and @you)**
   ```scss
   // _chat.scss or appropriate stylesheet
   .mention-role {
     // Use same styling as .mention-everyone and .mention-you
     background-color: var(--accent-background);
     color: var(--accent-foreground);
     padding: 0 4px;
     border-radius: 3px;
     font-weight: 500;
   }
   ```

3. **Add role mention rendering to useMessageFormatting (Mobile)**
   ```typescript
   // hooks/business/message/useMessageFormatting.ts

   // Add role mention processing similar to user mentions
   const processRoleMentions = (text: string) => {
     if (!message.mentions?.roleIds?.length) return text;

     const roleTags = message.mentions.roleIds
       .map(roleId => space?.roles?.find(r => r.roleId === roleId))
       .filter(Boolean)
       .map(role => role.roleTag);

     let processed = text;
     roleTags.forEach(roleTag => {
       const regex = new RegExp(`@<${roleTag}>`, 'g');
       processed = processed.replace(regex, `@${roleTag}`);
     });

     return processed;
   };

   // Return role mention tokens for styling
   return {
     // ... existing tokens ...
     roleMentions: message.mentions?.roleIds || [],
   };
   ```

### Phase 5: Enable UI & Testing

**Files to modify:**
- `src/components/notifications/NotificationPanel.tsx`
- Testing across web and mobile

**Tasks:**

1. **Enable role mention filter in NotificationPanel**
   ```typescript
   // NotificationPanel.tsx line 77-79
   {
     value: 'mention-roles' as NotificationTypeId,
     label: t`@roles`,
     disabled: false,  // CHANGED from true
   },
   ```

2. **Update default selected types (optional)**
   ```typescript
   // Line 36-40 - add 'mention-roles' to default
   const [selectedTypes, setSelectedTypes] = useState<NotificationTypeId[]>([
     'mention-you',
     'mention-everyone',
     'mention-roles',  // NEW
     'reply',
   ]);
   ```

3. **Update default notification settings**
   ```typescript
   // utils/notificationSettingsUtils.ts
   export function getDefaultNotificationSettings(spaceId: string): NotificationSettings {
     return {
       spaceId,
       enabledNotificationTypes: [
         'mention-you',
         'mention-everyone',
         'mention-roles',  // Already included
         'reply',
       ],
     };
   }
   ```

4. **Testing checklist:**
   - [ ] Create test space with multiple roles
   - [ ] Assign users to different roles
   - [ ] Send message with `@<roleTag>` mention
   - [ ] Verify extraction: Check message.mentions.roleIds populated
   - [ ] Verify notification: Users in role receive notification
   - [ ] Verify rendering: @role styled correctly (web + mobile)
   - [ ] Verify filtering: NotificationPanel filter works
   - [ ] Verify settings: Per-space settings toggle works
   - [ ] Verify counts: Channel badges show role mention counts
   - [ ] Cross-device sync: Notifications sync across devices

---

## Edge Cases & Considerations

### 1. Role Tag Conflicts
**Problem**: What if roleTag conflicts with a user address?
**Solution**: Role tags should use different format than addresses
- User: `@<0x123abc...>` (hex address)
- Role: `@<moderators>` (alphanumeric tag)
- Extraction checks role list first, then treats as user address if not found

### 2. Multiple Roles
**Problem**: User has multiple roles, message mentions 2 of them
**Solution**: Count as single notification (de-duplicate by messageId)
- `isMentionedWithSettings()` returns boolean, not role list
- Notification panel shows one item per message

### 3. Role Deletion
**Problem**: Message references deleted role
**Solution**: Graceful degradation
- Rendering: Show `@unknown-role` or just plain text
- Notifications: Ignore deleted role mentions (roleId not found)

### 4. Empty Roles
**Problem**: Mention role with no members
**Solution**: Allow mention, but no notifications sent (0 users)

### 5. Permission Escalation
**Problem**: User adds themselves to role to get notifications?
**Solution**: Not a security issue - notifications are informational
- If concern exists, add `mention:roles` permission in Phase 1

### 6. Performance
**Problem**: Large role (100+ members) gets mentioned
**Solution**: Already optimized
- Database-level filtering handles this efficiently
- Early-exit at 10 notifications per channel

### 7. Read-Only Channels
**Context**: Based on space-permissions-architecture.md, read-only channels have isolated permissions
**Question**: Should role mentions work in read-only channels?
**Recommendation**: YES - role mentions are about notifications, not permissions
- Read-only manager roles still exist in `space.roles[]`
- Role mentions should work everywhere (regular + read-only channels)
- Only message *sending* is restricted in read-only channels
- Role mention notifications are informational, not permission-based

---

## Related Documentation

- [Mention Notification System](../docs/features/mention-notification-system.md) - Architecture overview
- [Notification Settings Phase 4](.done/mention-notification-settings-phase4.md) - Settings implementation
- [Space Roles System](../docs/space-permissions/space-roles-system.md) - Complete role system documentation
- [Space Permissions Architecture](../docs/space-permissions/space-permissions-architecture.md) - Permission system overview

---

## Follow-up Tasks (Future)

1. **Role autocomplete in message composer** (Nice-to-have)
   - Show role suggestions when typing `@`
   - Display role members on hover

2. **Role mention permission** (If needed)
   - Add `'mention:roles'` to Permission type
   - UI in SpaceSettingsModal/Roles.tsx
   - Permission check in extraction

3. **Role mention analytics** (Advanced)
   - Track which roles are mentioned most
   - Notification engagement metrics

4. **Nested roles** (Complex)
   - Role hierarchies (admins > moderators > members)
   - Mention parent role mentions children

---

## Testing Plan

### Unit Tests

```typescript
// mentionUtils.test.ts

describe('extractMentionsFromText with roles', () => {
  const mockRoles: Role[] = [
    { roleId: 'r1', roleTag: 'moderators', displayName: 'Moderators', ... },
    { roleId: 'r2', roleTag: 'admins', displayName: 'Admins', ... },
  ];

  it('should extract role mentions using roleTag', () => {
    const text = 'Hey @<moderators> check this out!';
    const mentions = extractMentionsFromText(text, {
      allowRoles: true,
      spaceRoles: mockRoles,
    });
    expect(mentions.roleIds).toEqual(['r1']);
  });

  it('should extract multiple role mentions', () => {
    const text = '@<moderators> and @<admins> please review';
    const mentions = extractMentionsFromText(text, {
      allowRoles: true,
      spaceRoles: mockRoles,
    });
    expect(mentions.roleIds).toEqual(['r1', 'r2']);
  });

  it('should ignore unknown role tags', () => {
    const text = 'Hey @<fakeroletag> check this';
    const mentions = extractMentionsFromText(text, {
      allowRoles: true,
      spaceRoles: mockRoles,
    });
    expect(mentions.roleIds).toEqual([]);
  });

  it('should not extract roles when allowRoles is false', () => {
    const text = 'Hey @<moderators> check this';
    const mentions = extractMentionsFromText(text, {
      allowRoles: false,
      spaceRoles: mockRoles,
    });
    expect(mentions.roleIds).toEqual([]);
  });

  it('should ignore role mentions in code blocks', () => {
    const text = '`@<moderators>` in code should not trigger';
    const mentions = extractMentionsFromText(text, {
      allowRoles: true,
      spaceRoles: mockRoles,
    });
    expect(mentions.roleIds).toEqual([]);
  });
});

describe('isMentionedWithSettings with roles', () => {
  it('should return true when user has mentioned role', () => {
    const message = {
      mentions: { roleIds: ['r1'], memberIds: [], channelIds: [] },
    };
    const result = isMentionedWithSettings(message, {
      userAddress: 'user1',
      enabledTypes: ['mention-roles'],
      userRoles: ['r1', 'r2'],
    });
    expect(result).toBe(true);
  });

  it('should return false when user does not have mentioned role', () => {
    const message = {
      mentions: { roleIds: ['r3'], memberIds: [], channelIds: [] },
    };
    const result = isMentionedWithSettings(message, {
      userAddress: 'user1',
      enabledTypes: ['mention-roles'],
      userRoles: ['r1', 'r2'],
    });
    expect(result).toBe(false);
  });

  it('should return false when mention-roles not enabled', () => {
    const message = {
      mentions: { roleIds: ['r1'], memberIds: [], channelIds: [] },
    };
    const result = isMentionedWithSettings(message, {
      userAddress: 'user1',
      enabledTypes: ['mention-you'], // roles not enabled
      userRoles: ['r1'],
    });
    expect(result).toBe(false);
  });
});
```

### Integration Tests

1. **Mention extraction integration**
   - Create message with `@<roleTag>`
   - Verify `message.mentions.roleIds` populated in DB
   - Verify notifications created for role members

2. **Notification count integration**
   - User is member of role "moderators"
   - Send message with `@<moderators>`
   - Verify channel badge shows count
   - Verify NotificationPanel shows notification

3. **Filtering integration**
   - Disable 'mention-roles' in settings
   - Send message with `@<roleTag>`
   - Verify no notification (badge stays 0)

4. **Cross-platform rendering**
   - Send message with `@<roleTag>`
   - Verify web renders with `.mention-role` class
   - Verify mobile renders with role mention styling

---

## Implementation Notes

### Mention Format Decision

**Recommended format: `@<roleTag>`**

**Rationale:**
- Consistent with user mentions (`@<address>`)
- No ambiguity with plain text (roleTags are validated)
- Works with existing regex in extraction logic
- Role tags are short, user-friendly identifiers
- **Key insight from space-roles-system.md**: Roles already have a `roleTag` field specifically designed as "Short identifier (e.g., @moderator)" - this confirms `@<roleTag>` is the intended design

**Alternative considered:** `@roleName`
- Simpler UX, but harder to parse (spaces in names?)
- Requires exact name matching (case sensitive?)
- Could conflict with user display names

**Format examples:**
- `@<moderators>` - mentions the "moderators" role
- `@<admins>` - mentions the "admins" role
- Role tag is the lookup key, but UI displays the `displayName` in role management

### Performance Considerations

**Database queries:**
- Role mention filtering uses same `getUnreadMentions()` as user mentions
- Already optimized with early-exit at 10 notifications
- No additional indices needed

**Mention extraction:**
- Role lookup is O(n) where n = number of roles (typically <20)
- Acceptable performance impact

**Rendering:**
- Role tag lookup from roleId is O(n) per message
- Consider memoization if performance issues arise

---

## Estimated Effort

**Updated after user decisions (simplified approach):**

- **Phase 1** (Autocomplete - simplified): 1-1.5 hours
- **Phase 2** (Extraction - no permission): 0.5-1 hour (down from 1.5-2h, removed permission system)
- **Phase 3** (User roles): 0.5-1 hour
- **Phase 4** (Rendering - plain text fallback): 1-1.5 hours (down from 1.5-2h, removed deleted role styling)
- **Phase 5** (Testing + Mobile): 0.5-1 hour

**Total: 3.5-5.5 hours** (reduced from 5.5-7.5h due to simpler approach)

**Complexity: Medium** (reduced from High - no permission system, simpler fallback)

---

## Success Criteria

- [ ] User can mention a role using `@<roleTag>` syntax
- [ ] All members of mentioned role receive notification
- [ ] Role mentions render with visual styling (web + mobile)
- [ ] NotificationPanel filter "/@roles" works and is enabled
- [ ] Role mention counts appear in channel badges
- [ ] Per-space settings control role mention notifications
- [ ] Role mentions ignored in code blocks
- [ ] Non-existent role tags handled gracefully
- [ ] Performance remains acceptable (<200ms for 20 channels)
- [ ] Cross-device sync works for role mentions

---

## Revision Notes

**2025-10-17 (v5)**: FINAL - User decisions applied (simplified approach)
- ✅ **No permission system**: All users can mention roles (simpler, matches Discord)
- ✅ **Plain text fallback**: Deleted/invalid roles simply don't render (clean UX)
- ✅ **Consistent styling**: Role mentions use same style as @everyone and @you
- 📉 **Effort reduced**: 3.5-5.5 hours (down from 5.5-7.5h)
- 📉 **Complexity reduced**: Medium (down from High)
- 📉 **Priority adjusted**: Medium (no security concerns)

**2025-10-17 (v4)**: Feature-analyzer review and fixes
- 🚨 Fixed autocomplete pattern conflict (`@<` skip logic)
- ✅ Format decision: Roles use `@roleTag` (NO brackets)
- ✅ Simplified autocomplete: Separate arrays
- 📈 Added permission system (later removed in v5)
- 📈 Added deleted role styling (later simplified in v5)

**2025-10-17 (v3)**: Major UX correction based on autocomplete analysis
- Users type `@displayName`, NOT `@<roleTag>` directly
- Added Phase 1: Autocomplete enhancement
- Updated useMentionInput hook design
- Increased effort estimate to 4.5-6 hours

**2025-10-17 (v2)**: Updated with space-permissions documentation
- Added `'mention:everyone'` permission context
- Clarified `roleTag` field purpose
- Added read-only channels consideration

**2025-10-17 (v1)**: Initial task creation

---

*Last updated: 2025-10-17*
