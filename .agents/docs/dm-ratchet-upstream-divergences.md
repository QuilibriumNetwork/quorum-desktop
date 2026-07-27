---
type: doc
title: "DM Double Ratchet fixes — divergences from the original upstream implementation"
status: done
created: 2026-07-17
---

# DM Double Ratchet fixes — divergences from the original implementation

**Purpose of this document:** in July 2026 we changed two behaviors of the DM receive/send
pipeline in `src/services/MessageService.ts` that diverge from how the code was originally
written. Both changes fix the long-standing (~6 months) "DM messages silently never arrive"
bug. This document is the self-contained justification for those changes, written so it can
be handed to the lead dev at any point in the future without requiring them to read the full
bug archive. Every behavioral claim is backed by the Signal Double Ratchet specification
(https://signal.org/docs/specifications/doubleratchet/), not by our own reasoning about crypto.

Full evidence trail (5 instrumented live rounds, dual-log captures, live verification):
`.agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md`.

---

## Divergence 1 — decrypt failure no longer destroys the session

**Shipped:** PR #235 (2026-07-17).

**Original behavior:** in the DM receive section, both decrypt-failure catch blocks
(`DoubleRatchetInboxDecrypt` and `ConfirmDoubleRatchetSenderSession`) deleted the server copy
of the frame AND called `deleteEncryptionState(found)` — destroying the whole session on a
single failed frame.

**New behavior:** on decrypt failure, the frame is skipped (server copy still deleted, loud
error logged) and the session is KEPT.

**Why the original behavior was the root cause of the delivery bug:** the sender still holds
its session and keeps encrypting to the same session inbox. After the receiver destroyed its
state, every subsequent message hit the `!found` branch and was deleted unread with no log.
After the next reconnect the client did not even re-listen on that inbox (the listen set is
built from `encryption_states` rows). Result: the conversation direction died permanently,
with zero errors on either side — exactly the reported symptom shape ("first message lands,
later ones vanish, stays bad once bad"). Proven live with instrumented rounds, and the fix
was confirmed live: the same session now survives decrypt failures and keeps delivering.

**Why keeping the session is not a security regression.** The plausible rationale for the
original code is "AEAD failure could mean tampering, so fail closed and tear the session
down." The Double Ratchet specification explicitly prescribes the opposite for
`RatchetDecrypt`:

> "If an exception is raised (e.g. message authentication failure) then the message is
> discarded and changes to the state object are discarded. Otherwise, the decrypted
> plaintext is accepted and changes to the state object are stored."

Rejecting the frame IS the complete defense against a tampered or injected message — the
attacker gains nothing from the receiver keeping its session, and the protocol is designed to
tolerate bad/duplicate/out-of-order frames precisely this way (later messages use later keys
and decrypt fine). Destroying the session converts a one-frame loss into a permanently dead
conversation while adding no security. The original code additionally *persisted a state
mutation on failure* (the deletion), which is what the spec forbids. Our change brings the
code INTO spec compliance.

---

## Divergence 2 — all ratchet state operations serialized per conversation

**Shipped:** branch `fix/dm-ratchet-serialization` (2026-07-17). Key pieces:
`src/utils/keyedMutex.ts` (per-key FIFO async lock) + lock acquisition at every DM ratchet
critical section in `MessageService.ts`.

**Original behavior:** five independent code paths each performed
read-state → encrypt/decrypt → save-state on the same `encryption_states` row with no
coordination:

1. receive decrypt (`handleNewMessage` — state read at the top, saved ~1,400 lines of awaited
   code later),
2. text send / edit (`submitMessage` DM branch),
3. automatic retry (`retryDirectMessage`),
4. delivery/read receipt sends (`encryptAndSendDm` via the action queue),
5. typing indicator sends (`sendEphemeralDMControl` → `encryptAndSendDm`, fired on keystrokes).

**New behavior:** every one of those sections runs under
`dmRatchetMutex.runExclusive(conversationId, …)`. Additionally, the receive path re-reads the
state row inside the lock (its pre-lock snapshot may be stale after waiting) and persists the
advanced state immediately after a successful decrypt instead of at the tail of the handler.

> **Correction, 2026-07-27.** The list above was incomplete: there is a **SIXTH** site, the
> offline-composed DM path (`ActionQueueHandlers.sendDm`), and it held no lock at all until
> 2026-07-27. It was missed because it is a near-identical copy of the `submitMessage` loop
> living in a different file, and it only runs for DMs composed while offline — so it never
> appeared in any instrumented capture. Now locked, with a regression test verified to fail
> without it. **Anything applied to the DM encrypt path must be applied to all six sites**;
> this is the second defect caused by one of the copies drifting.

**Why this was necessary:** Double Ratchet state is strictly linear — the spec models
encrypt/decrypt as sequential mutations of a single state object, and the ratchet's security
(and correctness) depends on each operation starting from the latest stored state. Two
concurrent operations that read the same snapshot fork the state: whichever save lands last
silently erases the other's advance. The peer then cannot derive message keys for the erased
branch, and frames fail with `aead::Error`. A collision that erases a DH step or an inbox
rotation forks the session permanently. This was observed live as the deterministic repro
"reset session → messages 1 and 2 land → from message 3 nothing lands", triggered reliably
once the receipts feature began firing an encrypted send within milliseconds of every
received message (i.e., inside the receive handler's read-to-save window). After
serialization: 10/10 numbered messages per direction with receipts and typing enabled, zero
drops, zero stuck sends.

**On the immediate post-decrypt save** — this is also spec-motivated: "the decrypted
plaintext is accepted and changes to the state object are stored" is one atomic step in
`RatchetDecrypt`. Deferring the save to the end of a long handler created a multi-await
window in which a concurrent send could read the pre-decrypt state and erase the receive
advance.

**Implementation notes relevant to review:**
- `KeyedMutex` is ~40 lines of pure TypeScript with no dependencies, FIFO per key, keys are
  `conversationId`. Deliberately extractable to `quorum-shared` for mobile parity.
- The lock is NEVER held across socket delivery. The outbound queue's callbacks themselves
  take the lock, so holding it until delivery is a circular wait (we hit this in the first
  iteration — both directions froze at "Sending…"; fixed and regression-tested). The trap:
  an async lock callback returning the delivery promise gets auto-flattened, silently
  extending the critical section until delivery.
- Regression tests: concurrent sends must strictly alternate read→save→read→save (fails on
  the unserialized code), and a stalled outbound queue must not prevent a second send from
  reaching its encrypt+save (fails on the lock-across-delivery code).

---

## Divergence 3 — stale init envelopes are refused instead of installed

**Shipped:** branch `chore/dm-reset-signal-logging` (2026-07-17).

**Original behavior:** an incoming initialization envelope (the "here is our new session"
message that establishes or re-establishes a DM session) unconditionally replaced the
receiver's existing session for that device tag, in complete silence.

**New behavior:** an init envelope is installed only if it is strictly newer than the session
rows it would replace. Concretely (`src/utils/initEnvelopeGuard.ts`, pure and unit-tested):
an envelope whose timestamp exactly matches an existing row is a redelivery of an
already-processed envelope and is refused; an envelope older than the newest existing row
beyond a 2-minute clock-skew tolerance is refused. Refused envelopes are deleted from the
server. Malformed envelopes with no resolvable sender address are also dropped. Every
replacement, refusal, and reset signal is now logged at warning level.

**Why this was necessary — this was the dominant cause of the 6-month delivery bug.** The
server retains every inbox frame until the client explicitly deletes it, and those deletions
can fail (`POST /inbox/delete` returning 502 was captured live). An undeleted init envelope
is therefore redelivered on any reconnect — and *successfully re-processing* it replaced the
receiver's CURRENT healthy session with a resurrected old one that the sender no longer
holds. Captured live 2026-07-17: redelivered init envelopes up to 60 days old, replayed on
every hard refresh, each silently killing the fresh session (receiver console completely
silent afterward, because frames to the now-unknown inboxes never reach the app). This is
why conversations kept dying minutes after every manual session reset: each reset planted
the next mine. After the guard: hard refreshes no longer kill sessions, verified live.

Note the security framing: the guard does not weaken session establishment — a genuine
re-init always carries a timestamp newer than the rows it replaces, so legitimate resets are
unaffected. It removes a replay hazard (old envelopes being honored) that the unconditional
install created.

## Minor divergence — the `!found` branch now logs

Frames addressed to an inbox with no encryption state were deleted unread with no log of any
kind. This total silence hid the aftermath of mechanism 1 for six months. The branch still
deletes (leaving the frame would redeliver it forever) but now logs a loud warning with the
truncated inbox address and timestamp.

---

## What we propose upstream / for mobile

**Mobile status, verified in code 2026-07-17** (`quorum-mobile/services/crypto/encryption-service.ts`):
mobile does NOT have Divergence 1's bug — its decrypt-failure handling already returns null
or throws WITHOUT persisting anything (it even carries a comment warning against saving
corrupted state), so mobile was already spec-compliant there and nothing needs porting.
Mobile DOES share the Divergence 2 gap: no lock exists around its ratchet state operations,
its decrypt is an awaited native call between state read and write, and its delivery/read
receipts also ride the DM ratchet. MMKV's synchronous storage narrows the race window but
does not remove it. Concrete proposal:

1. `KeyedMutex` is DONE in shared (#59, 2.1.0-35); mobile serializes its ratchet operations
   per its task: `quorum-mobile/.agents/tasks/2026-07-17-serialize-dm-ratchet-state-keyedmutex.md`.
   The mobile task includes a recon item a JS mutex cannot cover: Android's
   `BackgroundMessageService` runs in a separate JS context; if it can decrypt the same
   inbox as the foreground app, that cross-context race needs a lead-dev-level decision.
2. **Divergence 3 on mobile (verified in mobile code 2026-07-17): partially protected by
   design.** Mobile's init handling checks an ephemeral-key cache and tries the existing
   session before falling through to fresh X3DH, so redelivery of the CURRENT session's
   envelope cannot nuke it. An OLDER distinct envelope (from a previous reset epoch) that
   fails existing-session decrypt and falls through to X3DH may still install a stale
   session over a newer one — recon item in the mobile task. If confirmed,
   `isStaleInitEnvelope` is pure and extractable to quorum-shared so both platforms share
   the identical staleness rule.
3. Optional hardening, desktop and mobile: dedupe-before-decrypt cache (redelivered frames
   currently fail AEAD harmlessly but noisily — deferred, see
   `.agents/tasks/2026-07-17-dm-dedupe-before-decrypt.md`), folding session reset
   (`deleteEncryptionStates`) under the same lock, and automatic resend on missing delivery
   receipts (`.agents/tasks/2026-07-17-dm-dead-session-autoheal.md` — the highest-value
   follow-up; converts residual single-frame wire losses into invisible recoveries).
4. **Server-side:** `POST /inbox/delete` intermittently returns 502 Bad Gateway. Failed
   deletes are the enabler of the whole redelivery class; worth a server-side look.

---

## Divergence 4 — a session reset keeps inbox ROUTING

**Shipped:** PR #252 (2026-07-25).

**Original behavior:** `EncryptionService.deleteEncryptionStates` deleted the conversation's
inbox MAPPINGS along with its ratchet states.

**Why that is wrong:** the peer still holds a confirmed session pointing at our existing
conversation inbox and keeps writing to that address — it has no way to learn we reset. With
the mapping gone those frames arrive at an address we no longer recognise and are silently
discarded, while our next send mints a BRAND-NEW inbox the peer never hears about. Our
messages still reach them (fresh init envelopes to their device inbox), so the conversation
looks half-alive: everything we send lands, everything they send disappears — permanently.

**Evidence:** measured live 2026-07-25. Immediately after a desktop reset the peer kept
posting to the old inbox with a still-confirmed session and desktop logged "no encryption
state, dropping unread" for every frame, including the first message after the reset.

**Note:** mobile has always had this right — its `resetSession` deletes ratchet states but
deliberately keeps conversation inbox keypairs ("the addresses are still valid for receiving")
and inbox mappings ("routing still needs to work"). The desktop reset action added 2026-07-17
mirrored the deletion but not those exclusions.

---

## Divergence 5 — undecryptable frames are RETAINED for retry, and acked on success

**Shipped:** PR #253 (2026-07-25). **This amends Divergence 1**, which stopped the session
being destroyed but left the frame being deleted on first failure.

**Original behavior:** both decrypt-failure catch blocks deleted the frame from the server
inbox on the FIRST failure.

**Why that is wrong:** a frame routinely fails purely because our receiving chain has not yet
ratcheted into the sender's current chain. Seconds later the DH ratchet runs, stores the
skipped message keys, and the SAME frame decrypts. Deleting on first failure destroys frames
before they can ever succeed.

**Evidence:** real captured frames replayed offline against real captured ratchet states —
5 of 6 deleted frames decrypted against a state the client itself held ~35s later, and
emptying that state's skipped-keys map made them fail again, proving the keys those frames
needed did arrive just after the frames were gone. Verified live: three frames recovered
after previously failing (19.6s/3 attempts, 20.2s/3, 40.9s/6).

**New behavior:** frames are retained (the server redelivers anything not acked-by-delete) and
deleted only once an attempt or time budget is spent, preserving the original protection
against a genuinely poisonous frame. Retaining is safe for the inbox: `processInbound` already
catches handler errors and continues, so a kept frame does not block those behind it.

Two supporting changes: successful decrypts are now ACKED (the confirmed-session path never
was, which with retention caused repeat redelivery — measured at 12 repeat decrypts of one
frame); and frame identity is a content hash, never the timestamp, because **two distinct live
frames were observed sharing one server timestamp**. That non-uniqueness also means any
delete-by-timestamp can take a sibling with it — mitigated by deleting far less often, but a
real fix needs the delete API to accept a frame identity.

---

## Divergence 6 — send with the NEWEST session for a device

**Shipped:** PR #254 (2026-07-25), mirroring quorum-mobile #179.

**Original behavior:** all four send sites selected with `sets.find((s) => s.tag === inbox)` —
first match in insertion order, no regard for recency.

**Why that is wrong:** several stored rows legitimately share one device tag. When the peer
resets they mint a new receiving inbox and announce it in a fresh init envelope, but they
cannot delete our old row — so we hold BOTH a stale confirmed row, pointing at an inbox they
have abandoned, and the fresh one. Both look send-ready and the stale one is first, so it won
every time. A reset is meant to be ONE-SIDED: one user resets, their next message carries the
new session, both converge. That only works if the peer's send path adopts the newest session.

**Evidence:** live 2026-07-25 — reset from desktop and mobile→desktop died; reset from mobile
and desktop→mobile died, 0 of 5 landing with no receipts either way. **The dead direction is
always the one pointing back at whoever reset.**

**New behavior:** `orderSessionsForSend` orders candidates send-ready first, then newest, so
`find` yields the right session at every site.

---

## Divergence 7 — init envelopes have an ABSOLUTE age bound

**Shipped:** PR #255 (2026-07-25). **This closes a hole in Divergence 3.**

**Original behavior:** the staleness guard's first rule was "no existing rows for the tag →
not stale".

**Why that is wrong:** a session RESET deletes every row, so for a window there is nothing to
compare against and ANY redelivered init envelope is accepted. The guard is blind precisely
when the user resets — the recovery action disables the protection.

**Evidence:** live 2026-07-25, immediately after a desktop reset:

```
SESSION REPLACED by init envelope  envelopeAgeSeconds: 94125  replacedRows: 0
SESSION REPLACED by init envelope  envelopeAgeSeconds: 94089  replacedRows: 1
SESSION REPLACED by init envelope  envelopeAgeSeconds: -0     replacedRows: 1
```

Two envelopes 26 HOURS old installed themselves into the freshly-reset state before the peer's
real init arrived; the pairing was left desynced and the peer's frames then hit an inbox with
no state. The reset the user had just performed was silently undone.

**New behavior:** an absolute age bound (10 minutes) covers the zero-rows case, where there is
nothing to compare against.

> **Revised 2026-07-27.** It originally ran BEFORE the relative rules, unconditionally, on the
> assumption that "a legitimate init envelope is seconds old". **That only holds while the
> receiver is online**, and it was measured destroying a real message: an envelope 174 s NEWER
> than every row it would replace — one both relative rules accept — was refused for being
> 17.6 minutes old, and the refusal path deletes the frame server-side. That is the
> "away for a while, come back broken" report.
>
> Wall-clock age is the wrong test whenever rows exist, because the rows carry a better signal:
> **a zombie is OLDER than the rows it would replace, a legitimate re-init is NEWER.** The
> relative rules already encode exactly that. The bound is now scoped to the no-rows case it was
> written for, and both observed zombie scenarios still refuse (fresh-session kills are caught by
> the relative rule; the just-reset case has no rows). Envelopes stamped implausibly far in the
> future are now also refused — one of those wins every recency comparison and would block every
> legitimate re-init behind it.

---

## STILL OPEN — the structural cause is on MOBILE, not desktop

Desktop↔desktop has no reported issues; every pairing involving mobile breaks. That maps onto
a storage-model difference, and desktop's model is the correct one:

> **FALSIFIED 2026-07-27.** Desktop↔desktop reproduces the failure. Seven instrumented
> desktop-only rounds measured ~40% of frames failing AEAD on first delivery attempt, in both
> directions, on sessions both sides consider healthy. The storage-model difference below is
> still real and mobile's model is still the wrong one — but it is not what makes
> desktop↔desktop work, because desktop↔desktop does not work. See
> `.agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md`.

- **Desktop** mints a fresh inbox keyset PER SESSION and stores rows under
  `inboxId: session.receiving_inbox.inbox_address` — every device gets its own inbox and its
  own row. Multi-device safe.
- **Mobile** reuses ONE conversation inbox for the whole conversation and stores rows under
  `(conversationId, inboxId)` — all of a peer's devices collapse onto one key and overwrite
  each other. Last writer wins; the other sessions are silently destroyed.

Two devices is enough to trigger it, and a phone + a desktop is the ordinary case. Design and
migration plan: `quorum-mobile/.agents/tasks/2026-07-25-mobile-per-device-conversation-inbox.md`.

Desktop needs no change for this, but it explains why the divergences above, all real and all
verified, did not by themselves close the bug: the mobile-side collision keeps manufacturing
the conditions they cope with.

### Update 2026-07-25 (later the same day) — mobile shipped, and a SECOND cause was found

**quorum-mobile PR #180** shipped the per-device inbox fix above, plus a larger cause that
matters to anyone reading DESKTOP logs:

**Mobile never sent the SDK "accept".** A frame is either plain or init-wrapped, and the
RECEIVER demands which: while desktop's `sending_inbox.inbox_public_key` is empty it takes
`ConfirmDoubleRatchetSenderSession`, which throws `invalid initialization envelope` on a plain
frame. Mobile chose the shape by asking *"do I know THEIR inbox?"*; the SDK asks *"have I told
them MINE?"* via `sent_accept` (`DoubleRatchetInboxEncrypt`, channel.ts L976+). A mobile session
born from desktop's init envelope knew desktop's inbox immediately, so mobile's first reply went
out plain and desktop dropped every frame. **That is the source of the
`invalid initialization envelope` bursts in desktop's console** — not a desktop defect.

Two desktop-side facts worth knowing, both verified against source:

- Desktop serializes its state blob without `sent_accept` (it lives in a separate DB column and
  is never written back), so `state.sent_accept` is always `undefined` at encrypt time and
  **desktop init-wraps every frame it sends.** The SDK's plain-frame branch is effectively dead
  code here. This is why desktop↔desktop never hit the bug.

  > **FIXED 2026-07-27, and the last sentence was wrong.** `orderSessionsForSend` now merges the
  > `sentAccept` column back into the session object, so the SDK's plain-frame branch is live and
  > desktop no longer re-sends setup material on every frame. Verified live: 12/12 sampled frames
  > carried the setup material before, 0/12 after, with no change in delivery.
  >
  > The claim that this is "why desktop↔desktop never hit the bug" is falsified — desktop↔desktop
  > does hit it, and a controlled round proved shape is not the variable: removing init-wrapping
  > left the failure table unmoved.
  >
  > **One consequence to know when reading desktop logs.** A row created FROM the peer's init
  > envelope is saved with no `sentAccept` value, so a first reply is still init-wrapped and the
  > peer can still confirm — the handshake is intact (checked in source, not assumed). But from
  > the second send onward a confirmed row sends plain, so in the asymmetric state
  > *we are confirmed, peer is not* a plain frame will hit the peer's `Confirm` branch and throw
  > `invalid initialization envelope`. Before this change every frame could confirm the peer, so
  > that window is new. It is transient — the init-wrapped first reply redelivers and confirms —
  > and it did not occur in the validation round, because that round never reset a session. **A
  > reset round on a build carrying this fix has not been done.**
- Desktop's `DoubleRatchetInboxDecrypt` tolerates an init-shaped plaintext on a confirmed row
  (the `maybe_initialization_info_and_message.user_address` branch), so mobile's accept is safe
  to receive whether or not desktop has already confirmed.

**The bug is NOT closed.** After #180, a one-sided reset from mobile went 0/3 → 5/5 both
directions, but frames still occasionally fail to arrive with no established cause, and
mobile↔mobile — the majority pairing — has never been tested. Full trail, including two
retracted hypotheses and the next debugging step:
`quorum-mobile/.agents/bugs/2026-07-24-dm-desktop-frames-undecryptable-state-divergence.md`.

---

## Divergence 8 — the init path no longer silently destroys an embedded first message

**Shipped:** PR #256 (2026-07-26).

**Original behavior:** the device-inbox init path (`handleNewMessage`) ended in a bare
`catch` that deleted the frame from the node inbox on ANY error — including errors thrown
AFTER the envelope had decrypted successfully (settings lookup, message save, UI insert).
A message embedded in an initialization envelope — i.e. the first message of any fresh
session — was destroyed with zero log output if any step after decrypt hiccuped. Reproduced
live in both directions (round 24: mobile's "m1" died exactly here).

**New behavior:** every failure on the path is logged; the non-essential steps (receipt
settings, control intercept, notification, UI cache) are isolated so they cannot abort the
save; the critical save is retried once; on a post-decrypt failure the frame is RETAINED for
redelivery instead of deleted; a stale-refused duplicate init salvages a young (< 10 min)
embedded post before the frame is defused (the DB save upserts by messageId, so re-saves are
no-ops); fully-processed control frames are now acked instead of left to redeliver.

**Why it is correct:** same principle as Divergence 5 — the frame on the node is the only
copy of the message, and deletion is only safe after the payload is durably persisted.

## Context for desktop logs — mobile receive-stack fixes (quorum-mobile #181, #182, 2026-07-26)

Mobile's DM receive flow failed in complete silence (bare catches on every path). #181 added
logging; its first instrumented round then exposed the defect that explains the permanent
"stale frame backlog" visible in every desktop/mobile capture of the past months:

**Desktop's typing indicators crashed mobile's message save.** `typing-start`/`typing-stop`
ride the DM ratchet as flat control messages (top-level `type`, no `content`, no
`messageId` — the same wire shape as delivery/read acks). Mobile had no intercept for them:
they fell through to `saveMessage`, crashed on the NOT NULL `message_id` constraint, and —
because the crash preceded the ack — were redelivered and re-crashed on every drain cycle
(124 crash-loops in one 5-minute capture). Additionally, 18 mobile ack-by-delete sites
signed conversation-inbox deletes with the DEVICE key; the node rejects the signature and
redelivers forever. #182 fixed both. Verified live: crash-loops 124 → 0, the backlog drained,
and desktop→mobile delivered 12/12 — the first fully clean direction in this bug's history.

## TWO OPEN UPSTREAM QUESTIONS (2026-07-26) — for the lead

1. **`channel` crate: a receiver whose first-ever processed frame sits at chain position > 0
   forks permanently at the next DH turn.** Deterministic repro against the SDK wasm build,
   no devices needed (~seconds):
   `quorum-mobile/.agents/scripts/dr-advanced-start-fork.mjs`. Case matrix: in-order start —
   clean; mid-chain gap — clean (skipped keys work); first frame at position 1 — one frame
   lost at the turn, then re-syncs; first frame at position 2+ — the sender's direction is
   PERMANENTLY undecryptable from the first turn on, while the receiver's own direction keeps
   working. This is dormant unless establishment-phase frames are lost — which mobile
   pairings do constantly (see 2) and desktop↔desktop essentially never does, matching the
   observed pairing asymmetry. Mobile's current re-key-per-unconfirmed-send accidentally
   shields against it (every announce restarts the peer at position 0), so we froze all send-path
   changes until the crate is fixed.

2. **Node write path: a whole class of mobile writes never becomes retrievable, silently.**
   Round 26, same session, same minutes, all frames confirmed handed to the native socket
   with the connection open: read-ack frames 10/10 LOST, chat posts 11/11 delivered. The node
   cannot see plaintext types — the visible discriminators are inbox, size, and the signature
   fields of the write. Question: what does the write path do with a `direct` write whose
   `inbox_public_key`/`inbox_signature` are empty or fail verification — is it dropped
   without an error frame? (Mobile-side per-frame signature logging is armed for the next
   capture round to pin the correlation.)

---
*Created: 2026-07-17 — Last updated: 2026-07-27*
