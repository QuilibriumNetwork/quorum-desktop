# Implement User Mute Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent, security-analyst agent

**Status**: Pending
**Complexity**: Medium
**Created**: 2025-12-14
**Files**:
- `src/api/quorumApi.ts:3-4` - Permission type, add `'user:mute'`
- `src/api/quorumApi.ts:99-113` - Message content types, add MuteMessage/UnmuteMessage
- `src/api/quorumApi.ts:195-198` - Add MuteMessage type definition (after KickMessage)
- `src/components/modals/SpaceSettingsModal/Roles.tsx:160-172` - Permission dropdown options
- `src/components/modals/MuteUserModal.tsx` - Mute confirmation modal (NEW)
- `src/components/user/UserProfile.tsx:186-209` - Add mute/unmute button
- `src/hooks/business/user/useUserProfileActions.ts` - Add mute action
- `src/services/MessageService.ts:839-852` - Receive-side validation pattern (reference)
- `src/db/messages.ts` - Mute state persistence (NEW)
- `src/utils/channelPermissions.ts` - canMuteUser method (NEW)
- `src/hooks/queries/mute/useMutedUsers.ts` - Mute state hook (NEW)

## What & Why

**Current state**: Moderators cannot kick or ban users (requires owner's ED448 key). There's no way to silence disruptive users without being the space owner.

**Desired state**: Moderators with `user:mute` permission can mute/unmute users. Muted users' messages are hidden from other clients.

**Value**: Enables effective moderation without requiring protocol-level changes. Uses the same receive-side validation pattern as `message:delete`.

## Context

- **Existing pattern**: `message:delete` permission works for moderators via receive-side validation ([MessageService.ts:839-852](src/services/MessageService.ts#L839-L852))
- **Key insight**: Mute is **client-enforced** (each client decides to ignore messages), unlike kick which is **protocol-enforced** (requires owner signature)
- **Related bug**: [user-kick-role-permission-non-functional.md](.agents/bugs/.solved/user-kick-role-permission-non-functional.md)

## Implementation

### Phase 1: Types & API

1. **Add `user:mute` permission** (`src/api/quorumApi.ts:3-4`)
   ```typescript
   export type Permission = 'message:delete' | 'message:pin' | 'mention:everyone' | 'user:mute';
   ```

2. **Add MuteMessage and UnmuteMessage types** (`src/api/quorumApi.ts` after line 198)
   ```typescript
   export type MuteMessage = {
     senderId: string;      // Who performed the mute
     type: 'mute';
     targetUserId: string;  // Who got muted
     muteId: string;        // UUID for deduplication (replay protection)
     timestamp: number;     // For ordering/conflict resolution
   };

   export type UnmuteMessage = {
     senderId: string;      // Who performed the unmute
     type: 'unmute';
     targetUserId: string;  // Who got unmuted
     muteId: string;        // UUID for deduplication
     timestamp: number;     // For ordering/conflict resolution
   };
   ```

3. **Add to Message content union** (`src/api/quorumApi.ts:99-113`)
   - Add `| MuteMessage | UnmuteMessage` to the content type union

### Phase 2: Permission & Role Settings

4. **Add permission to Roles dropdown** (`src/components/modals/SpaceSettingsModal/Roles.tsx:168-171`)
   ```typescript
   {
     value: 'user:mute',
     label: t`Mute Users`,
   },
   ```

5. **Add canMuteUser to permission system** (`src/utils/channelPermissions.ts`)
   ```typescript
   canMuteUser(): boolean {
     const { channel } = this.context;

     // NOTE: NO isSpaceOwner bypass - receiving side can't verify owner status
     // Space owners must assign themselves a role with user:mute permission

     // 1. Read-only channels: Only managers can mute
     if (channel?.isReadOnly) {
       return this.isReadOnlyChannelManager();
     }

     // 2. Regular channels: Check for user:mute permission via roles
     return this.hasTraditionalRolePermission('user:mute');
   }
   ```

### Phase 3: State Persistence & UI

6. **Add mute state persistence** (`src/db/messages.ts`)
   - Add `muted_users` object store with schema:
     ```typescript
     type MutedUserRecord = {
       spaceId: string;
       targetUserId: string;
       mutedAt: number;
       mutedBy: string;
       lastMuteId: string;  // For deduplication
     };
     ```
   - Add methods: `getMutedUsers(spaceId)`, `muteUser(...)`, `unmuteUser(...)`
   - **Important**: Mute state is per-space, not global

7. **Create mute state hook** (`src/hooks/queries/mute/useMutedUsers.ts`)
   ```typescript
   export const useMutedUsers = (spaceId: string) => {
     const { messageDB } = useMessageDB();
     return useQuery({
       queryKey: ['mutedUsers', spaceId],
       queryFn: () => messageDB.getMutedUsers(spaceId),
       staleTime: Infinity,
     });
   };
   ```

8. **Update UserProfile layout** (`src/components/user/UserProfile.tsx:186-209`)
   - Current: 2 buttons (Send Message, Kick User) in a 2-column grid
   - **Recommended layout** (Option C - grouped moderation):
     - Send Message: full width on mobile, spans 2 cols on desktop
     - Mute/Unmute + Kick: side by side below
   - Add Mute/Unmute button with toggle state based on `useMutedUsers` hook
   - Mute button opens confirmation modal (see step 9)

9. **Create MuteUserModal** (`src/components/modals/MuteUserModal.tsx`)
   - Similar pattern to KickUserModal
   - V1: Simple confirmation "Mute {userName}?"
   - Shows user avatar and name
   - Single "Mute" button (no double confirmation - less disruptive than kick)
   ```typescript
   interface MuteUserModalProps {
     isOpen: boolean;
     onClose: () => void;
     onConfirm: () => void;
     userName: string;
     userIcon?: string;
     userAddress: string;
   }
   ```

10. **Add mute action to hook** (`src/hooks/business/user/useUserProfileActions.ts`)
    ```typescript
    const muteUser = useCallback(async (targetUserId: string, spaceId: string, channelId: string) => {
      await messageService.sendMessage({
        spaceId,
        channelId,
        content: {
          type: 'mute',
          senderId: currentUserAddress,
          targetUserId,
          muteId: crypto.randomUUID(),
          timestamp: Date.now(),
        }
      });
    }, [messageService, currentUserAddress]);

    const unmuteUser = useCallback(async (targetUserId: string, spaceId: string, channelId: string) => {
      // Similar pattern with type: 'unmute'
    }, [messageService, currentUserAddress]);
    ```

### Phase 4: Receive-Side Validation & Enforcement

11. **Handle mute/unmute messages** (`src/services/MessageService.ts`)
    - On receiving `mute` message:
      ```typescript
      // Fail-secure validation
      const space = await this.messageDB.getSpace(spaceId);
      if (!space) {
        console.warn(`⚠️ Rejecting mute - space unavailable`);
        return; // FAIL-SECURE
      }

      // Check permission
      const hasPermission = space.roles?.some(
        (role) =>
          role.members?.includes(senderId) &&
          role.permissions?.includes('user:mute')
      );

      if (!hasPermission) {
        console.log(`🔒 Rejecting unauthorized mute from ${senderId}`);
        return; // FAIL-SECURE
      }

      // Check deduplication (replay protection)
      const existingMute = await this.messageDB.getMuteByMuteId(muteId);
      if (existingMute) return; // Already processed

      // Apply mute with timestamp for conflict resolution
      await this.messageDB.muteUser(spaceId, targetUserId, senderId, muteId, timestamp);
      ```
    - Same pattern for `unmute` with timestamp-based conflict resolution (last-write-wins)

12. **Filter muted users' messages** (`src/services/MessageService.ts` in `addMessage()`)
    - Check if sender is muted before adding to query cache
    - Skip adding message if sender is in muted users list for the space
    - **Note**: Filter in MessageService, not in UI components (consistent with `remove-message` pattern)

13. **Disable MessageComposer for muted users** (`src/components/space/Channel.tsx`)
    - Check if current user is muted in this space using `useMutedUsers` hook
    - Pass `disabled={isMuted}` and `disabledMessage={t\`You are muted in this space\`}` to MessageComposer
    - Pattern: Same as read-only channel behavior (line 1083-1088)
    ```typescript
    const { data: mutedUsers } = useMutedUsers(spaceId);
    const isMuted = mutedUsers?.some(m => m.targetUserId === currentUserAddress);

    // In MessageComposer props:
    disabled={!canPost || isMuted}
    disabledMessage={
      isMuted
        ? t`You are muted in this space`
        : channel?.isReadOnly
          ? t`You cannot post in this channel`
          : undefined
    }
    ```

### ~~Phase 5: System Messages~~ (Deferred)

> **Decision**: No system messages for mute/unmute in v1. This prevents harassment via mute spam and aligns with "muted users don't know they're muted" privacy design. Can be added later if needed (moderator-only visibility).

## Verification

✅ **Permission works**
   - Assign `user:mute` to a role
   - User with role can mute/unmute
   - User without role cannot mute

✅ **Mute enforced across clients**
   - User A mutes User B
   - User C (another client) stops seeing User B's messages
   - User B can still send (but messages hidden from others)

✅ **Unmute works**
   - After unmute, User B's messages visible again

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

✅ **Mobile layout works**
   - Buttons don't overflow on small screens

## Definition of Done

- [ ] `user:mute` permission type added
- [ ] MuteMessage/UnmuteMessage types defined
- [ ] Permission available in role settings
- [ ] MuteUserModal created
- [ ] Mute/Unmute button in UserProfile
- [ ] Receive-side validation implemented
- [ ] Muted users' messages hidden
- [ ] TypeScript passes
- [ ] Manual testing successful

## Notes

- This is a **first iteration** - mute is permanent until unmuted (no timing/duration)
- Same role that can mute can also unmute
- **Space owners must have a role with `user:mute` permission** - no implicit bypass (receiving side can't verify owner status)
- Muted user sees disabled composer with "You are muted in this space" - they know they're muted but there's no public announcement

## Security Considerations (from security-analyst review)

### Implemented Mitigations
- **Replay protection**: `muteId` + deduplication check prevents replay attacks
- **Conflict resolution**: Timestamp-based last-write-wins for concurrent mute/unmute
- **Fail-secure validation**: Reject mute when space data unavailable
- **Per-space scoping**: Mute state stored with spaceId to prevent cross-space leaks

### Design Decisions
- **No public system messages**: Other users don't see "X was muted" announcements (prevents harassment, reduces metadata exposure)
- **Muted user is notified**: They see disabled composer - clear feedback without public shaming
- **No isSpaceOwner bypass**: Consistent with `message:pin` - receiving side can't verify owner status (privacy requirement)

### Edge Cases Handled
- **Self-mute**: Reject mute where `targetUserId === senderId`
- **Muted user leaves/rejoins**: Mute state persists (tied to address, not membership)
- **Muted user with custom client**: Their messages are still rejected by honest clients (receive-side validation checks muted list)
- **Moderator leaves after muting**: Mute persists - validation is **point-in-time** (at message receipt), not continuous. Once stored, mute is not re-validated against current roles. Any other moderator with `user:mute` permission can unmute. This is consistent with other actions (deleted messages stay deleted even if moderator loses role).

### Limitations (Acceptable)
- **No rate limiting**: Moderators can spam mute actions (future enhancement)

---

## V2: Mute Duration Support (Future Enhancement)

### Overview
Add ability to mute users for a specific duration (1, 3, 7 days, or forever).

### Type Changes

```typescript
// MuteMessage with optional duration
export type MuteMessage = {
  senderId: string;
  type: 'mute';
  targetUserId: string;
  muteId: string;
  timestamp: number;
  duration?: number;  // milliseconds, 0 or undefined = forever
};

// MutedUserRecord with expiration
type MutedUserRecord = {
  spaceId: string;
  targetUserId: string;
  mutedAt: number;
  mutedBy: string;
  lastMuteId: string;
  expiresAt?: number;  // mutedAt + duration, undefined = forever
};
```

### UI Changes - MuteUserModal V2

Update modal to include duration input:

```tsx
<Modal isOpen={isOpen} onClose={onClose}>
  <Container className="p-4">
    <UserAvatar ... />
    <Text className="text-lg font-semibold mt-2">
      {t`Mute ${userName} for`}
    </Text>

    <FlexRow className="items-center gap-2 mt-3">
      <Input
        type="number"
        min={0}
        value={days}
        onChange={(e) => setDays(parseInt(e.target.value) || 0)}
        className="w-20 text-center"
      />
      <Text>{t`days`}</Text>
    </FlexRow>

    <Text variant="muted" size="sm" className="mt-1">
      {t`Enter 0 to mute forever`}
    </Text>

    <Button
      type="danger"
      onClick={() => onConfirm(days)}
      className="mt-4 w-full"
    >
      {days === 0 ? t`Mute Forever` : t`Mute for ${days} days`}
    </Button>
  </Container>
</Modal>
```

### Expiration Logic

```typescript
// In MessageService when filtering messages:
const isMuted = mutedUsers?.some(m =>
  m.targetUserId === senderId &&
  (!m.expiresAt || m.expiresAt > Date.now())
);

// In Channel.tsx for composer - show remaining time:
const muteRecord = mutedUsers?.find(m => m.targetUserId === currentUserAddress);
const isMuted = muteRecord && (!muteRecord.expiresAt || muteRecord.expiresAt > Date.now());

disabledMessage={
  isMuted
    ? muteRecord.expiresAt
      ? t`You are muted for ${formatDuration(muteRecord.expiresAt - Date.now())}`
      : t`You are muted in this space`
    : ...
}
```

### Complexity
- **Effort**: Low-Medium (~2-3 hours)
- **Risk**: Low (additive change, backwards compatible)
- **Dependencies**: V1 implementation complete

---

_Related: [GitHub Issue #98](https://github.com/QuilibriumNetwork/quorum-desktop/issues/98)_
