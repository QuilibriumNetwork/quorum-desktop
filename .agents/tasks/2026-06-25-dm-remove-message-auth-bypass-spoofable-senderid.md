---
type: task
title: "SECURITY: DM remove-message authorization bypass (spoofable senderId) — anchor to session sender"
status: "partial — DM remove + edit DONE (desktop branch); SPACE path still OPEN"
priority: high
created: 2026-06-25
source: surfaced during quorum-mobile DM delete-own-message work + deep code review
severity: HIGH (authorization bypass / integrity)
---

> **HUB:** This issue is tracked from
> [2026-06-25-MASTER-RECAP-control-message-auth.md](2026-06-25-MASTER-RECAP-control-message-auth.md).
> Read that first for the big picture and current status.
>
> **What's done:** the DM `remove-message` + `edit-message` bypass described below
> is FIXED on branch `fix/control-message-auth-session-sender` (see the recap and the
> `.done/` plan file). **What remains:** the **space (group-chat)** portion — scenario
> (d) below — is still open and shared with mobile's
> `2026-06-25-space-remove-message-auth-uses-payload-senderid.md`. The text below is
> kept as the original detailed analysis.

# DM remove-message auth bypass: authorize against the session-authenticated sender, not the payload `senderId`

## Summary

Desktop's DM `remove-message` handler authorizes a delete-for-everyone by comparing
two **plaintext payload fields** against each other:

```ts
if (targetMessage.content.senderId === decryptedContent.content.senderId) {
  await deleteOrSoftDelete(decryptedContent.content.removeMessageId);
}
```

Both `targetMessage.content.senderId` (author stored on the target) and
`decryptedContent.content.senderId` (the deleter, taken from the decrypted
remove-message payload) are **attacker-settable**. The deleter's `senderId` is
just a JSON field the sender writes; it is NOT derived from the Double-Ratchet
session that decrypted the message. So a malicious peer in a DM with you can:

1. Learn/observe the `messageId` of a message **you** authored (they have it — it's their conversation).
2. Send a `remove-message` with `content.senderId = <your address>` and `removeMessageId = <your message's id>`.
3. Your client computes `targetMessage.content.senderId (== you) === decryptedContent.content.senderId (spoofed to you)` → **true** → your message is deleted.

This violates the intended rule that **a peer can never delete a message you authored** (delete is own-message-only). It's an integrity/authorization bypass, not a confidentiality leak, but it lets a counterparty silently censor your side of a DM.

## Scope: this is ONE fix covering BOTH DMs and Spaces, in BOTH handlers

The same `remove-message` handler authorizes BOTH conversation types — DMs and
Spaces share one code block — and trusts the spoofable `decryptedContent.content.senderId`
in EVERY authorization decision. So the fix is: replace `decryptedContent.content.senderId`
with the cryptographically-authenticated sender (derived from the session that
decrypted the message, NOT the payload) at every spot it gates a delete. Do this
in both handlers. Concretely:

**Handler 1 — `saveMessage` path (~line 941–1036):**
- line 992–993 — author check `targetMessage.content.senderId === decryptedContent.content.senderId`. **This is the DM authorization** (DMs have `spaceId == channelId`, so the space `else if` at line 997 is skipped — DMs are authorized ONLY by this line).
- line 1012 — Space read-only-channel manager role check: `role.members.includes(decryptedContent.content.senderId)`.
- line 1027 — Space regular `message:delete` role check: `r.members.includes(decryptedContent.content.senderId)`.

**Handler 2 — `addMessage` path (~line 1575–1626):**
- line 1592–1593 — author check (DM + space "own message").
- line 1609 — Space read-only manager role check.
- line 1620 — Space regular `message:delete` role check.

So: **DM bypass** = lines 993 + 1593. **Space bypass** = lines 993/1593 (own) PLUS the role-lookup lines 1012/1027/1609/1620 (forge senderId = an admin/manager → delete anyone's space message). Fixing only the author-check lines would leave the space role bypass open; all of the above must use the authenticated sender.

Both use the payload `senderId`, not a session-bound identity.

## The fix (mirror the mobile fix)

Authorize against the **cryptographically-authenticated sender** — the identity
of the DR session that decrypted this control message — NOT the self-asserted
`decryptedContent.content.senderId`.

On mobile this is `conversationId.split('/')[0]` captured BEFORE the multi-device
self-sync rewrite (see quorum-mobile `context/WebSocketContext.tsx`, the two DM
`remove-message` branches; branch `feature/dm-delete-own-message-sync`). The
check becomes:

```ts
const authenticatedSender = /* the session-decrypted conversation owner, pre-self-sync */;
const authorized =
  decryptedContent.content.senderId === authenticatedSender &&            // payload claim must match the session
  (!targetMessage || targetMessage.content?.senderId === authenticatedSender); // deleter must be the author
```

Desktop equivalent of `authenticatedSender`: derive it from `found.conversationId`
(the session/inbox that successfully decrypted the message in
`DoubleRatchetInboxDecrypt` / `ConfirmDoubleRatchetSenderSession`), NOT from the
decrypted plaintext. Confirm where desktop already has the authenticated
conversation owner in scope at the `remove-message` handler and use it.

### Verify these scenarios after the fix
- (a) Peer deletes a message THEY authored → honored.
- (b) Peer tries to delete a message YOU authored (spoofing `senderId = you`) → **dropped**.
- (c) Your own delete fans out to your other devices (self-sync) → honored (authenticated sender is you, target authored by you). Watch the multi-device rewrite: capture the authenticated sender BEFORE any conversation rewrite, else self-sync deletes get dropped.
- (d) **Space `remove-message` path — CONFIRMED ALSO VULNERABLE (broader than DMs).** `addMessage` path lines 1592–1626 trust `decryptedContent.content.senderId` for BOTH the own-message check (line 1593) AND the role lookups: read-only manager check (`role.members.includes(decryptedContent.content.senderId)`, line 1609) and `message:delete` role check (line 1620). A peer with send access to a space can set `content.senderId = <an admin/manager's address>` and pass the role gate, deleting **anyone's** messages. The role membership lookup MUST use the authenticated sender, not the payload field. Fix the space path in the same pass.

## Notes / context

- The same weak pattern existed on mobile until `feature/dm-delete-own-message-sync` (2026-06-25). Mobile now anchors to the session sender; desktop should match.
- This is the canonical "verify the RECEIVE-side check, not the button" situation — the send-side gate (own-message-only) is irrelevant because a modified/malicious client ignores it.
- Reactions (`remove-reaction`) have the same payload-`senderId` trust shape; lower impact (reactions are low-stakes) but worth a follow-up audit while you're in this code.

## Source

Mobile reference implementation + full threat-model verification:
quorum-mobile branch `feature/dm-delete-own-message-sync`, and the mobile memory note
`dm-control-msg-auth-session-sender-not-payload`.

*Last updated: 2026-06-25*
