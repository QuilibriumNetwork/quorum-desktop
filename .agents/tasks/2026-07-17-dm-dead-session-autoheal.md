---
type: task
title: "DM dead-session auto-heal — detect via missing delivery receipts, repair without manual reset"
status: pending
created: 2026-07-17
related:
  - ".agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md (Remaining gaps; H4 silent shape)"
  - ".agents/tasks/2026-07-17-dm-session-reset-and-delivery-fix-plan.md (Reset Session button — the manual valve this automates)"
---

# DM dead-session auto-heal

## Why

The serialization fix (PR #236) prevents NEW ratchet forks, but a session that is already
desynced (from the pre-fix era, or any future unforeseen cause) can die in a fully silent
shape: the sender encrypts to an inbox the receiver has no state row for, so the receiver
never subscribes to it and NOTHING appears in its logs — frames pile up server-side unseen.
Observed live 2026-07-17: sender shows messages as sent, receiver console completely silent,
only a manual Reset Session recovers. Users cannot be expected to do that.

## Detection signal (already shipped)

Delivery receipts. A healthy direction produces a delivery-ack for every message within
seconds. A dead direction produces none. Sender-side rule of thumb: N consecutive messages
(e.g. 3) with no delivery-ack within a window (e.g. 60-120s, only while the counterparty is
plausibly online) = the direction is dead.

Caveats to handle: receipts can be disabled per-conversation/user (fall back to nothing or a
weaker signal); counterparty genuinely offline must not trigger heal (no acks is normal);
dedupe with reconnect events.

## Heal action (machinery exists)

What the Reset Session button does, triggered automatically: delete local encryption states
for the conversation and signal the counterparty to reset (the delete-conversation reset
signaling shipped in desktop PR #222 / mobile PR #144), then re-init on next send and RESEND
the messages that never got acked (they are still in local DB with no deliveredAt).

UX decision needed (default to the conservative option): fully automatic + resend silently,
vs. surface a "Connection issue — tap to repair" affordance on the conversation. Recommend:
automatic, with a subtle one-line notice in the conversation, since manual reset is exactly
what we are trying to eliminate.

## Notes

- Keep the detection decision logic PURE (counts, windows, no storage/transport) —
  extractable to quorum-shared; mobile has receipts and the same need.
- Do not loop: after an auto-heal, back off (e.g. one heal per conversation per 10 min);
  if the healed session dies again immediately, surface the manual affordance instead.
- Log every trigger loudly for field diagnosis.

---
*Created: 2026-07-17*
