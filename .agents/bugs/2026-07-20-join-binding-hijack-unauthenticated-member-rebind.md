---
type: bug
title: "Space member-binding can be rebound/blanked by a spoofable join/leave/sync-members payload (verified-signer bypass via the join path)"
status: OPEN — statically confirmed in source, NOT runtime-tested; needs lead-dev awareness
created: 2026-07-20
severity: HIGH (authorization-integrity — same class as #243, reached through the join/leave path instead of update-profile)
platforms: quorum-desktop + quorum-mobile
related:
  - .agents/bugs/2026-07-19-update-profile-inbox-poisoning-control-msg-impersonation.md (#243 — the update-profile form of this, fixed)
  - .agents/tasks/2026-07-19-per-device-signing-keys-registration-anchored.md (durable design whose master-signature machinery this hardening reuses)
  - .agents/bugs/2026-01-09-space-owner-privacy-limitation.md (#111)
  - .agents/docs/features/security.md ("Control-Message Authorization")
---

# Join-binding hijack: unauthenticated member rebind/blank

> Surfaced 2026-07-20 during the per-device-signing-keys deep-dive, while
> tracing how a member's `inbox_address` binding (the anchor
> `resolveVerifiedSender` uses) gets written. #243 closed the `update-profile`
> route to poisoning that binding; the **join / leave / sync-members** routes to
> the same table were never given the same treatment. Every code claim below is
> re-verified in source; **exploitability is reasoned, not runtime-confirmed** —
> see "Confidence & what still needs testing".

## The invariant being broken

Control-message auth (#241) resolves the acting member by REVERSE lookup:
verified signing key → `deriveInboxAddress` → the `space_members` row whose
`inbox_address` matches (shared `utils/messageAuth.ts:110`
`resolveVerifiedSender`). The whole security of delete/edit/pin/mute/read-only/
@everyone therefore rests on **who is allowed to write a member row's
`inbox_address`**. #243 established the rule: only the cryptographically
**verified join control** may set it; a self-asserted message must not.

The join/leave/sync-members handlers violate that rule.

## Route 1 — forged `join` re-binds a victim's row (desktop)

`MessageService.ts:3747-3783`. On a `join` control envelope the handler:

1. `js_verify_point(ratchet_state, point=participant.pubKey, index=participant.id)`
   — checks ratchet-slot possession against the receiver's own ratchet state.
2. `js_verify_ed448(participant.inboxPubKey, blob, participant.signature)` where
   `blob` = `address + id + inboxAddress + pubKey + inboxKey + … + displayName`.
3. On pass: `saveSpaceMember({ user_address: participant.address, inbox_address:
   participant.inboxAddress, … })` — an unconditional IndexedDB `put`
   (`db/messages.ts:1146`), overwriting any existing row for that address.

The ed448 check proves only that **whoever holds the private key for the
announced `inboxPubKey` signed the blob** — the attacker supplies BOTH
`inboxPubKey` and `address`, so it is a self-signature over an attacker-chosen
(address, key) pair. It does **not** bind the key to the claimed address.
Nothing else in the handler ties `participant.address` to a verified identity.
So the only thing standing between a member and rebinding another member's row
to an attacker-held key is `js_verify_point`.

If `js_verify_point` can be satisfied for a re-broadcast (see confidence note),
the consequence is identical to #243: `resolveVerifiedSender(attackerKey)`
resolves to the victim → the attacker's signed `remove-message` / `edit` /
`pin` / `mute` is authorized **as the victim** (role escalation if the victim
holds manager/owner powers), and the victim's own control messages stop
resolving (self-DoS).

## Route 2 — unauthenticated `leave` blanks a victim's binding (mobile)

`WebSocketContext.tsx:928-960`. The `leave` handler reads
`participant.address || address` **straight from the payload**, loads that
member, and writes `inbox_address: ''` with **no signature or point check at
all**. A single forged `leave` naming any member blanks their binding →
`resolveVerifiedSender` can no longer resolve their key → all their control
ops drop fleet-wide on every receiver that processed the forged leave
(unauthenticated control-message DoS against an arbitrary member).

> **Mobile-only (corrected 2026-07-20 after independent review).** Desktop's
> `leave` handler (`MessageService.ts:4069-4090`) is NOT vulnerable: it verifies
> `ed448(inboxPublicKey, 'delete' + hubKey.publicKey, inboxSignature)` and only
> blanks the binding of the member whose inbox key the sender actually holds —
> i.e. self-targeting only. Route 2 is therefore a **mobile-only** unauthenticated
> victim-targeting attack; the earlier "check desktop for the same shape" was an
> overstatement — desktop has a real cryptographic gate here.

## Route 3 — mobile `join` verifies nothing

`WebSocketContext.tsx:708-860`. The mobile `join` control case updates the
ratchet peer maps and calls `adapter.saveSpaceMember({ address:
participant.address, inbox_address: participant.inboxAddress, … })` with **no
`js_verify_point` and no ed448 check** — strictly weaker than desktop Route 1.
On mobile the rebind needs only a hub-sealed `join` envelope with an arbitrary
(address, inboxAddress) pair.

## Route 4 — `sync-members` bulk-overwrites rows (desktop, weaker gate)

`MessageService.ts:4533-4605`. `sync-members` overwrites member rows from a
sync peer, gated on `reg.owner_public_keys.includes(owner_public_key) ||
this.syncInfo.current[spaceId]`. The `syncInfo` branch trusts **any peer during
an active sync handshake**, so a peer mid-sync can assert member rows
(including `inbox_address`) that were never owner-signed.

> **Worse than first written (independent review, 2026-07-20).** The branch does
> run an `ed448` verify (`:4548`), but against `exteriorEnvelope.owner_public_key`
> — a field the attacker supplies. They pass their OWN key as `owner_public_key`
> and self-sign the envelope; the verify passes and proves nothing. So under an
> active sync window this is the **same severity** as routes 2/3 (arbitrary
> member-row overwrite incl. the owner's), not a lesser one. The only limiter is
> the sync window, and sync is peer-triggerable (`sync-info`, `:4499`), so an
> attacker can open the window themselves.

## Threat model (who can do this)

All routes require sealing a valid **hub control envelope**, which needs the
space **hub key** — i.e. the attacker is a **space member** (or a
former/compromised member's client). This is a **member-against-member**
integrity break, not an anonymous-internet attack. That is exactly the threat
model #241/#243 were built for: within a space, one member must not be able to
act as another. Kick's ratchet re-key does not help — these writes happen
before/independently of kick, and #243 proved the binding table is the sharp
edge.

## Why #243's fix does not already cover this

#243 hardened only the `update-profile` handler (`isUpdateProfileAuthorized`,
never writes the announced key to a row). The join/leave/sync-members handlers
predate that rule and still write `inbox_address` from payload-supplied values.
Same poisoning target, different doors.

## Fix direction (reuses the per-device-signing-keys machinery)

The durable design in
`.agents/tasks/2026-07-19-per-device-signing-keys-registration-anchored.md`
gives every device a **master-identity-signed statement** binding
`(userAddress → signing key)`, verifiable against the `user_address` already in
the member row, with zero trust in payload `senderId`. The hardening rides that
machinery:

1. **Bind join to the master identity.** Carry (optionally, additively) a
   master-key signature inside the join `participant` blob that attests
   `address ↔ inboxAddress`; verify it when present; a member row already
   written from master-verified data may only be overwritten by master-verified
   data. Absent-signature joins stay display-only (bootstrap), never authoritative
   for `inbox_address` — same posture #243 took for `update-profile`.
2. **Authenticate `leave`.** Require a signature by the leaving member's bound
   key (or master key) before blanking a binding; drop unauthenticated leaves
   (they can remain cache-only "inactive" hints, never a binding write).
3. **Tighten `sync-members`.** Only adopt rows carried as self-certifying
   master-signed statements (the same statements the durable design already
   re-verifies on sync); drop the `syncInfo`-only trust branch for
   binding-bearing fields.
4. **Mobile join parity.** Add the same verification mobile currently skips.

Sequence this **with or immediately after** the per-device-signing-keys task —
they share the statement type, the domain-separated bytes, and the
`deriveInboxAddress` check, so doing them together avoids building the same
verification twice.

## Confidence & what still needs testing

- **High confidence (static, independently reviewed 2026-07-20):** the ed448
  self-signature in Route 1 does not bind address→key; the mobile leave (Route 2)
  and mobile join (Route 3) handlers do no verification; sync-members (Route 4)
  verifies only an attacker-supplied `owner_public_key` (self-signature → proves
  nothing) under an active, peer-triggerable sync window. Desktop's `leave` is
  NOT vulnerable (real key-possession gate — Route 2 is mobile-only). All read
  directly from source at the lines cited and confirmed by a second reviewer.
- **Not yet confirmed:** whether `js_verify_point` (WASM, unaudited here) can be
  satisfied by an existing member re-broadcasting a forged join for an arbitrary
  `(address, id, point)` — this is the gate that decides whether Route 1 is a
  live exploit on desktop or merely a defense-in-depth gap. Routes 2 and 3 have
  no such gate and look exploitable as written, but neither has been
  runtime-reproduced. **Do not mark solved on reasoning alone** — needs a
  crafted-envelope test (or user-driven repro) per platform before claiming
  either the exploit or a fix.

## Suggested next steps

1. Lead-dev heads-up (Telegram, short) — this touches mobile and the shared
   auth boundary; it's their call whether to fold the hardening into the
   per-device-signing-keys work or track it separately.
2. Runtime-confirm Routes 2 & 3 (cheapest, no WASM question): forge a
   hub-sealed `leave` / `join` in a test space, observe a victim's binding
   blank/rebind.
3. Probe `js_verify_point` re-broadcast resistance to settle Route 1 severity.

*Last updated: 2026-07-20*
