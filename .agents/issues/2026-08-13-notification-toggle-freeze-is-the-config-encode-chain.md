---
type: bug
title: "Notification switches freeze the UI for ~1.8s — the config-save encode chain (hex+base64), not the signature"
status: in-progress
priority: high
created: 2026-08-13
updated: 2026-08-13
area: notifications / performance
---

# Notification switches freeze the UI for ~1.8s

Flipping a switch in **Space Settings → Account → Notifications** freezes the UI for
roughly 0.5-2s. Toggling several in succession is worse than additive.

Reported 2026-08-13. **The cause is measured, not inferred.** Two earlier diagnoses were
wrong; the appendix keeps them because the way they failed is instructive.

## Cause

### 1. It is the config save (browser A/B)

`src/dev/perf/toggleFreezeProbe.ts` on branch `local/toggle-freeze-ab-DO-NOT-MERGE`,
measuring `longtask` entries — contiguous main-thread blocks over 50ms. One click per arm.

| Arm | Blocked | Longest single block | Blocks |
|---|---|---|---|
| baseline | 1817ms | 1699ms | 2 |
| mention/reply recount suppressed | 2530ms | 2372ms | 2 |
| **config save suppressed** | **136ms** | 136ms | 1 |

Suppressing the queued `save-user-config` removes **~93%** of the freeze. Suppressing the
recount does not help at all — it measured *worse*, which is run-to-run variance.

### 2. Within the save, it is the ENCODING, not the signature

`yarn bench` → `src/dev/tests/perf/configSigning.bench.test.ts`, against the real wasm SDK.

Signing alone is cheap. Even a 4MB config — a 10.67MB signed payload — costs ~110ms:

| Config | Signed payload | Sign |
|---|---|---|
| 10 KB | 0.03 MB | 17ms |
| 1 MB | 2.67 MB | 36ms |
| 4 MB | 10.67 MB | 110ms |

Decomposing the real chain (`ConfigService.saveConfig` ~832-857):

| Config | JSON | AES-GCM | **hex** | **base64** | sign | TOTAL |
|---|---|---|---|---|---|---|
| 1 MB | 5ms | 66ms | 116ms | 214ms | 84ms | 485ms |
| 4 MB | 27ms | 274ms | **716ms** | **1083ms** | 216ms | **2316ms** |

**String marshalling is 78% of the cost. Signing is 9%.** The 4MB total lands squarely on
the browser-measured 1699-2372ms block.

> The inherited "**Ed448 signing ~1,000ms**" figure from
> `.archived/config-save-space-key-caching.md` does **not** hold. Every plan built on it,
> including "move signing to a Web Worker", was aimed at the wrong 9%.

### Why it costs so much

The ciphertext is *bytes*, but the code renders it as a **hex string**, utf-8 encodes that
string, then base64s the result:

```
config S bytes → JSON S → AES S → hex 2S CHARS → utf8 2S bytes → base64 2.67S
```

A 4MB config becomes a **10.67MB base64 string** before it is signed — three full passes
over multi-megabyte buffers. In the browser `Buffer` is a **polyfill**, not Node's native
implementation, which is the likeliest reason the real figure sits at the top of the range.

## Fix candidates, ranked by measured cost

1. **Move the encode chain off the main thread.** JSON + AES + hex + base64 are **91% of
   the cost and need no private key**, so the archived "signing can't move, it needs the
   key" objection does not apply to them. This sidesteps that debate rather than
   reopening it.
2. **Kill the hex round-trip.** `Buffer.from(bytes).toString('hex')` then
   `Buffer.from(hex,'utf-8')` round-trips through a 2S-character string for nothing.
   ⚠️ The hex string is what is *sent* (`user_config: ciphertext`) and what the signature
   must cover, so changing **what is signed** is a wire change needing server and mobile
   agreement. Changing **how the same bytes are produced** is not.
3. **Replace the `Buffer` polyfill on this path** with native `TextEncoder` / chunked
   base64. Browser `Buffer` is slow at these sizes.
4. **Shrink the config.** Every stage is linear in size, so halving the config roughly
   halves the freeze. See `.done/2026-08-05-bookmarks-are-75-percent-of-the-config-blob.md`
   — newly relevant, since this is no longer believed to be a fixed cost.
5. **Fix the broken dedup** (below) so N toggles do not cost N full encodes.

## Caveats — do not drop these when quoting the numbers

- The per-stage timings are **Node**. The browser's `Buffer` polyfill is slower, so the
  split may shift, though the 4MB total already matches the observed block well.
- **The 4MB config is a test fixture, not a measurement of the user's real config.** That
  it reproduces his timing is suggestive, not proof. Measuring the real blob size is the
  cheapest way to confirm, and has not been done.

## Related waste — real, but NOT the cause of this freeze

Found while investigating. Each is worth fixing on its own merits; none will noticeably
shorten this freeze, and they must not be sold as if they would.

- **The recount is genuinely wasteful.** Every toggle invalidates the space-wide
  `['mention-counts','space']` *and* `['reply-counts','space']`, each walking every channel
  of every space with three sequential IndexedDB reads — ~1200 round-trips per toggle at
  200 channels. Measured by `src/dev/tests/perf/spaceMentionCounts.bench.test.tsx`.
- **`getUnreadMentions` is a cursor that only stops early after `limit` MATCHES**
  (`db/messages.ts:2876`). With no unread mentions it walks every message since
  `lastReadTimestamp` — the whole channel history when that is 0. Its cost is
  O(messages scanned), not O(channels), and it is worst for big never-opened channels.
- **The queue dedup does not work.** `ActionQueueService.enqueue` computes
  `hasProcessingTaskWithKey` (line 126) but uses it for **a log line only** (140-142); it
  never gates the insert, despite the method's doc comment saying that is its purpose.
  `getPendingTasksByKey` only removes tasks still `pending` (`db/messages.ts:3514`). So N
  human-paced toggles genuinely cost N full saves.
- **Six files duplicate the same mute-gated loop**: `useSpaceMentionCounts:68`,
  `useSpaceReplyCounts:63`, `useChannelMentionCounts:60`, `useReplyNotificationCounts:59`,
  `fetchSpaceMentions:33`, `fetchSpaceReplies:21`.
- **A safe way to cut the recount**, if it is ever worth doing: split the two unscoped
  space-level queries into one query per space (the shape the channel-level queries
  already use), so a toggle invalidates only the space that changed. Mute filtering never
  moves, so it carries none of the regression risk of the display-layer approach.
  ⚠️ Do **not** lift the mute check to the display layer: `NavRail.tsx:115` has no mute
  awareness at all, `SpacesSidebar.tsx:134` computes badge counts before its own
  `useMutedSpacesSet()` (line 178) is declared, and the notification panels have no
  compensating filter — muted spaces would start showing badges.

## Appendix — two wrong diagnoses, and why they survived review

Kept deliberately. Both were held confidently, both were checked by independent reviewers,
and neither was caught by reading. One two-minute measurement settled it.

**Wrong diagnosis 1: the mention recount.** Argued from the un-debounced
`invalidateNotificationQueries()` and a genuinely expensive loop. Refuted by the A/B above:
suppressing it changed nothing.

**Wrong diagnosis 2: the Ed448 signature.** Adversarial review correctly refuted diagnosis
1's ranking and pointed at signing instead. Also wrong — signing is 9%.

**The discriminating argument that was itself broken.** Diagnosis 1 claimed rapid toggling
is worse *because* saves dedup and invalidations do not, so bursts must be the recount.
But the dedup does not work (see "Related waste"), so N toggles cost N saves, and the
signing hypothesis predicted the same symptom. The observation could not rank the two, and
was presented as though it could.

**Three lessons worth keeping:**

1. **Block shape was a free discriminator nobody looked at.** `blocks=2` with one ~1.7s
   block means *one contiguous synchronous operation*. A recount walking hundreds of
   channels through IndexedDB would appear as many small blocks, because every `await`
   yields. For a freeze, the distribution of block lengths is often more diagnostic than
   the total.
2. **A call-count instrument is not a cost model.** The recount bench counted round-trips
   and was right about the mechanism, but counts say nothing about milliseconds. It was
   used to rank suspects, which it could not do.
3. **Inherited measurements decay.** "Ed448 ~1,000ms" came from a 2025-12 archive, was
   never re-checked, and shaped two rounds of planning. It is off by roughly 10x.

## Unrelated finding: two tests in the unit suite are intermittently flaky

Surfaced while establishing a stable baseline. A flaky suite quietly devalues every green run.

| Test | Symptom |
|---|---|
| `src/dev/tests/components/websocketInboundPickup.unit.test.tsx` — "a frame arriving during a relay dump waits for the whole dump" | `expected 261 to be 401` — processed only 261 of 401 frames |
| `src/dev/tests/hooks/fetchSpaceReplies.unit.test.ts` — "returns a reply row tagged with spaceId and spaceName when enabled" | fails at the first assertion; 5401ms in the failing run |

Both pass consistently **in isolation** (each verified 3-5 times) and fail only under
full-suite load — CPU contention against timing assumptions, not logic. Rate with
`perf/**` excluded: ~1 failure in 8 runs. `fetchSpaceReplies` is notable for having no
timers and no `waitFor` — a pure async call against a mocked DB — so why load affects it
is not obvious from reading, and is worth understanding rather than papering over with a
retry.

Not filed separately yet.

---

*Last updated: 2026-08-13*
