---
type: task
title: "quorum-shared: type the two-slot global identity fields (retire casts)"
status: todo
priority: low
created: 2026-07-16
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
*Last updated: 2026-07-16*
