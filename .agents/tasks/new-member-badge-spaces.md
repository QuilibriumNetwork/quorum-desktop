---
type: task
title: Implement New Member Badge in Spaces
status: open
complexity: medium
ai_generated: true
created: 2025-12-29T00:00:00.000Z
updated: '2026-01-09'
---

# Implement New Member Badge in Spaces

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Files**:
- `src/services/InvitationService.ts:840-897`
- `src/services/MessageService.ts:2319-2433`
- `src/db/messages.ts:660-736`
- `src/components/message/Message.tsx:703-757`

## What & Why

Users who recently joined a Space are not visually distinguishable from long-time members. We want to show a seedling icon (🌱) next to usernames for members who joined within the last 7 days (matching Discord's behavior). This helps communities welcome new members and provides social context.

## Context

- **Existing pattern**: Pin/bookmark badges in `Message.tsx:707-740` show icons next to usernames
- **Privacy consideration**: Already acceptable - `JoinMessage` already exposes `user_address` joined a Space; we're just adding precise timestamp
- **Current limitation**: `JoinMessage.createdDate` is unreliable - each client sets `Date.now()` when they process the join, not when user actually joined

---

## Implementation

### Phase 1: Add `joinedAt` to Join Broadcast

- [ ] **Add `joinedAt` to participant object** (`src/services/InvitationService.ts:840-864`)
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

- [ ] **Include `joinedAt` in signed message** (`src/services/InvitationService.ts:865-884`)
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

- [ ] **Update space member type** (`src/db/messages.ts`)
    - Done when: `SpaceMember` type includes optional `joinedAt?: number` field
    - Verify: TypeScript compiles without errors

- [ ] **Store `joinedAt` when processing join** (`src/services/MessageService.ts:2349-2354`)
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

### Phase 3: Fix JoinMessage Timestamp (requires Phase 1)

- [ ] **Use authoritative `joinedAt` for JoinMessage** (`src/services/MessageService.ts:2412`)
    - Done when: `JoinMessage.createdDate` uses `participant.joinedAt` instead of `Date.now()`
    - Verify: All clients show same join timestamp for a user
    ```typescript
    // Current (line ~2412):
    createdDate: Date.now(),

    // Change to:
    createdDate: participant.joinedAt,
    ```

### Phase 4: Display Seedling Badge (requires Phase 2)

- [ ] **Add hook to check new member status** (`src/hooks/useIsNewMember.ts` - new file)
    - Done when: `useIsNewMember(spaceId, userAddress)` returns boolean
    - Verify: Returns `true` for members joined < 7 days ago
    ```typescript
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    export function useIsNewMember(spaceId: string, userAddress: string): boolean {
      const { data: members } = useSpaceMembers({ spaceId });
      const member = members?.find(m => m.user_address === userAddress);
      if (!member?.joinedAt) return false;
      return Date.now() - member.joinedAt < SEVEN_DAYS_MS;
    }
    ```

- [ ] **Add seedling badge to Message.tsx** (`src/components/message/Message.tsx:740`)
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

- [ ] **Add badge to mobile layout** (`src/components/message/Message.tsx:819-835`)
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

- [ ] All Phase 1-4 checkboxes complete
- [ ] TypeScript compiles: `npx tsc --noEmit` passes
- [ ] All verification tests pass
- [ ] No console errors or warnings
- [ ] Tested on desktop and mobile viewports
- [ ] Task updated with implementation notes

---

## Implementation Notes

_Updated during implementation_

---

## Updates

**2025-12-29 - Claude**: Initial task creation
