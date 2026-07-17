---
type: task
title: "DM delivery auto-heal — detect via missing delivery receipts, resend / repair without manual reset"
status: pending — highest-value follow-up after the three delivery fixes (PR #235, #236/#237, #238)
created: 2026-07-17
related:
  - ".agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md (three-mechanism resolution; residual single-frame loss)"
  - ".agents/tasks/2026-07-17-dm-session-reset-and-delivery-fix-plan.md (Reset Session button — the manual valve this automates)"
  - ".agents/docs/dm-ratchet-upstream-divergences.md (Divergence 3: stale init-envelope guard — constrains the heal design)"
---

# DM delivery auto-heal

## Why (updated after the 2026-07-17 fixes)

The three systemic killers are fixed: session destruction on decrypt failure (PR #235),
ratchet state races (PR #236/#237), and stale init-envelope redelivery (PR #238 — this was
the "fully silent death" that originally motivated this task; it no longer reproduces).

What remains, observed live post-fix: **isolated single-frame wire loss.** One message
(e.g. "30") vanishes — sent fine, never delivered, no error anywhere — while the session
stays healthy and the next message lands. The sender's UI already knows (the delivery
checkmark never appears) but **nothing retries automatically**; the loss is permanent unless
the user manually resends. Secondary purpose: safety net for any future/unknown desync
(dead direction) so a user never has to find the Reset Session button.

## Detection signal (already shipped)

Delivery receipts. Sender-side rules:
- **Single loss:** a message with no delivery-ack after a window (e.g. 60s) while LATER
  messages in the same conversation DID get acked → that frame is lost, session is healthy.
- **Dead direction:** N consecutive messages (e.g. 3) with no delivery-ack within a window
  (e.g. 120s) → the direction is dead (session desync or listen gap).

Caveats: receipts can be disabled per-conversation/user (degrade to no-op); counterparty
genuinely offline must not trigger (no acks at all + no incoming traffic = ambiguous, do
nothing); debounce across reconnects.

## Heal actions (escalation ladder — do the least destructive thing that works)

1. **Resend on the SAME session** (single-loss case): re-encrypt and re-send the unacked
   message. `retryDirectMessage` already does exactly this (today it is manual, wired to the
   failed-message retry button). The resend advances the ratchet normally; the receiver
   treats it as a new frame. Idempotency: same messageId, receiver-side saveMessage
   overwrites/dedupes by messageId.
2. **Session re-init + resend** (dead-direction case): do what the Reset Session button does
   — which, IMPORTANT (verified 2026-07-17), is **LOCAL-ONLY**: delete local encryption
   states for the conversation; NO signal is sent to the counterparty. The next outgoing
   send then creates a fresh session via a new init envelope, and the counterparty's
   init-envelope path replaces its rows for this device tag. After re-init, resend all
   unacked messages (still in local DB with no deliveredAt).
   - Interaction with the staleness guard (PR #238): the fresh envelope carries a new
     timestamp, strictly newer than anything it replaces → passes `isStaleInitEnvelope`
     on the counterparty. No special handling needed.
   - Do NOT use delete-conversation signaling for healing — that wipes the counterparty's
     conversation state and is a different, destructive operation.

UX: automatic, with at most a subtle one-line notice ("connection repaired") for case 2;
case 1 should be fully invisible. Rationale: eliminating the manual reset is the point.

## Safety rails

- One heal attempt per conversation per cooldown (e.g. 10 min); if a healed session dies
  again immediately, stop and surface a manual "tap to repair" affordance instead of
  thrashing.
- Log every trigger and action loudly (warn level, consistent with the session-lifecycle
  log net from PR #238) for field diagnosis.
- Keep detection decision logic PURE (counts, windows — no storage/transport) and
  extractable to quorum-shared; mobile has receipts and the same residual loss class.

---
*Created: 2026-07-17 — Last updated: 2026-07-17*
