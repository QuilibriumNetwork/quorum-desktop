---
type: bug
title: "A device returning with months-stale state silently loses every DM toward the peer — and its self-sync copies persist under a ghost self-conversation"
status: OPEN — mechanism demonstrated live 2026-07-29, probe-verified on three stores; code-path reading owed; mitigation homes identified
created: 2026-07-29
severity: high — real-user shape (reinstall, long-idle secondary phone). The sender's UI looks healthy, the peer receives nothing, and the sender's own devices hide the copies in an invisible conversation
area: DM session lifecycle (send side) + receive-side conversation mapping
repos: sender behaviour observed from quorum-mobile (current code, June-era app data); receive-side misfiling observed on quorum-desktop
related:
  - "docs/transport-measurements.md § the preview-build V-run (the evidence rows for everything below)"
  - "bugs/.solved/2026-07-29-session-replacement-strands-in-flight-frames.md (#273 — the orphaned-inbox mechanism, here observed from the SENDER's side for the first time)"
  - "tasks/2026-07-17-dm-dead-session-autoheal.md (the mitigation home for the send side)"
  - "tasks/2026-07-29-transport-debug-workflow-and-tooling.md (the workflow overhaul this incident fed)"
---

# Returning stale device: DMs toward the peer vanish, self-sync copies misfile

## §1. What happened (2026-07-29, all numbers probe-verified)

The preview (release-variant) APK was rebuilt from current code at 16:32 local
and reinstalled over **June-20-era app data** — account B logged in since then,
sessions untouched for ~5 weeks while the accounts lived through the entire July
churn (capture rounds, session replacements, harness device registrations). One
minute later it sent `V 1`…`V 20` to account A.

| observer | result |
|---|---|
| desktop A (the peer) | **0/20 in store and UI. Zero warnings** — no unknown-inbox, no session-replaced, no decrypt failure |
| desktop B (sender's own other device) | **20/20 in the store, 0 visible in the UI** — every row filed under `spaceId = channelId = <B's own address>` instead of the peer's address |
| control | B's **desktop** → A delivered normally the same day; only the stale phone could not reach A |

## §2. The two faces

**Face 1 — toward the peer: total, silent loss.** A's desktop saw nothing at
all: not even a frame it failed to process. The frames evidently went to
inboxes A's desktop no longer holds — the June-era session inboxes, orphaned by
later session replacements. This is the #273 mechanism (replacement strands the
old inbox) observed from the **sender's** side: the stale device keeps posting
into mailboxes nobody will ever read, and no layer reports anything.

**Face 2 — toward the sender's own devices: arrival, then misfiling.** B's
desktop received, decrypted and persisted all 20 copies — under a conversation
keyed by **B's own address** (a ghost B↔B self-conversation) instead of by the
peer A, which is how the real conversation is keyed (verified against a
rendering reference row). Consequences observed live: the messages are invisible
in the real thread; the sidebar shows a spurious row whose profile backfill
404s on B's own address (`useConversationsWithProfileBackfill`). Desktop A
carries a matching artifact from earlier in the day: an "Unknown User" row with
B's address (preview "U20", **zero unique messages** — store scan shows
`duplicates: 0`).

## §3. Mechanism reading (inference, flagged as such)

- The stale phone holds June-era sessions for both accounts' devices. Toward
  A's devices those sessions' inboxes are dead (orphaned) → face 1. Toward B's
  desktop the old session evidently still decrypts (that desktop kept its state
  continuously) → the frames arrive, but they carry a conversation identity
  convention from before the July inbox/session rework, and the receiver's
  mapping falls back to keying by the **sender's** address → face 2.
- Zero init envelopes were seen at A. If the current send path had re-initialized
  sessions toward A's *current* device inbox, A would have logged something. Why
  the stale state made the sender skip re-init (sessions marked confirmed in the
  old data?) is the main open code question.

## §4. What this is NOT

- **Not the field symptom.** The long-running loss is scattered 15–20% from an
  actively-used dev build. This is 100% loss from a device with fossil state.
  Do not let this bug absorb quorum-mobile#183 item 2 — the same-day U-run
  cross-check (measurement log) sharpened that one separately.
- **Not a dev-vs-prod datapoint.** The V-run was meant to answer §3.1 of the
  handoff; the stale state invalidated it. The W-run (after sign-out/in) is
  still owed.

## §5. User impact

Any user who reinstalls, restores, or picks up a long-idle secondary device
after their contacts' sessions have churned: their sends LOOK sent, reach
nobody, and their other devices file the copies where no one looks. No error
anywhere in the chain. This makes the app unusable for exactly the user least
equipped to diagnose it.

## §6. Mitigation homes

1. **Send side (the fix that matters):** `tasks/2026-07-17-dm-dead-session-autoheal.md`
   — no delivery receipts after N sends ⇒ re-fetch the peer registration,
   re-establish sessions, resend. This exact incident is its acceptance
   scenario: a returning device must self-heal within one conversation turn.
2. **Receive side:** the conversation mapping must never key a DM by the
   sender's own address. Derive the peer from the frame's conversation context;
   if unresolvable, quarantine and warn (adjacent to #273's retained-frames
   path) rather than minting a ghost conversation.
3. **Hygiene:** the ghost rows on both desktops need a cleanup path (and the
   probe's `duplicates: 0` shows no message data is at risk in removing them).

## §7. Open questions / next steps

- Read the send path against a stale-state fixture: why no re-init toward A?
  (`orderSessionsForSend`, sent_accept handling, registration-fetch fallback.)
- Locate the receive-side mapping fallback that keyed by sender address —
  desktop code or shared? Write the failing unit test first.
- Harness repro without devices looks feasible: snapshot a bot's state, churn
  the peer's sessions, send from the snapshot. Would turn this whole class into
  a bench scenario.

---
*Last updated: 2026-07-29*
