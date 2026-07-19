---
type: bug
title: "update-profile repoints a victim's inbox_address (poisons verified-signer reverse-lookup → control-message impersonation)"
status: fixed (pending merge) — desktop; mobile never had it
created: 2026-07-19
severity: HIGH (authorization bypass — escalates a display spoof into control-message impersonation)
related:
  - 2026-06-25 control-message-auth (verified-signer reverse lookup this poisons)
  - .solved/2026-06-07-space-profile-save-missing-inbox.md
  - 2026-06-13-space-members-missing-no-join-row.md
---

# update-profile inbox_address poisoning → control-message impersonation

> Surfaced during the cross-repo control-message-auth review (2026-07-19). The
> mobile implementation deliberately does NOT mirror the desktop shape; this is
> the desktop-side finding + fix.

## The bug

The space `update-profile` receive handler selected the member row to update by
the **claimed, spoofable** `content.senderId`, then overwrote that row's
`inbox_address` with the address derived from the **message's signing key**. The
upstream signature check for `update-profile` only proves the message was signed
by *some* key over a fingerprint that itself contains the claimed `senderId` —
it does **not** bind the key to the claimed sender (the inbox-mismatch guard is
explicitly skipped for `update-profile`, `MessageService.ts:3652-3667`,
"inbox address changes are legitimate (key rotation)").

Control-message authorization (`#241`) resolves the acting member by the REVERSE
lookup `signing key → inbox_address → member` (`resolveVerifiedSender`). Writing
an attacker's key onto a victim's row **poisons exactly that table**.

### Attack chain

1. Attacker (any space member, or even a non-member with a fresh key) sends
   `update-profile` with `content.senderId = victimAddress`, signed with the
   attacker's OWN key. It passes the upstream check (messageId matches the
   fingerprint the attacker computed with the victim's senderId; the ed448
   signature is valid for the attacker's key; the inbox-mismatch guard is
   skipped for `update-profile`).
2. The handler looked up the victim's row by `senderId` and set
   `participant.inbox_address = base58(sha256(attackerPublicKey))`.
3. Now `resolveVerifiedSender(attackerKey)` resolves to the **victim's**
   address.
4. The attacker sends a `remove-message` / `edit-message` / `pin` / `mute`
   signed with their own key → it is authorized as the victim. If the victim
   holds a manager/owner role, the attacker now deletes/edits/pins/mutes as the
   victim. It also DoSes the victim: their real key no longer matches any row,
   so their own legitimate control messages stop resolving.

Net: a self-asserted profile message escalates into full control-message
impersonation — defeating the `#241` verified-signer fix.

## Evidence (pre-fix)

- `MessageService.ts` two handlers (durable `saveMessage` ~1475 and live
  `addMessage` ~2027): `const existing = getSpaceMember(spaceId, senderId)`
  (lookup by claimed senderId), create fallback `inbox_address: inboxAddress`,
  then `participant.inbox_address = inboxAddress` (the poisoning write).
- `MessageService.ts:3652-3667`: `inboxMismatch = !isUpdateProfile && …` — the
  key↔member binding check is disabled for `update-profile`.
- `quorum-shared` `messageAuth.ts` `resolveVerifiedSender`: the reverse lookup
  keyed on `inbox_address` that the write poisons.

## Fix (desktop — mirrors mobile's shape)

New helper `isUpdateProfileAuthorized(message, messageDB, spaceId)`:

- Drops unsigned/invalid.
- `resolveVerifiedSender(publicKey, members)`: a key **already registered to a
  member** may only speak for THAT member (`verified === senderId`); a key
  matching **no** member returns `null` and is accepted as a rotation/bootstrap
  announcement (so a member whose join row never arrived can still surface a
  display name).

And, critically, the handler **never writes the announced key onto the row**:

- Upsert-create uses `inbox_address: ''` (display-only), never the announced
  key.
- Existing rows keep their `inbox_address` untouched.

The authoritative `inbox_address` comes only from the VERIFIED join control
(`js_verify_point` + ed448, `MessageService.ts:3705-3741`), never from a
self-asserted `update-profile`.

Applied to BOTH handlers (`saveMessage` + `addMessage`). Tests:
`MessageService.unit.test.tsx` §3g (unsigned dropped; known key claiming another
member dropped; existing inbox preserved under an unknown key; bootstrap creates
with empty inbox; own update accepted).

## Accepted residual (parity with mobile)

An unregistered key can still set the **display name / avatar** on a claimed
`senderId` (needed for the missing-join-row bootstrap). This is a cosmetic spoof
only — it cannot poison `inbox_address`, so it grants no control-message
authority. Two-slot LWW + the public-profile fallback bound its impact. Mobile
makes the same trade-off.

## Mobile

Mobile never shipped this bug: `services/space/spaceMessageAuth.ts`
`isUpdateProfileAuthorized` implements the known-key binding and the handler
(`WebSocketContext.tsx` ~2148) creates with `inbox_address: ''` and never writes
the announced key back.

*Last updated: 2026-07-19*
