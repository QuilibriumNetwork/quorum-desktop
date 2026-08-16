---
type: bug
title: "Desktop never sends or reads a broadcast .q, and renders a profile .q with no ownership check at all"
status: open
priority: critical
complexity: large
ai_generated: true
created: 2026-08-16
updated: 2026-08-16
area: "Identity resolution / QNS / wire protocol"
repos: quorum-desktop (mobile's half is DONE — see §2)
source: found 2026-08-16 while implementing the mobile half; every desktop claim below was re-verified against quorum-desktop main on that date
related:
  - "issues/2026-08-10-identity-resolution-architecture-design.md (the ladder this plugs into)"
  - "issues/2026-08-10-identity-resolution-architecture-plan.md"
  - "quorum-mobile .agents/issues/2026-08-16-broadcast-q-claims-never-render-after-the-identity-migration.md (the mobile implementation to mirror)"
  - "quorum-mobile .agents/issues/2026-08-06-decouple-qns-primary-name-from-public-profile-design.md (why the broadcast transport exists)"
---

# Desktop has no `.q` broadcast, and trusts a `.q` it never checks

## For the agent picking this up — read this first

**There are TWO independent problems here.** They share a subsystem, and one of
them is a live security gap that does not depend on the other at all.

- **§4 is a security fix.** Desktop renders a `.q` from a fetched public profile
  without ever asking whether that account owns the name. Ship this even if
  nothing else in this file gets done.
- **§5 is parity work.** Desktop neither sends nor reads the broadcast that
  carries a `.q` today.

Do §4 first. It is smaller, it is independent, and §5 is unsafe without it.

Do not start by reading the mobile repo end to end. Read this file, then the
four locations in §3.

---

## 1. The problem in plain words

A QNS name (`alice.q`) is presented to users as a trust marker: the suffix is
the only signal a viewer gets that a name is genuinely owned. So a client that
renders a `.q` is making a claim on someone's behalf.

Two things are wrong on desktop, and they pull in opposite directions:

1. **It shows a `.q` it has not verified.** Anyone who can get a
   `primary_username` into a public profile desktop fetches will render with a
   `.q`, whether or not they own the name.
2. **It shows no `.q` for the one transport that actually works.** The
   public-profile route is dead server-side (the API rejects every publish
   carrying `primary_username`, upstream
   [quorum-mobile#240](https://github.com/QuilibriumNetwork/quorum-mobile/issues/240)).
   The space/DM broadcast is the only working route, and desktop neither sends
   nor reads it.

Put together: **the `.q` a desktop user sees today is the one nobody checked,
and the one that is checked never arrives.**

## 2. What mobile already did, so you do not redesign it

Mobile shipped both halves. Mirror the decisions rather than re-deriving them:

| Piece | Mobile location |
|---|---|
| Ownership predicate | `utils/verifyQnsClaim.ts` — `claimedNameBelongsTo(record, address)` |
| Batched resolve + cache | `hooks/useVerifiedQnsNames.ts` — `useClaimRecords`, `resolveClaimedNames`, `QNS_BATCH_LIMIT` |
| Two-transport precedence | `hooks/useVerifiedQnsNames.ts` — `claimIn` |
| The single checkpoint | `identity/identityProvider.tsx` — `broadcastClaimsFor`, `claimRows`, `verifiedQnsNames` |
| Space send | `services/space/spaceMessageService.ts:915` |
| DM send | `services/dm/dmProfileService.ts:91` |
| Receive (3 paths) | `context/WebSocketContext.tsx:769` (DM), `:2791` (inbox), `:4709` (native batch) |

**The one structural decision worth copying verbatim:** mobile's
`IdentitySources` carries `verifiedQnsNames` (address → an already-verified
name) and **no profile object at all**. An unverified claim has nowhere to live,
so a surface cannot render one even by mistake. Desktop's `IdentitySources`
carries raw `profiles`, which is exactly why §4 is possible.

## 3. Where the pieces are — VERIFIED on `main`, 2026-08-16

| What | Where | State |
|---|---|---|
| The unverified read | `src/identity/identityProvider.tsx:108` — `qnsName: nn(profile?.primary_username)` | **no check of any kind** |
| Sources shape | `src/identity/identityProvider.tsx:28-50` — `profiles: Record<string, PublicProfileResponse \| null>`, commented "the ONLY source of primary_username" | holds the raw claim |
| Space send | `src/hooks/business/spaces/useSpaceProfile.ts:313-323` | sends `displayName` / `userIcon` / `bio` only |
| DM send | `src/services/MessageService.ts:701-707` | same three fields |
| DM send gate signature | `src/utils/dmProfileGate.ts:102-108` — `dmProfileSignature` | three fields; **no QNS field** |
| Space receive | `src/services/MessageService.ts:269` — `applyProfileUpdate` | six fields, none a QNS name |
| DM receive | `src/services/MessageService.ts:962-973` — `handleDMProfileUpdate` | writes `displayName` / `icon` / `bio` only |

Available already, do not rebuild:

- `deriveAddress` and `resolveName` are exported from `@quilibrium/quorum-shared`
  (`src/qns/deriveAddress.ts`, `src/qns/resolver.ts`), and desktop already uses
  both in `src/hooks/business/qns/useResolveQnsName.ts`.
- Desktop already has a per-partner DM send gate and a space announce gate.

**Not available, and this is the main build cost:** shared exports
`resolveName` (SINGULAR) only. There is no `resolveBatch` and no
`claimedNameBelongsTo` anywhere in desktop or shared. See §4.3.

## 4. FIRST: verify the claim desktop already renders

This is a security fix and stands alone. It needs none of §5.

### 4.1 The check

One comparison, and mobile's `verifyQnsClaim.ts` is the reference
implementation. Port it or lift it into `quorum-shared/src/qns/`:

```
claimed name ──resolve──▶ resolveKey (ed448)
                              │ deriveAddress()
                              ▼
                     derived Qm address === the address the claim arrived with?
```

**Every ambiguous case is FALSE.** No record, no key, malformed key, missing
address: all false. Withholding a `.q` from its rightful owner is invisible and
self-correcting; granting one to an impersonator is undetectable by the viewer
and permanent. The errors are not symmetric, so the predicate is boolean rather
than tri-state — the moment a caller can tell "could not tell" from "no",
somebody renders it optimistically, and an optimistic `.q` is the whole attack.

### 4.2 Where it goes

**Inside the provider, not at each surface.** Replace `profiles` in
`IdentitySources` with `verifiedQnsNames: Record<string, string>` plus
`profileGlobalNames: Record<string, string>` for the display name (which carries
no trust claim and needs no check). Then `identityProvider.tsx:108` reads
`nn(sources.verifiedQnsNames[address])` and there is nowhere left to put an
unverified claim.

Doing it per-surface is the wrong shape: a surface that forgets renders a
forgery, and there is no way to prove none forgot.

**Unproven includes NOT-YET-KNOWN.** A lookup in flight yields no entry, so the
name is simply absent and the global name renders. Never render `.q`
optimistically and then correct it: only ever upgrade INTO a `.q`.

### 4.3 The batching problem, which is a correctness concern here

Mobile measured a 100-name batch at ~190ms and a 1-name batch at ~167ms, so a
screenful costs the same as a single name. That measurement is what makes
verification affordable, and desktop has no batch endpoint wired up.

**Do not ship N single `resolveName` calls per screen.** A space roster is
unbounded by anything the user did; one request per row is the fetch storm both
clients already refused once.

Add a batched resolver to `quorum-shared/src/qns/` (the API is
`POST /resolve/batch`, see mobile `services/api/qnsClient.ts:501`). Note the
measured hard limit: **101 names returns `400 BATCH_SIZE_EXCEEDED` for the whole
request**, so an oversized batch loses everything on screen, not just the
excess. Chunk at 100.

### 4.4 `staleTime` is a security parameter

Mobile uses 1 hour, and the reason is not performance: it is the window in which
a name that has been transferred away keeps verifying under its previous owner.
Match it. Do not shorten it for freshness or lengthen it for cost without saying
so in the code.

## 5. SECOND: send and read the broadcast

Only after §4. A client that reads the wire field without checking it exposes
its own users regardless of what the other client does.

### 5.1 Send

Add `primaryUsername` to both payloads:

- space: `useSpaceProfile.ts:313-323`
- DM: `MessageService.ts:701-707`

Send it **unconditionally, including the empty string.** `''` is a deliberate
un-election and has to reach the peer, or dropping a primary name never
propagates and the old name renders for everyone else forever.

⚠️ **Add it to `dmProfileSignature` (`src/utils/dmProfileGate.ts:102-108`) and to
the space announce signature.** Miss this and electing a name broadcasts
nothing whenever the rest of the payload is unchanged: the gate reads it as
"same as last time". This is not hypothetical — it is the single most likely way
to ship this looking correct and having it do nothing.

Including it also doubles as the migration: every stored signature predates the
field, so none match and the next rebroadcast goes out to every partner once.

The field is **additive and undeclared** in `quorum-shared` —
`UpdateProfileMessage` has no QNS field, and mobile sends it through an untyped
cast. That is deliberate: `canonicalize` covers only `type`, `displayName` and
`userIcon`, so adding a field cannot break signature verification on any client
of any version, and old clients ignore what they do not know. **Do not "fix"
this by adding it to shared** as part of this task.

### 5.2 Receive

Store it under its own key, **never as `primary_username`**:

- space: `applyProfileUpdate` (`MessageService.ts:269`) → the member row
- DM: `handleDMProfileUpdate` (`MessageService.ts:962-973`) → the conversation row

Call it `claimed_primary_username`, matching mobile. The separate key is a
security property, not a naming preference: surfaces that skip verification read
`primary_username`, so a wire claim landing there renders unverified on every one
of them. Under `claimed_`, an unverified value is inert.

It belongs in the **global slot group**, sharing `globalProfileTimestamp` and the
`applyGlobal` staleness guard — it is part of a global identity, not a per-space
override.

### 5.3 Feed it to the ladder — and note there are TWO landing places

This is the part mobile's own plan got wrong and had to fix late, so it is
called out here rather than left to be rediscovered.

The same broadcast lands in **two different rows**:

- a space claim → the space member row
- a DM claim → the **conversation row**

And a DM resolves with **no `spaceId`**, so the roster is not consulted at all
for one. Wiring only rosters leaves every partner who shares no Space without a
`.q` — which is exactly the case the public-profile route can never serve.
**Both, or the feature is half-built.**

Merge the two into one claim per address before verifying, using mobile's rule
(`identity/identityProvider.tsx`, `broadcastClaimsFor`):

1. **Any present-and-empty claim un-elects.** One source having heard the clear
   is enough; a stale source still holding the old name must not win.
2. **Otherwise the first non-empty claim, spaces in sorted id order, then the
   conversation.** Sorted, so a merge cannot make it flap between renders.

Then apply mobile's `claimIn` precedence against the profile claim: **the
broadcast wins whenever PRESENT, including when empty.** Presence, not
truthiness. An empty broadcast claim is an un-election and must beat a profile
still carrying the old name; an ABSENT field falls back to the profile.

⚠️ The obvious re-derivation — `broadcastClaim ?? profileClaim`, or any
truthiness test — compiles, reads correctly, passes a naive test, and silently
breaks un-election, because it cannot tell empty from absent. Mobile exports
`claimIn` for exactly this reason.

### 5.4 Bound it demand-driven

Only verify a claim for an address something has actually asked to resolve.
Rosters and inboxes are both unbounded. Mobile reuses its existing
requested-address mechanism and adds names to a batch already capped at one
request, so it adds **no new per-address fetch**. Do the same, and do not
introduce a second cap.

## 6. Hard rules

- **Exactly one place may write the verified-name map**, and every write goes
  through the ownership check. Keep it that way; it is what makes "no surface
  forgot" provable rather than hopeful.
- **Never write a wire claim into `primary_username`.** Its own key, always.
- **Nothing outside the identity module may append `.q`.** One place spells the
  suffix.
- **Do not add the wire field to `quorum-shared`'s `UpdateProfileMessage`.** It
  is deliberately additive and undeclared.
- **Do not shorten the verification cache TTL.** It is a security parameter.

## 7. Verification bar

**Unit — required, and each must be proven to FAIL before the fix.** A test that
cannot fail is worse than none, because it manufactures confidence. Mobile's
equivalents are `__tests__/identityProviderRosterClaims.test.tsx` and
`__tests__/rootIdentityScopeWiring.test.tsx`; copy their shape.

1. A profile claim that resolves back to the claiming address renders `.q`.
2. **Impostor:** same claim, resolver record derives to a DIFFERENT address →
   no `.q`. Use a genuine ed448 pair and leave the verify predicate UNMOCKED.
   This is the case a real user cannot stage, and it is the one that matters.
3. A claim whose lookup is still in flight renders no `.q`, and renders one once
   the lookup lands (prove the pending state was pending, not broken).
4. A roster row carrying ONLY the broadcast claim, with no public profile at
   all, renders `.q`.
5. **A DM conversation row carrying only the broadcast claim, with no roster and
   no profile, renders `.q`.** Separate from (4) — different storage.
6. An EMPTY broadcast claim un-elects a name the profile still carries. Drive it
   as a SEQUENCE: render the `.q` first, then clear it. A single-render
   assertion here passes on a build that ignores broadcasts entirely, because
   "no `.q`" is briefly true in every implementation.
7. A deliberate per-space nickname still outranks the `.q`; a nickname that
   merely echoes the global name does NOT bury it.
8. A fetch-count test asserting a NUMBER, with well over the cap of claimants
   present but unrequested.
9. **Something actually hands the provider a DM claim.** Test the wiring, not
   just the provider. Mobile's space half shipped broken precisely because the
   claim arrived, was stored, was verifiable, and nothing read it — and every
   provider-level test passed throughout.

**Then revert the ownership check to `true` and confirm 2, 3 and 5 go red.**

**Device:** two accounts, public profiles OFF on both, one owning a real
registered resolvable name. ⚠️ The other client must be running a build with the
broadcast — on mobile that means **after 2026-08-09** (PR #245). A mobile build
older than that sends nothing, and the test will look like a desktop failure.
Tell them apart by the QNS list: a build with a static "★ Primary" badge instead
of a "Remove as Primary" button predates it.

Consider porting mobile's `Why no .q?` dev panel
(`components/dev/QnsExplainPanel.tsx`). "No `.q`" has at least four causes that
look identical on screen, and two separate mobile sessions were spent arguing
about which from screenshots before that panel existed.

## 8. Explicitly out of scope

- **The server's QNS lookup.** `POST /users/:addr/public-profile` carrying a
  `primary_username` fails with `qns primary username failed validation: qns
  lookup: Get "./": stopped after 10 redirects` — a malformed outbound URL,
  before the name is even considered. Not ours; tracked upstream as
  quorum-mobile#240. It is *why* the broadcast matters, not something to fix.
- **Merged Farcaster mode** (fanning a resolved name out to a Farcaster display
  name). Tracked in the mobile decoupling design; needs explicit user consent
  because it writes to an external public system.
- **Adding the field to `quorum-shared`.** Deliberate, see §5.1.

---

*Last updated: 2026-08-16*
