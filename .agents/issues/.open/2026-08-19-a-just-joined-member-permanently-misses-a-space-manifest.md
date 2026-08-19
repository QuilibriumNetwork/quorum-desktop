---
type: bug
title: "A member who has just joined permanently misses a space-manifest broadcast, and nothing retries"
status: open
priority: medium
ai_generated: true
created: 2026-08-19
updated: 2026-08-19
---

# A just-joined member permanently misses a space-manifest broadcast

> **⚠️ AI-Generated**: May contain errors. Verify before use.

Found while running the cross-client acceptance test for
[`2026-08-11-public-invite-link-never-reaches-existing-members.md`](../2026-08-11-public-invite-link-never-reaches-existing-members.md)
on 2026-08-19. That fix works; this is a separate defect the test exposed.

## Symptom — MEASURED, desktop to desktop

Two desktop clients, same machine, `localhost:5173`.

1. Owner **A** creates a Space with no public link.
2. **B** joins via a one-time invite.
3. Within roughly a minute, **A** generates the public link.
4. **B never receives it.** A page refresh does not recover it.
5. ~68 minutes later **A** renames the Space. That broadcast **does** reach B,
   and carries the whole record, so the invite URL arrives as a side effect.
6. **A** then republishes the link. B receives
   `Control message received: space-manifest` **immediately.**

Steps 4 and 6 are the same operation on the same Space with the same keys. The
only difference is how long B had been joined.

### Evidence

From A's console at step 3 — the broadcast demonstrably went out:

```
[SealHubEnvelope] config pubKey hex prefix: b4a9f4b5…
[SealHubEnvelope] ephemeral pubKey hex: 0c92439b…
[SealHubEnvelope] encrypt result: {"ciphertext":"2fIckGMqKK…
[invite] public link generated
[MessageService] Control message received: space-manifest   ← A's own echo
```

From B's console covering the same window (B's log was written ~2 minutes after
A's broadcast, so the window is genuinely covered):

| Control message | Count |
|---|---|
| `announce-keys` | 694 |
| `sync-request` | 5 |
| `sync-info` | 3 |
| **`space-manifest`** | **0** |

B was receiving plenty of hub traffic. It just never saw this one.

The rename at step 5 used the **same** config key (`b4a9f4b5…`) and the same
`submitUpdateSpace` → `SealHubEnvelope` path, and arrived. So the envelope shape
is not the variable; elapsed-time-since-join is.

## Why it matters

Not delayed — **lost**. A refresh, which re-reads the space inbox, did not
produce it. So the message was not held anywhere for B to collect. Nothing in
the product ever retries a `space-manifest`, so the affected record stays stale
until some unrelated edit happens to broadcast the whole Space again.

The blast radius is wider than invites. Every `space-manifest` sender is
exposed: rename, icon, description, channel add/remove, role grants. A member
who joins just before any of those silently holds a stale record.

It is quiet in the worst way — nothing errors on either side, and the sender
sees its own echo, so the owner has positive (but misleading) confirmation.

## Root cause — NOT ESTABLISHED

Inferred, not measured. The most likely candidate is that B's hub subscription
or inbox registration for the newly joined Space is not yet live when A
publishes, so the hub has nowhere to deliver or store the message. That would
explain both the miss and the failure to recover on refresh.

Unverified alternatives worth eliminating:

- B *is* subscribed, but the hub drops messages for a recipient whose
  registration is younger than some threshold.
- The message is stored in the space inbox but B's post-join inbox read has
  already passed that timestamp, so it is never fetched.

## What would settle it

- [ ] Instrument the join path to log when B's hub subscription and inbox
      registration actually become live, then re-run the sequence and compare
      that timestamp against A's broadcast
- [ ] Determine whether the hub stored the message at all (server-side), which
      separates "never delivered" from "delivered to nobody listening"
- [ ] Establish the window empirically: retry the sequence at ~5s, ~30s, ~2min,
      ~5min after join and find where it starts succeeding
- [ ] Check whether mobile has the same gap — its receive path differs

## Possible fixes, once the cause is known

Deliberately not chosen yet; the right one depends on the cause.

- Have the joiner refetch the manifest once, shortly after joining, closing the
  window from the receive side. Cheapest, and the join path already knows how.
- Have the sender retry an unacknowledged `space-manifest`. More correct in
  general, but there is no ack today, so this is a larger change.
- Fix the subscription ordering so a join does not complete until the client can
  receive.

## Related

- [`2026-08-11-public-invite-link-never-reaches-existing-members.md`](../2026-08-11-public-invite-link-never-reaches-existing-members.md)
  — the fix whose acceptance test exposed this. That fix is verified working;
  this is a different failure.
- [`2026-08-19-desktop-applies-any-space-manifest-with-no-staleness-guard.md`](2026-08-19-desktop-applies-any-space-manifest-with-no-staleness-guard.md)
  — also in the manifest receive path, also filed 2026-08-19.

---

*Last updated: 2026-08-19*
