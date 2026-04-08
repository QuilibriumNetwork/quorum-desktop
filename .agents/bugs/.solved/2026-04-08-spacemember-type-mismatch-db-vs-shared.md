---
type: bug
title: "SpaceMember field name mismatch between MessageDB and quorum-shared"
status: solved
priority: medium
ai_generated: false
created: 2026-04-08
updated: 2026-04-08
---

# SpaceMember field name mismatch between MessageDB and quorum-shared

## Symptoms

The `saveSpaceMember`, `getSpaceMember`, and `getSpaceMembers` methods in `src/db/messages.ts` cannot use the shared `SpaceMember` type from `@quilibrium/quorum-shared` because the field names differ:

| Concept | Desktop DB (IndexedDB) | SDK `channel.UserProfile` | Shared `SpaceMember` type |
|---|---|---|---|
| User address | `user_address` | `user_address` | `address` (via `UserProfile`) |
| Avatar URL | `user_icon` | `user_icon` | `profile_image` (via `UserProfile`) |
| Display name | `display_name` | `display_name` | `display_name` (matches) |
| Inbox address | `inbox_address` | N/A | `inbox_address` (matches) |

This forces `messages.ts` to maintain its own inline type definitions that duplicate the shared type with different field names. The `indexedDbAdapter.ts` bridges the gap with unsafe `as unknown as SpaceMember[]` and `as any` casts.

Discovered during the new-member-badge implementation (2026-04-08) when attempting to use `SpaceMember` directly as the `saveSpaceMember` parameter type caused ~20 type errors across the codebase.

## Root Cause

Three types evolved independently:

1. **SDK `channel.UserProfile`** (`@quilibrium/quilibrium-js-sdk-channels`): `user_address`, `user_icon`, `display_name`
2. **Shared `UserProfile`** (`@quilibrium/quorum-shared`): `address`, `profile_image`, `display_name`, `name`, `bio`
3. **Desktop IndexedDB schema**: stores data using SDK field names (`user_address`, `user_icon`)

The desktop codebase has 50+ references to `member.user_address` and `member.user_icon` across:
- Services: `MessageService.ts`, `SpaceService.ts`, `EncryptionService.ts`, `InvitationService.ts`, `SyncService.ts`
- Hooks: `useChannelData.ts`, `useSpaceProfile.ts`
- Components: `SpaceSettingsModal.tsx`

Mobile (`quorum-mobile`) uses the shared `address`/`profile_image` convention and maps from SDK fields when saving. Line 1805 of `WebSocketContext.tsx` even has defensive code: `address: member.user_address || member.address || ''`.

## Detailed Analysis

### Desktop data flow
1. SDK sends `channel.UserProfile` with `user_address`/`user_icon`
2. `messages.ts:saveSpaceMember` stores it in IndexedDB as-is (spreading `channel.UserProfile`)
3. `messages.ts:getSpaceMembers` returns objects with `user_address`/`user_icon`
4. All services and hooks access `member.user_address`/`member.user_icon` directly
5. `indexedDbAdapter.ts` wraps `messages.ts` for the `StorageAdapter` interface but uses `as any` casts

### Mobile data flow
1. SDK sends data with `user_address`/`user_icon`
2. `WebSocketContext.tsx` maps to shared convention: `address: participant.address`, `profile_image: participant.userIcon`
3. `mmkvAdapter.ts` stores/retrieves using `address`/`profile_image`

### Who uses what
- `indexedDbAdapter.ts`: Only used by `SyncService.ts`. Everything else calls `messageDB` directly.
- `SyncService.ts` itself also calls `messageDB.getSpaceMembers` directly (not through adapter).
- `MessageService.ts:3948` already has defensive dual-convention code: `member.address || member.user_address`

## Solution

**Chosen approach: Add `user_address` and `user_icon` as optional alias fields on `quorum-shared`'s `SpaceMember` type.**

This is the lowest-risk fix because:
- No IndexedDB migration needed (desktop DB schema unchanged)
- No 50+ file changes across desktop services
- Mobile continues using `address`/`profile_image` (fully backwards compatible)
- The `indexedDbAdapter.ts` can do proper field mapping instead of `as any`
- `messages.ts` can replace inline types with `SpaceMember` from shared

### Changes needed

**quorum-shared (`src/types/user.ts`):**
- Add `user_address?: string` and `user_icon?: string` to `SpaceMember` type (not `UserProfile`, to keep `UserProfile` clean for mobile/API use)

**quorum-desktop (`src/db/messages.ts`):**
- Replace inline type `channel.UserProfile & { inbox_address; isKicked?; spaceTag?; joinedAt? }` with `SpaceMember` from shared
- Verify DB key path still works (IndexedDB uses `user_address` as compound key)

**quorum-desktop (`src/adapters/indexedDbAdapter.ts`):**
- Map `user_address` to `address` and `user_icon` to `profile_image` in get methods
- Map `address` to `user_address` and `profile_image` to `user_icon` in save method
- Remove `as unknown as` and `as any` casts

## Prevention

When extending `SpaceMember` or `UserProfile` in quorum-shared, verify that field names match what is stored in IndexedDB on both platforms before publishing. Consider adding a type-level test that compares the shared type against the DB schema fields.

---

*Updated: 2026-04-08*
