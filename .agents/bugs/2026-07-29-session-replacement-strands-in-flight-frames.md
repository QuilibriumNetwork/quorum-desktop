---
type: bug
title: "Session replacement orphans the receiving inbox, and the cleanup for unplaceable frames named the wrong mailbox — real code defects, but NOT the cause of the field symptom"
status: CODE DEFECTS REAL AND MITIGATED (PR #273) — but the CAUSAL CLAIM IS RETIRED. ⚠️ Read §8 first, then §7. Three purpose-built bench runs (`dm-session-churn`) failed to reproduce any loss, including one with a confirmed 10-frame pre-wipe backlog on the orphaned inbox: 60/60 both directions, every time. The 366-drop capture that motivated this file was taken while the harness was re-registering bots on that account, so it is most probably a testing artifact rather than the operator's organic failure. What stands: replacement does orphan the inbox, and the old cleanup named the wrong mailbox so it removed nothing (fixed, with tests that fail against the old code). What does NOT stand: that this explains the field symptom.
created: 2026-07-29
severity: MEDIUM-HIGH — user-visible message loss (366 messages not persisted in one capture, silently, with no error to either party), but **downgraded from the original HIGH**: the data is probably not destroyed, only stranded. Re-rate upward if the relay is shown to expire or drop stranded frames.
repo: quorum-desktop (mobile NOT yet checked — see §6)
area: DM receive path / session lifecycle / init envelopes
related:
  - ".agents/docs/transport-measurements.md (the bench runs that could not see this)"
  - ".agents/docs/transport-reliability-index.md"
  - ".agents/bugs/.solved/2026-07-28-dm-receive-holds-ratchet-lock-across-http.md (a different defect in the same handler)"
  - "quorum-mobile#183 (upstream; this is CLIENT-side and does NOT explain item 2)"
---

# Session replacement orphans the receiving inbox

> ⛔ **READ §8 FIRST, THEN §7.** Everything between here and §7 is the original
> write-up, preserved so the reasoning is legible. Its central causal claim was
> **retired on 2026-07-29** after three purpose-built bench runs failed to
> reproduce any loss, and two pieces of its supporting evidence were withdrawn.
> The *code defects* it describes are real and are fixed; the *explanation of the
> field symptom* is not.

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

## §8. ⛔ THE MECHANISM DID NOT REPRODUCE — three bench runs, hypothesis retired

`dm-session-churn` was built specifically to trigger this, because the coverage
gap was real: volume scenarios never replace a session, and `dm-reset-recover`
replaces one while sending three messages with waits between, so nothing is ever
in flight. Three runs, each adding the ingredient the previous one lacked:

| run | setup | result |
|---|---|---|
| 1 | 60 rounds both directions, wipe at #30 under load | **60/60, zero loss** |
| 2 | + receiver held "offline" across the wipe, device-inbox frames released first | **60/60, zero loss** |
| 3 | + hold starts 5 rounds BEFORE the wipe, so pre-wipe frames actually queue (**10 confirmed** on the old inbox at wipe time) | **60/60, zero loss** |

Run 2's null was a test defect, not evidence: holding and wiping on the same round
meant every queued frame was sent *after* the wipe, so the backlog contained no
pre-wipe session-inbox frames at all. Run 3 fixed that and the backlog is logged.

**Run 3 built the exact condition §1 requires and produced no loss.** A stopping
rule was committed before the result: the hypothesis is retired rather than
adjusted a fourth time.

### What that means for §3's evidence

The 366 drops were real and distinct. But they were captured **while the harness
was repeatedly re-registering bots on that account**, which churns sessions
artificially — §4 already flagged this as a confound and it now carries the
weight. **The most probable reading is that the capture was an artifact of
testing, not the operator's organic failure.**

⚠️ **A second operator observation that WAS used as supporting evidence has also
been withdrawn.** "No messages landing on the desktop during a run" was recorded
as the symptom firing live; the run in question was on generated throwaway
accounts and never sent to that account at all. Nothing landing was correct
behaviour, not a failure. It should not have been treated as data.

### What is NOT retired

The **code defects** in §1 and §7.1 are real and independently verified:
replacement orphans the inbox, and the cleanup named the wrong mailbox so it
removed nothing. The guardrail shipped (PR #273) and its tests fail against the
old code. What is retired is the **causal claim** that this mechanism explains the
operator's field symptom.

### Where the symptom actually points now

The operator's own characterisation — *"sometimes messages land, sometimes not,
sometimes after a while, sometimes lost forever"*, worst mobile→desktop — is
intermittent with variable latency and occasional permanence. Every client-side
layer now measures clean: arrival, decrypt, persistence, all four platform
pairings, aged accounts, multi-device fan-out, and now session churn. That is
consistent with quorum-mobile#183 item 2, which is upstream and not fixable from
any client.

**The discriminating evidence is a console capture taken DURING a failure**, not
during a healthy window. Counts taken while messages were landing came back 0/0,
which is expected and says nothing. Non-zero during a failure means a client-side
path remains; zero during a failure means the frame never arrived.

## §7. ⚠️ CORRECTIONS from independent adversarial review (2026-07-29)

This section supersedes the claims above where they conflict. §1-§6 are left as
written so the reasoning error is legible rather than quietly erased.

### 7.1 The delete targets the WRONG INBOX — frames are stranded, not destroyed

The single most important correction. At `MessageService.ts:3881` the `!found`
branch calls:

```js
this.dispatchInboxDelete(keyset.deviceKeyset.inbox_keyset, [message.timestamp], …);
```

`deleteInboxMessages` builds its payload from that keyset —
`inbox_address: inboxKeyset.inbox_address` (`MessageDB.tsx:317-322`) — i.e. the
**device** inbox. But the frame arrived on `message.inboxAddress`, a **session**
inbox; the device-inbox case already returned earlier (`:3434`). So the request
names a mailbox the frame is not in.

**Consequences:**

- **"Permanently destroyed" (§2) is wrong.** The frames are very probably still on
  the relay. Severity drops accordingly, and the messages may be recoverable once
  the state problem is fixed.
- **The code's own comment is false.** *"Keep the delete (leaving the frame would
  redeliver it forever)"* — the delete does not work, so the frame does redeliver
  forever. The stated intent is not achieved.
- Mobile hit this exact bug and fixed it: `deleteProcessedEnvelope`
  (`quorum-mobile/context/WebSocketContext.tsx:182-201`) explicitly picks the
  signing key matching the inbox type, with a comment recording that using the
  wrong one *"fails signature verification server-side and the envelope redelivers
  forever — observed as an endless storm."*

### 7.2 The 366 count is NOT inflated — checked, not assumed

The reviewer proposed that 366 log lines might be a small set of frames re-logged
on redelivery, citing this investigation's own rule to de-duplicate by fingerprint
before reasoning. That rule was skipped when filing, which was a real methodological
error.

**Checked against the log: 366 lines, 366 distinct frame timestamps, each appearing
exactly once.** No inflation. The count in §3 stands.

### 7.3 The "~10 of 200" corroboration is NOT discriminating — retracted

§3 leaned on the ratio matching the field observation. That is not evidence for
*this* mechanism: the already-solved ratchet-lock bug explains the same observation
(`.solved/2026-07-28-…-ratchet-lock-across-http.md` §7), and it was confirmed by
fault injection. Reaching for a number that fits and treating the fit as support is
the reasoning error this investigation has repeated several times. **Do not cite
the ~10 ratio as support for this bug.**

### 7.4 The §5 fix is broken as written

The replace path selects rows by **tag alone** and unconditionally deletes every
match (`MessageService.ts:3540-3542`, `:3593-3595`). Retained-but-superseded rows
would be swept by the *next* replacement — and §3's own evidence is a burst of 35
replacements. The proposed grace period would be nullified by exactly the churn
cited to justify it. Any retention scheme must change what `existing` selects, not
just mark rows.

Also raised, and worth carrying:
- Retaining superseded ratchet material widens a forward-secrecy window; Divergence 1
  deliberately argues the opposite tradeoff.
- No GC is proposed. `bugs/2025-12-09-encryption-state-evals-bloat.md` records ~16MB
  of orphaned states from a structurally identical omission.
- Four session-**prune** sites could sweep retained rows; the interaction is unexamined.

### 7.5 Revised fix direction — smaller and better targeted

**Fix the delete's inbox first** (mobile's pattern: address and sign for the inbox
the frame actually arrived on, or do not attempt a server-side delete at all), and
retain locally with a bounded skip-list. That is a far smaller change than
retaining ratchet state across six call sites, and it targets the mechanism that is
actually broken rather than the one originally hypothesised.

### 7.6 Mobile — confirmed unaffected, with better evidence

Mobile keeps a **persistent per-conversation inbox keypair** distinct from the
ratchet state (`WebSocketContext.tsx:2735`, `:2901`), so replacement swaps ratchet
material without minting a new receiving address — the orphaning precondition never
exists. It also trial-decrypts against every stored state (`:2960-2988`) rather than
a single keyed lookup, and on total failure calls `recordInboxAttempt` and returns
**without** any server-side delete (`:2990-3009`). **No mobile change needed.**

### 7.7 Still unproven

- Whether the relay accepts or rejects the mismatched delete (relay source is not in
  this repo). Settles by logging the response status in `dispatchInboxDelete`.
- Whether stranded frames actually redeliver, and whether a redelivery storm could
  starve fresh traffic — mobile documented exactly that consequence.
- The natural, non-harness-driven session replacement rate (§4's confound, still open).

---
*Last updated: 2026-07-29*
