---
type: task
title: Implement Role-Based Channel Visibility
status: on-hold
complexity: high
ai_generated: true
created: 2025-12-26T00:00:00.000Z
updated: '2026-01-09'
---

# Implement Role-Based Channel Visibility

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Files**:
- `src/api/quorumApi.ts:57-74` (Channel type)
- `src/components/modals/ChannelEditorModal.tsx`
- `src/components/space/ChannelList.tsx`
- `src/components/space/ChannelGroup.tsx`
- `src/hooks/business/channels/useChannelManagement.ts`
- `src/services/MessageService.ts` (receiving-side validation)
- `src/utils/channelPermissions.ts`

## What & Why

Currently all channels in a space are visible to all members. Space owners need the ability to restrict channel visibility to specific roles (e.g., "Staff Only", "VIP Members"). Users without the required roles should not see the channel in the channel list.

---

## Critical Security Limitation

> **This feature would be COSMETIC ONLY, not a security boundary.**

Since Quorum is open-source and uses P2P message broadcasting, this feature **cannot provide true privacy**:

### What This Feature CAN Protect

| Protection | How | Effectiveness |
|------------|-----|---------------|
| **Honest clients** | UI filtering hides channels | Works perfectly |
| **Casual users** | Don't know how to bypass | Works for most users |
| **Accidental access** | Can't stumble into channels | Works perfectly |

### What This Feature CANNOT Protect

| Attack Vector | Why | Risk Level |
|---------------|-----|------------|
| **Modified client** | Attacker removes filtering code | Trivial to bypass |
| **Console injection** | Call internal APIs directly | Trivial to bypass |
| **Network observation** | Messages still broadcast to all peers | **Messages visible to all!** |

### Why This Happens

Messages are broadcast to the DHT network and received by **all clients**:

```
Sender (with role) → Encrypted Message → DHT Network → ALL clients receive it
                                                      ↓
                                    Honest client: filters out (doesn't display)
                                    Modified client: shows everything anyway
```

The receiving-side validation only prevents **honest clients** from displaying unauthorized content. A modified client can simply skip that validation and see all messages.

### Comparison to Similar Features

| Feature | Security Level | Why |
|---------|----------------|-----|
| **Role visibility** (`isPublic`) | Cosmetic | Documented as "UI-only, custom clients can bypass" |
| **Read-only channels** | Enforced | Receiving-side rejects posts, but messages still readable |
| **This feature** | **Cosmetic** | Same as role visibility - hides UI but messages still broadcast |

### True Privacy Would Require

For actual channel-level privacy, we would need:

1. **Separate encryption keys per channel** - Only role members get the decryption key
2. **Separate DHT topics** - Messages only routed to subscribers
3. **Key rotation on role changes** - Re-encrypt when members change

These are significant architectural changes beyond the scope of this task.

### Recommendation

**This feature may not be worth implementing** given:
- High complexity (estimated)
- Cosmetic-only protection
- Could give users false sense of security
- Similar to role visibility which is rarely used

If implemented, the UI **must clearly communicate** this is organizational, not security:

> "This hides the channel from non-members in the official app, but does not encrypt content differently. Users with modified clients may still see messages."

---

## Context

- **Existing pattern**: Read-only channels use `managerRoleIds` for permission control (`src/components/modals/ChannelEditorModal.tsx:160-194`)
- **Security model**: Defense-in-depth with UI validation + receiving-side validation (`src/services/MessageService.ts:1227-1248`)
- **Constraints**:
  - Must follow existing permission patterns for consistency
  - Receiving-side validation required (open-source, custom clients can bypass UI)
  - Space owners should always see all channels (for management purposes)
- **Related docs**:
  - `.agents/docs/space-permissions/space-roles-system.md`
  - `.agents/docs/space-permissions/read-only-channels-system.md`
  - `.agents/docs/features/security.md`

---

## Prerequisites
- [ ] Branch created from `develop`
- [ ] Development environment running (`yarn dev`)
- [ ] Understand existing read-only channel permission pattern

---

## Implementation

### Phase 1: Data Model Extension

- [ ] **Extend Channel type** (`src/api/quorumApi.ts:57-74`)
    - Add `visibleToRoleIds?: string[]` field to Channel type
    - Done when: Type definition includes new optional field
    - Verify: TypeScript compiles without errors
    ```typescript
    // Add to Channel type:
    visibleToRoleIds?: string[];  // If set, only users with these roles can see the channel
    ```

- [ ] **Extend ChannelData interface** (`src/hooks/business/channels/useChannelManagement.ts:14-24`)
    - Add `visibleToRoleIds: string[]` to ChannelData interface
    - Add `isRoleRestricted: boolean` toggle state
    - Done when: Hook interface includes new fields
    - Reference: Follow pattern from `isReadOnly` and `managerRoleIds` fields

### Phase 2: Channel Editor UI

- [ ] **Add role visibility toggle** (`src/components/modals/ChannelEditorModal.tsx`)
    - Add Switch for "Restrict to roles" below "Read only" toggle
    - Done when: Toggle appears in Channel Editor modal
    - Reference: Follow exact pattern from read-only toggle (`ChannelEditorModal.tsx:147-158`)
    ```typescript
    <Container className="mb-2 max-sm:mb-1">
      <FlexRow className="items-center justify-between">
        <div className="text-label-strong">
          <Trans>Restrict to roles</Trans>
        </div>
        <Switch
          value={isRoleRestricted}
          onChange={handleRoleRestrictedChange}
          accessibilityLabel={t`Restrict channel visibility to specific roles`}
        />
      </FlexRow>
    </Container>
    ```

- [ ] **Add role selector when restricted** (`src/components/modals/ChannelEditorModal.tsx`)
    - Show multi-select role picker when `isRoleRestricted` is true
    - Done when: Role selector appears/hides based on toggle
    - Reference: Follow exact pattern from Channel Managers selector (`ChannelEditorModal.tsx:160-194`)
    ```typescript
    {isRoleRestricted && (
      <Container className="mb-4 max-sm:mb-1">
        <FlexRow className="items-center justify-between max-sm:flex-col max-sm:items-stretch">
          <FlexRow className="items-center">
            <div className="text-label-strong whitespace-nowrap max-sm:mb-2">
              <Trans>Visible to Roles</Trans>
            </div>
            <Tooltip
              id="channel-visibility-tooltip"
              content={t`Only members of selected roles can see this channel. Space owners always see all channels.`}
              place="bottom"
              className="!w-[350px]"
              maxWidth={350}
            >
              <Icon name="info-circle" size="sm" className="text-main hover:text-strong cursor-pointer ml-2 max-sm:mb-2" />
            </Tooltip>
          </FlexRow>
          <Select
            value={visibleToRoleIds}
            options={availableRoles.map((role) => ({
              value: role.roleId,
              label: role.displayName,
            }))}
            onChange={handleVisibleRolesChange}
            placeholder={t`Select Roles`}
            multiple={true}
            className="flex-1 max-w-xs max-sm:max-w-full"
          />
        </FlexRow>
      </Container>
    )}
    ```

- [ ] **Update useChannelManagement hook** (`src/hooks/business/channels/useChannelManagement.ts`)
    - Add `handleRoleRestrictedChange` and `handleVisibleRolesChange` handlers
    - Update `saveChanges` to persist `visibleToRoleIds`
    - Done when: Channel saves with visibility restrictions
    - Reference: Follow pattern from `handleReadOnlyChange` and `handleManagerRolesChange`

### Phase 3: Channel Filtering (UI Layer)

- [ ] **Create useChannelVisibility hook** (`src/hooks/business/channels/useChannelVisibility.ts` - new file)
    - Create utility to check if user can see a channel
    - Done when: Hook returns correct visibility boolean
    - Reference: Follow permission checking pattern from `src/utils/channelPermissions.ts`
    ```typescript
    export function canUserSeeChannel(
      channel: Channel,
      userAddress: string | undefined,
      userRoleIds: string[],
      isSpaceOwner: boolean
    ): boolean {
      // Space owners always see all channels
      if (isSpaceOwner) return true;

      // No visibility restrictions = visible to all
      if (!channel.visibleToRoleIds || channel.visibleToRoleIds.length === 0) {
        return true;
      }

      // Check if user has any of the required roles
      if (!userAddress) return false;
      return channel.visibleToRoleIds.some(roleId => userRoleIds.includes(roleId));
    }
    ```

- [ ] **Filter channels in ChannelList** (`src/components/space/ChannelList.tsx`)
    - Filter `groupsWithMentionCounts` to only include visible channels
    - Filter empty groups (all channels hidden) from display
    - Done when: Restricted channels hidden from non-permitted users
    - Verify: Space owner still sees all channels
    ```typescript
    // After line 106, add filtering:
    const visibleGroups = React.useMemo(() => {
      return groupsWithMentionCounts
        .map(group => ({
          ...group,
          channels: group.channels.filter(channel =>
            canUserSeeChannel(channel, user.currentPasskeyInfo?.address, userRoleIds, isSpaceOwner)
          )
        }))
        .filter(group => group.channels.length > 0); // Hide empty groups
    }, [groupsWithMentionCounts, user.currentPasskeyInfo?.address, userRoleIds, isSpaceOwner]);
    ```

- [ ] **Update ChannelGroup rendering** (`src/components/space/ChannelList.tsx:145-151`)
    - Use `visibleGroups` instead of `groupsWithMentionCounts`
    - Done when: Only visible groups/channels render

### Phase 4: Receiving-Side Validation (Security Layer)

- [ ] **Add visibility validation for post messages** (`src/services/MessageService.ts`)
    - Validate sender has permission to post in role-restricted channels
    - Done when: Messages from unauthorized senders are silently rejected
    - Reference: Follow pattern from read-only channel validation (`MessageService.ts:1227-1248`)
    ```typescript
    // Add after read-only channel validation:
    // Validate role-restricted channel permissions
    if (channel.visibleToRoleIds && channel.visibleToRoleIds.length > 0) {
      const senderId = decryptedContent.content.senderId;

      // Check if sender has any of the required roles
      const hasRequiredRole = space.roles?.some(
        (role) =>
          channel.visibleToRoleIds?.includes(role.roleId) &&
          role.members?.includes(senderId)
      ) ?? false;

      if (!hasRequiredRole) {
        console.log(`🔒 Rejecting message from ${senderId} - not in required roles for channel`);
        return; // Silent rejection
      }
    }
    ```

- [ ] **Add visibility validation for delete messages** (`src/services/MessageService.ts`)
    - Validate delete sender has channel visibility permission
    - Done when: Deletes from unauthorized senders are silently rejected
    - Reference: Follow pattern from read-only channel delete validation

- [ ] **Add visibility validation for pin messages** (`src/services/MessageService.ts`)
    - Validate pin/unpin sender has channel visibility permission
    - Done when: Pins from unauthorized senders are silently rejected

### Phase 5: Permission Utilities Integration

- [ ] **Update channelPermissions.ts** (`src/utils/channelPermissions.ts`)
    - Add `canUserSeeChannel` to unified permission system
    - Export for use across components
    - Done when: Permission check available from centralized utility

- [ ] **Update useChannelMessages permission checks** (`src/hooks/business/channels/useChannelMessages.ts`)
    - Incorporate visibility check into `canDeleteMessages` and `canPinMessages`
    - Done when: Permission checks consider channel visibility
    - Reference: Follow existing permission check patterns in the file

### Phase 6: Visual Indicators

- [ ] **Add restricted channel icon** (`src/components/space/ChannelGroup.tsx`)
    - Show lock or shield icon for role-restricted channels (visible to space owners)
    - Done when: Space owners see visual indicator for restricted channels
    - Reference: Follow pattern from read-only lock icon
    ```typescript
    // For role-restricted channels, show shield icon (space owners only)
    {channel.visibleToRoleIds?.length > 0 && isSpaceOwner && (
      <Icon name="shield" size="xs" className="text-subtle" />
    )}
    ```

---

## Verification

✅ **Channel visibility filtering works**
    - Test: Create role-restricted channel → user without role doesn't see it
    - Test: Assign role to user → channel appears in list
    - Test: Space owner always sees all channels

✅ **Receiving-side validation blocks unauthorized messages**
    - Test: User without role tries to post (via modified client) → message rejected
    - Test: User with role posts → message appears for all permitted users
    - Verify: Console shows `🔒 Rejecting message` for unauthorized attempts

✅ **Channel Editor UI works correctly**
    - Test: Toggle "Restrict to roles" → role selector appears/hides
    - Test: Select roles → save → reload → settings preserved
    - Test: Remove all roles → channel becomes visible to all

✅ **TypeScript compiles**
    - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✅ **Mobile compatible**
    - Test: Channel Editor modal works on mobile viewport
    - Test: Channel list filtering works on mobile

✅ **No regressions**
    - Test: Read-only channels still work correctly
    - Test: Regular channels unaffected by changes

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority | Risk |
|----------|-------------------|--------|----------|------|
| User loses role while viewing channel | Channel disappears on next render | ⚠️ Needs handling | P1 | Medium |
| All roles removed from channel config | Channel visible to all (no restriction) | ✅ By design | P0 | Low |
| Restricted + Read-only combined | Both restrictions apply (must have visibility AND manager role to post) | ⚠️ Needs handling | P1 | Medium |
| Space owner removed from all roles | Still sees all channels (owner privilege) | ✅ By design | P0 | Low |
| Channel with deleted role in visibleToRoleIds | Gracefully handle missing role, treat as no restriction | ⚠️ Needs handling | P2 | Low |
| Notifications from restricted channel | Only show to users who can see channel | ⚠️ Needs handling | P1 | Medium |

---

## Risks & Rollback

**If channel filtering breaks channel list:**
- Verify `canUserSeeChannel` returns `true` for unrestricted channels
- Check `visibleGroups` memo dependencies are correct
- Fallback: Show all channels if filtering throws error

**If receiving-side validation is too strict:**
- Add debug logging to identify rejection reason
- Verify role membership check uses correct field names
- Check space data is available when validation runs

**If TypeScript compilation fails:**
- Verify Channel type extension is optional (`visibleToRoleIds?`)
- Check all new handler types match expected signatures

---

## Definition of Done

- [ ] All Phase 1-6 checkboxes complete
- [ ] TypeScript compiles: `npx tsc --noEmit` passes
- [ ] All verification tests pass
- [ ] P0 and P1 edge cases handled
- [ ] No console errors or warnings in development
- [ ] Code follows existing patterns from read-only channels
- [ ] Documentation updated (space-permissions docs)
- [ ] Task document updated with implementation notes

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2025-12-26 - Claude**: Initial task creation based on analysis of existing read-only channels pattern and security architecture
**2025-12-26 - Claude**: Added critical security limitation section - feature is cosmetic only due to P2P broadcast architecture. Status changed to "On Hold" pending decision on whether cosmetic-only protection is worth the implementation effort.
