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
locations in §3 — every one re-verified against `main` on 2026-08-16.

**§9 records four decisions already taken.** Nothing in this file is left open
for you to choose; if you find yourself weighing one of those four, read §9
instead.

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
| Sources shape | `src/identity/identityProvider.tsx:28-51` — `profiles: Record<string, PublicProfileResponse \| null>`, commented "the ONLY source of primary_username" | holds the raw claim |
| Space send — **on-connect announce** | `src/utils/spaceProfilePayload.ts:74-106` `buildSpaceProfileWirePayload`, called from `src/services/MessageService.ts:1130-1147` | builds BOTH slots; **the only path that carries the global slot** |
| Space wire field list | `src/utils/spaceProfilePayload.ts:31-41` — `SpaceProfileWireFields` | the type the new field must be declared on |
| Space send — modal save | `src/hooks/business/spaces/useSpaceProfile.ts:313-323` | override slot ONLY, and only fields that CHANGED |
| DM send | `src/services/MessageService.ts:700-706` | `displayName` / `userIcon` / `bio` only |
| DM send gate signature | `src/utils/dmProfileGate.ts:102-108` — `dmProfileSignature` | hardcoded three-field list; **no QNS field, must be edited** |
| Space announce signature | `src/utils/spaceProfileGate.ts:84-95` — `spaceProfileSignature` | signs `Object.entries(payload)`; **already covers a new field — do NOT edit** |
| Space announce gate | `src/utils/spaceProfilePayload.ts:115-123` — `hasAnnounceableIdentity` | four fields, none a QNS name — see §5.1 |
| Space receive | `src/services/MessageService.ts:269` — `applyProfileUpdate` | six fields, none a QNS name |
| DM receive | `src/services/MessageService.ts:957-979` — `handleDMProfileUpdate` (merge at `:966-971`) | writes `displayName` / `icon` / `bio` only |

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
implementation. **Put it in `quorum-shared/src/qns/`, not in desktop** (decided
on review, 2026-08-16). `deriveAddress` and `resolveName` already live there,
§4.3 puts the batched resolver there too, and mobile will want to drop its local
copy once this exists — a desktop-local predicate would have to move later
anyway.

⚠️ Practical consequence: **an edit to `quorum-shared/src` does not reach this
app until you `yarn build` in the shared repo.** Desktop imports the built
`dist`. A predicate that appears not to work is more often an unbuilt one.

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

⚠️ Desktop already has a QNS cache at a DIFFERENT value, sitting right where you
will be working: `useResolveQnsName.ts:25-26` uses **5 minutes**, with a comment
claiming it "matches mobile's QNS resolution cache window". That hook serves the
interactive name lookup (type a name, see whose it is) and 5 minutes is fine for
it. The verification cache is a separate thing at 1 hour. **Do not reuse that
hook for verification, and do not harmonise the two numbers in either
direction** — they answer different questions and only one of them is a security
parameter.

## 5. SECOND: send and read the broadcast

Only after §4. A client that reads the wire field without checking it exposes
its own users regardless of what the other client does.

### 5.1 Send

Add `primaryUsername` to both payloads. Send it **unconditionally, including the
empty string.** `''` is a deliberate un-election and has to reach the peer, or
dropping a primary name never propagates and the old name renders for everyone
else forever.

**DM** — `MessageService.ts:700-706`.

**Space** — ⚠️ **the target is `buildSpaceProfileWirePayload`
(`src/utils/spaceProfilePayload.ts:74-106`), NOT the profile modal.** Declare the
field on `SpaceProfileWireFields` (`:31-41`) and emit it there. Reasoning, since
this is the easiest thing in the whole file to get wrong:

- §5.2 puts the claim in the **global slot group**, and `buildSpaceProfileWirePayload`
  is the only path that builds the global slot at all. It is what the on-connect
  announce sends (`MessageService.ts:1130-1147`).
- `useSpaceProfile.ts:313-323` is the per-space profile modal. It sends the
  **override** slot, and only fields the user just CHANGED. Add the claim only
  there and a user who elects a `.q` broadcasts nothing until they happen to also
  edit a per-space nickname — in a space they have never opened the modal for,
  never. That is precisely the §5.3 half-built shape.

⚠️ **Signatures: the two gates need OPPOSITE treatment. Do not apply one rule to
both.**

- **DM — must edit.** `dmProfileSignature` (`src/utils/dmProfileGate.ts:102-108`)
  builds its canonical object from a hardcoded three-field list. A field it does
  not name is invisible to it, so electing a name would broadcast nothing
  whenever the other three are unchanged: the gate reads "same as last time".
- **Space — must NOT edit.** `spaceProfileSignature`
  (`src/utils/spaceProfileGate.ts:84-95`) iterates `Object.entries(payload)` and
  signs whatever it is handed. Its docstring (`:71-75`) says this is deliberate,
  "so a field added to the wire later cannot silently fall outside the change
  detection", and `SpaceProfileWireFields` is a type ALIAS rather than an
  interface (`spaceProfilePayload.ts:27-30`) specifically to let the whole payload
  be handed over without re-listing fields. Adding the claim to the payload is
  already enough. Editing this function to name the field re-introduces by hand
  the fixed list it was written to avoid.

⚠️ **`hasAnnounceableIdentity` (`src/utils/spaceProfilePayload.ts:115-123`) will
swallow the claim for exactly the users who need it most.** It is the pre-filter
at `MessageService.ts:1275`, ahead of the signature gate, and tests only
`displayName || userIcon || globalDisplayName || globalUserIcon`. A user whose
only identity is an elected `.q` — no display name, no avatar — fails it, so the
announce never fires and the name never leaves the device.

**Decided on review (2026-08-16): add `payload.primaryUsername` to that
predicate.** Its docstring says it exists to stop a *fresh account whose config
has not synced* broadcasting an all-empty payload. A real elected name is not an
empty payload, so it belongs in the test, and truthiness is the right operator
here — `''` alone genuinely is nothing to announce.

⚠️ **That leaves one residual case, and it is the un-election again.** A user
with no name and no avatar who elects `alice.q` and then clears it produces a
payload that is once more all-falsy, so the pre-filter blocks the clear and their
spacemates keep rendering `alice.q`. **Do not pre-emptively engineer around
this — measure it first** (test 10 in §7). If it reproduces, the minimal fix is
at the call site rather than in the predicate: let a space that already has a
recorded announce bypass `hasAnnounceableIdentity`, since the fresh-account case
the filter protects is by definition one that has never announced. Check first
whether the member-digest reconciliation (`MemberDigest` → `MemberDelta`, see
`spaceProfileGate.ts:12-16`) already repairs the stale row once
`claimed_primary_username` is part of the digest — if it does, the gap closes
itself and needs no code.

Including the field also doubles as the migration: every stored signature
predates it, so none match and the next rebroadcast goes out once — on the DM
side because the field list changed, on the space side because the payload
gained a key. This only holds if it really is sent unconditionally; an omitted
empty claim leaves the space signature byte-identical and no announce fires.

The field is **additive and undeclared** in `quorum-shared` —
`UpdateProfileMessage` has no QNS field, and mobile sends it through an untyped
cast. That is deliberate: `canonicalize` covers only `type`, `displayName` and
`userIcon`, so adding a field cannot break signature verification on any client
of any version, and old clients ignore what they do not know. **Do not "fix"
this by adding it to shared** as part of this task.

### 5.2 Receive

Store it under its own key, **never as `primary_username`**:

- space: `applyProfileUpdate` (`MessageService.ts:269`) → the member row
- DM: `handleDMProfileUpdate` (`MessageService.ts:957-979`, merge at `:966-971`)
  → the conversation row

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
10. **The announce pre-filter, both directions** (`hasAnnounceableIdentity`, see
    §5.1). (a) A payload whose ONLY content is an elected `primaryUsername`
    announces — this must go red before the §5.1 predicate change, which is what
    proves the test is live. (b) The same account then un-electing produces an
    all-falsy payload: assert what actually happens rather than what should. This
    is the measurement that decides whether the residual gap in §5.1 needs any
    code at all, so record the result in this file either way.
11. **The claim survives a `quorum-shared` rebuild.** Trivial but it is the
    single most common false failure here: run `yarn build` in the shared repo
    before concluding the predicate is broken (§4.1).

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

## 9. Decisions taken — do not reopen these

No open questions remain. Four forks were closed on the 2026-08-16 review pass;
they are recorded here so the next agent does not re-litigate them.

| Question | Decision | Where |
|---|---|---|
| `.secret/` or `.open/`? | **`.open/`.** Stays indexed and visible. Settled by the file's owner, 2026-08-16 | this section |
| Port the ownership predicate into desktop, or lift it into shared? | **Lift into `quorum-shared/src/qns/`**, alongside the batched resolver | §4.1 |
| Add the claim to `hasAnnounceableIdentity`, or document why not? | **Add it**, truthiness | §5.1 |
| Fix the un-election pre-filter gap up front? | **No — measure it first** (§7 test 10b), then fix only if it reproduces | §5.1 |

On the `.secret/` call, for the record: §4 does carry a mechanism and `file:line`
pointers, which is normally the trigger. It stays public anyway, and the
supporting argument is that §1's injection vector is server-blocked upstream
(quorum-mobile#240), so the vulnerable render path is real but not currently
reachable. ⚠️ **That server behaviour is READ from this file, not MEASURED** —
nobody on the review pass attempted the publish. Treat it as the reason the
decision is comfortable rather than as the decision itself.

---

*Last updated: 2026-08-16*

## Review Log
**2026-08-16 - claude-opus-5**: Re-verified every file:line claim against main (commit c8d331b2e). All of §3 held except line drift; §4's security claim confirmed exact at identityProvider.tsx:108. Found one error that would have shipped the fix doing nothing, one instruction that was actively wrong, and one unmentioned gate that swallows the feature.
- WRONG TARGET (would ship broken): §5.1 named useSpaceProfile.ts:313-323 as the space send. That is the per-space profile MODAL, which sends only the override slot and only CHANGED fields. The global slot -- where §5.2 puts the claim -- is built solely by buildSpaceProfileWirePayload (spaceProfilePayload.ts:74-106, called from MessageService.ts:1130-1147), the on-connect announce. Rewrote §5.1 and split the §3 row into both paths.
- INVERTED INSTRUCTION: §5.1 said to add the field to dmProfileSignature AND the space announce signature. True for DM (dmProfileGate.ts:102-108 has a hardcoded 3-field list, must be edited); FALSE and harmful for space -- spaceProfileSignature (spaceProfileGate.ts:84-95) iterates Object.entries(payload) and its docstring at :71-75 says that is deliberate so a later wire field cannot fall outside change detection. Split the warning into opposite treatments.
- MISSING GATE: hasAnnounceableIdentity (spaceProfilePayload.ts:115-123) tests only displayName/userIcon/globalDisplayName/globalUserIcon, so a user whose only identity is an elected .q never announces at all. Unmentioned anywhere in the file; added to §3 and §5.1 with a decision required.
- CACHE TRAP: §4.4 mandates a 1-hour verification TTL, but useResolveQnsName.ts:25-26 already sets 5 minutes with a comment claiming it matches mobile. Different caches, adjacent code; added a do-not-harmonise note.
- CONFIRMED UNCHANGED: shared exports resolveName (singular) and deriveAddress only -- no resolveBatch, no claimedNameBelongsTo anywhere in desktop or shared, so §4.3's build cost stands.
- Line drift corrected: DM send is 700-706 not 701-707; IdentitySources is 28-51 not 28-50; handleDMProfileUpdate is 957-979 with the merge at 966-971.
- FLAGGED not resolved: whether this belongs in .secret/ per the repo rule -- §4 has mechanism and file:line, but §1 claims the only injection vector is server-blocked (quorum-mobile#240). That claim is READ, not MEASURED. Left in .open/ with options in ## Blockers.
- No status or type change: type bug and status open both still correct, folder agrees. Nothing was implemented, so no box was checked.

**2026-08-16 - claude-opus-5**: Second pass, same session: closed every open fork so the file is implementable without further decisions. Added §9 recording all four. No new code verification was needed beyond tracing hasAnnounceableIdentity to its call site.
- RESOLVED by the owner: stays in .open/, not .secret/. Removed the ## Blockers section and recorded the decision plus its READ-not-MEASURED caveat in §9.
- RESOLVED §4.1: the ownership predicate goes into quorum-shared/src/qns/, not desktop -- deriveAddress and resolveName already live there and §4.3 puts the batch resolver there too. Added the yarn-build-the-dist gotcha, which is the most likely false failure.
- RESOLVED §5.1: add primaryUsername to hasAnnounceableIdentity with truthiness. Traced it to MessageService.ts:1275, where it is the pre-filter ahead of the signature gate. Its docstring scopes it to fresh unsynced accounts, and an elected name is not an empty payload.
- RESOLVED §5.1 residual: an all-falsy un-election still trips the same pre-filter. Deliberately NOT engineered around -- turned into §7 test 10b to be measured first, with the minimal call-site fix named only as the fallback, and a prior question about whether MemberDigest reconciliation already repairs it.
- Added §7 tests 10 and 11: the pre-filter in both directions (10a must go red before the predicate change, which is what proves it live), and a shared-rebuild check.
- Fixed the §5.2 handleDMProfileUpdate line ref to 957-979 to match the §3 table, and the intro's stale 'four locations in §3' now the table has ten rows.
- Status open, type bug, folder .open/ all still correct and in agreement.
