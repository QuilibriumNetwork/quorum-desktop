# Add Space Tag support to shared types

## Context

`quorum-desktop` has implemented Space Tags (Discord-style member badges). Cross-device config sync and mobile display require changes to `quorum-shared`.

---

## Priority 1 — Required for mobile to send and display tags

Without these changes, mobile cannot render space tags on incoming messages, cannot display the tag owner config UI, and cannot broadcast a tag selection in `update-profile`.

### `src/types/space.ts`

```ts
export type SpaceTag = {
  letters: string;        // exactly 4 uppercase alphanumeric
  url: string;            // image as data: URI
  backgroundColor: string; // color name from the standard palette
};

export type BroadcastSpaceTag = SpaceTag & {
  spaceId: string;
};

// Update Space type:
export type Space = {
  // ...existing fields...
  spaceTag?: SpaceTag;
};
```

### `src/types/user.ts` — `SpaceMember`

```ts
// Update SpaceMember:
type SpaceMember = UserProfile & {
  inbox_address: string;
  isKicked?: boolean;
  spaceTag?: BroadcastSpaceTag; // full tag data for rendering by non-members
};
```

### `src/types/message.ts` — `UpdateProfileMessage`

```ts
// Update UpdateProfileMessage:
type UpdateProfileMessage = {
  senderId: string;
  type: 'update-profile';
  displayName: string;
  userIcon: string;
  spaceTag?: BroadcastSpaceTag; // full tag data, not just spaceId
};
```

---

## Priority 2 — Required for cross-device config sync

Without this, a user who selects a tag on desktop will not have that selection propagate to mobile (or vice versa) via the config sync layer.

### `src/types/user.ts` — `UserConfig`

```ts
// Update UserConfig:
type UserConfig = {
  // ...existing fields...
  spaceTagId?: string; // spaceId of selected tag to display
};
```

---

## Priority 3 — Nice to have: member sync digest

Without this, tag updates still propagate correctly via `update-profile` broadcasts. The only gap is that the member sync delta algorithm won't detect a stale `spaceTag` on a `SpaceMember` record during digest comparison — it would only be corrected when a fresh `update-profile` is received. Low impact in practice.

### `src/sync/types.ts` — `MemberDigest`

```ts
interface MemberDigest {
  address: string;
  inboxAddress: string;
  displayNameHash: string;
  iconHash: string;
  spaceTagHash: string; // SHA-256 of JSON.stringify(spaceTag), or '' if none
}
```

### `src/sync/utils.ts` — `computeMemberHash` / `createMemberDigest`

```ts
// computeMemberHash: add spaceTagHash
function computeMemberHash(member: SpaceMember) {
  return {
    displayNameHash: computeHash(member.display_name || ''),
    iconHash: computeHash(member.profile_image || ''),
    spaceTagHash: computeHash(member.spaceTag ? JSON.stringify(member.spaceTag) : ''),
  };
}

// createMemberDigest: include spaceTagHash
function createMemberDigest(member: SpaceMember): MemberDigest {
  const { displayNameHash, iconHash, spaceTagHash } = computeMemberHash(member);
  return {
    address: member.address,
    inboxAddress: member.inbox_address || '',
    displayNameHash,
    iconHash,
    spaceTagHash,
  };
}

// computeMemberDiff: add spaceTagHash to stale check
} else if (
  ourDigest.displayNameHash !== theirDigest.displayNameHash ||
  ourDigest.iconHash !== theirDigest.iconHash ||
  ourDigest.spaceTagHash !== theirDigest.spaceTagHash // add this
) {
```

---

## Notes

- `BroadcastSpaceTag` embeds full tag data so recipients can render it without being members of the source space.
- `IconColor` is currently desktop-only — using `string` here keeps shared types free of desktop-specific deps. Desktop/mobile can narrow to their own union type.
- `computeContentHash` for `update-profile` in `sync/utils.ts` may also need updating to include `spaceTag` in the canonical string (line 91).
- `lastBroadcastSpaceTag` (`UserConfig`) is intentionally **not** included here — it is a desktop-only implementation detail used by the startup refresh hook (`useSpaceTagStartupRefresh`) to detect when a space owner changes their tag design between sessions. Mobile has no equivalent hook, so this field should remain in the desktop `UserConfig` only and not be added to shared types.
