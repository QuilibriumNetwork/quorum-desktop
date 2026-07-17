---
type: bug
title: "DM individual frames fail to decrypt (aead::Error) and drop — remaining half of the delivery bug"
status: open — session-death half fixed & shipped 2026-07-17; this is the frame-generation half. Not yet root-caused. HAND-OFF doc for next session / more powerful model.
created: 2026-07-17
severity: high
repo: quorum-desktop (mobile likely same)
area: DM delivery / Double Ratchet / retry / dedupe
related:
  - ".agents/bugs/2026-07-17-dm-decrypt-failure-destroys-session-FIX-SPEC.md (Fix 1 — SHIPPED, stops session destruction)"
  - ".agents/bugs/2026-07-02-dm-message-delivery-unreliable-master.md (full diagnosis archive)"
---

# DM frames still drop with `aead::Error` (remaining half of the delivery bug)

## Read this first — what is and isn't fixed

The DM delivery bug had **two mechanisms**:

1. **Session destruction (FIXED, shipped 2026-07-17).** A single decrypt failure used to tear
   down the whole encryption session → conversation direction permanently dead. Fix: stop
   deleting the session on decrypt failure (Double Ratchet spec compliance). Confirmed live —
   the conversation now survives decrypt failures and keeps delivering past them.

2. **Frame generation (THIS DOC, still open).** Individual DM frames still fail to decrypt with
   `Decryption failed: aead::Error` and are dropped. With Fix 1 in place these are now *isolated
   single-message losses* (the conversation keeps working), not a dead direction — but a
   messenger that silently loses individual messages is still broken. We need to stop the bad
   frames being produced.

## Confirmed symptom (live, 2026-07-17, after Fix 1)

Two desktop accounts (Brave ↔ Gatopardo), fresh session via reset. **Cleanest repro
(user-confirmed): msg 1 & 2 land, then from msg 3 onward NOTHING lands — normal TEXT messages
included, not just receipts.** (An earlier looser run showed occasional single drops with the
conversation continuing; the dual-log run below shows the full jam — the difference is whether a
poison frame gets stuck at the head of the inbox.) On the receiver console:
`[MessageService] DM decrypt failed (DoubleRatchetInboxDecrypt) — skipping
frame, keeping session` with `SyntaxError: Unexpected token 'D', "Decryption"... is not valid
JSON` (the WASM returns the string `Decryption failed: aead::Error` in `result.message`; JSON
parsing it throws). `aead::Error` = AEAD authentication failure = the ratchet message key used
to encrypt didn't match what the receiver derived for that frame.

## UPDATE 2026-07-17 — dual-log capture: RECEIPTS are the poison frames + head-of-line block

Captured both sides live (reset session, msg 1 & 2 land, from msg 3 everything stops):

- **The failing frames are RECEIPT control messages, not text messages.** Log B (receiver of the
  text) shows that for EACH incoming message it sends back BOTH a `read-ack` AND a
  `delivery-ack` as separate encrypted DM frames ("Read ack sent successfully" / "Ack sent
  successfully"). So one text message produces THREE ratchet frames on the session
  (message + read-ack + delivery-ack). Log A shows it processes the FIRST read-ack fine
  (matching messageId `97cebda9…`), then every following incoming frame is `aead::Error`.
  → The rapid-fire, concurrently-sent, low-volume ack frames are desyncing the ratchet. This
  confirms the "receipt control-message path" candidate below, and largely exonerates the text
  retry as the primary cause.
- **Head-of-line block makes it fatal (this is the real "everything stops" mechanism).** Log A
  shows the SAME frame failing 5+ times in a row (identical stack, `MessageService.ts:3167`).
  The undecryptable frame is NOT removed from the network inbox on failure, so it is redelivered
  and re-fails forever, AND the ratchet cannot advance past it — so the real message #3 queued
  behind it in that inbox never gets read either. Session-preservation (Fix 1) holds, but a
  single stuck frame jams the whole inbox.
- **Corollary:** Fix 1 (keep session) is necessary but not sufficient. The two things to fix are
  (a) stop generating colliding ack frames, and (b) don't let one undecryptable frame block the
  inbox behind it.

> **IMPORTANT (user-confirmed 2026-07-17): NORMAL TEXT MESSAGES stop landing too, not only
> receipts.** The receipt frames are what *trigger* the first `aead::Error`, but the resulting
> head-of-line block (b) then jams the inbox for EVERYTHING queued behind the poison frame —
> including ordinary text messages. Reproduction: reset session, msg 1 & 2 land, then from msg 3
> onward NOTHING lands (text or receipts). So the user-visible symptom is still "normal messages
> stop." Do not read this report as "only receipts fail" — receipts are the trigger, normal
> messages are among the victims. Fix (b) (unblock the inbox) is therefore at least as important
> as fix (a) (stop the colliding acks); (a) alone would reduce triggers but any single bad frame
> from any source would still jam the queue.

### Where to look next (sharpened by the logs)

1. **Why do ack frames collide?** Read receipts + delivery receipts each send a SEPARATE
   standalone DM (`ActionQueueHandlers.sendReadAck` / `sendDeliveryAck` → `encryptAndSendDm`).
   Two encrypted frames enqueued back-to-back for the same session, plus the piggyback path,
   are strong candidates for a ratchet-state race (two `encryptAndSendDm` interleaving their
   state reads/saves). Check whether `encryptAndSendDm` serializes per-conversation.
2. **Head-of-line block:** on `aead::Error`, the frame stays in the inbox and is redelivered
   (log A: 5+ identical failures). Options: after N failures, delete the poison frame from the
   inbox so the queue can advance (careful — it's currently kept precisely so nothing is lost);
   OR make decrypt not block the inbox (skip-and-continue past a permanently-bad frame).
3. **Reduce ack frame volume:** prefer piggybacking; coalesce read+delivery into one frame;
   rate-limit standalone acks — fewer frames = fewer collision chances.

## Leading hypothesis (SUPERSEDED by the dual-log finding above — kept for history) — retry collisions

`aead::Error` on a per-frame basis means sender and receiver ratchet states diverged for that
one frame. The most concrete suspected source is the **automatic retry**:

- `MessageService.retryDirectMessage` (~line 5554) and `retryMessage` (~line 5450) re-encrypt and
  re-send a message when no delivery receipt arrives in time.
- Re-encrypting advances/uses ratchet state. If a retry re-encrypts from a DB state that has
  moved on (or races the original send's state save), it can emit a frame whose key the receiver
  can't derive → `aead::Error`.
- This fits the timing: drops cluster during active back-and-forth (when receipts and retries are
  in flight), and the receipt traffic itself is low-volume and retry-prone.

Other candidates to rule out (from the master report): two-tabs/two-devices state races; a
duplicate/redelivery from the network inbox re-handed after the ratchet advanced; the receipt
control-message path specifically (delivery-ack / read-ack are sent as their own DM frames and
could be the ones failing).

## How to investigate (evidence-first — do NOT patch blind)

The `[DMTRACE]` kit on branch `debug/dm-delivery-trace` already has a `⚠️ REDELIVERY` detector
and per-frame timestamps. For this bug, extend it to answer:

1. **Is the failing frame a retry?** Tag every send with its origin (original vs retry) and its
   ratchet-state identity; when an `aead::Error` fires, report whether that (inbox, timestamp)
   was sent more than once, and whether a retry preceded it.
2. **Is it a receipt frame?** Log the decrypted `type` the sender intended (post vs delivery-ack
   vs read-ack) for the failing frame — cross-check against whether receipt frames fail
   disproportionately (the read-receipt asymmetry seen earlier hints they might).
3. **Is it a state-save race?** Check for concurrent `saveEncryptionState` on the same session
   around the failure (two sends interleaving).

Pass criterion for a fix: sustained several-minute back-and-forth with NO dropped messages
(not just no dead direction).

## Candidate fixes (after root cause confirmed)

- **Fix 2 — dedupe before decrypt:** track recently-processed (inbox, timestamp); skip+ack
  duplicates so redelivered/retried frames never reach the ratchet. Directly neutralizes the
  redelivery/retry-collision class. Keep the logic PURE (extractable to quorum-shared later).
- **Retry hardening:** don't let a retry re-encrypt from stale state; serialize send+state-save
  so a retry can't race the original; or make retries idempotent at the frame level.
- **Receipt path review:** if receipt frames are the disproportionate failers, look at how
  standalone acks are encrypted/sent (`ActionQueueHandlers.sendReadAck` /
  `encryptAndSendDm`) vs piggybacked ones.

## Note for the next session / model

Fix 1 shipped separately and is safe. This is the harder, genuinely-uncertain half — worth a
recon spike against the real retry/receipt code before proposing a fix, and worth confirming the
retry hypothesis with instrumentation before writing any patch. There is also a **separate,
possibly-related read-receipt asymmetry bug** (Gatopardo reads Brave's messages but Brave never
sees the read indicator) that was being investigated with `[RCPT]` logs when this was parked —
those logs were removed from the tree but the tracing points are documented in git history on
branch context; may share a root cause with the receipt-frame failures here.

---
*Created: 2026-07-17*
