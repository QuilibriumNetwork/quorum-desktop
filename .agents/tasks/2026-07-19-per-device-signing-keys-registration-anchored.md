---
type: task
title: "Durable multi-device: per-device space signing keys, admitted via master-identity-signed device statements"
status: DEEP-DIVE COMPLETE — spec ready; not yet implemented
priority: high (follow-up to the interim signing-split fix)
created: 2026-07-19
severity: HIGH (security-critical — touches the verified-signer auth boundary)
platforms: quorum-desktop + quorum-mobile + quorum-shared
supersedes: the interim per-user `signing`-slot fix (branch fix-multidevice-signing-key)
related:
  - quorum-mobile .agents/bugs/2026-07-19-multidevice-inbox-key-breaks-verified-signer-auth.md (root analysis)
  - .agents/bugs/2026-07-19-update-profile-inbox-poisoning-control-msg-impersonation.md (why in-band rebinding is banned)
  - .agents/docs/cryptographic-architecture.md ("Inbox Key Rotation" section — carries the interim note)
  - .agents/bugs/2026-01-09-space-owner-privacy-limitation.md (#111 — owner unverifiable by design)
---

# Durable multi-device: per-device signing keys via master-signed device statements

> Deep-dive completed 2026-07-20 against real source on all three repos
> (desktop branch `fix-multidevice-signing-key`, mobile branch
> `fix/multidevice-space-signing-key`, shared `main`). Every claim below was
> re-derived from code; file references are to those trees. The design changed
> in one important way from the draft: the proof anchors to the **master
> identity key directly**, not to a fetched device registration — see
> "Key finding #2" for why that is both simpler and equally strong.

## Why (context — unchanged from draft)

Verified-signer auth (#241) maps a message's signing key → member via a SINGLE
bound `inbox_address` per member (`resolveVerifiedSender`, shared
`utils/messageAuth.ts:110`). Multi-device breaks this: each device generates
its own per-space keypair, so a second device signs with a key no receiver's
member table has seen, and its control messages (delete/edit/pin/mute,
read-only posts, @everyone) are dropped.

The **interim fix** (shipping first) makes all devices share one signing key
(the join key) carried in the E2E-encrypted config payload. It unbreaks
multi-device but: no per-device attribution or revocation, the shared private
key crosses devices, and a lost join key breaks control ops until re-join.

## Key findings from the deep-dive (verified in source)

1. **What the device registration attests.** `UserRegistration = {
   user_address, user_public_key, peer_public_key, device_registrations[],
   signature }` where `user_address = base58btc(multihash(sha256(user_public_key)))`
   and `signature` is ed448 by the **master user key** over the full device
   list (SDK `ConstructUserRegistration`, sdk-channels `dist/index.js:1550`).
   Each `DeviceRegistration` carries the device's X448 keys and its DM
   `inbox_registration.inbox_address`, which is
   `base58btc(multihash(sha256(device ed448 inbox pubkey)))` — the **same
   derivation as shared `deriveInboxAddress`** (SDK `NewInboxKeyset`,
   `dist/index.js:1539`). There is **no timestamp** in the registration
   (freshness comes from the hub fetch), and **no client verifies the
   registration signature today** (DM fan-out trusts the HTTPS response).

2. **Every device holds the master ed448 private key.** Desktop: UserKeyset in
   KeyDB id=2, used to sign every config upload (`ConfigService.saveConfig`).
   Mobile: SecureStore `quorum.privateKey`, same use
   (`services/config/configService.ts` `signConfigData`,
   `services/onboarding/secureStorage.ts:59`). This is the pivotal fact: a
   device can sign a statement **directly with the master key**, whose hash is
   the `user_address` already present in every receiver's member row (from the
   join broadcast). Chaining through the fetched registration adds a network
   round-trip and an unverified-today signature check, but no security: the
   registration's own root of trust IS the master key. So the proof anchors to
   the master key; the registration stays involved only for the device list UI,
   the revocation trigger, and the per-device tag (below).

3. **Spaces already know the user's master address.** `participant.address` in
   the join broadcast is the user address; member rows key on it; desktop's
   kick flow calls `getUser(member.user_address)` (SpaceService.ts:870). No new
   privacy exposure from binding statements to it (and the per-address device
   list is already publicly fetchable from the hub).

4. **Join binding mechanics (and a discovered pre-existing hole).** Desktop
   verifies a join via `js_verify_point` (ratchet-slot possession) + an ed448
   self-signature by the **announced inbox key itself** (MessageService.ts:3747),
   then `saveSpaceMember` = unconditional IndexedDB `put` (db/messages.ts:1146).
   Nothing binds `participant.address` to the master key → **any space member
   holding a valid ratchet slot can re-broadcast a forged join claiming another
   member's address with their own inbox key, overwriting the victim's binding**
   (same class as #243, via join). Mobile is weaker still: its join handler
   verifies **nothing** (WebSocketContext.tsx:708 saves the row as-is), and its
   unauthenticated `leave` handler blanks a claimed member's `inbox_address`.
   Desktop's `sync-members` also bulk-overwrites rows from a sync peer.
   → Needs its own bug report + lead-dev ping (statically confirmed, not
   runtime-tested). This task's design mitigates for announced keys (statements
   are forgery-proof) but does NOT close the base join-binding hole; the
   hardening (optional master signature inside the join participant blob,
   verified when present, master-verified rows only overwritable by
   master-signed data) reuses this task's machinery and should ride along or
   immediately after.

5. **Interim-fix state actually shipped.** Mobile evolved past the bug doc:
   `signing` keys carry local provenance `origin | promoted | adopted`; `origin`
   is never replaced, everything else yields to the blob on every config
   receive; self member row re-anchored to the signing address idempotently
   (spaceSyncService.ts:87-141). Desktop only handles the new-space path
   (ConfigService.ts:110-145 runs under `!existingSpace`): no ongoing heal, no
   promotion-at-save for pre-fix spaces, no self-row re-anchor. Divergence is
   tolerable because receivers only ever needed the join binding, but the
   durable migration must not assume the platforms hold identical `signing`
   state.

6. **Transport facts.** New hub **control** envelope types are wire-additive:
   desktop's control chain (MessageService.ts:3747-4791) and mobile's switch
   (WebSocketContext.tsx:707) silently ignore unknown types — old clients are
   unaffected. Mobile's hub-log transport durably replays hub messages from a
   seq cursor (offline catch-up covers control envelopes); desktop's P2P path
   has no control-message replay, so late/offline desktop receivers need the
   statements carried via member sync + on-connect re-broadcast. Desktop will
   later migrate to hub-log (lead-confirmed), which makes replay uniform —
   keep all statement logic transport-agnostic in shared.

7. **Ratchet sharing.** A second device reuses the SAME triple-ratchet slot
   (config sync copies `encryptionState`; only `inboxId` changes). Announcing
   per-device signing keys does not touch the ratchet.

## Goal (durable end state)

A member's identity admits **multiple verified signing keys, one per device**.
Each device signs space messages with its own per-space key (its existing
per-device `inbox` mailbox key — no third keypair), admitted by receivers ONLY
via a **device-key statement signed by the user's master identity key** and
verified against the `user_address` already bound in the member table.
Private signing keys never leave their device (strict improvement over the
interim shared-key model). Revocation is first-class via the device-deletion
flow. The interim `signing` slot is retired.

## The design

### Wire: two new hub CONTROL envelope types (sealed like join/leave)

```jsonc
// admit: "device D of user U signs space S with key K"
{
  "type": "announce-keys",
  "userAddress": "...",         // must match an existing member row key
  "userPublicKey": "hex",       // master ed448 pubkey; multihash must equal userAddress
  "spaceId": "...",             // scope binding (no cross-space replay)
  "deviceInboxAddress": "...",  // the device's DM inbox_address from UserRegistration
                                 // (attribution + revocation handle; not verified against
                                 // the registration at receive — self-scoped, see edges)
  "spaceKeyPublicKey": "hex",   // K: this device's per-space ed448 signing pubkey
  "timestamp": 1234567890,
  "signature": "hex"            // ed448 by master key over the statement bytes
}

// revoke: "device D of user U is no longer trusted in space S"
{
  "type": "revoke-device",
  "userAddress": "...", "userPublicKey": "hex", "spaceId": "...",
  "deviceInboxAddress": "...", "timestamp": 123, "signature": "hex"
}
```

Statement bytes = `utf8(DOMAIN_PREFIX + canonicalize({userAddress, spaceId,
deviceInboxAddress, spaceKeyPublicKey?, timestamp}))` with distinct domain
prefixes (`quorum:announce-keys:v1` / `quorum:revoke-device:v1`) so these
signatures can never collide with config-upload or registration signatures
made by the same key. Control envelopes (not content messages): no feed
pollution, no ratchet advance, idempotent re-broadcast, ignored by old clients.

### Receive-side verification (fail closed at every step)

1. `deriveInboxAddress(userPublicKey) === userAddress` (self-certifying id;
   same multihash derivation as user_address — verified identical in SDK).
2. ed448 verify `signature` over statement bytes (ed448 stays in each app,
   bytes-building in shared — the `messageAuth.ts` pattern).
3. `timestamp <= now + 30s` skew guard (see edges: future-dated ADD would
   otherwise be revocation-proof) and LWW against the stored row/tombstone.
4. Member gate: a row for `userAddress` must exist and not be kicked.
5. Upsert admission `{spaceId, userAddress, deviceInboxAddress,
   inboxAddress: deriveInboxAddress(spaceKeyPublicKey), spaceKeyPublicKey,
   timestamp, statement}` — store the **verbatim statement** so admissions can
   be re-gossiped (member sync) and re-verified by anyone. `revoke-device`
   writes a tombstone that beats any admission with an older timestamp and is
   never deleted (a re-added device gets fresh DM keys → new tag; same-tag
   re-admit needs a newer-ts announce, which only the master key can mint).
6. **Never write member rows from statements.** The member row's
   `inbox_address` (join binding) is untouched — poisoning-proof by
   construction (#243 lesson).

### Resolver: key-set reverse lookup (quorum-shared)

`resolveVerifiedSender(publicKeyHex, members, deviceKeys?)` — third param
OPTIONAL (additive; mobile pinned to an older shared build keeps compiling):

1. Current path: member whose `inbox_address` matches, not kicked → address.
2. Else: non-revoked admission whose `inboxAddress` matches → its member row
   (must exist, not kicked) → address.

`authorizeControlMessage` unchanged downstream. Covers remove/edit/pin/mute,
read-only posts, @everyone gates, and `isUpdateProfileAuthorized` on both
platforms automatically (all funnel through the resolver).

### Send-side

On space connect (same cadence slot as the existing on-connect
`update-profile` broadcast), each device broadcasts its `announce-keys` for
that space — idempotent, cheap, self-healing for receivers that missed it —
then signs everything with its **own** per-device key (`inbox`). The interim
`getSigningKey` fallback (`signing ?? inbox`) stays during rollout and is
removed at cleanup. The join device's per-device key IS the join key, so its
announce also tags the join binding with a `deviceInboxAddress` for revocation.

### Revocation trigger

Desktop Security modal already: `removeDevice` → `ConstructUserRegistration(
userKeyset, remainingDevices, [])` → re-upload (useUserSettings.ts:522). Hook
in there: for each of the user's spaces, broadcast `revoke-device` with the
removed device's `inbox_registration.inbox_address` (the UI already has it).
Mobile's device-management flow mirrors this when it lands there. Offline
receivers catch up via mobile hub-log replay / desktop member-sync statements
/ the next time any of the user's devices re-announces (receivers can also
lazily drop admissions whose device disappears from a registration fetch —
optional TTL hardening, not required for correctness).

### Storage

- **Desktop:** new IndexedDB store `space_member_devices`, keyPath
  `[spaceId, inboxAddress]` (reverse lookup is the native shape), index on
  `[spaceId, userAddress]`; DB version bump. Verify blocks + control handlers
  in `MessageService.ts` load admissions alongside members.
- **Mobile:** MMKV adapter mirror (`getSpaceMemberDevices` /
  `saveSpaceMemberDevice` / tombstones), receive in `WebSocketContext.tsx`
  control switch, verify via `spaceMessageAuth.ts`.
- **Shared:** types + pure logic only (no storage — storage adapters are
  per-app, matching today's split).

## What lives in quorum-shared (the drift-proof core)

- `SpaceMemberDevice` type + statement types; control-type name constants +
  domain prefixes.
- `buildDeviceKeyStatementBytes(...)` (canonical bytes both platforms sign and
  verify — byte-identical or auth splits, exactly like `buildMessageFingerprint`).
- `verifyDeviceKeyStatement(...)`: address-derivation check, timestamp/skew +
  LWW/tombstone verdict; ed448 verification injected/adjacent per app.
- `resolveVerifiedSender` extended with the optional `deviceKeys` param.
- Tests for all of it (statement forgery, cross-space/user replay, future-ts,
  tombstone ordering, kicked member, revoked key).

All **additive** → ship shared alone; mobile catches up on its next pinned
bump (per the additive-vs-breaking gut-check).

### Hard prerequisites before the send-side flip (from independent review 2026-07-20)

1. **`buildDeviceKeyStatementBytes` MUST live in shared and be the ONLY code
   both platforms use to build statement bytes, for BOTH sign and verify.** Not
   the existing `canonicalize` (it throws on non-message objects); a new,
   dedicated function. If desktop and mobile serialize statements independently,
   any field-order/encoding/whitespace difference makes signatures fail
   verification silently across platforms. This project already carries
   `buildMessageFingerprint`/`canonicalize` precisely because of this class of
   bug — treat byte-identity as a hard gate, not an implementation detail.
2. **Cap admissions per `(spaceId, userAddress)`** (e.g. ≤10, evict oldest
   non-revoked). Each valid `announce-keys` is master-signed but a compromised/
   malicious account could mint many with different `spaceKeyPublicKey`s,
   bloating storage and turning the resolver's second-path scan into an O(n)
   DoS. Enforce the cap at upsert and early-exit the resolver scan.
3. **Document that `deviceInboxAddress` is a self-asserted tag**, not verified
   against the hub registration at receive (attribution + revocation handle
   only). Consequence: revocation is only as reliable as the master-key holder's
   self-report of which tag to tombstone — fine in the normal UI flow (the tag
   comes from the real registration), but must be stated as a design assumption.

## Edge cases (resolved)

- **Revocation lifecycle** — see above. Residuals stated honestly: (a) a
  device that still physically holds the master key is not cryptographically
  stripped by revocation (it can sign new statements; registration deletion
  doesn't remove master-key possession either) — device revocation protects
  retired/lost devices, not an actively-malicious master-key holder; that
  boundary is identical to today's trust model (master key = account).
  (b) The 30s future-ts guard prevents a compromised device pre-minting a
  revocation-proof ADD.
- **Lost join key** — solved structurally: post-flip no device needs the join
  key; each announces its own. Also unbricks the mobile bug's documented
  "third device locked on a wrongly-promoted signing key" race.
- **Ordering** — control-before-content within a session (announce sent on
  connect, before any signed sends); unknown-key control messages still drop
  fail-closed; re-announce every connect + hub-log replay (mobile) + statement
  carriage in member sync (desktop) close the gaps. No receive-side buffering.
- **Late joiners** — extend desktop `sync-members` additively with the stored
  statements; receivers RE-VERIFY each statement before adopting (statements
  are self-certifying, so peer-asserted sync data can carry them safely —
  unlike the raw member rows sync-members asserts today).
- **Kicked members** — resolver's member gate keeps `isKicked` fail-closed for
  both paths; kick's ratchet re-key already cuts decryption.
- **Per-space vs per-user** — statements are per-(user, device, space); one
  announce per space per device, broadcast on connect. No global fan-out.
- **Owner (#111)** — untouched: `authorizeControlMessage` still sets
  `isSpaceOwner: false`; owner authority remains role-based. Owner's devices
  announce like anyone's.
- **Repudiability** — untouched: this changes which keys are ADMITTED, not
  whether signing is required; unsigned-edit-of-unsigned exception intact.
- **Config payload** — statements do NOT ride the config blob (no size/churn
  growth, no LWW-merge problem: each device announces itself; nobody needs a
  global key inventory). The blob eventually stops carrying `signing`.
- **Migration from interim `signing`** — zero-gap: receive-side (resolver +
  handlers) ships first on both platforms while everyone still signs with the
  join-bound key (join binding keeps resolving); send-side flips per device
  only after it broadcasts its announce; `signing` fallback read retained one
  release, then slot dropped from create/join/sync (per-platform divergence in
  interim heal logic — finding #5 — becomes irrelevant once the flip lands).
  Beta = clean cut-over per prior decisions.

## Answers to the draft's open questions

1. **What does registration attest / can receivers fetch it?** Attests the
   master-signed device list incl. each device's DM `inbox_address` (= hash of
   its DM ed448 key). Fetchable by `user_address` (member rows have it). But
   the durable design doesn't need the fetch in the verify path — the master
   key itself (held by every device) signs the statement, and the member table
   already anchors its hash. Registration remains the device-list UI +
   revocation trigger + `deviceInboxAddress` tag source.
2. **Announcement shape** — see Wire section: master-signed, domain-separated,
   space-scoped statement; verifiable offline with zero trust in payload
   senderId or transport.
3. **Revocation transport + authority** — master-signed `revoke-device` per
   space, triggered by the existing device-deletion flow; tombstoned LWW;
   catch-up via hub-log replay (mobile), member-sync statements (desktop),
   re-announce cadence; optional registration TTL cross-check as hardening.
4. **Schema/wire bump?** — No wire version bump: new control types are ignored
   by old clients (verified both platforms); shared change is additive;
   desktop needs an IndexedDB store (version bump of the local DB only);
   mobile a new MMKV keyspace. Clean cut-over acceptable for beta.

## Cross-repo scope + sequencing (vertical slices)

1. **quorum-shared** — types, statement bytes/verify, resolver extension,
   tests. Additive publish. (Observable: shared tests green; both apps build.)
2. **Receive-side, desktop + mobile** — control handlers, admission storage,
   resolver wired with admissions, member-sync statement carriage (desktop).
   Observable: everything works exactly as before (interim model untouched);
   new tests prove forged/replayed/revoked statements are rejected.
3. **Send-side flip, both platforms** — on-connect announce + per-device
   signing + Security-modal revocation broadcast. Observable (the real test):
   fresh second device (no shared `signing`) deletes/edits/pins from day one;
   deleting that device from Security settings makes its subsequent control
   ops drop on other clients.
4. **Cleanup** — retire `signing` slot writes + fallback, rewrite
   `cryptographic-architecture.md` multi-device section, resolve the mobile
   bug report, file the join-binding hardening follow-up.

## Production release order (decided 2026-07-20)

**Decision: ship the full fix (receive + send) on both apps, then deploy desktop
to prod immediately AFTER the lead ships mobile to prod.** Not the fully
decoupled "receive-side everywhere, soak, then flip" order — deliberately, for
beta, because the blast radius is tiny (below).

- **The receive-side is inherently tolerant regardless of order.** During any
  transition a space contains both old shared-key signers and new per-device
  signers, so `resolveVerifiedSender` must accept BOTH paths at once. That is
  not extra work; it is required for correctness. It also means the "decoupled"
  structure exists at the code level anyway — the only real choice is the
  DEPLOY timing of the send-side flip.

- **Why the aggressive timing is acceptable for beta.** The flip only changes
  behavior for a **secondary** device. A user's PRIMARY (join) device signs
  with the join-bound key receivers already hold, so it verifies on old clients
  with no announcement. Therefore:
  - Single-device users: zero regression, ever.
  - Primary device of a multi-device user: unaffected.
  - Only affected case: a control action (delete/edit/pin/mute) sent from a
    SECONDARY device, received by a client still on an OLD build → that one
    action silently doesn't apply on that one stale receiver until it updates
    (no crash, no data loss). Multi-device users are rare, and during beta they
    are mostly the devs/testers, who understand the transition.
  - **Honest framing (independent review 2026-07-20):** the flip is a
    regression *relative to the interim fix's current behavior*, not just
    relative to the ideal. Today a secondary device signs with the shared join
    key, which every receiver already has → its control ops work everywhere.
    Post-flip it signs with its own key, which OLD receivers can't resolve →
    those ops break for stale receivers until they update. We are knowingly
    re-breaking secondary-device control ops on not-yet-updated clients for the
    rollout window, in exchange for the durable end state. Acceptable at beta
    scale; not "neutral."

- **The one thing that makes it safe rather than fragile:** "prod" is a spread
  of build versions, not a switch, so the flip's regression persists per-stale-
  receiver until they update — it is NOT closed by deploying desktop right after
  mobile. We accept that tail for beta given the blast radius. If real-user
  multi-device usage grows or we leave beta, revert to the decoupled order
  (soak receive-side to saturation before flipping).

Concrete order: (1) shared additive publish → (2) desktop + mobile receive-side
+ send-side both merged → (3) lead ships mobile to prod → (4) we ship desktop to
prod right after. Keep the `signing ?? inbox` fallback through this whole window;
remove it only at cleanup once both apps are broadly updated.

## Discovered issues to handle OUTSIDE this task

- **Join-binding hijack** (finding #4): forged join / unauthenticated leave /
  sync-members assertion can rewrite bindings. Filed:
  `.agents/bugs/2026-07-20-join-binding-hijack-unauthenticated-member-rebind.md`.
  Needs a lead-dev ping (Telegram, short). Hardening rider reuses this task's
  master-signature machinery.
- Desktop interim branch lacks mobile's heal/promotion parity (finding #5) —
  acceptable if this durable task lands promptly; revisit only if the durable
  work slips. **Sharpened by independent review (2026-07-20):** the concrete gap
  is that desktop's `signing`-key preservation sits inside `if (!existingSpace)`
  (`ConfigService.ts:112`), so a PRE-fix desktop second device that ALREADY has
  the space never adopts the blob's `signing` key on a later config sync — it
  stays broken until the space is re-added. Mobile heals existing spaces
  (`spaceSyncService.ts:86-141`); desktop does not. Once the durable per-device
  work lands this is moot (no device needs the shared key); until then it's a
  desktop-only "re-add to fix," which the release notes should state plainly.

- **Desktop P2P revocation replay gap.** Until desktop migrates to the hub-log
  transport, an offline desktop receiver has no replay path for a `revoke-device`
  (or `announce-keys`) it missed; it catches up only on the announcing device's
  next re-announce. Mobile's hub-log replay covers this. Not a design flaw
  (inherent to the P2P transport, converges on hub-log migration), but note it
  in the implementation plan: revocation propagation is asymmetric until then.

- **`isSpaceControlAuthorized` durable path is not self-contained** (defense-in-
  depth, not an active exploit): the `saveMessage` path resolves the verified
  sender but relies on the streaming handler having already nulled a bad
  `publicKey` rather than re-verifying the ed448 signature itself. Worth a
  belt-and-braces re-verify when this code is next touched.

## Implementation-time verifications (small, listed so they aren't lost)

- Mobile hub-log seq ordering: confirm control envelopes replay in-order
  relative to content messages after offline catch-up.
- Exact on-connect broadcast hook sites on each platform (desktop: the
  update-profile-on-connect site; mobile: its profile broadcast on socket up).
- `revoke-device` fan-out cost for users in many spaces (batch per connect).
- Desktop DB migration bump mechanics for the new store.

*Last updated: 2026-07-20*
