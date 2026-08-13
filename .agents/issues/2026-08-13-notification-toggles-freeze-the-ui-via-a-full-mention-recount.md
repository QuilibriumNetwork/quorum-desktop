---
type: bug
title: "Notification switches freeze the UI for 0.5-2s, and rapid toggling is disproportionately worse"
status: in-progress
priority: medium
created: 2026-08-13
updated: 2026-08-13
area: notifications / performance
---

# Notification switches freeze the UI

Toggling a switch in **Space Settings → Account → Notifications** (Space notifications,
or any per-channel switch) freezes the UI for roughly half a second to two seconds.
Toggling several in succession is **disproportionately** worse, not merely additive.

Reported by the user 2026-08-13 while testing the notification settings panel.

## This is NOT the config-save path — that was already fixed

Worth stating up front, because it is the obvious suspect and it is the wrong one.
`useChannelMute` already does the right thing: an optimistic `queryClient.setQueryData`
for instant feedback, then a **fire-and-forget** `actionQueueService.enqueue` with dedup
key `config:${userAddress}`. Nothing on the save path is awaited before the UI updates.

That work landed via `.agents/issues/.done/background-action-queue.md`. Two related
issues are archived and their measurements are still useful:

- `.agents/issues/.archived/config-save-space-key-caching.md` — timed a config save at
  ~7s total: DB queries ~40ms, **Ed448 signing ~1,000ms**, API call ~5,500ms.
- `.agents/issues/.archived/background-action-queue-with-worker-crypto.md` — explains why
  there is no Web Worker: AES-GCM 0.2ms and SHA-512 0.3ms are not worth moving, and
  Ed448 signing "can't move — requires private key". Confirmed still true 2026-08-13:
  `ActionQueueService.ts` contains no Worker references.

## Prime suspect: a full cross-space mention recount on every toggle

Every mute/unmute calls `invalidateNotificationQueries()` — **8 call sites** in
`src/hooks/business/channels/useChannelMute.ts`, with **no debounce or throttle anywhere
in the file**. It invalidates six-plus query keys, including the space-wide
`['mention-counts', 'space']`.

That key's `queryFn` lives in `src/hooks/business/mentions/useSpaceMentionCounts.ts` and
is shaped like this:

```
for (const space of spaces)                 // every space
  for (const channelId of channelIds)       // every channel in it
    await getConversation(...)              // IDB read 1
    await getThreadReadTimesForChannel(...) // IDB read 2
    await getUnreadMentions(...)            // IDB read 3 (cursor scan)
```

Three **sequential** IndexedDB round-trips per channel, no batching, no parallelism, all
on the main thread.

**The early exit does not save the common case.** The `break` fires only when
`spaceTotal >= DISPLAY_THRESHOLD` (10), i.e. only once mentions have been *found*. With
no unread mentions — the normal state — every channel of every space is scanned in full.
So the cost is ~`3 × (total channels across all spaces)` sequential IDB operations, and
it is worst precisely when there is nothing to report.

### Why this explains "worse when toggling several in a row"

This is the detail that discriminates between the two suspects, and it is the reason the
recount is the prime one:

| Path | Deduped? | Cost of N rapid toggles |
|---|---|---|
| Config save | **yes** — `config:${userAddress}` dedup key | 1 save, 1 signature |
| `invalidateNotificationQueries()` | **no** — no dedup, no debounce | N full recounts |

A save-side cause would predict rapid toggling being *cheaper per toggle* (dedup
collapses it). The observed behaviour is the opposite, which is what the un-debounced
invalidation predicts.

## Secondary suspect: Ed448 signing on the main thread

~1,000ms, measured 2025-12, synchronous WASM, no worker (and by the archive's reasoning,
not movable to one). This would produce a freeze shortly after a toggle, once per deduped
save. It is real, but it does not explain the rapid-toggling behaviour above, so it is
likely a contributor rather than the driver.

## Evidence status — read this before acting

- **READ (verified in code):** the loop structure and its three sequential awaits; the
  early-exit condition; 8 un-debounced `invalidateNotificationQueries()` call sites; the
  optimistic + fire-and-forget save path; the dedup key; no Worker in `ActionQueueService`.
- **MEASURED, but by someone else in 2025-12 and possibly stale:** Ed448 ~1,000ms,
  API ~5,500ms, DB ~40ms.
- **INFERRED, not measured:** that the recount dominates the freeze.

The last line is the whole reason this issue leads with a measurement task. Previous
attempts in this area shipped on reasoning and did not hold.

## STEP 1 — Measure before changing anything ✅ DONE 2026-08-13

Bench: `src/dev/tests/perf/spaceMentionCounts.bench.test.tsx`, run with **`yarn bench`**.
It drives the **real hook** via `renderHook`; it deliberately does not re-implement the
loop, because a copy would measure the copy and keep passing if the hook changed.

It is **not** in the unit suite. `vitest.config.ts` excludes `perf/**` and a new
`vitest.perf.config.ts` runs it, mirroring how `harness/**` and `security/**` are already
handled. Reason, measured while building it: `websocketInboundPickup` and
`fetchSpaceReplies` are already intermittently load-sensitive (the suite failed once in
8 runs with no bench present, and both pass consistently in isolation), and adding one
bench file took that to 3 failures in 6 runs. The bench amplifies a pre-existing flake
rather than causing it — see "Unrelated finding" at the end.

It asserts on **IndexedDB round-trip counts, not wall-clock**. Wall-clock under
`fake-indexeddb` says nothing about a real browser, but the *shape* of the work — how
many sequential round-trips, and how that scales — transfers directly and is
deterministic.

- [x] Cost of one recount across a spaces × channels grid — **MEASURED**:

  | Spaces × channels | Total channels | IDB round-trips per toggle |
  |---|---|---|
  | 1 × 5 | 5 | **15** |
  | 5 × 10 | 50 | **150** |
  | 10 × 20 | 200 | **600** |

  Exactly **3 sequential round-trips per channel**, no batching, confirmed at every size.

- [x] Scales with **total channel count**, not space count — 2 spaces × 50 channels and
      50 spaces × 2 channels cost identically (100 reads each).
- [x] The **no-unread-mentions** case is the one measured above, and it is the worst
      case, exactly as the early-exit reading predicted: the `spaceTotal >= 10` break can
      never fire when nothing is unread, so every channel is always scanned.
- [x] **Control arm** — a muted space is skipped (`if (settings?.isMuted) continue`) and
      costs **0** reads vs 40 for the same spaces unmuted. This proves the counters can
      register a difference at all; without it every number above would be suspect.
- [x] **Falsification check** — asserting 2 round-trips per channel instead of 3 makes
      the bench go red (`expected 15 to be 10`); restoring makes it green. The assertions
      are load-bearing, not vacuous.
- [ ] **Still not measured:** the Ed448 signature cost *today* (the ~1,000ms figure is
      2025-12 and may be stale), and real-browser wall-clock for one recount.

### What the measurement establishes, and what it does not

**Established:** one notification toggle issues `3 × (total channels across all spaces)`
sequential IndexedDB round-trips on the main thread, and N rapid toggles issue N times
that, because the invalidation is not deduped or debounced while the config save is.
For a user with 200 channels that is 600 round-trips per click.

**Not established:** that this is the *whole* 0.5-2s. Converting round-trips into
milliseconds needs a real browser; `fake-indexeddb` is an in-memory shim and its timings
(60-100ms for the whole grid) are not transferable. The Ed448 signature remains an
unquantified second contributor.

So the mechanism is now confirmed and sized, but the split between the two suspects is
not. A browser Performance-panel capture while toggling would close that gap.

## STEP 2 — Likely fixes, only once the measurement says which

Sketches, deliberately not committed to:

- **Do not recount on mute at all.** Muting changes which counts are *displayed*, not the
  underlying unread data. If the mute state is applied at render/selector level, the
  invalidation may be removable outright — the cheapest possible fix.
- **Debounce / coalesce** `invalidateNotificationQueries()` so a burst of toggles causes
  one recount instead of N.
- **Scope the invalidation** to the affected space rather than the space-wide
  `['mention-counts', 'space']` key.
- **Batch the per-channel reads** so a channel costs one IDB round-trip instead of three,
  or run them concurrently rather than sequentially.

## Unrelated finding: two tests in the unit suite are intermittently flaky

Surfaced while establishing a stable baseline for the bench, and worth its own attention
because a flaky suite quietly devalues every green run:

| Test | Symptom |
|---|---|
| `src/dev/tests/components/websocketInboundPickup.unit.test.tsx` — "a frame arriving during a relay dump waits for the whole dump" | `expected 261 to be 401` — processed only 261 of 401 frames |
| `src/dev/tests/hooks/fetchSpaceReplies.unit.test.ts` — "returns a reply row tagged with spaceId and spaceName when enabled" | fails at the first assertion; took 5401ms in the failing run |

Both pass consistently **in isolation** (`fetchSpaceReplies` verified 5/5), and both fail
only under full-suite load, so this is CPU contention against timing assumptions, not
logic. Observed rate with `perf/**` correctly excluded: 1 failure in 8 runs.

`fetchSpaceReplies` is notable because it has no timers and no `waitFor` — a pure async
call against a mocked DB — so whatever makes it fail under load is not obvious from
reading it, and is worth understanding rather than papering over with a retry.

Not filed separately yet; say the word and it becomes its own issue.

---

*Last updated: 2026-08-13*
