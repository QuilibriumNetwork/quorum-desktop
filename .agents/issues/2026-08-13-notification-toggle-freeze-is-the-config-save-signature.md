---
type: bug
title: "Notification switches freeze the UI for ~1.8s — the config save's signature, NOT the mention recount"
status: in-progress
priority: high
created: 2026-08-13
updated: 2026-08-13
area: notifications / performance
---

# Notification switches freeze the UI

> ## ⛔ THE DIAGNOSIS BELOW WAS WRONG. MEASURED AND REFUTED 2026-08-13.
>
> Everything from here to "## A/B RESULT" argued that a cross-space mention
> recount causes the freeze. **A browser A/B disproved it.** Suppressing the
> recount made the freeze slightly WORSE; suppressing the config save removed
> 93% of it.
>
> | Arm | Blocked | Longest single block |
> |---|---|---|
> | baseline | 1817ms | 1699ms |
> | recount suppressed | **2530ms** | 2372ms |
> | config save suppressed | **136ms** | 136ms |
>
> The wrong reasoning is kept deliberately, because two independent code reviews
> and three careful readings all failed to catch it and one two-minute
> measurement did. Jump to **"## A/B RESULT"** for what is actually true.

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

### ~~Why this explains "worse when toggling several in a row"~~ — REFUTED 2026-08-13

> **This argument was wrong and is retained only so nobody re-derives it.** It claimed the
> config save is deduped while the invalidation is not, so bursts of toggles must be
> explained by the recount rather than by signing. Adversarial review refuted it, and the
> refutation was independently verified:
>
> - `getPendingTasksByKey` filters `status === 'pending'` (`src/db/messages.ts:3514`), so
>   dedup only removes tasks that have **not started**. A task already `processing` is
>   untouched.
> - `ActionQueueService.enqueue` computes `hasProcessingTaskWithKey` (line 126) but the
>   result is used for **a log line only** (lines 140-142) — it never gates `addQueueTask`.
>   The method's own doc comment says it is "used to skip enqueueing while an identical
>   task is already running"; that was never wired up.
> - `processQueue` fires on every enqueue and on a 1s interval, so a task reaches
>   `processing` far faster than a human can click a second switch.
>
> Therefore N human-paced toggles produce N tasks and **N sequential ~1s Ed448 signs**.
> Signing predicts the same "worse than additive" symptom as the recount. The observation
> does not discriminate between the two hypotheses, so it cannot be used to rank them.

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

## Review findings, 2026-08-13 — three corrections to the above

Two independent reviews (one verifying the fix, one instructed to refute the diagnosis)
each found real defects. All claims below were re-verified directly before being written
down.

**1. The measured cost is roughly DOUBLE what the bench reports.**
`src/hooks/business/replies/useSpaceReplyCounts.ts` is an exact structural twin of
`useSpaceMentionCounts` — same space-level `isMuted` gate (line 63), same per-channel
loop (line 79), same three sequential reads (`getConversation` 88,
`getThreadReadTimesForChannel` 95, `getUnreadReplies` 102) — and
`invalidateNotificationQueries()` invalidates **both** `['mention-counts','space']` and
`['reply-counts','space']` (`useChannelMute.ts:116-121`). The bench only exercised the
mention half. Real cost at the 10×20 grid is ~**1200** round-trips per toggle, not 600.

**2. The cost model is wrong in SHAPE, not just magnitude.**
The bench treats the three reads as equal-cost, which they are not. `getConversation` is
an O(1) `store.get()`; `getThreadReadTimesForChannel` is a small bounded `index.getAll`.
But `getUnreadMentions` (`src/db/messages.ts:2876-2926`) opens a **cursor** over
`by_conversation_time` and only stops early once it has collected `limit` *matches*. With
no unread mentions — the case this issue calls the worst case — that early stop never
fires and the cursor walks **every message after `afterTimestamp`**, which is
`lastReadTimestamp || 0`, i.e. the channel's entire history for a never-opened channel.
So the true cost is O(messages scanned), not O(channels), and it is worst for exactly the
big, old, never-opened channels. The bench's round-trip count is a **lower bound on the
shape of the problem, not a model of its cost.**

**3. The proposed fix is incomplete and would ship a correctness regression.**
Six places share the identical mute-gated loop, not one:

| File | Space-level mute gate | Per-channel gate |
|---|---|---|
| `useSpaceMentionCounts.ts:68` | yes | no |
| `useSpaceReplyCounts.ts:63` | yes | no |
| `useChannelMentionCounts.ts:60` | yes | yes (87) |
| `useReplyNotificationCounts.ts:59` | yes | yes (74) |
| `fetchSpaceMentions.ts:33` | yes | yes (52) |
| `fetchSpaceReplies.ts:21` | yes | yes (33) |

Lifting the mute check to the display layer means every consumer must re-apply it, and
they are not ready: `NavRail.tsx:115` has **no mute awareness at all**;
`SpacesSidebar.tsx:134` derives badge counts before its existing `useMutedSpacesSet()`
(line 178) is even declared; `NotificationPanel` and `GlobalNotificationsModal` have no
compensating filter whatsoever. Implemented as originally sketched, muted spaces would
start showing badges and populating the notification panel.

### Better fix identified by review — supersedes the sketch below

Restructure only the two unscoped hooks (`useSpaceMentionCounts`, `useSpaceReplyCounts`)
from one combined all-spaces query into **one query per space**, keyed
`['mention-counts','space', spaceId, userAddress]` — the shape the channel-level queries
already use successfully. Then a mute toggle can invalidate just the space that changed,
bounding cost to that space's channels.

Why this is preferable: **mute filtering never moves**, so the regression surface in (3)
does not exist. No consumer component changes. Existing broad invalidations
(`useSpaceContextMenu.tsx:156`, `useUpdateThreadReadTime.ts:43`,
`NotificationPanel.tsx:181`) use the 2-element prefix and keep working, since a prefix
still matches every per-space query.

Note this also makes the old sketch #3 ("scope the invalidation") impossible as written:
`spaceId` is not currently a key segment of the space-level queries, so it cannot be
narrowed by passing a longer `queryKey` — the query itself has to be restructured.

### One objection that did NOT survive

I had flagged that if the mention-count query were unmounted while the settings modal is
open, invalidation might cost nothing and the whole diagnosis would collapse. It is
mounted: `SpacesSidebar.tsx:134` renders it in the always-visible sidebar, which stays
mounted under the modal overlay. The invalidation does trigger a real refetch.

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

## A/B RESULT — the config save is the cause (measured 2026-08-13)

Run in a real browser with `src/dev/perf/toggleFreezeProbe.ts` (branch
`local/toggle-freeze-ab-DO-NOT-MERGE`), measuring `longtask` entries — contiguous
main-thread blocks over 50ms, which is precisely the freeze under investigation.
One click per arm.

| Arm | Blocked | Longest single block | Blocks |
|---|---|---|---|
| `baseline` | 1817ms | 1699ms | 2 |
| `no-invalidate` (recount suppressed) | 2530ms | 2372ms | 2 |
| `no-enqueue` (config save suppressed) | **136ms** | 136ms | 1 |

**Conclusion: the queued `save-user-config` task causes ~93% of the freeze. The
mention/reply recount is not a significant contributor.** Suppressing the recount
did not help at all — it measured *worse* than baseline, which is run-to-run
variance in the signature and further evidence the recount is irrelevant here.

### The tell that was available all along, for free

`blocks=2`, one of them ~1.7-2.4s. That is **one contiguous synchronous
operation**. A recount walking hundreds of channels through IndexedDB would
appear as many small blocks, because every `await` yields. The block *shape*
discriminated the two hypotheses before any A/B was run, and nobody looked at it.
Worth remembering: for a freeze, the distribution of block lengths is often more
diagnostic than the total.

### Note the magnitude

1699-2372ms, against the ~1,000ms recorded for Ed448 signing in 2025-12. Either
signing got slower or the payload grew — see
`.agents/issues/.done/2026-08-05-bookmarks-are-75-percent-of-the-config-blob.md`,
which found bookmarks dominating the config blob. Blob size is therefore a
plausible lever and worth measuring before assuming the signature is irreducible.

### What this invalidates

- The whole "prime suspect" section above, and its proposed fix.
- The per-space query restructuring proposed by review. It remains *correct* —
  it removes genuinely wasted work — but it is **not a fix for this bug** and
  must not be sold as one.

### Next, and it needs no more of the user's time

1. Time `ch.js_sign_ed448` directly against realistic config-blob sizes. The
   harness config already loads the real WASM SDK, so this is measurable in a
   bench with no manual testing.
2. If cost scales with blob size, shrinking the blob (bookmarks) is the cheapest
   real win.
3. Re-examine "signing can't move to a Web Worker — requires the private key"
   from `.archived/background-action-queue-with-worker-crypto.md`. A worker is
   the same origin and same security context; the key already lives in
   main-thread JS. That reasoning deserves a second look rather than being
   inherited — but it is a security-adjacent claim, so it needs an actual
   argument, not my assumption.
4. Fix the broken dedup regardless (`hasProcessingTaskWithKey` is computed and
   never used to gate). Today N toggles cost N signatures.

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
