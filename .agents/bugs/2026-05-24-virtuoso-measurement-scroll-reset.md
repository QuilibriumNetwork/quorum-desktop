---
type: bug
title: "Virtuoso measurement callback resets scrollTop on new messages — scroll jank in channels and DMs"
status: in-progress
priority: high
ai_generated: true
created: 2026-05-24
updated: 2026-05-24
supersedes: .archived/2026-03-19-message-list-scroll-jank-on-send.md
branch: fix/virtuoso-scroll-jank
---

# Virtuoso measurement callback resets scrollTop on new messages

## TL;DR / current status

When a message is sent or received in a channel or DM, the message list scrolls up by a fraction of a screen, then sometimes — non-deterministically — snaps back down. When the snap-back wins the race the user sees the new message; when it doesn't, the new message is below the fold.

**ROOT CAUSE — IDENTIFIED 2026-05-24 (Sessions 2-6, two background-agent code traces, telemetry-confirmed):**

Two distinct bugs, both with triggers entirely on **our** side. Both route through Virtuoso's well-known measurement-callback bug, but that's only the amplifier. Eliminate the triggers → no Virtuoso migration needed.

| | **B1 — Sender-side** | **B2 — Receiver-side** |
|---|---|---|
| **User-visible** | ~24px scroll jump on send | ~350-420px scroll jump on inbound |
| **Trigger** | Optimistic message height shrink (74→50px) when `isCompact` flips after a cache mutation | New `messageList` array reference on every cache write, combined with huge overscan window |
| **Mechanism** | `MessageService.ts:1911` force-sorts pending messages to tail → predecessor flips when cache mutates → `shouldShowCompactHeader` returns true on re-render → header strip (avatar+name) removed | `setQueriesData` returns new `InfiniteData` object → `useChannelMessages.ts:67` useMemo re-runs → new `messageList` array → Virtuoso re-windows everything → items 0/1 mount at top → ~160px content added above → Virtuoso backward scrollTop adjustment |
| **Proposed fix** | **Fix C** — freeze `isCompact` for messages with `sendStatus==='sending'` | **Fix R2 + R3** — return same `InfiniteData` ref when nothing changed; cap `increaseViewportBy` |
| **Estimated patch** | ~20 lines | ~17 lines total |

**Status (2026-05-24, post-Session 13 — β PLAN WRITTEN, awaiting user approval):**

R3 + R4 in place, reduce receiver-side jump from 420px → ~130px (kept; see Session 13 for R4's confirmed disposition). R2 and Fix C both attempted and reverted. **Session 11 found the real cause of the 24px shrink**: `mapSenderToUser` identity change when `members` data resolves async → `isCompact` flip → CSS `margin-top` drops 24→0. **Session 12: user proposed the architectural move** — thin wrapper around Virtuoso that owns scroll anchoring. **Session 13: β plan written** in plain-language reasoning (NOT code) for user to evaluate. Plan kills bug class by targeting the consequence (Virtuoso's wrong scrollTop write) rather than the cause (many independent triggers). Decision: NOT migrating off Virtuoso, NOT accepting residual jank. Awaiting user approval of plan before any implementation.

**Prior investigation:** 20 phases in the archived doc, ~4 hours, no fix that converged — because every attempt targeted Virtuoso's symptom rather than our own trigger. See [`.archived/2026-03-19-message-list-scroll-jank-on-send.md`](.archived/2026-03-19-message-list-scroll-jank-on-send.md) for the full receipts.

**Process rule:** no stacking patches. Every attempt is recorded BEFORE testing, tested in isolation, reverted immediately if it doesn't help.

## Symptoms (current observation, 2026-05-24)

- Send a message in a channel: page scrolls up, then sometimes back down. When it scrolls back down, the sent message is visible. When it doesn't, the message is below the fold.
- Receiver side: similar up-then-maybe-down behavior when receiving.
- Non-deterministic — the rAF-snap-back workaround in `MessageList.tsx` races against Virtuoso's internal reset; whichever wins determines what the user sees.
- Originally believed to affect only DMs (per archived doc Phase 18). Now confirmed to affect channels too. Either prior testing was under different conditions, or recent changes (composer overlay, typing indicator) shifted the timing.

## What's currently in the code (as of this doc's creation)

These workarounds are still live and contributing to the non-determinism:

1. [`MessageList.tsx:619-646`](../../src/components/message/MessageList.tsx#L619-L646) — `followOutput` returns `false` and instead runs an rAF loop (10 frames) + two delayed `setTimeout` snaps at 300ms and 600ms to force `scrollTop = scrollHeight - clientHeight`.
2. [`DirectMessage.tsx:360-371`](../../src/components/direct/DirectMessage.tsx#L360-L371) — after `submitMessage` resolves, three more `setTimeout` snaps at 100/300/600ms.
3. [`MessageService.ts`](../../src/services/MessageService.ts) — DM optimistic-update path (adds the message synchronously before `enqueueOutbound`).
4. Various effect-cleanup changes in [`useDirectMessagesList.ts`](../../src/hooks/business/messages/useDirectMessagesList.ts) and [`DirectMessage.tsx`](../../src/components/direct/DirectMessage.tsx) (mount-only effects, ref-based reads).

The optimistic update (#3) is independently desirable — it makes sent messages appear instantly — so we keep it regardless of the scroll fix.

The two snap-back loops (#1, #2) are workarounds for the Virtuoso bug. They will likely be removed/replaced when we ship a proper fix.

## Plan

### Phase 1 (current): Instrument and profile

Add temporary, throwaway observability — no behavior change — so we can see the exact sequence of events around a send:

- A `scrollTop` setter wrapper on the Virtuoso scroller element. Every write logs timestamp + `new value` + `prev value` + stack trace. This tells us who is actually writing scrollTop (us vs Virtuoso).
- Timestamped `console.log` at every point in our snap-back loops + every `followOutput` invocation.
- Feature flags around the snap-back loops (one-line edit to disable), so we can observe raw Virtuoso behavior without our workarounds masking it.

User reproduces the bug 2-3 times in a channel with DevTools console open, pastes log output. We read the sequence together and decide:

- If logs show a specific component re-render preceding the reset → narrow fix may be possible.
- If logs show Virtuoso re-measures + resets on every send regardless of what we render → Path B or C is the only real option.

### Phase 2: Decision

Based on Phase 1 evidence, pick Path B (migrate to @tanstack/react-virtual) or Path C (plain scroll). Update this doc with the decision and reasoning before any migration work begins.

### Phase 3: Implementation

Do the migration. Remove the snap-back workarounds. Verify the bug is gone across: channels, DMs, threads, search results jump-to-message, hash navigation, pin-to-bottom, paginate-on-top.

## Other Virtuoso usages in the codebase (out of scope unless they regress)

- Search results panels
- Pinned messages panels
- User lists / member lists

These don't auto-scroll, so they don't hit this bug. They can stay on Virtuoso even if we migrate the message list. Worth a quick grep before deciding the migration scope — list the usages here when we get to Phase 2.

## Testing playbook — Phase 1 instrumentation

Instrumentation is live on branch `fix/virtuoso-scroll-jank`. Three files touched (all temporary, marked with `TEMPORARY DEBUG` comments — easy to revert):

- `src/components/message/__scrollDebug.ts` (new) — comprehensive recorder
- `src/components/message/MessageList.tsx` — wires the recorder + logs Virtuoso callbacks
- `src/components/direct/DirectMessage.tsx` — logs submit-snap workaround
- `src/services/MessageService.ts` — one log line at the top of `addMessage`

### What gets recorded

Every event is timestamped (ms relative to session start) and buffered. Captured automatically with no manual action during the bug:

| Event kind | What it tells us |
|---|---|
| `scrollTop-set` | Every write to scrollTop, with `prev`, new, `gap` (distance from bottom), full stack trace. Auto-flagged as `🔴 suspect` if scrollTop dropped >30px from non-our code. |
| `item-resize` | A message row changed height (which item, old → new height) |
| `item-added` / `item-removed` | DOM item lifecycle |
| `addMessage` | Message added to React Query cache (which type, sendStatus, channel) |
| `followOutput` | Virtuoso asked "should I follow?" (with state at that moment) |
| `atBottomStateChange` | Virtuoso reports atBottom changed |
| `rangeChanged` | Virtuoso reports visible item range changed |
| `snap-raf` / `snap-timeout` / `submit-snap` | Our workaround loops firing |

Buffer survives page reloads via sessionStorage (so refresh-jank can also be captured).

### How to run a session

1. **Start dev server** (`yarn dev` or your normal command).
2. **Open a channel**, open **DevTools console** (F12).
3. (Optional but recommended) **Filter the console**: type `SCROLL-DEBUG` in the console's filter box. All our log lines are prefixed with `[SCROLL-DEBUG]` so this hides all other app logs.
4. In the console: `__scrollDebug.startSession('channel-send-bottom')`
5. **Send one message**. Wait ~1s for the scroll dance to settle.
6. In the console: `__scrollDebug.endSession()`
7. The session automatically:
   - Copies a Markdown report to your clipboard
   - Downloads the same report as `scroll-debug-<timestamp>.md` (backup)
   - Prints a one-line summary: `END — events: N, suspects: M, clipboard: ok`
8. **Paste the Markdown into chat.** Done.

### Recommended sessions (run all three, label each clearly)

The goal is to capture multiple conditions in one sitting:

```js
// 1. Channel, scrolled at bottom, normal workarounds on
__scrollDebug.startSession('channel-send-at-bottom-snap-on')
// → send 1 message, wait, then:
__scrollDebug.endSession()
```

```js
// 2. SAME conditions but with our workarounds OFF (raw Virtuoso)
__scrollDebug.snapEnabled = false
__scrollDebug.startSession('channel-send-at-bottom-snap-off')
// → send 1 message, wait, then:
__scrollDebug.endSession()
__scrollDebug.snapEnabled = true   // restore
```

```js
// 3. DM, same procedure
// (navigate to a DM first, then:)
__scrollDebug.startSession('dm-send-at-bottom-snap-on')
// → send 1 message, wait, then:
__scrollDebug.endSession()
```

Paste all three Markdown reports into chat. Total user effort: ~3 minutes.

### What we'll look for in the reports

The Markdown table has one row per event with `t` (ms), `kind`, `scrollTop`, `prev`, `gap`, `Δ`, `item index`, `note`. Suspect events are flagged 🔴.

In a jank session we expect to see:
- `addMessage` event around t≈0
- One or more `item-resize` events shortly after (when the optimistic message height settles)
- A `scrollTop-set` event with negative `Δ` and a stack pointing inside `react-virtuoso-*.js` — this is the bug
- Our `snap-raf`/`snap-timeout` events trying to correct it

The interesting question: **does the suspect `scrollTop-set` happen immediately after an `item-resize`** (proving height-change is the trigger), or is it independent of height changes (proving the trigger is some other internal Virtuoso state)?

### Cleanup when we're done with Phase 1

Delete the file + revert the four call-site imports:

```bash
git rm src/components/message/__scrollDebug.ts
# then revert the `TEMPORARY DEBUG` blocks in:
#   src/components/message/MessageList.tsx (3 blocks)
#   src/components/direct/DirectMessage.tsx (1 block)
#   src/services/MessageService.ts         (1 import + 1 log)
```

Search the codebase for `TEMPORARY DEBUG` to find every site.

## Session log

### Session 1 (2026-05-24): Doc split + branch setup + instrumentation

- Archived the old 273-line doc (20 phases of patching).
- Created this doc with TL;DR up top + clean forward plan.
- New branch: `fix/virtuoso-scroll-jank` (branched off `main` after PR #153 merged).
- Built comprehensive Phase-1 instrumentation: scrollTop setter wrapper + ResizeObserver + MutationObserver + addMessage hook + Virtuoso callback logging. Session start/end commands that auto-copy a Markdown report to clipboard and download as backup. SessionStorage persistence across page reloads. Jank auto-detection (scrollTop drops >30px from non-our code).

### Session 2 (2026-05-24): First real capture — Channel, send-at-bottom

**Conditions:**
- Channel, scrolled at bottom (gap=5 when followOutput fired — basically at bottom).
- Workarounds enabled (`snapEnabled=true`).
- User sent one text message.
- UX note: clipboard write apparently did not work (download did). Likely page-focus issue at endSession time.

**Raw timeline (13 events, 0 auto-flagged suspects):**

| t (ms) | event | detail |
|---:|---|---|
| 0 | session-start | label="channel-send-at-bottom-snap-on" |
| 5451 | addMessage | optimistic message added with `sendStatus=sending` |
| 5518.8 | rangeChanged | start=60 end=100 (item 100 now visible) |
| 5519.1 | followOutput | scrollTop=4848, gap=**5** (effectively at bottom), `hasNextPage=true` so snap path skipped |
| 5539.6 | item-added | index=100, height=50px |
| **5759.4** | **item-resize** | **index=100, 50 → 28 (shrunk 22px)** |
| 5926.6 | addMessage | server-confirmed version replaces optimistic (`sendStatus=none`) |
| 6170.5 | rangeChanged | start=**56** end=100 — visible range jumped from 60 to 56, meaning **5 older items scrolled into view from above** |
| 6204.8 | item-added × 4 | indices 56, 57, 58, 59 mounted (the items now visible above) |
| 18121.1 | session-end | |

**Key observations:**

1. **The jank happened** but was NOT captured as a `scrollTop-set` event. Evidence: at t=5519 visible range was [60..100], at t=6170 it was [56..100] — 5 items came into view from above without any scrollTop write in our log. This means **Virtuoso writes scrollTop through a path that bypasses our property-descriptor wrapper.** Likely candidates: `Element.scrollTo()`, `scrollBy()`, or a path where the descriptor gets replaced (e.g., another effect re-runs and overwrites our wrapper).

2. **Real height change found.** Item 100 (the optimistic message) rendered at 50px and **shrank to 28px at t=5759**. That's a 22px height change — *exactly the kind of event* that triggers Virtuoso's measurement callback. We always suspected the `sending` indicator caused this, but the original theory was that the indicator disappearing on `addMessage` (without `sendStatus`) caused the shrink. Here the shrink happens at **t=5759, before the server-confirmed addMessage at t=5926**. So something else is changing the height during the optimistic phase. Possibilities to investigate:
   - The `.message-status.sending` Flex element rendering with `opacity: 0` for the first 1s (CSS animation-delay) — but opacity doesn't change height, so this shouldn't shrink the row.
   - A reaction-list / thread-indicator / receipt component mounting late.
   - An image/avatar/embed sizing late.
   - A late-arriving `members[senderId]` lookup that affects the rendered name/avatar size.
3. **`hasNextPage=true`** at the time of send. This means the user was NOT at the absolute newest page — there were still more pages forward. Our `followOutput` snap-back path requires `hasNextPage === false`, so the workaround **never even ran**. The jank we saw was 100% raw Virtuoso behavior, not a race with our snap loops. (This may also explain non-determinism in prior testing: if `hasNextPage` flips state mid-send, the workaround fires on some sends and not others.)

**Blind spots to fix before next session:**
- **Silent scroll writes** — need a `scroll` event listener that fires on the element regardless of how scrollTop was changed (Element.scrollTo, scrollBy, programmatic). Compare current scrollTop to last-recorded; log any delta not preceded by our setter-wrapper event as `scroll-untracked` and flag suspect.
- **Clipboard fallback** — clipboard write fails when console isn't focused. Drop clipboard entirely or make it best-effort only; download is the reliable path.
- **Add height-shrink-tracker** — when an item resizes, log the message id + a snapshot of which child elements are mounted (sending-indicator, reactions, thread-indicator, receipts) so we can correlate the height delta with what changed visually.

**What this changes for our plan:**
- The bug isn't a race with our workarounds. It's a real Virtuoso reset that happens regardless of our intervention.
- The height shrink at t=5759 is a strong lead. Investigating *why* item 100 shrinks during the optimistic phase may give us the trigger, even if we can't directly fix Virtuoso.
- Confirmed `hasNextPage=true` matters — channels in active use will often be in this state.

**Next session goals:**
1. With improved instrumentation (scroll-event listener + child-element snapshot on resize), capture a second send.
2. Confirm or refute: scrollTop reset always happens shortly after the item-100 resize.
3. Identify which DOM children mount/unmount during the resize.

---

### Session 3 (2026-05-24): Code investigation — root cause of the 22px shrink CONFIRMED

While waiting for the next user test, a background agent traced the codebase to explain why item 100 shrank from 50px to 28px at t=5759 in Session 2. The hypothesis (full-header → compact-header transition) was **confirmed**.

**The exact mechanism:**

1. **`shouldShowCompactHeader`** lives at [`quorum-shared/src/utils/messageGrouping.ts:76-100`](../../../quorum-shared/src/utils/messageGrouping.ts#L76-L100). It returns `true` (hide avatar + name strip, save ~22px) when the current message has the same `senderId` as the previous message and was sent within 5 minutes of it (plus a few other guards: no separators, not a reply, not a system message).

2. **Optimistic sort places pending messages at the END.** In [`MessageService.ts:1903-1927`](../../src/services/MessageService.ts#L1903-L1927), after `addMessage` inserts the new message, the page is re-sorted with a special rule: any message with `sendStatus === 'sending'` is forced to the tail of the array, regardless of `createdDate`. This makes the optimistic message item 100 (the last), and its `previousMessage` is `messageList[99]`.

3. **First render — full header.** At t=5539, when item 100 first renders, `messageList[99]` is whatever was last in the page at that moment. The `messageDisplayInfo` useMemo at [`MessageList.tsx:299-310`](../../src/components/message/MessageList.tsx#L299-L310) computes `isCompact = shouldShowCompactHeader(item100, item99, ...)`. If `item99` is from a different sender (very likely just by chance), `isCompact = false` → full header rendered → ~50px tall.

4. **Cache mutates again within ~220ms.** Some other write to the React Query messages cache fires (an inbound message from another user, a delivery receipt, a typing-indicator update, a read receipt — anything that calls `setQueriesData` for this channel). This re-runs the sort. Because the optimistic message is still `sending`, it stays at the tail, but other messages may have rearranged. Critically, **the predecessor of the optimistic message may change.**

5. **Second render — compact header.** If the new `messageList[99]` happens to be **from the same sender** as the user (common: the user's own previous messages, or anything sorted near the tail by `createdDate`), `shouldShowCompactHeader` flips to `true` → `isCompact={true}` → the Message component hides the avatar/name strip → row shrinks ~22px → **t=5759 `item-resize 50 → 28`**.

6. **Virtuoso re-measures, computes wrong `scrollTop`** — this is the long-standing upstream bug. The visible range shifts from `[60..100]` to `[56..100]` at t=6170 — exactly the symptom the user sees as "scrolled up."

**This explains the non-determinism.** Whether the bug fires on a given send depends on:
- Whether `messageList[N-1]` happens to be from the same sender at insertion time (if yes, isCompact is already true and no shrink happens — no bug).
- Whether any cache update lands in the ~220ms window after the optimistic insert (if no update fires, no re-sort, no predecessor change, no shrink — no bug).
- The exact ordering of other concurrent messages.

**What's NOT the cause:**
- The `.message-status.sending` "Sending..." Flex element (opacity-only animation, doesn't change height — Phase 19's reserved-slot fix correctly attacked the wrong symptom).
- The server-confirmed `addMessage` replacement at t=5926 (happens AFTER the shrink at t=5759).
- DM-specific hook tree (the bug happens in channels too, with same mechanism).

**Why the 20-phase patching never converged.** Every patch attempted to suppress the symptom (Virtuoso's bad scrollTop math) without addressing the trigger (a height change driven by `isCompact` flipping). The patches were also chasing the wrong cause within the trigger (Phase 19 reserved space for the *sending indicator* — wrong element).

**Possible fixes — to discuss:**

### Fix A: Force `isCompact` to be stable for sending messages
Compute `isCompact` for the optimistic message based on what it would be when the message is finally non-pending. Concretely: when sorting, instead of "pending always goes to the end," sort the pending message into its real chronological position so `previousMessage` is stable. Trade-off: pending messages would no longer always be visually at the bottom — they could appear in the middle if the user sends an old message timestamp, but that's not actually a scenario.

### Fix B: Reserve header space when the message could become compact later
When rendering an own message, always reserve the header space (~22px), so the row height is constant whether `isCompact` is true or false. Visual trade-off: gaps above some own messages in the compact case. Minor.

### Fix C: Suppress the predecessor flip during the sending window
In `messageDisplayInfo`, special-case: if the message has `sendStatus === 'sending'`, freeze its `isCompact` value to whatever it was on first render. After it transitions out of sending, recompute normally.

### Fix D: Skip the post-insert sort when nothing meaningful changed
The sort at MessageService.ts:1911 runs on every cache mutation. If the only change was, say, a delivery receipt for a different message, the sort recomputes but produces the same order. Avoid this with a sort-stability check or by only re-sorting when the relevant cache update actually changes positions. Bigger refactor, more invasive.

**Recommendation:** Fix A and Fix C are the cheapest. Fix A is more correct (the bug is the sort forcing a fake position). Fix C is the smallest patch. I'd lean Fix A but want to confirm with another test session — specifically, a session that captures whether the shrink reliably happens, and whether the scroll-untracked write is logged after the improved instrumentation.

**Updated next-session goals (Session 4):**
1. Run instrumentation (now improved with scroll-event listener and child snapshot).
2. Confirm the shrink correlates with a `header` element disappearing from the child snapshot.
3. Confirm a `scroll-untracked` event fires shortly after, with the visible range shifting (proving the silent-write theory).
4. If yes to both, implement Fix A (or C as a stop-gap), then re-test.

If Fix A/C eliminates the height change, Virtuoso has nothing to re-measure → no scrollTop reset → bug gone. No migration needed. This would be the first non-Virtuoso fix in 20+ phases and the first one targeting the **trigger** rather than the **symptom**.

---

### Session 4 (2026-05-24): Sender-side capture with improved instrumentation — DIAGNOSIS FULLY CONFIRMED

User ran one channel-send. The report (40 events) confirmed everything:

**Smoking gun timeline (sender-side):**

| t (ms) | event | detail |
|---:|---|---|
| 18680 | addMessage | optimistic, `sendStatus=sending` |
| 18722 | item-added | index=18, height=**74** |
| 18723 | scrollTop-set 407→505 | our snap-raf, gap=0 |
| 19775 | addMessage | server-confirmed replacement, `sendStatus=none` |
| **19816.8** | **🔴 scroll-untracked 505→481, Δ=-24** | **Virtuoso's silent write — proof of blind-spot theory** |
| **19817.1** | **item-resize index=18, Δ=-24, 74 → 50** | **proof of compact-header flip** |

The scroll-untracked write fired **0.3ms before** the resize event landed (resize observer is async; the write happened during the same layout pass). All three theories confirmed in a single report:

1. **Silent-write theory:** ✅ — `scroll-untracked` with Δ=-24 and zero matching setter write. Virtuoso bypasses our `scrollTop` property-descriptor wrapper.
2. **Height-change trigger:** ✅ — exact 24px resize, exact same magnitude as the scroll move.
3. **Compact-header mechanism:** ✅ — `addMessage` server-replacement at t=19775 fires the cache mutation that causes `isCompact` to recompute and flip.

**Note:** the child snapshot showed `(none)` for the resize because ResizeObserver fires after the DOM has already changed (too late to see the `header` element before it was removed). The numbers (Δ=-24, sub-millisecond proximity to scroll-untracked) are conclusive without the snapshot.

**Cleanup item noticed:** the DM `submit-snap` instrumentation also fired during a channel send (note at t=18725 reads "DM handleSubmitMessage finished"). Likely a hook still mounted from a previous DM nav, or the channel happens to share the submit hook. Doesn't affect analysis. Worth a quick cleanup later.

### Session 5 (2026-05-24): Receiver-side capture — DIFFERENT BUG DISCOVERED

User then ran a receiver-side session (had user B send a message; user A's browser ran the recorder). **The behavior is completely different and much worse.**

**Two big 🔴 suspect events** for ONE incoming message:
- t=22193.7: `scrollTop` 2027 → 1608, **Δ=-419px** (~half a screen)
- t=22387.0: `scrollTop` 2027 → 1676, **Δ=-351px**

The receiver-side timeline had **105 events** vs ~40 for sender-side. Massive DOM churn.

**The pattern preceding each big jump:**
```
rangeChanged start=4 → start=0    (visible range expands to TOP of list)
item-added index=0 height=86
item-added index=1 height=74
🔴 scroll-untracked  Δ=-400 to -419
```

The new message itself was item 41 (at the bottom). Items 0 and 1 mounting means **the visible viewport temporarily covered the entire list** — even though the user was near the bottom (scrollTop=2027, gap=16 from bottom). This is NOT the compact-header mechanism; it's something causing Virtuoso to re-evaluate the entire windowed range on inbound messages.

**Additional patterns in the receiver-side timeline:**
- Items 2 and 3 are repeatedly mounted, removed, and re-mounted in the same ~30ms window (visible in events t=22022-22270). Suggests the windowed view is being recomputed multiple times in quick succession.
- The pattern repeats for the SAME message — two big jumps at t=22193 and t=22387 from one inbound. Possibly two separate cache writes (the message itself + a delivery receipt? or a render cascade).

**Theory (to be validated by Session 6 background agent):**

The receiver-side cache update path (`addMessage` from inbound WebSocket) likely creates a **new top-level array reference** for the flattened message list on every write. Virtuoso, seeing a new `messageList` prop, has to re-evaluate its windowed view. Combined with `increaseViewportBy={{ top: height, bottom: height }}` (which expands the rendered range by a full window-height in each direction), on a list of small messages a single inbound can briefly span the entire list — mounting items 0 and 1 even though the user is at the bottom.

When that happens, Virtuoso re-anchors its scroll position based on the newly-mounted items at the top, computes the wrong scrollTop offset, and the user sees a 350-420px jump backward.

### Session 6 (2026-05-24): Receiver-side code trace — ROOT CAUSE CONFIRMED

Background agent traced the receiver-side path and confirmed the reference-instability theory. The chain:

1. **Inbound message → `setQueriesData` returns a new `InfiniteData` object every time** ([`MessageService.ts:1892-1942`](../../src/services/MessageService.ts#L1892-L1942)). Even pages that DON'T contain the new message get wrapped in a fresh outer `{ pageParams, pages: [...] }` object. No `invalidateQueries` is called on the `['Messages']` key — the churn is pure reference instability, not a refetch.

2. **`useChannelMessages` `useMemo` re-runs and produces a new flat array** ([`useChannelMessages.ts:67-81`](../../src/hooks/business/channels/useChannelMessages.ts#L67-L81)):
   ```ts
   const messageList = useMemo(() => {
     const allMessages = messages.pages.flatMap(p => p.messages);
     // dedup ...
     return allMessages.filter(...);
   }, [messages, threadsEnabled]);
   ```
   The memo's only data dep is `messages` (the `InfiniteData`). Since that reference changes on every inbound, `flatMap` produces a brand-new array — even if every element is identical. **`messageList` is a new array reference on every inbound message.**

3. **MessageList sees a new `messageList` prop → `rowRenderer` `useCallback` recreates** ([`MessageList.tsx:390`](../../src/components/message/MessageList.tsx#L390)) because `messageList` is in its dep array. `totalCount`, `computeItemKey`, `itemContent` all depend on `messageList`.

4. **Virtuoso re-evaluates its windowed view** because `itemContent` is a new function reference. Combined with the aggressive viewport config at [`MessageList.tsx:597-598`](../../src/components/message/MessageList.tsx#L597-L598):
   ```tsx
   overscan={{ main: height, reverse: height }}
   increaseViewportBy={{ top: height, bottom: height }}
   ```
   `height` is `window.innerHeight` (~800px). On a list of ~42 small messages (~50px each = ~2100px total), the overscan window of 800px in each direction briefly covers nearly the entire list. **Items 0 and 1 mount at the top** even though the user is near the bottom (scrollTop=2027, gap=16).

5. **The newly-mounted items 0 and 1 (heights 86 and 74) add ~160px above existing content.** Virtuoso's internal scrollTop accounting reacts with a backwards adjustment of ~350-420px (the silent-write `scroll-untracked` events seen at t=22193 and t=22387).

6. **Two jumps per message because the cache mutates twice** in quick succession — once when the message arrives off the wire, once for a follow-up update (delivery receipt, deduplication pass, or similar). Each call produces a new `InfiniteData` reference → two full re-measurement cycles.

**Two distinct bugs, both confirmed:**

| Bug | Side | Trigger | Magnitude | Mechanism |
|---|---|---|---|---|
| **B1** | Sender | Optimistic-sort + cache mutation → `isCompact` flip | ~24px | Same-message height change triggers Virtuoso measurement reset |
| **B2** | Receiver | `setQueriesData` reference instability + huge overscan | ~350-420px | New `messageList` ref → Virtuoso re-windows entire list → items mount at top → backward scrollTop adjustment |

Both bugs route through Virtuoso's measurement-callback bug, but the **triggers are entirely on our side**. No Virtuoso migration needed.

### Session 7 (2026-05-24): Fix attempts R3, R2, R4 — partial only

After Session 6 traced the root cause, three fixes were attempted in sequence. Each tested with the same receiver-side procedure (have a second account send 1 message; record telemetry).

| Fix | Description | Result | Disposition |
|---|---|---|---|
| **R3** | Cap `increaseViewportBy` from `{top: height, bottom: height}` (~800px) to `{top: 300, bottom: 300}` in `MessageList.tsx` | Cut largest backward jump from **420px → 133px** (-70%); event count from 105 → 10 | **KEPT** (commit `09361de7`) |
| **R2** | Short-circuit `setQueriesData` to return `oldData` when content is reference-equal; preserve non-last page refs via `oldData.pages.slice()` | Jump went 133px → **124px** (within noise); event count went UP to 52 (more snap-loop firing) | **REVERTED** (commit `db456a68`) — the no-op short-circuit rarely triggered; cache writes are usually real changes |
| **R4** | Read `messageList` / `messageDisplayInfo` from refs inside `rowRenderer` so its callback identity is stable across cache updates | Jump went 124px → **135px** (within noise) | **KEPT** (commit `dd966df7`) — neutral for the bug but real render-efficiency improvement; safe to leave in |

**Pattern across all three:** every fix targets one trigger Virtuoso uses to re-evaluate items. Virtuoso has multiple triggers (array ref change, function ref change, item-resize, viewport recompute on size change). Closing one leaves the others open. The residual ~120-135px jump appears constant regardless of which trigger we close — strongly suggests Virtuoso re-anchors `scrollTop` whenever items mount above the current viewport, no matter why those items mounted.

**The Cline maintainer's quote from #4780 is empirically validated for our codebase:** this class of bug is *fundamental to Virtuoso's algorithm*.

**Sender-side fix (C, freeze isCompact for pending messages) NOT yet attempted.** Pending the migration decision below.

### Session 8 (2026-05-24): Scale context + migration audit

**Critical scale context from user (must inform all decisions):**

- Target message volumes per channel: **100K to 1M messages** (Discord-scale).
- Target user counts per space: **up to 50K+ members**.
- Other Virtuoso usages exist in the codebase: search results, pinned messages, member lists, possibly more. These are out of scope for the bug but MUST be considered when deciding whether to remove or replace the dependency.

**What this rules out:**

Plain scroll + cap-at-N is **NOT viable** for the message list at these scales. Even with trim-oldest, users scrolling through historical context would either lose state or hit perf walls. **Virtualization is mandatory** for the message list.

This collapses the earlier "Option 2 (plain scroll)" off the table.

**What this rules in:**

The real decision is between:

1. **Ship current state (R3 + R4).** Accept ~120-135px residual jump on inbound, ~24px on send (B1 still untouched). No further structural work. Honest assessment of UX: "noticeable but not blocking" on receive, "small annoyance" on send.

2. **Migrate the message list to `@tanstack/react-virtual`** (~1-2 days). Headless virtualizer, no internal `scrollTop` callbacks to fight. Same virtualization win as Virtuoso. Need to re-implement: auto-scroll-to-bottom, follow-output, paginate-on-top, sticky-bottom detection, scrollToIndex (hash navigation, scrollToMessageId, jump-to-present). Keep Virtuoso for all OTHER usages (search, pinned, members) — they don't have this bug because they don't auto-scroll.

3. **Keep Virtuoso elsewhere** (independent of decision above). Confirmed scope: only the message list is buggy. Other lists may also benefit from `@tanstack/react-virtual` long-term but no urgency.

**Audit needed before deciding:**

User correctly insisted on full audit before any migration. Two background agents launched in parallel:

- **Agent A** — Virtuoso usage audit. Map every file that imports react-virtuoso, every prop/method/callback used at each usage site, and which features in the codebase depend on Virtuoso-specific APIs. Specifically: hash navigation (`#msg-xxx` URLs), `scrollToMessageId`, jump-to-present button, paginate-on-top, paginate-on-bottom, sticky-bottom detection, follow-output, `firstItemIndex`, `rangeChanged` (for separator dismissal). Output: a table of feature → Virtuoso API → tanstack-virtual replacement → estimated complexity.

- **Agent B** — feature-doc collation. Read all relevant `.agents/docs/` and `.agents/tasks/.done/` files that describe behavior tied to the message list. Surface the documented contracts so the migration knows what NOT to break.

After both report back, write a decision document **with** the user comparing Ship vs Migrate with concrete scope, risks, and effort numbers grounded in the audit (not my guesses).

**Process rule remains:** no migration code until decision is signed off. Diagnose-then-decide, not the other way around.

---

### Session 9 (2026-05-24): Audits complete + DECISION — stay on Virtuoso

Three audits returned:

**Audit A (Virtuoso usage):** 6 usages total in the codebase. Only MessageList has the bug. The other 5 (Channel members ×2, EmojiPicker, SearchResults, PinnedMessagesPanel, BookmarksPanel) are all safe — no auto-scroll, no rapid mutations, no dynamic heights. Migration scope is unambiguously just MessageList. Two genuinely hard pieces to re-implement: `alignToBottom` and `followOutput`. Everything else (hash nav, jump-to-present, pagination triggers, etc.) has clean tanstack-virtual equivalents.

**Audit B (feature docs):** 18+ documented behaviors hang off the message list. Most are layout/cache-only (compact grouping, sending indicator, receipts, lazy media, date separators, dm-receipts) and would survive any virtualizer. The Virtuoso-specific ones: hash nav (`scrollToIndex`), auto-jump to first unread, new messages separator (relies on `rangeChanged` because IntersectionObserver was explicitly rejected — Virtuoso unmounts items off-screen and DOM observers fire on unmount), jump-to-present, pin-to-bottom (`followOutput`, currently broken — the bug), pagination top/bottom (`atTopStateChange`/`atBottomStateChange`), thread panel (reuses MessageList wholesale with `alignToTop=true`).

**Audit C (alternatives research) — this changed the decision:**

| Finding | Implication |
|---|---|
| TanStack Virtual has the same bug class (Discussion #195 open since 2021, Issue #1093 auto-scroll-to-bottom Dec 2025 with zero maintainer response) | We'd migrate FROM Virtuoso's bug TO the same bug in a less-mature library |
| No MIT-licensed virtualizer has `alignToBottom` + `followOutput` + `firstItemIndex` + auto-measurement working together | These are the four hard problems for chat. Virtuoso solves all four; everyone else makes you implement at least two yourself |
| Virtuoso maintainer closes scroll-anchoring issues with "see troubleshooting docs" — recent 4.18.x releases fix RTL/SSR/React 19 detection but NO scroll-anchoring fixes | Don't expect upstream relief |
| Discord wrote a custom virtualizer; Element/Matrix wrote a custom one and is rebuilding in Rust; no major chat app publicly uses Virtuoso/TanStack/virtua for their main message list at scale | Off-the-shelf chat virtualization is empirically an unsolved problem at our target scale |
| Virtuoso sells `@virtuoso.dev/message-list` commercial at $168-312/seat/year | Even the maintainer treats chat as hard enough to charge for |

**Decision: stay on Virtuoso.** Reasoning in three lines:
1. The "better" alternative (tanstack-virtual) has the same bug class, unfixed for 5 years.
2. Migration means rebuilding two chat primitives (`alignToBottom`, `followOutput`) ourselves — exactly the code area where chat apps get bugs.
3. The honest answer to "what works at this scale" is "write your own like Discord did" — a much bigger investment than we're prepared for now.

**Conclusion:** off-the-shelf virtualization for our scale targets is empirically an unsolved problem. Migrating shuffles bugs; it doesn't fix them. The only winning move would be a custom virtualizer (Discord pattern) which is out of scope.

### Session 10 (2026-05-24): Fix C attempted + REVERTED — predecessor-flip theory disproven + sender-side has hidden B2 too

**Fix C implemented:** stash isCompact value per messageId in a useRef-backed Map; reuse stashed value for `sendStatus==='sending'` messages; recompute + clear stash when settled. Type-clean, ~50 lines.

**Test result (sender-side):**

```
t=4786.5  addMessage (optimistic, sendStatus=sending)
t=4879.5  item-added 100, height=74
t=5070.2  item-resize 100, 74→50 Δ=-24   ← STILL SHRANK
t=5233.5  addMessage (server-confirmed, sendStatus=none)
t=5417.1  rangeChanged 64→100  (range expanded ABOVE viewport)
t=5433.1  item-added index=64
t=5433.3  🔴 scroll-untracked Δ=-85    ← receiver-style B2 bug also on sender
```

**Two findings:**

1. **The shrink at t=5070 is NOT caused by the predecessor-flip mechanism.** Critical detail: the shrink happens at t=5070, **190ms BEFORE** the second addMessage at t=5233. So no cache mutation fired in the window between the optimistic add and the shrink. Yet `isCompact` (or *something*) made the row shrink anyway. Fix C froze isCompact for pending messages and the shrink still happened — proving the cause is something else. Possibilities (un-investigated): avatar/member-lookup resolving late, layout effect, image/embed sizing, useEffect-driven re-render inside Message.tsx.

2. **Sender-side has the receiver-side B2 bug too**, after the server-confirmed message arrives. Item 64 (some message above the viewport) mounts in response to the second `addMessage`, and Virtuoso adjusts scrollTop backward by 85px. We previously only documented B2 for the receiver case but it fires on the sender's own confirm-cycle as well. This means a sender-side fix has to address BOTH the 24px optimistic-shrink AND the 85px confirm-cycle jump.

**Disposition: Fix C reverted** (was uncommitted, discarded via `git checkout --`). Following the process rule: revert immediately when a fix doesn't help, don't stack.

### Session 11 (2026-05-24): Re-investigation — REAL cause of the 24px shrink found

Background agent launched with corrected premise (no cache mutation fires in the 190ms window between optimistic add and shrink). **Found a definitive, file:line-precise cause.**

**The 24px is NOT a content-height change — it's a CSS margin-top change on the wrapper.**

Mechanism (all citations from agent's report):

1. `MessageList.tsx:286-300` — `mapSenderToUser` is a `useCallback` keyed on `[members]`. When the `members` state object updates (which happens after the optimistic message is added — member subscription firing, lookup resolving, etc.), `mapSenderToUser` gets a new function identity.

2. `MessageList.tsx:405-441` — `mapSenderToUser` is in `rowRenderer`'s `useCallback` dep array (line ~417). New `mapSenderToUser` identity → new `rowRenderer` identity → Virtuoso receives a new `itemContent` reference and re-invokes `rowRenderer(100)` for the visible message.

3. `MessageList.tsx:323-326` (the R4 refs we added) — `messageListRef` and `messageDisplayInfoRef` are updated synchronously on every render. By the time the re-invoked `rowRenderer(100)` reads `messageDisplayInfoRef.current[100]`, `messageDisplayInfo` has been recomputed in the parent render — and `isCompact` for index 100 may now be `true` (because `messageDisplayInfo`'s useMemo re-ran in the same render cycle that updated members).

4. `MessageList.tsx:338-340` — `gapClass = displayInfo.isCompact ? 'message-row message-row-first' : 'message-row'`. When `isCompact` flips, the wrapper's class changes.

5. `Message.scss:325`: `.message-row { margin-top: 24px }` — and `Message.scss:336`: `.message-row-first { margin-top: 0 }`. **The 24px delta is the margin difference.** Virtuoso measures items including margin, so the row goes from 74px (50 content + 24 margin) to 50px.

**Two important implications:**

A. **The shrink IS an `isCompact` flip after all** — but triggered by `members` data resolving asynchronously, not by the cache-write predecessor change we originally theorized. Fix C's *premise* was right (freeze isCompact for pending), but the trigger I targeted (cache mutation) was the wrong one. With the correct trigger understood, Fix C *could* be implemented properly. But we have a better option (see Session 12).

B. **R4 (the ref-based stabilization, commit `dd966df7`) is implicated in the OBSERVED mechanism.** Agent: *"this is the R4 fix's exact vulnerability: `messageDisplayInfoRef.current` is written synchronously at MessageList.tsx:326 on every render, so by the time rowRenderer reads it, it may already reflect a different isCompact value than was used for the original render."* This doesn't mean R4 caused the bug (the same flip would happen pre-R4 via a different observation path) — but it DOES mean R4 is not "neutral" as previously labeled. Whether R4 should stay needs reassessment (see Session 12).

C. **Important caveat about the agent's recommendation:** The agent suggested adding a `console.log` to confirm. We're skipping that step because we have a better-targeted approach already on the table (the hybrid wrapper, Session 12) that doesn't depend on closing this specific trigger. The diagnosis is solid enough to act on.

**Also re-confirmed in Session 10 telemetry but worth re-stating here:** the sender-side B2 (85px confirm-cycle jump) is the SAME mechanism as receiver-side B2 — items mounting above the viewport when the cache mutates. So a single architectural fix on the anchoring side addresses both bugs in both directions.

### Session 12 (2026-05-24): User proposed "thin Virtuoso wrapper" — commit inventory + plan-first

**User's proposal (paraphrased):**

> Build a thin wrapper that owns scroll anchoring. Keep Virtuoso for the hard parts it actually solves (dynamic-height measurement, windowing, item recycling). Strip the parts that fight us: `followOutput`, `alignToBottom`, scroll-anchoring-on-measurement. Concretely: `followOutput={false}` always, then implement "scroll-to-bottom-on-cache-write-while-user-is-anchored" ourselves. Maybe 200-400 lines of our code on top of Virtuoso's 10K lines of solved problems.

**Assistant assessment:**

This is the right architectural move. Reasoning:
- Virtuoso's measurement-callback bug runs internally — we cannot patch it. Every "close one trigger" fix leaves other triggers open.
- But the *visual consequence* of the bug is "scrollTop has the wrong value after a measurement." We CAN write the correct scrollTop ourselves, AFTER the wrong write, AS LONG AS we have a reliable signal for when to do it.
- "Cache write while user was anchored at bottom" is a clean, reliable signal. We have full control over both halves (cache writes flow through `MessageService.addMessage`; user-anchored state is observable from a scroll listener).
- The current rAF snap loops are a degenerate version of this — they fire on `followOutput`, which doesn't fire on receiver-side when `hasNextPage=true`. That's why receiver-side is broken. Restructuring around `addMessage` events instead of `followOutput` closes the gap.

**Why this kills the entire bug class** (not just one trigger):
- We don't try to prevent Virtuoso's wrong write. We let it happen, then overwrite it.
- It doesn't matter WHICH measurement triggered Virtuoso's bad math (row shrink, item mount above viewport, image load, etc.) — we correct the consequence regardless of the cause.
- Future code changes that introduce new dynamic heights won't reintroduce the bug.

**Commit inventory + dispositions** (settled with user before any new code):

| Commit | Description | Disposition |
|---|---|---|
| `58e4c1f0` | docs split + diagnosis | KEEP — the receipts |
| `308795ad` | throwaway instrumentation | KEEP THROUGH TESTING, REMOVE before PR |
| `09361de7` | Fix R3 (cap overscan 800→300) | KEEP — real improvement, survives β |
| `528ba7fd` + `db456a68` | Fix R2 + revert | LEAVE — already reverted, git history fine |
| `dd966df7` | Fix R4 (stable rowRenderer via refs) | **TBD — pending user decision in Session 12** |
| `ebdf0913` `35a24473` `d22feb7d` | doc updates | KEEP — documentation |

R4 decision pending: agent flagged R4's refs as part of the observed mechanism. With β in place, R4 becomes "render efficiency only, no longer relevant to the bug." Three options: keep (smaller diff narrative), revert (cleaner pre-β state), or rewrite (after β is in place). Awaiting user input.

**Next:** write the β plan in plain-language reasoning (for a junior-dev reader who needs to evaluate philosophy, not code), then user reviews before any code is written.

### Session 13 (2026-05-24): β plan — application-owned scroll anchoring

**R4 disposition:** KEEP (user-confirmed). Stays as a render-efficiency improvement; bug-fix role superseded by β.

---

## β: application-owned scroll anchoring

### Goal

Eliminate both observable bug classes (B1 sender-side ~24-85px, B2 receiver-side ~130px). Not reduce — eliminate. Process discipline: do not ship with residual jank.

### Rationale

Sessions 2-12 established that Virtuoso's measurement callback writes incorrect `scrollTop` values in response to measurement events, and that the library has many independent measurement triggers (row resize, item mount above viewport, function-reference identity change, array-reference change, image load, late member-data resolution — Sessions 5, 10, 11). Each per-trigger fix attempt (R2, R3, R4, C) closed at most one trigger while leaving others open. R3 reduced amplitude via overscan capping but did not address the underlying class of bug.

**The architectural reframing is to target the consequence rather than the cause:** let Virtuoso's measurement callback write whatever `scrollTop` it computes, then overwrite that value at the application layer when a cache write occurs while the user is anchored at bottom. The trigger inventory becomes irrelevant — every measurement event resolves to either "user was anchored, snap to bottom" or "user was not anchored, leave the scroll position alone."

This is the pattern used by Discord and Element (custom virtualizers with application-owned anchoring) and corresponds to Virtuoso's commercial `@virtuoso.dev/message-list` product, which exists because the open-source `followOutput` API has insufficient guarantees for chat. We adopt the same pattern at the application layer.

### Mechanism

A `useScrollAnchor` hook in `src/components/message/`:

1. **Scroll-position tracker.** Passive scroll listener on the Virtuoso scroller element. Maintains `isAtBottomRef: boolean` based on `(scrollHeight - clientHeight - scrollTop) < THRESHOLD`. Threshold = 50px (consistent with `useScrollTracking`).
2. **Cache-write subscription.** Subscribes to the React Query cache via `queryClient.getQueryCache().subscribe()` filtered to `buildMessagesKeyPrefix({ spaceId, channelId })`. On `updated` events where the data added items at the end of the last page, evaluates `isAtBottomRef`. If true, schedules a snap via `requestAnimationFrame` (next paint) and a second snap on the following frame (defense against Virtuoso's measurement callback overwriting in the intervening frame).
3. **Imperative snap.** Returns a `snapToBottom()` function for callers that need to force-pin (jump-to-present button, post-send handler).
4. **Initialization guard.** Snapping is gated on a `hasInteractedRef` flag set true on the first scroll event, preventing spurious snaps during initial mount when `initialTopMostItemIndex` is still doing its work.
5. **Suppression interop.** Respects the existing `hasJumpedToOldMessage` state — when true, all auto-snap is disabled, matching current `followOutput` semantics.

### Scope of change

**Modified:**
- `MessageList.tsx` — `followOutput` reduced to `followOutput={false}` (always). The existing rAF + setTimeout snap loop in the `followOutput` body (lines 619-646) is removed. `useScrollAnchor` is mounted; exposed snap function wired into `useImperativeHandle` for parent callers.
- `DirectMessage.tsx` — the `setTimeout(snap, 100/300/600)` block in `handleSubmitMessage` (lines 360-371) is removed. Post-send anchoring is handled by `useScrollAnchor` reacting to the optimistic `addMessage` cache write.
- `Channel.tsx` — verify and remove any analogous ad-hoc snap calls. Pre-implementation grep needed.

**Added:**
- `src/components/message/useScrollAnchor.ts` (~80 lines).

**Unchanged:**
- `react-virtuoso` dependency, version, and core configuration (`alignToBottom`, `firstItemIndex`, `initialTopMostItemIndex`, `computeItemKey`, `itemContent`, `rangeChanged`, overscan, `atTopStateChange`, `atBottomStateChange`).
- All other Virtuoso usages (`Channel.tsx` members, `EmojiPicker.tsx`, `SearchResults.tsx`, `PinnedMessagesPanel.tsx`, `BookmarksPanel.tsx`).
- Hash navigation, `scrollToMessageId`, jump-to-present button, new-messages-separator dismissal, pagination top/bottom triggers, thread panel reuse of `MessageList` with `alignToTop={true}`.

### Risk register

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Visible single-frame flash if Virtuoso writes wrong `scrollTop` before our `rAF` snap lands. | Telemetry verification post-implementation. Fallback: snap via `useLayoutEffect` synchronous with the React render that processes the cache update, ahead of paint. |
| R2 | False positive snap (user is scrolled up but `isAtBottomRef` reports true). | 50px threshold matches existing `useScrollTracking` convention. Verified in production via that hook. |
| R3 | Pagination cache writes (load-previous-page) misclassified as "new messages at bottom." | Hook filters on whether the cache update appended to the last page (vs prepended to the first page). The two paths take different code routes in `MessageService` already. |
| R4 | Conflict with imperative scrolls (hash nav, scrollToMessageId, jump-to-present). | Hook respects `hasJumpedToOldMessage` flag (same suppression mechanism currently used by `followOutput`). |
| R5 | Snap fires during initial mount before Virtuoso has measured. | `hasInteractedRef` gate — snapping is only enabled after the first user scroll event confirms the scroller is mounted and measured. |
| R6 | Cache-subscription churn impacts performance at 100K-1M message scale. | Subscription is filtered by query key prefix and runs synchronously per update; cost is O(1) per cache write. No iteration over message list. |

### Acceptance criteria

Pre-existing instrumentation captures all relevant signals. Pass criteria:

- **Sender-side telemetry:** zero suspect events (`🔴 scroll-untracked` with negative Δ) across 3 consecutive captures. `item-resize` events may still occur but must not be followed by negative scrollTop deltas.
- **Receiver-side telemetry:** same — zero suspect events across 3 consecutive captures.
- **Functional regression checks (manual):**
  - Hash navigation: clicking a search result scrolls to and highlights the message.
  - `scrollToMessageId`: auto-jump-to-first-unread positions the new-messages-separator in view.
  - Jump-to-present: button appears when scrolled up; clicking snaps to the latest message.
  - Pagination top: scrolling to top triggers `fetchPreviousPage` and preserves position.
  - Thread panel: opens, scrolls, and behaves identically to current.
  - New-messages separator: appears and dismisses on visibility transition.

### Failure mode

If acceptance criteria are not met after R1 mitigation (synchronous `useLayoutEffect` snap), β does not ship. Bug remains open. Next architectural step (custom virtualizer following Discord/Element pattern, or commercial `@virtuoso.dev/message-list` evaluation) is reopened in a new session.

### Diff estimate

~100-150 lines net change: ~80 line addition (`useScrollAnchor.ts`), ~30 line removal (existing snap loops), ~10 line modification across MessageList/DirectMessage/Channel call sites.

---

## Status: β PLAN READY — awaiting user approval before implementation

Currently kept on branch `fix/virtuoso-scroll-jank`:
- Commit `58e4c1f0`: docs split + diagnosis recorded.
- Commit `308795ad`: throwaway instrumentation — **REMOVE before ship.**
- Commit `09361de7`: Fix R3 (overscan cap) — **KEEP.** Real improvement (420→130px on receive).
- Commit `dd966df7`: Fix R4 (stable rowRenderer) — **KEEP** (user-confirmed Session 13). Was originally implicated in the observed 24px shrink mechanism; β supersedes its bug-fix role; remains as a render-efficiency improvement.
- Commit `db456a68`: revert of `528ba7fd` (Fix R2, did not help). Already reverted.
- Commits `ebdf0913` `35a24473` `d22feb7d` `875a3f9a`: doc updates (Sessions 7-12).

**Pending (in order):**

1. **R4 disposition decision** — user picks: keep, revert, or rewrite. (Awaiting input as of Session 12.)
2. **Write β plan in this doc** — plain language, focused on rationale not code. User reviews and approves.
3. **Implement β** — the thin wrapper that owns scroll anchoring (`followOutput={false}` always, custom anchor logic in our code).
4. **Test β** — sender-side AND receiver-side, with instrumentation still live, until both bug classes are gone.
5. **Remove instrumentation** — `__scrollDebug.ts` + the 5 `TEMPORARY DEBUG` blocks across MessageList/DirectMessage/MessageService.
6. **Remove the obsolete rAF/setTimeout snap-back loops** (in MessageList.tsx `followOutput` body and DirectMessage.tsx `handleSubmitMessage`) — β supersedes them.
7. **Open PR.**

**Process discipline (user-stated, 2026-05-24):** do NOT accept residual jank as a known limitation. This is the most-used surface in the app; a constant visual degradation is unacceptable. Keep pushing until it's gone. No stacking of patches; revert immediately when something doesn't help.

---

*Last updated: 2026-05-24*
