---
type: task
title: "Edited messages show a false 'not signed' warning on other devices (cross-device badge inconsistency)"
status: open — needs a small shared/protocol decision before implementation
priority: medium
created: 2026-07-19
severity: trust-UX (NOT a security hole — false WARNING, never a false 'verified')
spans-repos:
  - quorum-shared
  - quorum-desktop
  - quorum-mobile
related:
  - 2026-06-25-MASTER-RECAP-control-message-auth.md (the security fix this surfaced during)
  - .agents/bugs/2026-06-14-sync-path-hardcodes-post-type-nulls-nonpost-signatures.md (same fingerprint-recompute machinery)
---

# Edited messages show a false "not signed" warning on other devices

## The symptom (what a user sees)

A user edits their own (signed) message. On the device where they edited it, it
looks normal. On **another device** that receives the edited message (a sync
peer, another member, or the author's own second device), it shows the warning
**"Message does not have a valid signature, this may not be from the sender."**
— even though the message is perfectly legitimate and the author really did
write it.

So the same message shows "signed" on one screen and "unsigned + scary warning"
on another.

## Severity: trust-UX, NOT security

Be precise about the direction of the falsehood:

- It is a **false warning on a legitimate message** (cries wolf).
- It is **never** the dangerous direction (it never shows "verified/signed" for
  content that wasn't actually verified).

So there is no authorization or integrity hole here. The cost is trust erosion:
a signature indicator that fires on legitimate messages trains users to ignore
it, which quietly defeats the purpose of having it. Worth fixing, not worth
blocking the security work for.

This is **pre-existing** — it happens today, independent of the
control-message-auth security fix. That fix neither caused nor worsened it; it
just surfaced it (badge semantics were explicitly deferred out of that PR to
keep it focused).

## Why it happens (root cause)

A signature signs **one exact byte string** (the message fingerprint), not "the
message" loosely. For a normal post the fingerprint is
`nonce + 'post' + senderId + canonicalize(post)` — i.e. it commits to the post's
text.

When a message is **edited**:
- The original signature was over the ORIGINAL text. The displayed text is now
  different, so that signature can never match again.
- The edit is sent as its own `edit-message` control message, signed over a
  DIFFERENT fingerprint shape (`nonce + 'edit-message' + senderId + spaceId +
  channelId + canonicalize(edit)` — see `buildMessageFingerprint`). That proves
  the edit, but it is not a signature over "a post containing the new text."

The edited message is stored as a POST (new text) that keeps the ORIGINAL post's
`messageId` and `signature` (the edit-apply handlers update text/modifiedDate
but not the signature — desktop `MessageService.ts` edit handlers; mobile
`WebSocketContext.tsx` edit handler ~1930).

So on any device that RE-verifies the stored message (the sync/live receive
verify blocks recompute the post fingerprint from the CURRENT text and compare
to the stored `messageId`):

`recompute(new text) != messageId(old text)` → `messageIdMismatch` → the verify
block nulls `publicKey`/`signature` → badge shows the warning.

**Conclusion:** no post-shaped signature can ever verify an edited post. The
only thing that proves an edited message is authentic is the EDIT's signature,
and today that proof is thrown away after the edit is applied — nothing durable
is stored on the message for a later/other device to re-verify.

## Where the badge + strip logic lives (current, both platforms)

Both platforms use the same presence-based badge and the same strip-on-mismatch:

- **Desktop badge:** `!message.signature` → warning. `Message.tsx:920`, `:1015`,
  `:1076`.
- **Desktop strip-on-mismatch:** the two verify blocks in `MessageService.ts`
  (live ~3556, sync ~4563) null `publicKey`/`signature` on `messageIdMismatch`.
- **Mobile badge:** `!item.originalMessage?.signature` → warning.
  `components/Chat/MessagesList.tsx:733`, `:771`.
- **Mobile strip/verify:** mobile's space receive path (post control-message-auth
  work) will verify signatures similarly; the edited-post recompute has the same
  mismatch problem.

- **Dormant hook:** `EditMessage.editSignature?` already exists in
  `quorum-shared/src/types/message.ts:159` but is **written and read nowhere in
  any repo** (verified 2026-07-19). Someone anticipated this; the mechanism was
  never built. It is the natural home for the fix.

## The fix (recommended: store + re-verify the edit's proof)

Make an edited message carry its OWN re-verifiable proof, so ANY device that has
the message in its final edited form — including one that was offline and only
ever sees the final post via sync/replay, never the live edit control message —
can verify it independently.

1. **On applying a verified edit**, store the edit's proof on the message:
   the edit's `signature`, the edit's `publicKey`, and the `editNonce` (the
   `editNonce` is already retained as `lastModifiedHash`; `originalMessageId` is
   the message's own `messageId`; `editedText` is the current text — so the full
   `edit-message` fingerprint is reconstructable from the stored post + these
   fields). Use `EditMessage.editSignature` (dormant) plus a place for the edit's
   `publicKey` on the stored `Message`.
2. **In the verify blocks**, when a message has been edited (has an edit proof /
   `modifiedDate !== createdDate`), rebuild the EDIT fingerprint via
   `buildMessageFingerprint({ content: <reconstructed edit-message>, ... })` and
   verify the stored edit signature against it — instead of the post fingerprint
   (which can never match). Keep the signature/badge iff that verifies.
3. **Badge** stays presence-based but now presence is preserved correctly for
   legitimately-edited messages.

### Alternatives considered (and why not)

- **Local "editVerified" boolean flag** (set when THIS device verified the live
  edit): fails for sync/replay devices that only receive the final edited post
  and never saw a verifiable edit — they'd have nothing to set the flag from.
  Also can't trust a synced flag from another device. Rejected: doesn't cover
  the main failing case.
- **Suppress the warning for any edited message** (badge ignores edits): removes
  the trust signal entirely for edited messages and would hide a genuinely
  unverifiable edit. Rejected.
- **Clear the signature on edit everywhere** (uniform "unsigned" on all devices):
  consistent but misleading in the other direction (warns on authentic content)
  and loses the signal. Rejected.

## Three-repo impact (this is a cross-repo change — read carefully)

| Repo | Change | Notes |
|---|---|---|
| **quorum-shared** | Likely: extend the stored `Message` type to hold the edit's proof (edit `publicKey` alongside `editSignature`); possibly a small helper to reconstruct the `edit-message` fingerprint from a stored edited post. Publish + version bump. | Additive if done as new optional fields. The "what proves an edited message" shape is a WIRE/protocol decision both apps must agree on — this is the part to confirm with the lead. |
| **quorum-desktop** | Store the edit proof in the edit-apply handlers (`saveMessage` + `addMessage`); teach both verify blocks to use the edit fingerprint for edited messages; badge honors it. Consumes shared via `link:`. | Medium: a few handler + verify-block edits + tests. |
| **quorum-mobile** | MUST mirror the same store + re-verify, or the badge diverges cross-platform (same message: "signed" on desktop, "unsigned" on mobile — for a trust signal that is arguably WORSE than the current consistent-ish wrongness). Bump to the published shared version. | This is the real weight of the task. Mobile parity is not optional here. |

**Additive gut-check:** if the stored-proof fields are new OPTIONAL fields, a
mobile bump with no other change still builds — so shared can ship first and
each app adopts on its own timeline. But the *badge* won't be consistent until
BOTH apps store AND re-verify. So for the user-visible fix to actually land,
desktop + mobile must both ship the receive/verify half.

**Sequencing:** shared (types/helper) → publish → desktop (store + verify) →
mobile (store + verify) → the cross-device inconsistency is resolved only once
both apps have the receive half.

## Lead-dev decision needed (one question)

"How should an edited message's authenticity be represented on the wire / in
storage?" i.e. confirm the approach of storing the edit's signature+publicKey on
the message and re-verifying via the edit fingerprint (vs. any protocol
preference the lead has, especially given the pending P2P → hub-log transport
convergence, which may change how message history/edits are replayed to a device
and therefore what proof is available at verify time). Raise via Telegram (the
lead doesn't read GitHub issues).

> ⚠️ Interaction with the hub-log migration: desktop is slated to move to
> mobile's hub-log transport. If history replay under hub-log delivers edits
> differently (e.g. as replayable control messages rather than collapsed final
> state), that changes what proof a late device has. Confirm the store-the-proof
> approach is compatible with the target transport before building, so this isn't
> redone after the migration.

## Test plan (both platforms)

1. Edit your own signed message → it stays "signed" (no warning) on the editing
   device AND on a second device that receives it via sync/replay.
2. Edit in a repudiable space where the original was UNSIGNED (inherit rule) →
   the edited message stays unsigned everywhere (no false "signed"), no warning
   claiming it should be signed. (Deniability preserved; consistent.)
3. A tampered edited message (edit signature invalid / doesn't match the
   displayed text) → shows the warning (the signal still works when it should).
4. Cross-platform: a message edited on desktop shows the SAME signed/unsigned
   badge state on mobile, and vice-versa.

## Scope / non-goals

- Not a security fix. Do not let it delay or entangle the control-message-auth
  security work (that PR intentionally excludes badge semantics).
- Reactions/pins don't carry displayed text, so they're out of scope.

*Last updated: 2026-07-19*
