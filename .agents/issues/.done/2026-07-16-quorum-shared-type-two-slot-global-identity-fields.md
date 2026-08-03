---
type: task
title: "quorum-shared: type the two-slot global identity fields (retire casts)"
status: done
priority: low
created: 2026-07-16
completed: 2026-07-16
related_docs:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
related_files:
  - "src/services/MessageService.ts"
  - "src/components/context/MessageDB.tsx"
  - "src/hooks/business/user/useMembersWithPublicProfileFallback.ts"
  - "src/hooks/business/channels/useChannelData.ts"
---

# quorum-shared: type the two-slot global identity fields

> Housed in the desktop repo (its `.agents/` is git-tracked/synced) but the
> actual code change lands in **quorum-shared**, then both apps swap their casts
> to the typed fields on the next shared bump. Coordinate with the shared lead.

## Context

The two-slot identity design (see identity-resolution-and-profile-sync doc)
shipped 2026-07-16 on branch `follow-global-profile` in both apps. It adds a
GLOBAL identity slot to `update-profile` messages and to member rows, stored
separately from the per-space OVERRIDE fields. To ship without waiting on a
shared publish, both apps carry the new fields **untyped via casts**:

- Wire (`UpdateProfileMessage`): `globalDisplayName` / `globalUserIcon` /
  `globalBio`. Desktop casts with `as unknown as UpdateProfileMessage`
  (`MessageDB.tsx`); mobile casts the content `as MessageContent`
  (`spaceMessageService.ts`).
- Member row: `global_display_name` / `global_user_icon` (`global_profile_image`
  on mobile) / `global_bio`, plus a `globalProfileTimestamp` (mobile). Read via
  `(x as any)` / helper casts on both sides.

This works — old clients ignore unknown wire fields, and the fields round-trip
untyped — but it means zero TypeScript safety on the new fields and a drift
risk if the two apps' field names diverge.

## What to do

1. **quorum-shared** — add, additively and optional:
   - `UpdateProfileMessage`: `globalDisplayName?: string`, `globalUserIcon?:
     string`, `globalBio?: string`.
   - `SpaceMember` / `UserProfile` (whichever the member row extends):
     `global_display_name?`, `global_user_icon?`, `global_bio?`,
     `globalProfileTimestamp?: number`. (Confirm the canonical avatar field
     name — mobile stores `global_profile_image`, desktop reads
     `global_user_icon`; pick ONE in the shared type and align both apps.)
   - Publish.
2. **Desktop** — remove the `as unknown as UpdateProfileMessage` cast in
   `MessageDB.updateUserProfile`, the `as MessageContent`-style casts, and the
   `(curr as any).global_*` reads in `useChannelData` / the
   `applyGlobalProfileSlots` helper; use the typed fields.
3. **Mobile** — same: drop the `content as MessageContent` cast in
   `sendUpdateProfileMessage`, the `as never` member-row writes, and the
   `(local as {...})` reads in `useMembersWithPublicProfileFallback`.

## Gotcha: canonical avatar field name

Mobile's member row uses `global_profile_image`; desktop reads
`global_user_icon` (mirroring its existing `user_icon` vs mobile's
`profile_image` split). This is fine untyped because each app reads its own
storage, but the WIRE field is shared (`globalUserIcon`) and both apps already
agree on it. Only the local storage field names differ. When typing the member
row in shared, decide whether to unify or keep the per-app split documented.

## Sequencing

Do this AFTER the cross-device behavior is confirmed working (no point typing a
wire shape that might still change). Pairs naturally with
`2026-07-16-update-profile-receive-per-slot-timestamp-guard.md` (that guard also
needs the timestamp fields on the shared member type).

---

## Done — 2026-07-16 (shared PR #57 merged to master; desktop branch `feat/two-slot-identity-types-and-timestamp-guard`)

Implemented together with the per-slot timestamp guard task in one typed pass.

**quorum-shared (PR #57, merged):**
- Added `globalDisplayName?` / `globalUserIcon?` / `globalBio?` to
  `UpdateProfileMessage` (additive, optional; canonicalize unaffected). ✅
- **Deviation — member-row fields NOT added to shared's `SpaceMember`.** Recon
  found desktop's member row is typed off `channel.UserProfile` (the SDK type),
  NOT shared's `SpaceMember`, so adding `global_*`/timestamp fields to shared's
  `SpaceMember` would not retire desktop's storage casts. Instead a desktop-local
  `SpaceMemberRow` type (in `src/db/messages.ts`) is now the single source of
  truth for those fields. If mobile later wants a shared member-row type, that's
  a separate, additive step — not required to retire desktop's casts.
- **NOT published / NOT version-bumped** (deliberate — held for the next publish
  batch per the user). Desktop consumes the change via the local symlink today;
  mobile will only see it after a future publish + bump.

**Desktop (branch, not yet PR'd at time of writing):**
- Retired `as unknown as UpdateProfileMessage` in `MessageDB.updateUserProfile`
  → single `as UpdateProfileMessage` cast (matches the tag-rotation rebroadcast
  site; the remaining cast only papers over the pre-existing required-`userIcon`
  field on a global-only broadcast, unrelated to this task). ✅
- Retired the `(curr as any).global_*` reads in `useChannelData` and the
  `(local as {...})` reads in `useMembersWithPublicProfileFallback` — both now
  read typed fields off `SpaceMemberRow` / the existing `MemberRecord`. ✅
- Replaced the `applyGlobalProfileSlots` helper with a typed, guard-aware
  `applyProfileUpdate` (see the timestamp-guard task). ✅

**Mobile — NOT done (out of scope this session).** Step 3 (drop mobile's
`content as MessageContent` cast, `as never` member-row writes, and the
`(local as {...})` reads) still stands. It only becomes possible after shared is
published + mobile bumps to a version carrying the new `UpdateProfileMessage`
fields. Track as a mobile-side follow-up once shared is published. The canonical
avatar-field-name gotcha is resolved by keeping the per-app storage split
(desktop `global_user_icon` vs mobile `global_profile_image`); only the WIRE
name (`globalUserIcon`) is shared and identical — documented, not unified.

*Last updated: 2026-07-16*
