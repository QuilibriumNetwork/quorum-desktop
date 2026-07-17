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

Two desktop accounts (Brave ↔ Gatopardo), fresh session via reset. Messages flow, then
occasional numbered messages fail to land in one or both directions (e.g. Brave→Gatopardo "13"
dropped; Gatopardo→Brave "12" and "13" dropped) while surrounding messages arrive fine. On the
receiver console: `[MessageService] DM decrypt failed (DoubleRatchetInboxDecrypt) — skipping
frame, keeping session` with `SyntaxError: Unexpected token 'D', "Decryption"... is not valid
JSON` (the WASM returns the string `Decryption failed: aead::Error` in `result.message`; JSON
parsing it throws). `aead::Error` = AEAD authentication failure = the ratchet message key used
to encrypt didn't match what the receiver derived for that frame.

## Leading hypothesis (NOT yet proven) — retry collisions

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
