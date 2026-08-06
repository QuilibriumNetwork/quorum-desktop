---
type: bug
title: "Messages arriving over sync never reach an open channel, so it stays completely empty until you reload"
status: done
priority: high
created: 2026-08-06
updated: 2026-08-06
severity: silent — the messages are written to IndexedDB correctly and nothing errors; the open channel simply never re-reads them, so it reads as "this channel has nothing in it"
area: message query cache keys / peer sync
repos: quorum-desktop (space channels only; DMs were unaffected)
related:
  - ".agents/issues/.done/2026-08-06-channel-loads-one-old-message-and-reads-as-empty.md"
---

# Messages arriving over sync never reach an open channel, so it stays completely empty until you reload

## Report

> sometimes while navigating between channels in a Space a channel will show as
> empty (at least one time ALL channels were showing as empty), I have to
> refresh the browser page for it to show the messages

## Status

**2026-08-06 — shipped in PR #318.** Root cause found and fixed. `tsc` clean, 1102 tests pass.

Independently reviewed by three agents that had no part in writing the fix:

- **Cache-key sweep review** — confirmed the sweep correct, and specifically that
  `setQueryData` → `setQueriesData` is safe: `setQueryData` bails without
  creating an entry when the updater returns `undefined`, which every guarded
  updater does on a cold cache, so old and new behave identically when nothing
  is mounted. It also found a **separate pre-existing bug** this fix could not
  have caught (see below).
- **Silent-failure hunt** — found no new silent failure introduced here, and
  three pre-existing ones now filed as their own issues.
- **Test-strength audit** — confirmed, by rebuilding the suite against reverted
  source, that the six key tests contain **no** red-before-fix case, exactly as
  documented. That gap is now closed by a contract test (below).

### Found by review, fixed here

**`usePinnedMessages.ts:135` — pinning never optimistically updated the panel.**
It read the source message with a hand-rolled three-element
`['Messages', spaceId, channelId]` passed to `getQueryData`, which is an **exact
hash lookup** (`queryCache.get(options.queryHash)`), not a prefix match. Real
keys are four elements, so it always returned `undefined` and the append below it
was dead code. The two neighbouring literals in the same file went to
`setQueriesData`, which *does* prefix-match, which is why the broken one blended
in. Verified independently before fixing; all three now use the prefix builder.

**`Channel.tsx` ×2 — the two exact-key writes originally left alone.** The two
reviewers disagreed about these, so it was settled on evidence: both pass a
**literal object**, not an updater, so `functionalUpdate` never returns
`undefined` and `setQueryData` *creates* an entry. On a stale `threadsEnabled`
captured across the `await`, that spawns an orphaned variant nothing reads —
concrete, where the "prefix is over-broad" objection is theoretical, since only
one variant is ever mounted per channel. Both moved to prefix + `setQueriesData`,
with a dev-only warning when the write matches zero queries.

**`useInvalidateMessages` deleted.** Zero callers, and structurally unusable by
the sites that would want it (services can't call hooks). Dead code that looked
like coverage.

### Test gap closed

`src/dev/tests/services/messagesCacheKeyContract.test.ts` guards the invariant
itself: no source file outside the mount point may use the variant-pinned exact
key, and none may hand-roll a `['Messages', …]` literal. **Verified red on
revert** — reverting `MessageService.ts` alone fails it by name. This covers what
the required parameter cannot: the compiler forces an author to *state* a
variant, not to state the right one. It also caught two files on its first run.

Behaviour is verified at the unit and contract level, not yet observed in a live
session with real peers.

## Root cause

`buildMessagesKey` produces a **four**-element key whose last element is the
thread variant:

```ts
['Messages', spaceId, channelId, includeThreadReplies ? 'with-threads' : 'no-threads']
```

`includeThreadReplies` **defaulted to `false`**, so omitting it did not mean
"either variant" — it silently pinned the key to `'no-threads'`.

A channel picks its variant the other way round:

```ts
// Channel.tsx:270
const threadsEnabled = !!space?.allowThreads && (channel?.allowThreads !== false);
// useChannelMessages.ts:38
useMessages({ ..., includeThreadReplies: !threadsEnabled })
```

So a space with threads **disabled** — the default — mounts its message query
under `'with-threads'`, while every call site that omitted the flag targeted
`'no-threads'`. Ten sites omitted it. The three that matter most are the ones
that refresh a channel after the peer-sync path writes new history straight to
IndexedDB:

- `MessageService.ts:6047` — synced space message batch
- `MessageService.ts:6139` — `sync-delta` apply
- `MessageService.ts:7748` — conversation deletion

Those `refetchQueries` calls matched **nothing**. And nothing else covers them:
`useInvalidateMessages` exists, is exported, and has **zero callers**; the only
other path into the cache is the live per-message append in
`MessageService.addMessage`, which already uses the 3-element prefix.

Net effect: open a channel while its history is still arriving over sync, and
the query resolves empty, the sync writes land in IndexedDB, the refetch misses,
and **the channel stays empty for the entire life of that mount**. Reloading
the page re-reads IndexedDB from scratch, which is why a refresh "fixed" it —
and why all channels could be empty at once, when a whole space's history
arrived in one batch while navigating.

## Why this was invisible

Every symptom is a non-event. Nothing throws, nothing logs, IndexedDB is
correct, and the same code is correct for DMs (which consistently omit the flag
on both sides, so both land on `'no-threads'`) and for spaces that enable
threads. Only "space channel, threads disabled, history arriving via sync" hits
it.

## Measured

Real `QueryClient`. A channel mounted the way a threads-disabled space mounts it
(`includeThreadReplies: true` → `'with-threads'`):

| lookup | queries matched | channel re-read? |
|---|---|---|
| `buildMessagesKey({spaceId, channelId})` (old sync-path call) | **0** | **no** |
| `buildMessagesKeyPrefix({spaceId, channelId})` | 1 | yes |

Controls: the prefix also matches a threads-*enabled* channel, and does not leak
across channels.

## Fix

1. **`includeThreadReplies` is now required** on `buildMessagesKey`. Omitting it
   is a compile error rather than a silent variant choice. This is the part that
   closes the class of bug — the compiler enumerated all ten offending sites.
2. All conversation-wide writes and refetches moved to `buildMessagesKeyPrefix`
   (3 elements, prefix-matches both variants), which is what the live-append
   path already used. `setQueryData(exactKey, …)` became
   `setQueriesData({ queryKey: prefix }, …)` where needed:
   - `MessageService.ts` ×3 (the sync refetches above)
   - `useMessageActions.ts` ×3 (optimistic reaction, soft-delete, hard-delete)
   - `MessageEditTextarea.tsx` ×2 (optimistic edit)
   - `Channel.tsx` ×1 (optimistic thread removal)
   - `DirectMessage.tsx` ×2 (DM optimistic writes — were already correct by
     coincidence, now correct by construction)

`Channel.tsx`'s two jump-to-message writes originally kept the exact key, since
they pass an explicit flag and replace the whole cache for the variant they
believe is mounted. Review overturned that — see **Found by review** above — and
they now use the prefix too. No call site outside `useMessages` picks a variant
any more.

Tests: `src/dev/tests/services/syncRefetchQueryKey.unit.test.ts` (semantics),
`src/dev/tests/services/messagesCacheKeyContract.test.ts` (the invariant, red on
revert), `src/dev/tests/hooks/pinnedMessagesCacheLookup.unit.test.ts` (the
exact-vs-prefix lookup trap).

### Also fixed by the same sweep

The optimistic-update sites were broken in exactly the same way. In a
threads-disabled space channel, reacting to, editing or deleting a message wrote
to a cache key nothing was reading, so the UI only caught up when the echo came
back through `addMessage`. Nobody had reported this; it was found by the
compiler once the flag became required.

## Note on test strength

The six new tests pin the *matching semantics* the fix depends on — they pass
before and after, because what changed is which key each call site passes. The
call sites themselves are guarded by the type system, not by a test: the sync
handlers sit inside a websocket envelope dispatcher that would need a
substantial harness to drive. A required parameter forces a future author to
*state* the variant; it cannot force them to state the right one.

---
*Last updated: 2026-08-06*
