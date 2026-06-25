---
type: task
title: "PLAN: Desktop DM control-message auth fix (remove-message + edit-message) — anchor to session sender"
status: done (DM paths implemented + tested; PR + manual verify tracked in MASTER-RECAP)
priority: high
created: 2026-06-25
branch: fix/control-message-auth-session-sender
mirrors: quorum-mobile commit 18cc7dc (branch feature/dm-delete-own-message-sync)
---

# Plan: fix DM remove-message + edit-message authorization on desktop

## Plain-language problem

DM control messages (delete-for-everyone = `remove-message`, and `edit-message`)
carry a `content.senderId` field that is **plaintext the sender's client writes**.
It is NOT proven by the encryption. A peer running a modified client can set it to
**your** address and delete/edit a message **you** authored. Desktop currently
authorizes by comparing `targetMessage.content.senderId === decryptedContent.content.senderId`
— two spoofable plaintext fields.

## The fix (mirrors mobile)

Authorize against the **session-authenticated sender** — the address of the Double
Ratchet session that actually decrypted the message — not the plaintext payload.

Key insight (why this is sound for DMs): a DM session is two-party. A message only
decrypts if it came from **you or the one peer**. The session that decrypts names
the true author via `conversationId.split('/')[0]` (or `session.user_address` on
the first-contact path). The attacker cannot fake which session decrypts their
message, so they cannot fake this identity.

The authorization check becomes (mobile's exact shape):
```ts
const authorized =
  payloadSenderId === authenticatedSender &&
  (!targetMessage || targetMessage.content?.senderId === authenticatedSender);
```

### The self-sync subtlety (the one trap)

Desktop fans DM messages out to the sender's OWN other devices too (confirmed:
`encryptAndSendDm` line ~757 and the edit-send block ~2400-2438 send to
`self.device_registrations` minus this device). When your own delete reaches your
other device, the code rewrites `conversationId` to point at the partner (for
storage). So the authenticated sender MUST be captured **before** that rewrite:
- First-contact path: capture `session.user_address` BEFORE the rewrite at
  MessageService.ts:2773-2777 (for self-sync, pre-rewrite value == self_address,
  which matches your own message's senderId == you → your delete is honored).
- Established path: the rewrite is the `conversationId.split('/')[0] === self_address`
  → repoint logic; capture before it.

## What's IN scope (high confidence)
- DM `remove-message` — `saveMessage` handler (lines ~992-995) and `addMessage`
  handler (lines ~1592-1595).
- DM `edit-message` — `saveMessage` handler (line ~1050) and `addMessage` handler
  (line ~1527). NOTE: mobile has NO DM edit handler (DM edits are sender-side only
  there); desktop DOES have one, so we fix desktop's to be safe. Flag for mobile
  parity discussion.

## What's OUT of scope (matches mobile — do NOT diverge)
- **Space `remove-message` and `edit-message`.** Mobile deliberately did NOT
  cryptographically fix the space path (commit 18cc7dc) — the space broadcast model
  has no per-message authenticated sender without a protocol change. Mobile keeps
  role-based checking on the payload senderId but hardcodes `isSpaceOwner: false`.
  Desktop's space gates (lines 1012/1027/1609/1620 role lookups) stay as-is here.
  Tracked separately:
  - quorum-desktop `.agents/tasks/2026-06-25-dm-remove-message-auth-bypass-spoofable-senderid.md` (space portion)
  - quorum-mobile `.agents/tasks/2026-06-25-control-message-auth-audit-senderid-spoofing.md`
- **Reactions / remove-reaction** — LOW (attribution spoof only, no privilege gate).

## Implementation approach

Thread the captured authenticated sender into `saveMessage`/`addMessage` as a new
**optional** parameter `authenticatedDmSender?: string`:
- When present (DM calls) → DM auth gates use it instead of the payload senderId.
- When absent (space calls) → behavior unchanged (space role gates untouched).
- Storage/cache keys keep using `spaceId`/`channelId` exactly as today; only the
  authorization DECISION changes.

DM call sites to pass it from (the authenticated sender, captured pre-rewrite):
- First-contact: MessageService.ts ~2847 (saveMessage) + ~2876 (addMessage).
- Established: MessageService.ts ~4421 (saveMessage) + ~4443 (addMessage).

## Verify after the fix (the three scenarios)
- (a) Peer deletes/edits a message THEY authored → honored.
- (b) Peer tries to delete/edit a message YOU authored (spoofs senderId=you) → dropped.
- (c) Your own delete/edit fans out to your other devices (self-sync) → honored.

Plus: `npx tsc --noEmit`, `yarn lint`, existing MessageService/ActionQueueHandlers unit tests, and add tests for (a)/(b)/(c).

## What was actually implemented (2026-06-25)

Four authorization gates in `src/services/MessageService.ts`, all DM-only
(`isDM = spaceId === channelId`), anchored to the proven conversation owner
(`spaceId`) instead of payload `senderId`:
1. `saveMessage` remove-message (~line 1011)
2. `addMessage` remove-message (~line 1622)
3. `saveMessage` edit-message (~line 1080)
4. `addMessage` edit-message (~line 1573)

Space paths left untouched (out of scope). Self-sync auto-apply intentionally not
handled on desktop (the "safe version" — see MASTER-RECAP). Implementation chose
NOT to thread a new parameter: for a DM, `spaceId` already IS the authenticated
sender in scope, so the gate uses it directly (simpler, no signature changes).

Tests added (`src/dev/tests/services/MessageService.unit.test.tsx`,
blocks 3b + 3c): legit peer delete honored; spoofed "delete YOUR message" dropped;
third-party-authored target dropped; legit peer edit honored; spoofed edit dropped.

Verification: `npx tsc --noEmit` clean; MessageService tests 24/24;
ActionQueueHandlers 67/67; eslint on changed file 0 errors.

PENDING: manual in-app verify of scenarios (a)/(b)/(c); PR to `main`; lead-dev
conversation re: space path + SDK authenticated-sender (see MASTER-RECAP talking points).

*Last updated: 2026-06-25*
