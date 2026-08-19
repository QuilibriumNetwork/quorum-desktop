---
type: bug
title: "Generating a public invite link never reaches existing members"
status: in-progress
priority: high
ai_generated: true
created: 2026-08-11
updated: 2026-08-19
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

## Status

**2026-08-19 — desktop half shipped in PR #355**
(`fix(invite): tell existing members when a public link is generated`).
All three repos now have their half:

| Repo | PR | What landed |
|---|---|---|
| quorum-mobile | #259 | 3a ordering, 3b broadcast, copy fix, non-owner gating |
| quorum-shared | #84 | invite links always carry the production domain |
| quorum-desktop | #355 | 3b broadcast, `modifiedDate` bump, wrapper deleted, docs |

Desktop specifics: the manifest is hoisted into a variable, POSTed, then
broadcast as the same object reference. Sealing moved to a free function
(`src/services/spaceManifestBroadcast.ts`) since `InvitationService` holds no
`SpaceService` reference and is constructed first — option 1 of the three the
Solution section weighed. `submitUpdateSpace` delegates to it and produces a
byte-for-byte identical envelope, keeping its (dead) error swallow so the
rename/icon/role paths are untouched. `space.modifiedDate = ts` now accompanies
`space.inviteUrl`, both before encryption.

Verification: 1527 tests across 166 files, typecheck and lint clean. Four new
tests plus two strengthened assertions, each checked red-on-revert. An
independent review pass traced the ephemeral-key alignment, envelope
equivalence, failure ordering and the wrapper removal, and found no functional
defects.

Two things that review turned up, both handled:

- A pre-existing test asserting `enqueueOutbound` was never called became false
  with this change, and kept passing only because the PR mocks the broadcast
  module — it was describing the mock. Rewritten to assert the invariant it was
  really guarding.
- The "unchecked" question below (does desktop's receive handler have a
  staleness guard?) is now answered: **it does not.** Filed separately as
  [`2026-08-19-desktop-applies-any-space-manifest-with-no-staleness-guard.md`](2026-08-19-desktop-applies-any-space-manifest-with-no-staleness-guard.md).
  Pre-existing and not worsened here, but a correct fix needs an audit of
  whether every desktop sender populates `modifiedDate` first.

**Still open — the acceptance test has NOT been run, and it is this issue's real
pass/fail criterion.** Everything above is unit-level: it proves the right
object goes into the right envelope, not that the envelope arrives. The failure
mode is silent, so no amount of unit testing reaches it. Do not close this issue
until the cross-client checklist below is ticked. It is only now runnable, since
all three halves exist.

Scope note for whoever runs it: a member who joined *via* the public link
already had the URL, because the manifest fetched on the way in carries it. The
members this fixes are the ones who were in the Space **before** the link was
created.

## Symptoms

When a Space owner generates a public invite link, no existing member on any
client ever learns about it.

`InvitationService.generateNewInviteLink` ends by persisting the new
`space.inviteUrl` locally and nothing more
(`src/services/InvitationService.ts:423-427`):

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
absent (`.../SpaceSettingsModal/SpaceSettingsModal.tsx:222-229`). Since the
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

So the manifest POST inside `generateNewInviteLink` (`:410`) serves *future
joiners* only. Existing members are updated exclusively by the `space-manifest`
control message, and the invite path never sends one. The URL therefore stays
local until the owner happens to edit the Space for an unrelated reason (name,
icon, description), which broadcasts the full record through
`SpaceService.updateSpace`.

**The plumbing is fine — nothing drops the field** (recon R1). The receive
handler at `src/services/MessageService.ts:5193` verifies the owner signature,
decrypts, casts to `Space` and calls `messageDB.saveSpace(space)` on the whole
record, so `inviteUrl` would land correctly if it were ever sent.

## Solution

**Proposed. Not yet implemented.**

Send the `space-manifest` control message after the manifest POST in
`InvitationService.generateNewInviteLink`, reusing the manifest object already
built for `postSpaceManifest` at `:410`:

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
   `src/components/context/MessageDB.tsx:932` and `new SpaceService` at `:1137`,
   so this needs a reorder or a lazy getter.
3. **Inline the envelope seal in `InvitationService`** using the
   `enqueueOutbound` it already holds (`:49`). Works, but duplicates the
   envelope-sealing code — least preferred.

### Also bump `modifiedDate` with `inviteUrl`

**INFERRED, not measured — verify before relying on it.** Mobile's receive path
skips a manifest when `manifest.timestamp < existingSpace.modifiedDate`, then
writes the record wholesale
(`quorum-mobile/context/WebSocketContext.tsx:1921-1935`). `generateNewInviteLink`
does not touch `modifiedDate`, so the broadcast carries an **old**
`modifiedDate` with a **new** `manifest.timestamp`: the guard passes and the
member's stored `modifiedDate` can be written backwards, lowering the watermark
that protects against the hub replaying historical log entries on reconnect.

Set `space.modifiedDate = ts` alongside `space.inviteUrl` at `:363` so the record
stays monotonic. Unchecked: whether this repo's own receive handler has an
equivalent staleness guard — only part of `MessageService.ts:5193+` was read.

### Also fix the stale comment

`.../Invites.tsx:382-386` claims replication happens "via the encrypted
manifest". Correct it to say the URL arrives via the `space-manifest` control
message, once this fix makes that true.

### Also fold in: always generate the canonical production invite domain (decided 2026-08-18)

Shared's `getInviteUrlBase()` derives the invite-link domain from
`window.location.hostname` (`quorum-shared/src/utils/inviteDomain.ts:13-45`):
`test.quorummessenger.com` on staging, `localhost:<port>` in dev, `qm.one` in
production. The generated URL is persisted into `space.inviteUrl` — and once
this issue's broadcast fix lands, it replicates to every member on every
client. A link generated on a test or localhost build therefore reaches
production users as an unshareable URL. Worse on mobile: its
`VALID_INVITE_PREFIXES` (`quorum-mobile/services/space/inviteService.ts:41-50`)
does not include `test.quorummessenger.com` at all, so mobile's
`isPublicInvite()` rejects the link and (after the mobile issue's Fix 2) hides
the member share pill entirely.

The domain carries no information. The join payload lives entirely in the hash
fragment, and shared's own `getValidInvitePrefixes` accepts production-domain
links in every environment (`inviteDomain.ts:76-87` — its comment says exactly
this). Mobile already generates production-only, so this is also a parity fix.

**Decision: generation becomes canonical, acceptance stays permissive.**

1. **Shared:** make `getInviteUrlBase()` / `getInviteBaseDomain()` return the
   production base unconditionally — `https://app.quorummessenger.com` + path.
   (Desktop's wrapper already rewrites `qm.one` → `app.quorummessenger.com`, so
   bake that in rather than emitting `qm.one`.) Leave `getValidInvitePrefixes`
   untouched so legacy test/localhost links still parse for joining.
2. **Desktop:** delete the now-moot wrapper at
   `src/services/InvitationService.ts:18-22`. The two call sites that bypass it
   — `src/services/MessageService.ts:5512` and
   `src/services/SpaceService.ts:1180` — call shared directly and heal
   automatically. Update the unit test around
   `src/dev/tests/services/InvitationService.unit.test.tsx:875`, which exercises
   the env branch. `JoinSpaceModal.tsx:50` (`getInviteDisplayDomain`) is
   display-only and will simply show the production domain everywhere.
3. **Mobile:** no change — its generator is already hardcoded to production.

Costs and healing:

- Dev workflow: pasting a production link into a localhost build already joins
  fine (production prefixes are accepted in every environment). Only
  click-through deep-link testing needs a hand-edited domain. Accepted trade.
- Legacy records already carrying localhost/test URLs self-heal when the owner
  republishes: the URL is rebuilt canonical, and the broadcast fix propagates it.

## Release sequencing

**This is safe to ship to production desktop-first. It does not have to wait for
a mobile release.**

The fix introduces **no new message type and no schema change**. `space-manifest`
is an existing hub control message that the mobile build already in production
handles today (`quorum-mobile/context/WebSocketContext.tsx:1823`), and that every
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

No `quorum-shared` change is required for the broadcast fix itself. The domain
fold-in above does change shared, but desktop consumes shared via `link:`, so it
lands without waiting on an npm publish — and mobile needs nothing from it.

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
- [ ] **Domain fold-in:** a public link generated on a localhost (and, if
      reachable, test.quorummessenger.com) build reads
      `https://app.quorummessenger.com/invite/#…`
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

*Last updated: 2026-08-18*
