---
type: recap
title: "MASTER RECAP: control-message authorization fix (delete/edit spoofing) — desktop + mobile"
status: "living-document — ALL security code merged on BOTH platforms (DM #220; SPACE desktop #241/#243 + mobile #160 + shared #61; multi-device per-device-signing follow-up: desktop #245/#249/#250 + mobile #168 + shared #62). Only NON-code residuals remain: the coordinated prod cut-over (new desktop release timed with mobile going live) + the per-device `signing ?? inbox` cleanup (deferred until both apps broadly updated). Kept open as the cluster hub until those close."
priority: high
created: 2026-06-25
audience: "the team — written in plain language, no deep jargon"
---

# Master recap: the "spoofable senderId" fix

This is the ONE document to read to understand the whole situation. Everything
else (the other task files) is detail under one of the boxes below.

> **STATUS UPDATE (2026-07-19) — the SPACE fix has LANDED on desktop.** The
> "Left alone on purpose" framing below is now HISTORICAL. Desktop now
> authorizes space `remove-message` / `edit-message` / `pin` / `mute` against
> the cryptographically **verified ed448 signer** (reverse-lookup from the
> signing key, fail-closed on unknown members) instead of the spoofable payload
> `senderId`. The signature is the per-message sender proof the "we can't fix
> group chats without deeper crypto" note worried about — it was already
> attached to every message; we just made the receive side actually use it.
> Shared primitives: `quorum-shared` PR #61 (`messageAuth.ts`). Desktop:
> branch `feat/space-control-message-auth` (commits `955471b16`, `151ddeb9c`).
> `@everyone` is also now gated on the verified signer.
>
> **UPDATE (2026-07-21):** mobile's matching receive-side verification is now
> ALSO merged to mobile `master` — `fix: space control message auth signatures
> (#160)` (verified-signer receive) plus `fix: multi-device space message
> signing (#162)`. So the security code is complete on BOTH platforms. The
> **sole remaining blocker to close this recap is the coordinated production
> cut-over** (do not deploy desktop to prod until mobile ships to prod, or
> updated desktops reject control messages from un-updated clients). As of
> 2026-07-21 **neither platform has the SPACE fix in production yet:**
> - Desktop's last release is **v2.1.3 (2026-07-17)**, which PREDATES the space
>   fix `d6d20a6a2` (2026-07-19) — verified `git merge-base --is-ancestor`: v2.1.3
>   does NOT contain #241. (The DM fix #220 DID ship, it's in v2.1.2/v2.1.3.) So
>   the space fix sits on `main` unreleased; the cut-over needs a fresh desktop
>   release (v2.1.4+) cut after `d6d20a6a2`.
> - Mobile code is merged to `master` but not yet shipped to prod (release timing
>   is outside our control).
>
> This "neither in prod" state is the SAFE one — no client mismatch is possible
> until one side ships. The cut-over = a new desktop release timed with mobile
> going live. Deferred, non-blocking: the edited-message
> "signed" badge across devices — `.agents/tasks/2026-07-19-edited-message-signature-badge-cross-device.md`.
> Read the sections below with this update in mind.

## The bug, in one paragraph

Delete and edit messages carry a "signed by: <name>" field that is **just text the
sender's app writes** — it is not proven by the encryption. A chat partner running
a **modified app** can set that field to **your** name and target a message **you**
wrote. The receiving app currently believes it, so the partner can secretly delete
or edit messages you authored. (This is NOT a random internet attacker — it's a
person you're already in a conversation with, using a hacked client. Receive-side
checks exist precisely so we don't have to trust the other person's client.)

## The fix, in one sentence

Stop trusting the "signed by" text. Authorize using the identity the **encryption
itself proves** about who sent the message (the "session-authenticated sender").

## The full picture (every piece, with status)

|  | DM (private 1-on-1) | Space (group chat) |
|---|---|---|
| **delete** (`remove-message`) | Mobile: DONE. Desktop: DONE (merged). | **Desktop: DONE** (verified-signer auth). **Mobile: DONE** (#160). |
| **edit** (`edit-message`) | Desktop: DONE (merged). Mobile: no DM-edit handler exists. | **Desktop: DONE** (verified-signer auth + edit inherit rule). **Mobile: DONE** (#160). |
| **pin** | n/a (space-only) | **Desktop: DONE** (verified-signer auth). **Mobile: DONE** (#160). |
| **mute** | n/a (space-only) | **Desktop: DONE** (verified-signer auth). **Mobile: DONE** (#160). |
| **@everyone** | n/a | **Desktop: DONE** (honored only if verified signer holds `mention:everyone`). **Mobile: DONE** (#160). |
| **reactions** | Out of scope — low stakes (fake "X reacted", no privilege). | Out of scope — same. |

> The Space column previously read "Left alone on purpose" for delete/edit. That
> is now HISTORICAL (see the 2026-07-19 status update at the top). The "Left
> alone on purpose" section below is kept for provenance but no longer describes
> current desktop behavior.

> "Desktop: DONE" = code written, type-check clean, unit tests pass (incl. the
> spoof-attack tests). Still PENDING: a quick in-app manual check + opening the PR.
> See "Current status / what's left" below.
>
> **Mobile "DONE" status (2026-06-25):** code complete on branch
> `feature/dm-delete-own-message-sync`, **uncommitted working tree**, verified
> static (tsc + lint clean; reaction send unchanged; normal receive unaffected;
> desktop honors a legit cross-account delete — traced). The mobile branch ALSO
> carries two delivery-reliability fixes the desktop side doesn't need: (1) the
> delete sends via the all-devices transport (`sendEncryptedMessageToAllDevices`),
> not the single-session reaction transport, so it reaches every device a normal
> message does; (2) the send no longer bails on a transient `!isConnected` (it
> enqueues and flushes on reconnect) — that was silently dropping deletes. These
> are mobile-transport fixes, separate from the shared security logic. Live
> mobile↔desktop propagation could not be confirmed: blocked by the pre-existing
> desktop↔mobile delivery sync issue (affects normal messages too), NOT the auth
> fix. Detail: mobile `.agents/docs/features/dm-delete-own-message.md`.

**"Left alone on purpose" (group chats) — HISTORICAL (superseded 2026-07-19):**
This section described the state when only DMs were fixed. It reasoned that a
group chat's encryption can't prove who sent each message "without a deeper
change to the shared crypto library." That turned out to be avoidable: the
ed448 **signature** already on every message IS the per-message sender proof —
no crypto-library change was needed, only using the signature on the receive
side. Desktop now does exactly that (see the 2026-07-19 status update at the
top). Mobile's matching receive-side verification is now also merged (#160) —
the only remaining piece is the coordinated production cut-over.

> **Scope note for the group-chat follow-up:** the underlying issue is not
> specific to delete/edit — it applies to *every* group-permission decision that
> the receiver makes based on the sender's claimed identity (the same pattern is
> used for several existing permissions, and any new role permission would inherit
> it). So the group-chat fix should be done once at the mechanism level — make the
> proven sender the single identity all permission checks use — rather than
> patched per feature. Detailed/private write-up is tracked outside this public
> repo (see the private tracking issue referenced in the mobile design task).

## What "this work" (the current desktop branch) actually changes

Branch: `fix/control-message-auth-session-sender`

ONLY private-chat (DM) delete and edit. Four spots in
`src/services/MessageService.ts`:
- delete: the `saveMessage` handler + the `addMessage` handler
- edit: the `saveMessage` handler + the `addMessage` handler

Nothing about group chats, reactions, or the crypto library is touched.

How the fix works in one line: for a DM, the app already knows the proven other
party (it's the conversation address). A delete/edit is honored only if the message
being deleted/edited was actually written by that proven party. A partner lying
that "this is signed by you" to delete YOUR message fails this check.

## Current status / what's left

DONE (on branch `fix/control-message-auth-session-sender`):
- Code: 4 DM authorization gates rewritten in `src/services/MessageService.ts`.
- Tests: 5 new unit tests in `src/dev/tests/services/MessageService.unit.test.tsx`
  (legit peer delete honored; spoofed "delete your message" dropped; third-party
  target dropped; legit peer edit honored; spoofed edit dropped).
- Checks: `npx tsc --noEmit` clean · MessageService tests 24/24 · ActionQueueHandlers
  67/67 · eslint on the changed file: 0 errors.

STILL TO DO:
1. Manual in-app sanity check (delete/edit your own DM message works; the cosmetic
   self-sync lag is the only expected difference).
2. Open the PR to `main` (commit/push only when you say so).
3. Talk to the lead dev using the talking points at the bottom of this file
   (group-chat scope + whether the SDK should expose the per-message sender).

## The one known limitation (decided: ship the safe version)

When you delete a message, your app also syncs that delete to your OWN other
devices. On desktop, for an **ongoing** conversation, the app cannot tell apart
"this delete came from my other device" vs "from my chat partner." Mobile CAN tell
(its lower-level decryptor hands back the proven sender on every message; desktop's
does not).

Decision: **ship the safe version.** It 100% blocks the attack. The only cost is
a rare cosmetic lag — a delete you make on one device might not auto-disappear on
your *other* device until that device refreshes. Nothing is lost or insecure.

The "perfect" version (instant self-sync too) needs the shared crypto library to
return the proven sender on every message, like mobile's native layer does. That is
a **lead-dev / SDK decision**, noted as a follow-up — NOT done in this branch.

## Why desktop and mobile differ here (so it's not a surprise later)

Mobile's message decryption runs in a native (Rust/WASM) layer that returns the
authenticated sender for every message. Desktop uses the JavaScript SDK, which only
returns the sender on the FIRST message of a conversation, not on later ones. Same
encryption underneath; different amount of info handed back to the app. That gap is
the entire reason for the limitation above.

## Parity: are desktop and mobile fixing this the SAME way? (Yes, on security)

The security logic is **identical** on both platforms:

| | Mobile | Desktop |
|---|---|---|
| The check | `senderId === authenticatedSender && (!target \|\| target.senderId === authenticatedSender)` | `senderId === spaceId && target.senderId === spaceId` |
| "authenticated sender" is… | `conversationId.split('/')[0]` | `spaceId` — which **for a DM equals** `conversationId.split('/')[0]` |
| Spoofed "delete YOUR msg" | dropped | dropped |

Same two-part rule, same proven-sender source. Different variable name only
(`authenticatedDmSender` on mobile vs `spaceId` on desktop), because on desktop the
DM's `spaceId` already IS that proven sender. **This is true parity on the part that
makes it safe.**

The ONLY difference is the self-sync nicety (instant cross-device delete), which
mobile has and desktop doesn't, purely because of the SDK info gap above. That
difference is cosmetic and does NOT affect the security guarantee. It is a lead-dev
/ SDK item, not a parity bug.

**Bottom line for shipping:** the attack is blocked the same way on both apps. The
fix is fully verifiable on a single device (edit a message, delete a message — both
confirmed working in desktop dev). Cross-device sync is NOT required to trust or
merge this fix.

## Task index (THIS file is the hub — every related task is linked here)

This is the single source of truth. The other files hold detail; this table tells
you what is OPEN vs DONE so nothing gets lost.

### Core security work (the senderId-spoofing fix)

| Status | Task | What it covers |
|---|---|---|
| **DONE** | `.done/2026-06-25-desktop-dm-control-msg-auth-fix-plan.md` (desktop) | The desktop DM delete+edit fix implemented on this branch. Complete: code + tests. |
| **DONE** | mobile commit `18cc7dc` (branch `feature/dm-delete-own-message-sync`) | The mobile DM delete fix. The reference desktop mirrored. |
| **OPEN** | `2026-06-25-dm-remove-message-auth-bypass-spoofable-senderid.md` (desktop) | Original DM bug write-up. DM part now DONE. (Space portion redacted — see private issue.) |
| **OPEN** | **PRIVATE:** quorum-app-prod#1 + quorum-mobile gitignored `.agents/` (`2026-06-25-space-control-msg-auth-signature-design.md` + `2026-06-25-space-auth-leaddev-message.md`) | **Group-chat (space) authorization — the remaining work.** Design doc + lead-dev message live here. Detail kept OUT of this public repo. |
| **OPEN (private detail)** | `2026-06-25-space-remove-message-auth-uses-payload-senderid.md` (mobile, gitignored) | The mobile-side space bug report this design answers. Mobile-local only. |
| **REFERENCE** | `2026-06-25-control-message-auth-audit-senderid-spoofing.md` (mobile, gitignored) | The full per-handler audit matrix (DM + space + reactions). Detailed reference; THIS recap is the live tracker. |

### Adjacent work (related topic, NOT the spoofing fix — don't confuse)

| Status | Task | Why it's separate |
|---|---|---|
| OPEN | `2026-06-17-delete-own-message-in-dm.md` (mobile) | The mobile DM-delete *feature* (where this fix originated). |
| OPEN | `2026-06-25-dm-delete-conversation-signal-and-self-sync.md` (mobile) | Deleting a WHOLE conversation — different feature, blocked on a new shared wire type. |
| OPEN | `2026-06-25-port-message-signing-controls.md` (mobile) | The "Always sign messages" toggle UI — unrelated to spoofing auth. |

**See also (same "don't trust the sender's client on receive" family, separate efforts):**
`2026-06-13-harden-unsupported-message-type-handling.md` and
`2026-06-13-dm-receive-path-default-deny.md` (mobile) — receive-side default-deny
hardening. Not part of this fix, but adjacent if a broader receive-side audit happens.

### The one open follow-up this recap itself owns

- **Space-path fix (desktop + mobile)** — this is an UNPATCHED authorization concern
  for group chats, so its specifics are kept OUT of this public repo. Tracked
  privately at **https://github.com/QuilibriumNetwork/quorum-app-prod/issues/1**, with
  the design/decision doc in quorum-mobile's gitignored `.agents/`. Awaiting a
  lead-dev direction decision. Do NOT re-add space exploit detail to this public repo.

## For a conversation with the lead dev (talking points)

1. We're fixing DM delete + edit on desktop to match the mobile fix (block the
   spoof). Good to merge.
2. We are deliberately NOT touching group-chat delete/edit (matches mobile's
   decision). Confirm that's still the plan.
3. Desktop has a self-sync cosmetic limitation mobile doesn't, because the JS SDK
   doesn't return the authenticated sender on every message. Question for you: do
   we want the SDK to expose that (so desktop can reach full parity), or is the
   safe-version behavior fine to live with?

## Ready to ship? (merge readiness)

YES for the desktop DM fix. Reasoning:
- The attack is blocked, with the SAME logic as the already-merged mobile fix
  (see Parity section) — no divergence on security.
- Verified: tsc clean, 24/24 + 67/67 unit tests, lint clean on the changed file.
- Manually confirmed in desktop dev: editing a message works, deleting a message
  works. (Cross-device propagation could NOT be tested due to a desktop↔mobile sync
  issue, but it is NOT required for this fix — see Parity section: the fix is
  single-device-verifiable, and the self-sync nicety is a separate SDK item.)

Not blocking the merge: the space-path fix and the self-sync nicety are tracked
follow-ups, not regressions introduced by this branch.

Suggested PR scope: desktop DM `remove-message` + `edit-message` only. Mention in
the PR body that space paths are intentionally unchanged (parity with mobile) and
linked to the open space task.

*Last updated: 2026-07-21*
