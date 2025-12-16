# Implement User Mute Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent, security-analyst agent

**Status**: ✅ Complete
**Complexity**: Medium
**Created**: 2025-12-14
**Completed**: 2025-12-15
**Files**:
- `src/api/quorumApi.ts` - Permission type `'user:mute'`, MuteMessage/UnmuteMessage types
- `src/utils/canonicalize.ts` - Canonicalization for mute/unmute messages
- `src/components/modals/SpaceSettingsModal/Roles.tsx` - Permission dropdown options
- `src/components/modals/MuteUserModal.tsx` - Mute/unmute confirmation modal
- `src/components/user/UserProfile.tsx` - Mute/unmute button
- `src/hooks/business/user/useUserMuting.ts` - Mute/unmute actions hook
- `src/hooks/business/ui/useModalState.ts` - MuteUserTarget interface with isUnmuting
- `src/components/context/ModalProvider.tsx` - Modal integration with mute/unmute logic
- `src/services/MessageService.ts` - Receive-side validation and message filtering
- `src/db/messages.ts` - Mute state persistence (muted_users store)
- `src/utils/channelPermissions.ts` - canMuteUser method
- `src/hooks/queries/mutedUsers/` - Mute state hooks (useMutedUsers, useInvalidateMutedUsers)
- `src/components/space/Channel.tsx` - MessageComposer disabled for muted users
- `src/components/primitives/Icon/types.ts` - volume/volume-off icon names
- `src/components/primitives/Icon/iconMapping.ts` - volume/volume-off mappings

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

2. **Add MuteMessage and UnmuteMessage types** (`src/api/quorumApi.ts` after line 199, following KickMessage)
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
   - **Increment DB version**: Change `DB_VERSION` from `4` to `5` (line 103)
   - Add migration in `onupgradeneeded`:
     ```typescript
     if (event.oldVersion < 5) {
       const mutedUsersStore = db.createObjectStore('muted_users', {
         keyPath: ['spaceId', 'targetUserId'],  // Composite key
       });
       mutedUsersStore.createIndex('by_space', 'spaceId');
       mutedUsersStore.createIndex('by_mute_id', 'lastMuteId');  // For deduplication lookups
     }
     ```
   - Add `MutedUserRecord` type:
     ```typescript
     type MutedUserRecord = {
       spaceId: string;
       targetUserId: string;
       mutedAt: number;
       mutedBy: string;
       lastMuteId: string;  // For deduplication
     };
     ```
   - Add methods: `getMutedUsers(spaceId)`, `getMuteByMuteId(muteId)`, `muteUser(...)`, `unmuteUser(...)`
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
   - **Button labels**: "Send Message", "Mute" (or "Unmute"), "Kick"
   - **Layout**:
     - Row 1: "Send Message" button (full width)
     - Row 2: Moderation buttons side by side (when both visible)
   - **Conditional display**:
     - "Kick" only shown to space owners (`isSpaceOwner && canKickThisUser`)
     - "Mute"/"Unmute" only shown to users with `user:mute` permission (`canMuteUsers`)
     - When only ONE moderation button is visible → it takes full row width
     - When BOTH are visible → side by side
   - **Responsive behavior** (maintain current pattern):
     - On mobile/small screens: all buttons stack vertically (full width each)
     - On desktop: Row 1 full width, Row 2 side-by-side (or single full-width if only one)
   - Add Mute/Unmute toggle state based on `useMutedUsers` hook
   - Mute button opens confirmation modal (see step 9)

   **Icons** (using `iconName` prop on Button):
   - Send Message: `message` (speech bubble) ⚠️ **NEW - add alias to icon system**
   - Mute: `volume-off` (muted speaker) ⚠️ **NEW - add to icon system**
   - Unmute: `volume` (speaker with sound) ⚠️ **NEW - add to icon system**
   - Kick: `ban` (prohibition sign - already in icon system)

   **Add icons to primitive** (`src/components/primitives/Icon/`):
   - In `types.ts`: Add `'message' | 'volume' | 'volume-off'` to IconName type
   - In `iconMapping.ts`: Add mappings:
     ```typescript
     'message': 'IconMessage',      // Alias (comment-dots also maps to this)
     'volume': 'IconVolume',
     'volume-off': 'IconVolumeOff',
     ```
   - Reference: https://tabler.io/icons/icon/message, https://tabler.io/icons/icon/volume, https://tabler.io/icons/icon/volume-off

   ```tsx
   {/* Row 1: Send Message - always full width */}
   <Button size="small" iconName="message" className="w-full justify-center">
     {t`Send Message`}
   </Button>

   {/* Row 2: Moderation buttons - conditional */}
   {(canMuteUsers || canKickUsers) && (
     <Container className={`grid gap-1 sm:gap-2 ${
       canMuteUsers && canKickUsers
         ? 'grid-cols-1 sm:grid-cols-2'  // Both: side by side on desktop
         : 'grid-cols-1'                  // One: full width
     }`}>
       {canMuteUsers && (
         <Button type="secondary" size="small" iconName={isMuted ? 'volume' : 'volume-off'} className="justify-center">
           {isMuted ? t`Unmute` : t`Mute`}
         </Button>
       )}
       {canKickUsers && (
         <Button type="danger" size="small" iconName="ban" className="justify-center">
           {t`Kick`}
         </Button>
       )}
     </Container>
   )}
   ```

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
   - Buttons stack vertically on small screens
   - When only Mute OR Kick visible (not both), button takes full width
   - When both Mute AND Kick visible, they're side-by-side on desktop, stacked on mobile

## Definition of Done

- [x] `user:mute` permission type added
- [x] MuteMessage/UnmuteMessage types defined
- [x] Permission available in role settings
- [x] DB migration added (version 5 with `muted_users` store)
- [x] Icons added to Icon primitive (`volume`, `volume-off`)
- [x] MuteUserModal created (supports both mute and unmute modes)
- [x] Mute/Unmute button in UserProfile (with responsive layout & icons)
- [x] Receive-side validation implemented
- [x] Muted users' messages hidden
- [x] Muted users see disabled MessageComposer
- [x] Canonicalization support for mute/unmute messages
- [x] Manual testing successful

## Notes

- This is a **first iteration** - mute is permanent until unmuted (no timing/duration)
- Same role that can mute can also unmute
- **Space owners must have a role with `user:mute` permission** - no implicit bypass (receiving side can't verify owner status)
- Muted user sees disabled composer with "You are muted in this space" - they know they're muted but there's no public announcement

## Implementation Notes (2025-12-15)

**Key implementation differences from original plan:**
- Mute hook lives in `src/hooks/business/user/useUserMuting.ts` (separate from `useUserProfileActions`)
- Query hooks in `src/hooks/queries/mutedUsers/` (not `mute/`)
- MuteUserModal supports both mute and unmute modes via `isUnmuting` prop (single component for both)

**Critical fix applied:**
- Added `mute` and `unmute` message types to `src/utils/canonicalize.ts` - without this, messages were stored locally but not transmitted over the network (caused "Invalid message type" error)

**UI behavior:**
- Mute/Unmute button visible on own profile if user has permission (allows testing)
- Kick button hidden on own profile (space owners cannot kick themselves)
- Modal shows error via Callout component if mute/unmute fails

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
Add ability to mute users for a specific duration (0-365 days, where 0 = forever).

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

### Canonicalization (Critical!)

**Must add `duration` field to `src/utils/canonicalize.ts`** - same issue we fixed for V1 where messages were stored locally but not transmitted over the network.

### UI Changes - MuteUserModal V2

Update modal to include duration input:

```tsx
const [days, setDays] = useState(1); // Default to 1 day (not forever)

<Modal isOpen={isOpen} onClose={onClose}>
  <Container className="p-4">
    <UserAvatar ... />
    <Text typography="body" className="font-semibold">
      {t`Mute ${userName} for`}
    </Text>

    <FlexRow className="items-center gap-2 mt-3">
      <Input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={0}
        max={365}
        value={days}
        onChange={(e) => {
          const val = parseInt(e.target.value) || 0;
          setDays(Math.min(365, Math.max(0, val))); // Clamp 0-365
        }}
        onKeyDown={(e) => {
          // Block non-numeric keys (allow backspace, delete, arrows, tab)
          if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
            e.preventDefault();
          }
        }}
        onPaste={(e) => {
          // Extract only digits from pasted content
          const pasted = e.clipboardData.getData('text');
          const digitsOnly = pasted.replace(/\D/g, '');
          if (pasted !== digitsOnly) {
            e.preventDefault();
            const val = parseInt(digitsOnly) || 0;
            setDays(Math.min(365, Math.max(0, val)));
          }
        }}
        className="w-20 text-center"
      />
      <Text typography="body">{t`days`}</Text>
    </FlexRow>

    <Text typography="small" variant="subtle">
      {t`0 = forever`}
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

// Helper function for smart duration formatting
const formatMuteRemaining = (expiresAt: number): string => {
  const remaining = expiresAt - Date.now();
  const hours = Math.ceil(remaining / (1000 * 60 * 60));
  const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));

  if (days > 1) {
    return t`${days} days`;
  } else {
    return t`${hours} hours`;
  }
};

// In Channel.tsx for composer - show remaining time:
const muteRecord = mutedUsers?.find(m => m.targetUserId === currentUserAddress);
const isMuted = muteRecord && (!muteRecord.expiresAt || muteRecord.expiresAt > Date.now());

disabledMessage={
  isMuted
    ? muteRecord.expiresAt
      ? t`You are muted for ${formatMuteRemaining(muteRecord.expiresAt)}`
      : t`You are muted in this space`
    : ...
}

// Examples:
// 364d 23h remaining → "You are muted for 365 days"
// 6d 5h remaining   → "You are muted for 7 days"
// 23h 45m remaining → "You are muted for 24 hours"
// 2h 15m remaining  → "You are muted for 3 hours"
// Forever           → "You are muted in this space"
```

### Auto-Refresh on Mute Expiry

Use a single `setTimeout` to exact expiry time (NOT polling with `setInterval`):

```typescript
// In Channel.tsx or a dedicated hook
useEffect(() => {
  if (!muteRecord?.expiresAt) return; // Forever mute, no timer needed

  const remaining = muteRecord.expiresAt - Date.now();
  if (remaining <= 0) return; // Already expired

  const timer = setTimeout(() => {
    invalidateMutedUsers(); // Trigger re-fetch/re-render
  }, remaining);

  return () => clearTimeout(timer);
}, [muteRecord?.expiresAt, invalidateMutedUsers]);
```

**Performance**: One timer per muted user viewing their own status. Negligible cost.

**Note**: JS `setTimeout` max is ~24.8 days, but we don't need to handle this edge case - users will refresh/restart the app long before then, and the timeout recalculates on mount.

### Risks & Considerations

| Risk | Severity | Notes |
|------|----------|-------|
| **Clock skew** | ℹ️ Inherent | Different clients have different local clocks. A mute that expired on one client may still be active on another. Acceptable for client-enforced feature. |
| **Canonicalization** | ⚠️ Critical | Must add `duration` to canonicalize.ts or field won't transmit! |
| **Input validation** | ✅ Simple | Clamp to 0-365 range, error-proof by design |

### Complexity
- **Effort**: Low (~2-3 hours)
- **Risk**: Low (additive change)
- **Backward compatibility**: Non-issue (mute feature is new, no legacy clients to support)

---

_Related: [GitHub Issue #98](https://github.com/QuilibriumNetwork/quorum-desktop/issues/98)_
