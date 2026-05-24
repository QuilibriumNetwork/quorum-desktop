---
type: bug
title: "Message list scroll jank on send — Virtuoso scroll position drift"
status: in-progress
priority: high
ai_generated: true
created: 2026-03-19
updated: 2026-05-24
---

# Message list scroll jank on send — Virtuoso scroll position drift

## Symptoms

When sending/receiving a DM, the message list scrolls up instead of staying at bottom, or doesn't scroll at all to show new messages. Channels work correctly. DMs do not.

**Desired behavior** (matching Discord): when sending a message, the view should **instantly jump** to the bottom — no smooth scroll, no visual movement. This should work regardless of current scroll position.

## Definitive Root Cause

### Virtuoso's internal measurement callback resets scrollTop (DMs only)

Stack trace evidence proves the bug is **inside react-virtuoso itself**:

```
followOutput fires:     scrollTop=674, gap=0     ← correct
+0ms (after return):    scrollTop=680, gap=0     ← Virtuoso scrolled correctly!
+16ms (next frame):     scrollTop=560, gap=120   ← Virtuoso's own code RESET it
```

Stack trace: `react-virtuoso.js:2262 → :345 → :320 → :2348` — Virtuoso's item measurement callback recalculates `scrollTop` incorrectly after items are re-measured, pulling it back up by ~120px.

### Why channels work but DMs don't

**Confirmed experimentally**: A channel with few messages (`hasNextPage=false`) + same `followOutput: 'auto'` + identical Virtuoso config works perfectly. Same `MessageList` component, same props.

The DM component tree causes **more React re-renders** during Virtuoso's measurement cycle. DirectMessage has many hooks (`useConversation`, delivery receipts, accept-chat state, auto-jump effects, etc.) that trigger re-renders when the message list changes. These extra re-renders cause Virtuoso to re-measure items, firing the buggy measurement callback that resets `scrollTop`.

Channels have a leaner component tree — fewer hooks, fewer intermediate re-renders, so Virtuoso measures once and the scroll position stays correct.

**Key evidence**: Removing the major DM effects (`setAcceptChat`, `invalidateConversation`, auto-jump) did NOT fix the scroll. Other hooks in the DM tree still cause enough re-renders to trigger the bug.

### Re-renders disproven as cause (Phases 16-18)

- **Phase 16**: `React.memo` on MessageList — no effect. Parent re-renders aren't the cause.
- **Phase 17**: Disabling `showDeliveryReceipts` — no effect.
- **Phase 18**: Replacing `<Flex>` wrapper with exact same `<div>` as channels — no effect. DOM structure compared via parent chain dumps shows identical flex/overflow/height properties.

### DOM structure comparison (Phase 18)

Parent chain dumps show both DM and Channel have **identical layout properties**: same `flex: 1 1 0%`, same `overflow: auto` on scroller and `.message-list`, same hierarchy depths. The only difference is class names (`min-w-0` vs `relative`, `justify-start` vs not) — but computed styles are the same.

### New observation

On page refresh in DMs, initial scroll position is 2-3 message lines above the bottom. This suggests the issue affects initial layout too, not just `followOutput`.

### Most likely remaining cause: `sendStatus` height change

DM messages added via optimistic update have `sendStatus: 'sending'`, which renders a "Sending..." indicator (`Message.tsx:1237-1241`). When the `enqueueOutbound` completes and calls `addMessage` again (without `sendStatus`), the indicator disappears and the **message height changes**. This height change triggers Virtuoso's re-measurement callback, which recalculates and resets `scrollTop` incorrectly.

Channel optimistic updates also have `sendStatus: 'sending'` but resolve via ActionQueue which may complete faster or differently. This needs verification.

**However**, this doesn't fully explain why the initial page load scroll position is also wrong in DMs. There may be multiple contributing issues.

### What hasn't been tried

1. **Disable the "Sending..." indicator entirely** — test if removing the visual `sendStatus` indicator (Message.tsx:1237-1241) prevents the height change that triggers re-measurement
2. **Reserve space for the indicator** — give the message a fixed min-height that accounts for the indicator, preventing height change when it disappears
3. **Profile React renders** with React DevTools Profiler to see exactly which components re-render between "followOutput fires" and "+16ms scrollTop reset"

## Committed Changes (2026-03-22 baseline)

These changes are committed and confirmed not to regress channels:

### 1. DM optimistic update (MessageService.ts) — NEW
Added synchronous optimistic `addMessage` before `enqueueOutbound` in the online DM legacy path:
- `preBuiltMessage` / `preBuiltMessageIdBuffer` hoist the pre-built message
- `addMessage` with `sendStatus: 'sending'` fires before `enqueueOutbound`
- Legacy `enqueueOutbound` path reuses `preBuiltMessage` (same `messageId`) for deduplication
- Signing skipped in legacy path when `preBuiltMessage` exists

### 2. DM effects cleanup (useDirectMessagesList.ts) — CHANGED
- `setAcceptChat` effect: changed to mount-only (no `messageList` dep)
- `saveReadTime + invalidateConversation` effect: removed entirely (redundant — DirectMessage.tsx has periodic interval + unmount save via `useUpdateReadTime`)

### 3. Auto-jump effect fix (DirectMessage.tsx) — CHANGED
- Removed `messageList` from dependency array (this is a mount-only effect)
- Added `messageListLatestRef` to read current messages without triggering re-runs

### 4. followOutput workaround (MessageList.tsx)
- `followOutput` returns `false` when `isAtBottom && hasNextPage === false` (bypasses Virtuoso's broken scroll)
- Schedules aggressive rAF-based `scrollTop` correction (10 frames + delayed catches at 300ms/600ms)
- Works around Virtuoso's internal measurement callback that resets `scrollTop` at +16ms
- **Known limitation**: minor visual flash (scroll-up-then-snap-back ~1 frame) still visible

### 5. Post-send scroll-to-bottom (DirectMessage.tsx)
- `handleSubmitMessage` schedules delayed `scrollTop` corrections after sending
- Handles the case where user sends a message while scrolled up (where `followOutput` doesn't fire)

### 6. Button type fix (MessageList.tsx)
- Cast `Button` import to `React.FC<any>` to fix React version mismatch between quorum-shared and quorum-desktop

### Virtuoso config — UNCHANGED
All Virtuoso props remain at original values (`atBottomThreshold=5000`, `overscan=height`, `alignToBottom={!alignToTop}`, etc.). Changing these caused channel regression.

## Recommended Next Step: Refactor DM component tree

The root cause is structural — the DM component tree causes too many re-renders during Virtuoso's measurement cycle. The fix is to **isolate re-render-causing hooks into sibling/child components** so their state changes don't propagate through Virtuoso:

```
// Current (broken): all hooks in DirectMessage → re-renders propagate to Virtuoso
DirectMessage
  ├── useConversation()           ← re-render affects Virtuoso
  ├── useDeliveryReceipts()       ← re-render affects Virtuoso
  ├── acceptChat state            ← re-render affects Virtuoso
  └── <MessageList> (Virtuoso)    ← gets disrupted

// Proposed: hooks isolated → re-renders don't reach Virtuoso
DirectMessage
  ├── <ConversationManager />     ← re-renders stay here
  ├── <DeliveryReceiptTracker />  ← re-renders stay here
  └── <DMMessageArea>             ← lean wrapper, minimal hooks
       └── <MessageList>          ← clean render cycle, like channels
```

Key principle: **the path from "message added to cache" → "Virtuoso renders" must have zero intermediate state changes**, matching how channels work.

## Investigation Log (Phases 1-15)

### Session 1 (2026-03-19): Phases 1-8

| Phase | Approach | Result |
|-------|----------|--------|
| 1 | Composer resize race hypothesis | Rejected — jank occurs with no resize |
| 2 | `followOutput: 'auto'` vs `'smooth'` | Jank pattern reversed, same drift |
| 3 | ResizeObserver compensation | Only helped composer-resize case |
| 4 | useEffect + scrollToIndex | Same drift — scrollToIndex also overridden |
| 5 | Disable alignToBottom | No change |
| 6 | rAF correction loop | Too aggressive — opposite bounce |
| 7 | No scroll intervention | Channels perfect, DMs don't scroll |
| 8 | followOutput: 'auto' | Channels perfect, DMs still broken |

### Session 2 (2026-03-22): Phases 9-15

| Phase | Approach | Result |
|-------|----------|--------|
| 9 | DM optimistic update + `followOutput: 'auto'` | Virtuoso drifts 50ms after followOutput |
| 10 | `followOutput: false`, `alignToBottom` alone | Sends-from-bottom: OK. Others: no scroll |
| 11 | useEffect + direct scrollTop snap | Jittery, misses |
| 12 | ResizeObserver height delta | Sends-from-bottom only |
| 13 | Defer DM effects + `followOutput(() => false)` | No movement (alignToBottom is layout-only) |
| 14 | Fix atBottomThreshold/overscan + skipAnimationFrame | Still reset by Virtuoso internally |
| 14b | Same + `alignToBottom={false}` | Same — measurement callback resets scrollTop |
| 15 | Manual rAF scrollTop correction | Partial — from-bottom mostly works, jittery |
| 16 | React.memo on MessageList + stable callbacks | No effect — re-renders aren't from parent |
| 17 | Disable showDeliveryReceipts | No effect |
| 18 | Replace `<Flex>` with exact same `<div>` as channels | No effect — DOM structure is not the cause |

**Key discoveries:**
- **(Phase 14)**: Changing Virtuoso config values (`atBottomThreshold`, `overscan`) broke channels. These are load-bearing.
- **(Phase 16)**: React.memo didn't help — the re-renders causing the bug are NOT from the parent component.
- **(Phase 18)**: DOM parent chain is identical between DM and channel (same flex, same overflow, same heights). DOM structure is not the cause.
- **The remaining untested hypothesis**: the `sendStatus: 'sending'` indicator causes message height to change when it appears then disappears, triggering Virtuoso's buggy re-measurement callback.

## Session 3 (2026-05-24): Phase 19 — Reserve height for sendStatus indicator

**Hypothesis under test** (from "What hasn't been tried" #2): The visible jank is caused by the optimistic message's height changing when the `.message-status.sending` `<Flex>` is removed from the DOM after `enqueueOutbound` resolves. The element renders with `opacity: 0` for the first 1s (CSS animation-delay) so the user never sees it appear — but it still occupies layout space while mounted, then collapses when removed. That height delta triggers Virtuoso's measurement callback, which resets `scrollTop` (the +16ms bug we've been chasing).

**Change** (single, surgical):

1. `Message.tsx` (~line 1330) — replaced the conditional `{message.sendStatus === 'sending' && (<Flex …/>)}` with an always-mounted `<div className="message-status-slot">` for own messages, containing the indicator `<Flex>` only when `sendStatus === 'sending'`. Slot is rendered when `sendStatus === 'sending'` OR (`!sendStatus` AND `isOwnMessage`). Failed state stays outside the slot (rare path, intentional height change).
2. `Message.scss` — added `.message-status-slot { height: 1.5rem; }` to reserve constant vertical space. Moved the `pt-1` padding from the inline JSX class into `.message-status.sending` so the slot height matches whether the indicator is mounted or not.

**Expected effect:** message height stays constant when `sendStatus` transitions from `'sending'` → undefined. No height change → no Virtuoso re-measurement → no scrollTop reset. If correct, this should ALSO let us remove the rAF/setTimeout scroll-correction band-aids in MessageList.tsx (lines 619-646) and DirectMessage.tsx (lines 360-371).

**Caveats / known unknowns:**
- Doesn't address initial page-load scroll offset (2-3 lines above bottom on refresh in DMs). Theory: separate cause, possibly first-paint measurement with images/embeds. Re-test after this fix and treat as a separate sub-issue if still present.
- For non-own messages from the other party (received DMs), there's no sendStatus indicator at all. If receiving a message also janks the scroll, the cause is different (probably height changes from image/embed loading inside the incoming message).
- Adds a tiny constant ~1.5rem of vertical space below every own message in DMs and channels. Acceptable for the test; if confirmed working, we can decide whether to keep it visually or tighten the slot height to a smaller value.

**Status:** TESTED — **did NOT fix the bug.** Reverted 2026-05-24.

**Test result (2026-05-24, user testing):**
- No noticeable change on the front end.
- Behavior persists in **channels** (not just DMs as previously assumed):
  - Sender side: page scrolls up, then sometimes back down (non-deterministic). When it scrolls back down, the sent message is visible. When it doesn't, the sent message is below the fold.
  - Receiver side: similar up-then-maybe-down behavior when receiving a message.
- **Important re-scoping**: the bug also affects channels under some conditions. Previous Phase 18 conclusion that "channels work perfectly" may have been observed under different conditions (smaller message lists, different load state). Need to reconsider what differs between "channels worked in prior testing" and "channels don't work now."

**Why this didn't work (post-mortem):**
The `.message-status-slot` constant-height fix addressed a real height change but it's apparently not the trigger for Virtuoso's measurement-callback `scrollTop` reset. The trigger must be something else — either:
- A different element height change (delivery receipt? avatar load? image embed measurement?)
- Pure React-render-driven re-measurement (Virtuoso re-measures on certain re-renders even without height changes)
- Initial-mount measurement of the new row (Virtuoso measures the new last item, and the measurement itself perturbs scrollTop)

**Reverted:** all Phase 19 changes (Message.tsx slot wrapper, Message.scss `.message-status-slot` block, padding-top move into `.sending`).

## What to try next (untested, do NOT combine — try one at a time and revert if no effect)

1. **React DevTools Profiler instrumentation** — record a profile of a message send. Identify which component(s) re-render in the window between "followOutput fires" and "+16ms scrollTop reset". This tells us if the trigger is a height change (need to find which element) or a pure re-render (then we need to understand Virtuoso's re-measure trigger).

2. **Disable `sendStatus: 'sending'` entirely (test-only)** — short-circuit the optimistic `addMessage` call so the message is added only AFTER `enqueueOutbound` resolves (without ever having `sendStatus`). If the jank disappears, the cause is the two-step add. If it persists, the optimistic path isn't the trigger.

3. **Strip Virtuoso `increaseViewportBy` and `overscan` to minimum** — Phase 14 said changing these "broke channels." Re-verify with current code state. Possibly the breakage was a different symptom than today's bug.

4. **Pin Virtuoso to a different version** — current is whatever's in package.json. Test the latest 4.x and the latest 5.x to see if upstream has fixed the measurement-callback reset.

5. **Replace Virtuoso with native scroll** for the message list as a spike — if native scroll has zero jank, that confirms the bug is intrinsic to Virtuoso's measurement model in this codebase and we should plan a migration.

**Process rule for this bug going forward:** every attempt must be (a) recorded here BEFORE testing, (b) tested in isolation, (c) reverted immediately if it doesn't work. Do not stack patches.

## Session 4 (2026-05-24): Phase 20 — Reconnaissance, no code change

Goal: cheap diagnosis before committing to any fix path. **No code changes this phase.**

**Version check:**
- `package.json` pins `react-virtuoso: ^4.12.3`, lockfile resolves to **4.18.4**.
- npm latest: **4.18.7**.
- Changelog between 4.18.4 → 4.18.7:
  - 4.18.5 — React 19 detection for `useSyncExternalStore`
  - 4.18.6 — SSR `useWindowScroll` layout collapse fix
  - 4.18.7 — RTL horizontal scrolling fix
- **None of these touch the measurement-callback / scrollTop-reset path.** A version bump will not help.

**Upstream issue review** (Virtuoso GitHub issues, all matching our symptom, all closed without surfaced fix or workaround):
- **#1273** "followOutput and scrollToIndex incorrectly positioned after rapid list updates" (May 2025) — *almost verbatim our bug*: rapid additions → scroll stops mid-item → manual scroll then auto-scroll returns to wrong position. Closed, no resolution comment.
- **#1026** "Stick-to-bottom does not work with fast updates" (Jan 2024) — `followOutput` gets stuck when updates faster than ~40ms. Closed with "Workaround: TBD", no maintainer comment.
- **#1243** "Best way to limit chat by removing oldest message without breaking autoscroll" (May 2025) — no answer, no workaround.
- **#1145** "Unstable scroll on dynamic list" (Oct 2024) — closed, no resolution surfaced.
- **#1246** "followOutput is broken when fixedItemHeight is set" (May 2025) — not our config (we don't use fixedItemHeight), but signals followOutput fragility.
- Plus previously cited **#423** alignToBottom flickering and Cline **#4780** "fundamental to Virtuoso's algorithm."

**Conclusion of reconnaissance:**

This is a **known, long-standing, structural limitation** of Virtuoso for chat-style auto-bottom-aligned lists with frequent updates. Multiple people, multiple years, no upstream fix surfaced. The cause is in Virtuoso's measurement callback running incorrect scrollTop math after item resize/remeasure — confirmed in our Phase 14 stack trace.

**This downgrades the value of further patch-attempts in our code.** We've spent ~4 hours across 20 phases applying workarounds to a library-level bug that the maintainer has not fixed in years. Continuing to apply per-symptom fixes is unlikely to converge.

**Three viable forward paths** (must pick one — no stacking):

### Path A: React DevTools Profiler session (~1h, low risk)
Capture a profile of one message send. Confirm whether our specific trigger is identifiable (e.g. one specific component re-render or one specific height change). If yes, we may find a narrow fix. If profile shows "Virtuoso re-measures on every render regardless of height," that confirms the only remaining option is Path B or C.

**Cost:** time. **Risk:** zero (read-only investigation). **Upside:** may find a narrow fix, OR may give us definitive proof to choose Path B/C with confidence.

### Path B: Migrate the message list to `@tanstack/react-virtual` (~1-2 days, medium risk)
Tanstack-virtual is headless: we control rendering, no internal scrollTop callback to fight. Trade-offs:
- Have to re-implement: auto-scroll-to-bottom, follow-output, paginate-on-top sentinel, sticky-bottom detection, scrollToIndex (hash navigation, scrollToMessageId).
- Keep all the existing MessageList prop surface; swap the internal implementation.
- Other Virtuoso users in the codebase (search results, pinned messages, user lists) can stay on Virtuoso — they don't have followOutput jank because they don't auto-scroll.

**Cost:** 1-2 days of focused work + regression testing. **Risk:** new bugs during migration. **Upside:** permanent fix, no more workarounds.

### Path C: Replace virtualization with plain scroll + cap mounted messages (~half day, higher behavior risk)
Render only the last N (say 300) messages plus whatever the user paginated into. Plain `<div>` scroll, no virtualizer. Simplest code, smallest dependency surface.

**Cost:** half day implementation + tuning N. **Risk:** users who scroll back through thousands of messages on low-end machines may hit perf issues. **Upside:** simplest code, fewest moving parts.

### Recommendation
Path A first (cheap, zero-risk, generates evidence). Then either confirm a narrow fix or commit to Path B with confidence. Reserve Path C as the fallback if Path B turns out harder than estimated.

**Do NOT** continue patching in-place (slot height, scroll-correction loops, hook isolation) without first running Path A — we've established empirically that one-off patches don't converge.

## Research Sources

- [Issue #423](https://github.com/petyosi/react-virtuoso/issues/423): alignToBottom flickering (still present in v4.12.3)
- [Cline Issue #4780](https://github.com/cline/cline/issues/4780): Bouncy scroll — "fundamental to Virtuoso's algorithm"
- [Discussion #1083](https://github.com/petyosi/react-virtuoso/discussions/1083): skipAnimationFrameInResizeObserver fix
- Virtuoso API docs: `alignToBottom` is layout-only, `followOutput` is the only auto-scroll mechanism

---

*Last updated: 2026-05-24*
