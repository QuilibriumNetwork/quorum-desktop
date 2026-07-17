---
type: task
title: "DM dedupe-before-decrypt — skip redelivered frames before they hit the ratchet"
status: deferred — measure first; implement only if duplicate noise shows up in normal use
created: 2026-07-17
related:
  - ".agents/bugs/.solved/2026-07-02-dm-message-delivery-unreliable-master.md (Remaining gaps section)"
---

# DM dedupe-before-decrypt

## Why (and why deferred)

The server keeps every inbox message until the client deletes it (delete = ack). Clients
re-send `listen` frames constantly (one per send + every reconnect), so the server can push
the same frame twice before the first delete lands. The duplicate's message key was already
consumed by the ratchet, so it always fails AEAD → logged as
`DM decrypt failed — skipping frame, keeping session` and deleted. **No message is lost** —
the cost is a false-alarm error log and a wasted decrypt. The real harm is signal pollution:
failure counts can't be trusted for any future auto-heal heuristic ("reset after N
consecutive real failures").

Deferred because: (a) harmless since the serialization fix (branch
`fix/dm-ratchet-serialization`) shipped; (b) we have no evidence yet of duplicate VOLUME in
normal use — the error bursts seen live were pre-reset-session frames, expected debris;
(c) the decrypt-fail and `!found` logs are now loud enough to measure. **Trigger to
implement:** recurring `skipping frame` errors during normal chat (not right after a session
reset) with no missing messages.

## Implementation sketch (when triggered)

- In-memory cache of recently processed `(inboxAddress, timestamp)` pairs (LRU, cap a few
  hundred entries). Record after successful decrypt+save, inside the ratchet lock.
- In `handleNewMessage`, before decrypting an established-session DM frame: on cache hit,
  delete the server copy and return silently (no error log).
- Safe by construction: the server API already identifies messages by exactly this pair
  (`deleteInboxMessages(inbox, [timestamp])`), so no new uniqueness assumption is added.
- Keep the cache logic PURE (no storage/transport imports) — candidate for quorum-shared
  later, mobile has the same redelivery semantics on its transport.
- Tests: duplicate frame → skipped without ratchet call; distinct frames same inbox → both
  processed; cache eviction.

---
*Created: 2026-07-17*
