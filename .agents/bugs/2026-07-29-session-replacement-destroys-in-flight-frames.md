---
type: bug
title: "A session replacement deletes the old encryption state, and every frame already addressed to the old inbox is then dropped AND deleted from the relay — permanent, silent message loss"
status: OPEN — MECHANISM CONFIRMED FROM PRODUCTION LOGS AND CODE, NOT YET FIXED. Two safe-looking behaviours combine into unrecoverable data loss: replacing a session **deletes** the previous encryption state rows immediately (`MessageService.ts:3593-3595`), and a frame arriving for an inbox with no state is **deleted from the relay** rather than retained (`MessageService.ts:3868-3885`). Any frame in flight to the old inbox at the moment of replacement is therefore destroyed with no error and no possibility of redelivery. Measured in the operator's own desktop console: **36 session replacements, 366 destroyed frames, ~10 per replacement** — which matches the long-standing "~10 of 200 messages arrived" field observation.
created: 2026-07-29
severity: HIGH — silent, permanent loss of user messages. No error surfaces, the sender believes it delivered, and the frame is removed from the relay so redelivery can never recover it. This is the loss class the investigation has been chasing for six months.
repo: quorum-desktop (mobile NOT yet checked — see §6)
area: DM receive path / session lifecycle / init envelopes
related:
  - ".agents/docs/transport-measurements.md (the bench runs that could not see this)"
  - ".agents/docs/transport-reliability-index.md"
  - ".agents/bugs/.solved/2026-07-28-dm-receive-holds-ratchet-lock-across-http.md (a different defect in the same handler)"
  - "quorum-mobile#183 (upstream; this is CLIENT-side and does NOT explain item 2)"
---

# Session replacement destroys every frame in flight to the old inbox

## §1. The two behaviours that combine

Neither is obviously wrong alone. Together they guarantee loss.

**(a) Replacing a session deletes the old state immediately.** When an init
envelope installs a new session, `MessageService.ts:3593-3595`:

```js
logger.warn('[MessageService] ⚠️ SESSION REPLACED by init envelope', { … });
for (const e of existing) {
  await this.messageDB.deleteEncryptionState(e);   // ← the old rows are GONE
}
// … then a new state is saved under a NEW receiving inbox:
await this.messageDB.saveEncryptionState({ …, inboxId: inbox_key.inbox_address, … }, true);
```

The new session gets a **new receiving inbox address**. The old inbox is now
unknown to this client.

**(b) A frame for an unknown inbox is deleted from the relay.** The receive path
looks a frame up by the inbox it arrived on (`const found = states[message.inboxAddress]`,
`MessageService.ts:3431`), and when there is no state (`:3868`):

```js
logger.warn('[MessageService] DM frame for unknown inbox — no encryption state, dropping unread', { … });
this.dispatchInboxDelete(…);   // ← POST /inbox/delete: the frame is destroyed
return;
```

## §2. Why that is unrecoverable

The relay is the only copy. Deleting the frame there means it can never be
redelivered, so the message is **permanently gone**. Nothing surfaces to either
user: the sender's send succeeded, the receiver logs a warning nobody reads, and
the message simply never exists.

The peer keeps sending to the old inbox because a session replacement is
**one-sided** — the replacing side mints a new receiving inbox and the peer is not
told until it learns otherwise. Every frame sent in that window is destroyed on
arrival.

## §3. Measured in production, not inferred

From the operator's desktop console during a live bench run (their account is the
receiver; account A is the harness):

```
366   DM frame for unknown inbox — no encryption state, dropping unread
 36   ⚠️ SESSION REPLACED by init envelope
```

- **Exactly two distinct inbox addresses** account for all 366 drops, **183 each** —
  perfectly symmetric, so this is structural, not sampling loss.
- The ordering is decisive: a burst of **35 replacements**, then 2 drops, then one
  more replacement, then **364 consecutive drops**. Everything after the last
  replacement was destroyed.
- **~10 frames destroyed per replacement**, which is the same magnitude as the
  operator's long-standing field observation of *"~10 of 200 messages arrived on
  one desktop, 0 of 200 on the other"*.
- All replacements name one `conversationId`, and the envelopes are fresh
  (`envelopeAgeSeconds: -1, 0, 1`) — these are live replacements, not zombies.

## §4. Why every bench missed it

Six months of benches reported 0% loss because of what they measured:

| bench | what it counted | why it was blind |
|---|---|---|
| `dm-loss` | frames arriving at the socket | the frame DOES arrive — it is destroyed after arrival |
| `dm-multidevice` | messages persisted per device | catches the symptom, but only on a device that hits a replacement |
| all of them | fresh throwaway accounts, one session, no resets | **a session replacement never happens**, so the trigger is absent |

The trigger is *session churn*, and a clean bench with a single stable session has
none. This is why the operator's real, aged, multi-device accounts fail where every
generated account is perfect.

⚠️ **Honest confound about the 36 replacements in §3:** repeated harness runs
against that account almost certainly caused most of them, because each run's bots
re-establish sessions. **Do not quote "production churns sessions 36 times."** What
the log establishes is the *mechanism* — that a replacement destroys in-flight
frames — not the natural rate of replacement. The rate needs measuring separately.

## §5. The fix — attack (a), not (b)

**Retaining the frame is not enough.** If the old state is gone forever, a retained
frame is redelivered, fails the same lookup, and is deleted when its retry budget
runs out. The message still dies, just later.

**The real fix is to stop deleting the replaced session state.** The old ratchet
state can still decrypt frames encrypted to the old session, so keeping it for a
grace period recovers exactly the frames that are currently destroyed. Sketch:

1. On replacement, **retain** the previous rows (mark superseded, keep the keys)
   rather than `deleteEncryptionState`.
2. Keep the old inbox in the subscription list while retained, so the frames are
   still delivered to us.
3. Expire retained sessions on a bound (age or count), not immediately.
4. Independently, make the unknown-inbox branch **retain rather than delete** —
   defence in depth, and it converts any remaining case from permanent loss into
   delayed delivery.

This is the same philosophy as the already-shipped `c0635f965 fix: stop deleting
DM frames that would decrypt moments later` — applied to session *state* instead of
to frames.

⚠️ Do NOT simply stop replacing sessions. Replacement exists for real reasons
(resets, re-inits) and suppressing it would resurrect the bugs it was added to fix.

## §6. Not yet checked

- **Mobile.** Whether `quorum-mobile` has the same delete-on-replace and
  delete-on-unknown-inbox pair is unexamined. It must be checked before any claim
  about cross-platform scope.
- **The natural replacement rate** in ordinary use, without a harness hammering the
  account (see §4's confound).
- **Why so many init envelopes arrive at all.** Reducing replacement frequency is a
  separate, possibly larger, question — the loss on each replacement is the bug
  filed here.
- This does **not** explain quorum-mobile#183 item 2 (frames never arriving at all).
  That is upstream of arrival; this is entirely downstream of it.

---
*Last updated: 2026-07-29*
