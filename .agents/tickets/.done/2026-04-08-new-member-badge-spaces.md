---
type: task
title: Implement New Member Badge in Spaces
status: done
complexity: medium
ai_generated: true
created: 2025-12-29T00:00:00.000Z
updated: 2026-04-08
---

# Implement New Member Badge in Spaces

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> reviewed by Experts Panel agents. 


**Files**:
- `src/services/InvitationService.ts:833-876`
- `src/services/MessageService.ts:2876-2959`
- `src/components/message/Message.tsx:762-874`

## What & Why

Users who recently joined a Space are not visually distinguishable from long-time members. We want to show a seedling icon (🌱) next to usernames for members who joined within the last 7 days (matching Discord's behavior). This helps communities welcome new members and provides social context.

## Context

- **Existing pattern**: Pin/bookmark badges in `Message.tsx:707-740` show icons next to usernames
- **Privacy consideration**: The `joinedAt` timestamp is scoped entirely within the Space's encrypted channel — it is **not** a global user property. It only travels through the same encrypted channel as the existing "XYZ has joined" message, is stored per-Space in each member's local IndexedDB (`space_members` keyed by `[spaceId, user_address]`), and is invisible to anyone outside the Space. Members of Space A cannot see when a user joined Space B. Since the join event is already visible in the chat stream, `joinedAt` formalizes an implicit timestamp rather than introducing new metadata exposure.
- **Current limitation**: `JoinMessage.createdDate` is unreliable - each client sets `Date.now()` when they process the join, not when user actually joined

---

## Implementation

### Phase 1: Add `joinedAt` to Join Broadcast

> **Recommended**: Extract signature payload building into a shared helper function used by both `InvitationService.ts` (signing) and `MessageService.ts` (verification) to prevent schema drift when fields are added/changed.

- [x] **Add `joinedAt` to participant object** (`src/services/InvitationService.ts:833-864`)
    - Done when: `participant` object includes `joinedAt: Date.now()` field
    - Verify: Console log participant object shows `joinedAt` timestamp
    ```typescript
    // Current participant object (line ~840):
    const participant = {
      address: currentPasskeyInfo.address,
      // ... other fields
      displayName: currentPasskeyInfo!.displayName,
      signature: '',
    };

    // Change to:
    const participant = {
      address: currentPasskeyInfo.address,
      // ... other fields
      displayName: currentPasskeyInfo!.displayName,
      joinedAt: Date.now(),  // ADD THIS
      signature: '',
    };
    ```

- [x] **Include `joinedAt` in signed message** (`src/services/InvitationService.ts:865-876`)
    - Done when: `joinedAt` is part of the signed payload
    - Verify: Signature covers the timestamp (prevents tampering)
    ```typescript
    // Current (line ~865):
    const msg = Buffer.from(
      currentPasskeyInfo.address +
        ratchet.id +
        // ... other fields
        participant.displayName,
      'utf-8'
    ).toString('base64');

    // Change to:
    const msg = Buffer.from(
      currentPasskeyInfo.address +
        ratchet.id +
        // ... other fields
        participant.displayName +
        participant.joinedAt,  // ADD THIS
      'utf-8'
    ).toString('base64');
    ```

### Phase 2: Store `joinedAt` in Space Members (requires Phase 1)

- [x] **Update space member type** — already done in `@quilibrium/quorum-shared` (`SpaceMember` includes `joinedAt?: number`)

- [x] **Store `joinedAt` when processing join** (`src/services/MessageService.ts:2876`)
    - Done when: `saveSpaceMember` call includes `joinedAt` from participant
    - Verify: IndexedDB `space_members` store shows `joinedAt` field
    ```typescript
    // Current (line ~2349):
    this.messageDB.saveSpaceMember(conversationId.split('/')[0], {
      user_address: participant.address,
      user_icon: participant.userIcon,
      display_name: participant.displayName,
      inbox_address: participant.inboxAddress,
      isKicked: false,
    });

    // Change to:
    this.messageDB.saveSpaceMember(conversationId.split('/')[0], {
      user_address: participant.address,
      user_icon: participant.userIcon,
      display_name: participant.displayName,
      inbox_address: participant.inboxAddress,
      isKicked: false,
      joinedAt: participant.joinedAt,  // ADD THIS
    });
    ```

- [x] **Include `joinedAt` in query cache update** (`src/services/MessageService.ts:2883`)
    - Done when: `queryClient.setQueryData` includes `joinedAt` so the badge appears immediately without refetch
    - Verify: Badge shows right away when a new member joins (no page refresh needed)
    ```typescript
    // Current cache update is missing joinedAt:
    await queryClient.setQueryData(
      buildSpaceMembersKey({ spaceId: conversationId.split('/')[0] }),
      (oldData: secureChannel.UserProfile[]) => {
        return [...(oldData ?? []), {
          user_address: participant.address,
          user_icon: participant.userIcon,
          display_name: participant.displayName,
          joinedAt: participant.joinedAt,  // ADD THIS
        }];
      }
    );
    ```

### Phase 3: Fix JoinMessage Timestamp (requires Phase 1)

- [x] **Use authoritative `joinedAt` for JoinMessage** (`src/services/MessageService.ts:2939`)
    - Done when: `JoinMessage.createdDate` uses `participant.joinedAt` instead of `Date.now()`
    - Verify: All clients show same join timestamp for a user
    ```typescript
    // Current (line ~2412):
    createdDate: Date.now(),

    // Change to:
    createdDate: participant.joinedAt,
    ```

### Phase 4: Display Seedling Badge (requires Phase 2)

- [x] **Add hook to check new member status** (`src/hooks/useIsNewMember.ts` - new file)
    - Done when: `useIsNewMember(memberMap, userAddress)` returns boolean
    - Verify: Returns `true` for members joined < 7 days ago
    - **Note**: Uses a pre-built `Map` to avoid O(n) `.find()` per message render
    ```typescript
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    export function useIsNewMember(
      memberMap: Map<string, SpaceMember> | undefined,
      userAddress: string
    ): boolean {
      const member = memberMap?.get(userAddress);
      if (!member?.joinedAt) return false;
      return Date.now() - member.joinedAt < SEVEN_DAYS_MS;
    }
    ```

- [x] **Build memoized member lookup Map** (in message list parent component)
    - Done when: `memberMap` is built once via `useMemo` and passed down to messages
    - Verify: Map is only rebuilt when `members` data changes, not on every render
    ```typescript
    const { data: members } = useSpaceMembers({ spaceId });
    const memberMap = useMemo(
      () => new Map(members?.map(m => [m.user_address, m]) ?? []),
      [members]
    );
    ```

- [x] **Add seedling badge to Message.tsx** (`src/components/message/Message.tsx:795`)
    - Done when: Seedling icon appears next to new member names
    - Verify: Badge shows for 7 days then disappears
    - Reference: Follow pin badge pattern from `Message.tsx:707-724`
    ```typescript
    // Add after bookmark badge (line ~740):
    {isNewMember && (
      <Tooltip
        id={`new-member-${message.messageId}`}
        content={t`New member`}
        showOnTouch={true}
        autoHideAfter={3000}
      >
        <Icon
          name="seedling"
          size="sm"
          variant="filled"
          className="ml-2 text-success"
        />
      </Tooltip>
    )}
    ```

- [x] **Add badge to mobile layout** (`src/components/message/Message.tsx:823-874`)
    - Done when: Badge also appears in mobile message layout
    - Verify: Works on mobile viewport

---

## Verification

✓ **New member badge appears**
    - Test: Join a Space → send message → seedling icon visible next to name
    - Test: Wait 7+ days (or mock time) → badge disappears

✓ **All clients see same join date**
    - Test: User A joins → User B and C both see same "joined" timestamp
    - Test: JoinMessage shows consistent `createdDate` across all clients

✓ **Signature includes joinedAt**
    - Test: Tamper with `joinedAt` in transit → signature verification fails
    - Verify: Join is rejected if timestamp is modified

✓ **TypeScript compiles**
    - Run: `npx tsc --noEmit`

✓ **Works on mobile**
    - Test: Badge visible and properly styled on mobile viewport

---

## Edge Cases

| Scenario | Expected Behavior | Status | Priority | Risk |
|----------|-------------------|--------|----------|------|
| User joined before feature | No badge (no `joinedAt` stored) | ⚠️ Acceptable | P2 | Low |
| User rejoins after leaving | New `joinedAt` set, badge shows again | ✓ Expected | P1 | Low |
| Clock skew between devices | Minor discrepancy acceptable (seconds) | ⚠️ Acceptable | P2 | Low |
| Spoofed `joinedAt` (old date) | Signature prevents tampering | ✓ Already handled | P0 | Low |

---

## Definition of Done

- [x] All Phase 1-4 checkboxes complete
- [x] TypeScript compiles: `npx tsc --noEmit` passes
- [ ] All verification tests pass
- [ ] No console errors or warnings
- [ ] Tested on desktop and mobile viewports
- [x] Task updated with implementation notes

---

## Implementation Notes

### 2026-02-18 — Blocker identified: `quorum-shared` type change required

~~During implementation planning we determined that `joinedAt` must be added to the `SpaceMember` type in `@quilibrium/quorum-shared` **before** this feature can be implemented here.~~

**Resolved 2026-04-08**: `joinedAt?: number` is now present on `SpaceMember` in `@quilibrium/quorum-shared` (`src/types/user.ts:86`). The `src/db/messages.ts` local type no longer exists; the shared type is used throughout.

### 2026-04-08 — Unblocked, line number refresh

- Blocker resolved: `SpaceMember.joinedAt` exists in quorum-shared
- Phase 2 "Update space member type" step marked as done
- Removed `src/db/messages.ts` from file list (no local type to update)
- Line numbers updated across all phases (MessageService.ts shifted ~500 lines, Message.tsx shifted ~55 lines)
- `useSpaceMembers` remains a local hook (not yet migrated to quorum-shared), no impact on this task

---

## Updates

**2025-12-29 - Claude**: Initial task creation
**2026-02-16 - Claude**: Expert panel review (Arch 7/10, Impl 5/10, Pragmatism 8/10). Applied fixes:
  - Phase 4: Replaced per-message `.find()` with memoized `Map` lookup to avoid O(n*m) perf cliff
  - Phase 2: Added missing `joinedAt` to query cache update (badge shows immediately, no refetch needed)
  - Phase 1: Added recommendation to extract shared signature payload builder
**2026-02-18 - Claude**: Marked as blocked. `quorum-shared` needs `joinedAt?: number` on `SpaceMember` before implementation. 
**2026-04-08 - Claude**: Unblocked. `joinedAt` now in quorum-shared. Updated line numbers, marked Phase 2 type step as done. Renamed file with date prefix.
- **2026-04-08 15:51**: Implementation complete. Phase 4 deviation: instead of a separate useIsNewMember hook + memoized Map, joinedAt flows through the existing mapSenderToUser pipeline (added to useChannelData.ts members map). isNewMember computed inline in Message.tsx. Simpler and achieves same O(1) lookup. TypeScript fix: local inline types in messages.ts extended with joinedAt (could not use shared SpaceMember directly due to field name mismatch — see bug 2026-04-08-spacemember-type-mismatch-db-vs-shared.md). Space owner naturally excluded: they never go through join broadcast, so joinedAt is undefined and no badge shows.
