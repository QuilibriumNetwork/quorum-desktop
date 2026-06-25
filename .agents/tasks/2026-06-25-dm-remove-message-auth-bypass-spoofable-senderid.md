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

## Scope: DM portion (this doc) — Space portion tracked privately

This document covers the **DM** `remove-message` / `edit-message` fix, which is
DONE and merged (PR #220). The DM handler authorizes by comparing the spoofable
`decryptedContent.content.senderId`; the fix replaces it with the
cryptographically-authenticated session sender (see "The fix" below).

> The **Space (group-chat)** portion of this issue is intentionally NOT detailed
> here. It is an unpatched authorization concern and its specifics are kept out of
> this public repo. Tracked privately:
> **https://github.com/QuilibriumNetwork/quorum-app-prod/issues/1**
> (design notes live in quorum-mobile's gitignored `.agents/`). Do not re-add Space
> exploit specifics to this file.

**DM handler — `saveMessage` path (~line 941–1036):**
- the DM author check `targetMessage.content.senderId === decryptedContent.content.senderId`
  (DMs have `spaceId == channelId`, so DMs are authorized ONLY by this line).

**DM handler — `addMessage` path (~line 1575–1626):**
- the DM author check (same shape).

Both used the payload `senderId`, not a session-bound identity — now fixed for DMs.

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
- (d) **Space path** — a related authorization concern exists for group chats; it is
  tracked privately (see the note above:
  https://github.com/QuilibriumNetwork/quorum-app-prod/issues/1). Not described here.

## Notes / context

- The same weak pattern existed on mobile until `feature/dm-delete-own-message-sync` (2026-06-25). Mobile now anchors to the session sender; desktop should match.
- This is the canonical "verify the RECEIVE-side check, not the button" situation — the send-side gate (own-message-only) is irrelevant because a modified/malicious client ignores it.
- Reactions (`remove-reaction`) have the same payload-`senderId` trust shape; lower impact (reactions are low-stakes) but worth a follow-up audit while you're in this code.

## Source

Mobile reference implementation + full threat-model verification:
quorum-mobile branch `feature/dm-delete-own-message-sync`, and the mobile memory note
`dm-control-msg-auth-session-sender-not-payload`.

*Last updated: 2026-06-25*
