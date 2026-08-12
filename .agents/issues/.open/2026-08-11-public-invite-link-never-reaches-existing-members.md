---
type: bug
title: "Generating a public invite link never reaches existing members"
status: open
priority: high
ai_generated: true
created: 2026-08-11
updated: 2026-08-11
---

# Generating a public invite link never reaches existing members

> **⚠️ AI-Generated**: May contain errors. Verify before use.

Desktop half of a cross-client defect. The mobile half, plus the full
investigation, symptom analysis and recon that produced this, lives in
[`quorum-mobile/.agents/issues/.open/2026-08-11-public-invite-regenerate-copy-and-non-owner-invite-gating.md`](../../../../quorum-mobile/.agents/issues/.open/2026-08-11-public-invite-regenerate-copy-and-non-owner-invite-gating.md)
(finding **3b**). Read that first — this file only covers what changes in this
repo.

The two halves are independent code changes and can be worked in parallel, but
the acceptance test is cross-client and needs both.

## Symptoms

When a Space owner generates a public invite link, no existing member on any
client ever learns about it.

`InvitationService.generateNewInviteLink` ends by persisting the new
`space.inviteUrl` locally and nothing more
(`src/services/InvitationService.ts:420-436`):

```ts
// Persist the new inviteUrl locally.
await this.messageDB.saveSpace(space);
await this.queryClient.setQueryData(buildSpaceKey({ spaceId: space.spaceId }), space);
```

There is no `submitUpdateSpace` call, so no `space-manifest` control message
goes out on the hub. The owner's own client is the only one that knows.

This directly breaks this repo's own non-owner Invites view, which exists
specifically so members can share the Space's public link. It reads
`space.inviteUrl` from the local record (`.../SpaceSettingsModal/Invites.tsx:382-470`)
and the Invites category is hidden from non-owners entirely when that field is
absent (`.../SpaceSettingsModal/SpaceSettingsModal.tsx:225-234`). Since the
field never arrives, the feature is effectively unreachable for members.

The comment at `.../Invites.tsx:382-386` says the URL is "replicated to every
member's local Space record via the encrypted manifest". That is not accurate
for existing members and should be corrected as part of this fix.

## Root Cause

**No manifest refetch exists for an already-joined member.** Verified across
both repos (recon R2 in the mobile issue): every `getSpaceManifest` call site is
either a join or a device-restore, never a refresh.

| Call site | When it runs |
|---|---|
| `src/services/ConfigService.ts:375` | restoring a Space onto a device that does not have it |
| `src/hooks/business/spaces/useInviteValidation.ts:49` | join preview |
| `src/services/InvitationService.ts:472,535` | joining |

So the manifest POST inside `generateNewInviteLink` (`:469`) serves *future
joiners* only. Existing members are updated exclusively by the `space-manifest`
control message, and the invite path never sends one. The URL therefore stays
local until the owner happens to edit the Space for an unrelated reason (name,
icon, description), which broadcasts the full record through
`SpaceService.updateSpace`.

**The plumbing is fine — nothing drops the field** (recon R1). The receive
handler at `src/services/MessageService.ts:5184` verifies the owner signature,
decrypts, casts to `Space` and calls `messageDB.saveSpace(space)` on the whole
record, so `inviteUrl` would land correctly if it were ever sent.

## Solution

**Proposed. Not yet implemented.**

Send the `space-manifest` control message after the manifest POST in
`InvitationService.generateNewInviteLink`, reusing the manifest object already
built for `postSpaceManifest` at `:469`:

```ts
await this.apiClient.postSpaceManifest(spaceId, manifest);
// NEW: tell existing members, not just future joiners.
await this.spaceService.submitUpdateSpace(manifest);
```

`SpaceService.submitUpdateSpace(manifest)` (`src/services/SpaceService.ts:85`)
already does exactly this: it seals the hub envelope with
`{type: 'control', message: {type: 'space-manifest', manifest}}` and enqueues it.

### ⚠️ Do NOT rebuild the manifest

Pass the **same manifest object** that was just POSTed. Do not construct a fresh
one and do not route this through a generic space-update helper that mints its
own ephemeral key. The invite path deliberately encrypts its manifest with the
**same ephemeral X448 key as the eval** (`:368` uses `ephemeralKey` from the eval
step), and re-publishing under a different key would break the legacy-server
fallback described in
[`docs/features/invite-system-analysis.md`](../../docs/features/invite-system-analysis.md)
→ "The eval's ephemeral key is NOT the manifest's". That callout documents the
exact class of bug that caused months of "expired/invalid public invite link"
reports (PR #183).

### Wiring: `InvitationService` has no `SpaceService` reference

Confirmed 2026-08-11: `InvitationService`'s dependencies are `messageDB`,
`apiClient`, `spaceInfo`, `selfAddress`, `enqueueOutbound`, `queryClient`,
`getConfig`, `saveConfig`, `sendHubMessage`, `requestSync`
(`src/services/InvitationService.ts:44-67`). No `spaceService`.

Three ways to close that, in order of preference:

1. **Extract `submitUpdateSpace` into a standalone helper module** that both
   services import. Mirrors mobile, where the equivalent
   (`sendSpaceManifestMessage`) is already a free function rather than a service
   method. Avoids the construction-ordering problem below entirely.
2. **Inject `spaceService` into `InvitationService`.** Note the ordering
   constraint: `new InvitationService` is at
   `src/components/context/MessageDB.tsx:928` and `new SpaceService` at `:1133`,
   so this needs a reorder or a lazy getter.
3. **Inline the envelope seal in `InvitationService`** using the
   `enqueueOutbound` it already holds (`:49`). Works, but duplicates the
   envelope-sealing code — least preferred.

### Also bump `modifiedDate` with `inviteUrl`

**INFERRED, not measured — verify before relying on it.** Mobile's receive path
skips a manifest when `manifest.timestamp < existingSpace.modifiedDate`, then
writes the record wholesale
(`quorum-mobile/context/WebSocketContext.tsx:1924-1938`). `generateNewInviteLink`
does not touch `modifiedDate`, so the broadcast carries an **old**
`modifiedDate` with a **new** `manifest.timestamp`: the guard passes and the
member's stored `modifiedDate` can be written backwards, lowering the watermark
that protects against the hub replaying historical log entries on reconnect.

Set `space.modifiedDate = ts` alongside `space.inviteUrl` at `:363` so the record
stays monotonic. Unchecked: whether this repo's own receive handler has an
equivalent staleness guard — only part of `MessageService.ts:5184+` was read.

### Also fix the stale comment

`.../Invites.tsx:382-386` claims replication happens "via the encrypted
manifest". Correct it to say the URL arrives via the `space-manifest` control
message, once this fix makes that true.

## Release sequencing

**This is safe to ship to production desktop-first. It does not have to wait for
a mobile release.**

The fix introduces **no new message type and no schema change**. `space-manifest`
is an existing hub control message that the mobile build already in production
handles today (`quorum-mobile/context/WebSocketContext.tsx:1828`), and that every
rename, icon change and role grant already sends. This only makes the invite path
send one where it currently sends nothing.

| Combination | Result |
|---|---|
| New desktop → **mobile already in production** | Mobile receives a message type it already understands and saves the record including `inviteUrl`. **Shipped mobile gains the fix for desktop-generated links with no mobile release.** |
| New desktop → new mobile | Fully fixed both directions. |

Interim state once desktop ships alone: desktop-generated public links reach
every member on both clients; mobile-generated ones still reach nobody, exactly
as today. Asymmetric, strictly better, no regression. The mobile half is only
needed for mobile to *originate* a link that propagates.

No `quorum-shared` change is required for this fix, so nothing here is blocked on
a publish.

## Verification

**This is a silent-failure change** — if the broadcast does not land, nothing
errors and no member ever sees a link, which is indistinguishable from today.
It must not ship on code reading alone.

Cross-client acceptance test (needs the mobile half too):

- [ ] Owner on desktop generates a public link → a **mobile** member, already
      joined and online, receives it without the owner touching Space settings
- [ ] Owner on desktop generates a public link → a **desktop** member sees the
      Invites category appear and the link populate
- [ ] Owner on mobile generates a public link → a **desktop** member sees the
      same (this is the mobile half of the fix)
- [ ] **Control arm:** a member of a *different* Space sees no change. If both
      Spaces update, the instrument is wrong, not the code.
- [ ] `yarn tsc --noEmit` and lint pass

## Related

- **Mobile half + full investigation:**
  [`quorum-mobile/.agents/issues/.open/2026-08-11-public-invite-regenerate-copy-and-non-owner-invite-gating.md`](../../../../quorum-mobile/.agents/issues/.open/2026-08-11-public-invite-regenerate-copy-and-non-owner-invite-gating.md).
  Also covers two mobile-only defects (misleading "invalidate the old link"
  copy, and an ungated invite button for non-owners) where **this repo is the
  correct reference** — desktop's copy and gating are both right.
- [`docs/features/invite-system-analysis.md`](../../docs/features/invite-system-analysis.md)
  — invite architecture, both link formats, the eval/manifest ephemeral-key
  trap. Will need a small update once this ships.
- Two pure predicates are proposed for `quorum-shared` in the mobile issue
  (`isPublicInvite`, `canInviteToSpace`). Neither is required for this fix.

---

*Last updated: 2026-08-11*
