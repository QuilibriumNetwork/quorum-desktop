---
type: doc
title: Read-Only Channels System
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-07-19T00:00:00.000Z
---

# Read-Only Channels System

## Overview

Read-only channels provide an **isolated permission system** that operates independently from traditional space roles. This system enables announcement channels, moderated discussions, and controlled communication flows where only designated managers and space owners can post, delete, and pin messages.

## Core Architecture

### Isolation Principle

**Critical Design Decision**: Read-only channels use a completely separate permission system that **ignores traditional space roles**.

- **Traditional roles with `message:delete`** → ❌ Cannot delete in read-only channels
- **Traditional roles with `message:pin`** → ❌ Cannot pin in read-only channels
- **Read-only channel managers** → ✅ Full permissions in their managed channels only
- **Space owners** → ❌ Must join a manager role (receiving-side cannot verify ownership)

### Manager-Based Permissions

Read-only channels use **existing space roles as managers**, but this creates an isolated permission context:

```typescript
// When a role is assigned as a read-only channel manager:
// 1. In regular channels: Role permissions apply normally
// 2. In THIS read-only channel: Manager status overrides everything
// 3. In OTHER read-only channels: No special permissions
```

## Data Model

### Channel Extensions

```typescript
export type Channel = {
  // ... existing Channel fields
  isReadOnly?: boolean; // Enables read-only mode
  managerRoleIds?: string[]; // Roles that can manage this channel
};
```

### Permission Matrix

| User Type            | Regular Channels | Read-Only Channels (Manager) | Read-Only Channels (Non-Manager) |
| -------------------- | ---------------- | ---------------------------- | -------------------------------- |
| **Space Owner**      | Role-based*      | All permissions              | No permissions (must join role)  |
| **Manager Role**     | Role permissions | All permissions              | No special permissions           |
| **Traditional Role** | Role permissions | No permissions               | No permissions                   |
| **Regular User**     | No permissions   | No permissions               | React only                       |

*Space owners can always **kick users** (protocol verifies via `owner_public_keys`), but need roles for delete/pin.

## Implementation Architecture

### UI Components

#### **Channel Editor** (`src/components/modals/ChannelEditorModal.tsx`)

**Read-Only Configuration UI**:

```typescript
// Read-only toggle
<Switch
  value={isReadOnly}
  onChange={handleReadOnlyChange}
  accessibilityLabel={t`Read only channel`}
/>

// Manager role assignment
<Select
  value={managerRoleIds}
  options={availableRoles.map(role => ({
    value: role.roleId,
    label: role.displayName,
  }))}
  onChange={handleManagerRolesChange}
  multiple={true}
  placeholder={t`Select Roles`}
/>
```

**Manager Explanation Tooltip**:

```typescript
<Tooltip
  content={t`Members of selected roles can post, delete, and pin messages
  in this read-only channel. Note: Space owners must also be in a manager
  role to post here.`}
/>
```

#### **Channel Headers** (`src/components/space/Channel.tsx`)

**Visual Indicators**:

```typescript
// Read-only channels: Lock icon
{channel?.isReadOnly ? (
  <Icon name="lock" size="sm" className="text-subtle flex-shrink-0" />
) : (
  <Icon name="hashtag" size="sm" className="text-subtle flex-shrink-0" />
)}
```

**Layout Structure**:

```typescript
// Desktop layout
<div className="hidden lg:flex flex-1 min-w-0">
  <div className="flex items-center gap-2 truncate whitespace-nowrap overflow-hidden">
    {/* Icon */}
    <span className="text-main font-medium flex-shrink truncate">
      {channel?.channelName}
    </span>
    {channel?.channelTopic && (
      <>
        <span className="text-subtle flex-shrink-0">|</span>
        <span className="text-subtle font-light text-sm flex-shrink truncate">
          {channel.channelTopic}
        </span>
      </>
    )}
  </div>
</div>
```

#### **Message Composer** (`src/components/message/MessageComposer.tsx`)

**Disabled State for Non-Managers**:

```typescript
<div className="w-full items-center gap-2 ml-[11px] my-2 py-2 pl-4 pr-[6px] rounded-lg flex justify-start bg-chat-input">
  <Icon name="lock" size="xs" className="text-muted flex-shrink-0" />
  <span className="text-base font-normal" style={{ color: 'var(--color-field-placeholder)' }}>
    {disabledMessage || t`You cannot post in this channel`}
  </span>
</div>
```

#### **Channel List** (`src/components/space/ChannelGroup.tsx`)

**Icon Display**:

```typescript
{channel.isReadOnly ? (
  <Icon name="lock" size="xs" className="text-subtle" />
) : (
  <Icon name="hashtag" size="xs" className="text-subtle" />
)}
```

### Permission Logic Implementation

#### **Post Permissions** (`src/components/space/Channel.tsx`)

```typescript
// NOTE: Space owners must explicitly join a manager role to post in read-only channels.
// This is intentional - the receiving side cannot verify space ownership (privacy requirement).
function canPostInReadOnlyChannel(
  channel: Channel | undefined,
  userAddress: string | undefined,
  roles: Role[],
  _isSpaceOwner: boolean
): boolean {
  // Regular channels: everyone can post
  if (!channel?.isReadOnly) return true;

  // No manager roles defined: nobody can post
  if (!channel.managerRoleIds || channel.managerRoleIds.length === 0) {
    return false;
  }

  // Check if user has any manager roles (space owners must also be in a manager role)
  if (!userAddress) return false;

  return roles.some(
    (role) =>
      channel.managerRoleIds?.includes(role.roleId) &&
      role.members.includes(userAddress)
  );
}
```

#### **Delete Permissions** (`src/hooks/business/channels/useChannelMessages.ts`)

```typescript
const canDeleteMessages = useCallback(
  (message: MessageType) => {
    const userAddress = user.currentPasskeyInfo?.address;
    if (!userAddress) return false;

    // Users can always delete their own messages
    if (message.content.senderId === userAddress) return true;

    // Read-only channels: check manager status BEFORE traditional roles
    if (channel?.isReadOnly) {
      const isManager = !!(
        channel.managerRoleIds &&
        roles.some(
          (role) =>
            channel.managerRoleIds?.includes(role.roleId) &&
            role.members.includes(userAddress)
        )
      );
      if (isManager) return true;
      // If not a manager, traditional roles are ignored
      return false;
    }

    // Regular channels: use traditional role system
    return hasPermission(userAddress, 'message:delete', space, isSpaceOwner);
  },
  [roles, user.currentPasskeyInfo, isSpaceOwner, channel, space]
);
```

#### **Pin Permissions** (`src/hooks/business/messages/usePinnedMessages.ts`)

```typescript
const canUserPin = useCallback(() => {
  const userAddress = user?.currentPasskeyInfo?.address;
  if (!userAddress) return false;

  // Read-only channels: check manager status BEFORE traditional roles
  if (channel?.isReadOnly) {
    const isManager = !!(
      channel.managerRoleIds &&
      space?.roles &&
      space.roles.some(
        (role) =>
          channel.managerRoleIds?.includes(role.roleId) &&
          role.members.includes(userAddress)
      )
    );
    if (isManager) return true;
    // Traditional roles ignored in read-only channels
    return false;
  }

  // Regular channels: use traditional role system
  return hasPermission(userAddress, 'message:pin', space, isSpaceOwner);
}, [user?.currentPasskeyInfo?.address, isSpaceOwner, channel, space]);
```

### Channel Management Hooks

#### **`useChannelManagement`** (`src/hooks/business/channels/useChannelManagement.ts`)

**Extended Channel Data Interface**:

```typescript
export interface ChannelData {
  channelName: string;
  channelTopic: string;
  isReadOnly: boolean; // Read-only toggle state
  managerRoleIds: string[]; // Selected manager roles
}
```

**Management Handlers**:

```typescript
// Read-only toggle
const handleReadOnlyChange = useCallback((value: boolean) => {
  setChannelData((prev) => ({ ...prev, isReadOnly: value }));
}, []);

// Manager role selection
const handleManagerRolesChange = useCallback((value: string | string[]) => {
  const roleIds = Array.isArray(value) ? value : [value];
  setChannelData((prev) => ({ ...prev, managerRoleIds: roleIds }));
}, []);
```

**Channel Persistence**:

```typescript
// Save changes with read-only configuration
const saveChanges = useCallback(async () => {
  if (!space) return;

  if (channelId) {
    // Update existing channel
    updateSpace({
      ...space,
      groups: space.groups.map((g) => ({
        ...g,
        channels:
          groupName === g.groupName
            ? g.channels.map((c) =>
                c.channelId === channelId
                  ? {
                      ...c,
                      channelName: channelData.channelName,
                      channelTopic: channelData.channelTopic,
                      isReadOnly: channelData.isReadOnly,
                      managerRoleIds: channelData.managerRoleIds,
                      modifiedDate: Date.now(),
                    }
                  : c
              )
            : g.channels,
      })),
    });
  }
  // ... new channel creation logic
}, [space, channelData /* ... */]);
```

## Processing Layer Integration

### Service-Oriented Processing (via MessageDB Context)

**Read-Only Channel Validation** (orchestrated by `MessageService` or `SpaceService` via `MessageDB Context`):

The logic for validating delete messages in read-only channels is now encapsulated within specialized services (e.g., `MessageService` or `SpaceService`). These services interact with the low-level `MessageDB` (`src/db/messages.ts`) for data access.

**Authorization uses the cryptographically verified ed448 signer, not the payload `senderId`.** The payload `senderId` is written by the sender's client and is spoofable. `MessageService` resolves the verified sender via `resolveVerifiedSender(publicKey, members)`, which maps the signing key to an inbox address (`base58btc(sha256(publicKey))`) and then does a REVERSE lookup against `space_members` rows — failing closed (drop) if the key matches no known, active member. The resulting `VerifiedSender` is then passed to `authorizeControlMessage` (from `quorum-shared/src/utils/messageAuth.ts`) for the actual allow/deny decision.

```typescript
// Delete message processing (simplified illustration of what MessageService does)
if (spaceId != channelId) {
  // Service resolves the VERIFIED sender from the ed448 signing key,
  // never from the spoofable payload senderId.
  const members = await messageDB.getSpaceMembers(spaceId);
  const verifiedSender = decryptedContent.publicKey
    ? resolveVerifiedSender(decryptedContent.publicKey, members) // key → inbox → member
    : null;

  // authorizeControlMessage (quorum-shared/src/utils/messageAuth.ts) handles
  // all control types (remove-message, edit-message, pin, mute).
  // For remove-message in a read-only channel it checks manager status against
  // the verified sender; in a regular channel it checks the message:delete role.
  const verdict = authorizeControlMessage({
    content: decryptedContent.content,
    verifiedSender,   // proven by ed448 signature — NOT payload senderId
    space,
    channel,
    targetMessage,
  });

  if (!verdict.allowed) return; // fail closed — unsigned/unauthorized drops silently

  // Service would call messageDB.deleteMessage()
  await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
}
```

See also: `.agents/docs/features/security.md` — "Control-Message Authorization (verified signer)" for the full mechanism.

**Read-only content acceptance (deciding whether content is allowed into a
read-only channel) — verified signer, both paths (2026-07-19).** This is a
*different* gate from the control-message (delete/pin) path above: it decides
whether incoming `post` / `embed` / `sticker` is accepted, not whether a control
action is authorized. It no longer trusts `content.senderId` — the
`isReadOnlyPostAuthorized` helper verifies the content's ed448 signature and
authorizes the **verified signer** as a channel manager (`resolveVerifiedSender`
+ `canManageReadOnlyChannel`). Unsigned/unverifiable content is dropped (manager
identity must be proven, so this holds even in a repudiable space). Applied on
BOTH the live cache path (`addMessage`) and the durable DB path (`saveMessage`),
so a forged post can't survive on disk and resurface on refetch.

- **Durable-path fail-open**: `saveMessage` also runs during sync/replay, where a
  message can arrive before its space row loads. It therefore drops only when the
  channel is *positively confirmed* read-only and the verified signer isn't a
  manager; missing space/channel data passes through, so a legit signed manager
  message is never permanently lost. Thread replies are exempt (matching the live
  path).
- **Send-side force-sign**: a post to a read-only channel is always signed
  regardless of the repudiable "send unsigned" toggle (`submitChannelMessage`),
  so a manager's own post is never dropped by the receive gate. The composer
  hides the toggle for read-only channels.

Desktop shipped in #242; the tracking bug
`.agents/bugs/2026-06-12-readonly-channel-receive-side-enforcement-gaps.md`
stays open until the mobile mirror lands.

**Key Processing Principles**:

1. **Verified Identity Only**: Authorization is always against the ed448-proven signer, never the plaintext `senderId`
2. **Channel Type Detection**: `authorizeControlMessage` determines if channel is read-only and applies the correct permission check
3. **Isolated Validation**: Manager status in read-only channels is checked against the verified sender, independently from traditional roles
4. **Fallback Blocking**: If the signer is unknown, unsigned, or lacks permission, the message is dropped silently (fail closed)
5. **Traditional Channel Fallback**: In regular channels `authorizeControlMessage` checks the `message:delete` role on the verified sender

## Design System Integration

### Styling Guidelines

**Text Hierarchy**:

- **Channel names**: `text-main font-medium`
- **Channel topics**: `text-subtle font-light text-sm`
- **Separators**: `text-subtle`
- **Lock icons**: `text-subtle` or `text-muted` (context-dependent)

**Spacing and Layout**:

- **Header elements**: `gap-2` spacing between icon, name, separator, topic
- **Explanation text**: `mb-4` bottom margin, `leading-tight` line height
- **Input fields**: Standard primitive spacing

**Semantic Classes**:

- **Background colors**: `bg-chat-input` for disabled composer
- **Component spacing**: `py-2 pl-4 pr-[6px]` for composer layout
- **Icon sizing**: `size="xs"` for channel list, `size="sm"` for headers

### Cross-Platform Compatibility

**Responsive Layout**:

```typescript
// Desktop header (single line)
<div className="hidden lg:flex flex-1 min-w-0">
  {/* Channel info with proper truncation */}
</div>

// Mobile header (separate row)
<div className="w-full lg:hidden">
  {/* Channel info adapted for mobile */}
</div>
```

**Primitive Component Usage**:

- **`Switch`**: Read-only toggle with accessibility label
- **`Select`**: Multi-select for manager role assignment
- **`Icon`**: Consistent lock/hashtag icons across components
- **`Text`**: Semantic text classes for hierarchy

## Current Implementation Status

### ✅ Fully Working Systems

- **Read-only channel creation and editing**: Complete UI and persistence
- **Manager role assignment**: Multi-select role assignment working
- **Post restrictions**: Non-managers blocked from posting with clear messaging
- **Visual indicators**: Lock icons and styling throughout the interface
- **Permission isolation**: Traditional roles correctly ignored in read-only channels
- **Manager delete permissions**: Read-only managers can delete messages, persist correctly
- **Manager pin permissions**: Read-only managers can pin/unpin messages
- **Self-message management**: Users can delete own messages in read-only channels

### ⚠️ Space Owner Requirements

- **Privacy Constraint**: Receiving side cannot verify space ownership (no `Space.ownerAddress` exposed)
- **Role Requirement**: Space owners must explicitly join a manager role for post/delete/pin permissions
- **Exception**: Space owners can always **kick users** (protocol verifies via `owner_public_keys`)
- **Receiving-Side Validation**: MessageService.ts validates all incoming messages in read-only channels

### 🔧 Future Enhancements

- **Enhanced Manager Features**: Manager-specific UI indicators, manager lists in channel info
- **Granular Manager Permissions**: Different manager types with specific permission sets
- **Temporary Manager Assignments**: Time-limited manager status
- **Manager Role Templates**: Quick assignment of common manager permission sets

## Manager vs Traditional Role Comparison

### Traditional Space Roles

- **Scope**: Space-wide permissions
- **Permissions**: Specific capabilities (`message:delete`, `message:pin`, `user:kick`)
- **Context**: Work in all regular channels across the space
- **Management**: Space-wide role creation and assignment

### Read-Only Channel Managers

- **Scope**: Specific channel only
- **Permissions**: Full control within managed channel (post, delete, pin)
- **Context**: Only work in the designated read-only channel
- **Management**: Channel-specific assignment using existing roles

### Key Differences

1. **Inheritance**: Managers use existing roles but create isolated permission context
2. **Scope Limitation**: Manager status only applies to specific channel
3. **Permission Override**: Manager status overrides traditional role limitations
4. **Isolation**: Traditional role permissions completely ignored in managed channels

## Development Guidelines

### Working with Read-Only Channels

1. **Respect Isolation**: Never expect traditional roles to work in read-only channels
2. **Check Channel Type**: Always determine channel type before applying permissions
3. **Manager-First Logic**: Check manager status before traditional role permissions
4. **UI Consistency**: Use lock icons and appropriate messaging throughout

### Adding New Read-Only Features

1. **Follow Isolation Principle**: New features should ignore traditional roles
2. **Manager-Centric Design**: Base permissions on manager status, not traditional roles
3. **Maintain UI Clarity**: Ensure visual distinction between regular and read-only channels
4. **Consider Processing**: Ensure the relevant service (e.g., `MessageService`, `SpaceService`) exposed via `MessageDB Context` supports new features.

### Testing Considerations

- **Manager vs Non-Manager**: Test both manager and non-manager user experiences
- **Channel Type Boundaries**: Verify isolation between regular and read-only channels
- **Multiple Manager Roles**: Test users with multiple roles assigned as managers
- **Role Assignment Changes**: Test dynamic manager role assignment/removal

## Integration with Broader Permission System

### Relationship to Space Roles

- **Leverages Existing Roles**: Uses existing space role infrastructure
- **Creates Isolated Context**: Manager assignment creates channel-specific permissions
- **No Role Modification**: Does not alter traditional role permissions or scope

### Permission Architecture Integration

- **UI Level**: Integrated with unified permission checking system
- **Processing Level**: Validated independently within the relevant service (e.g., `MessageService`, `SpaceService`) exposed via `MessageDB Context`.
- **Hierarchy Respect**: Maintains space owner privilege while adding manager layer

## Related Documentation

- **[Space Permissions Architecture](./space-permissions-architecture.md)** - Overall system design and integration
- **[Space Roles System](./space-roles-system.md)** - Traditional space-wide role permissions

---

_Last Updated: 2026-07-19_
_Implementation Status: Core functionality complete, space owner bypass removed for security_
_Security Update: Control messages (delete/edit/pin/mute) authorized against the ed448-verified signer, not the spoofable payload senderId_
