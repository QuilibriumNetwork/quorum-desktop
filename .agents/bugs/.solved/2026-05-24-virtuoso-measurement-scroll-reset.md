---
type: bug
title: "Virtuoso measurement callback resets scrollTop on new messages — scroll jank in channels and DMs"
status: solved
priority: high
ai_generated: true
created: 2026-05-24
updated: 2026-07-21
supersedes: ../.archived/2026-03-19-message-list-scroll-jank-on-send.md
related_doc: ../../docs/features/messages/scroll-anchoring.md
branch: fix/virtuoso-scroll-jank
---

# Virtuoso measurement callback resets scrollTop on new messages

## TL;DR

When a message is sent or received in a channel or DM, the message list jumps the scroll position incorrectly: small jumps that snap back, or larger jumps that leave the new message off-screen. Root cause is in `react-virtuoso`'s internal measurement callback (multiple GitHub issues open since 2021, unfixed). Fix is at the application layer: our own scroll-anchoring hook (`useScrollAnchor`) replaces Virtuoso's `followOutput` and handles snap-to-bottom logic ourselves on three signals (scroll position, cache updates, imperative calls from send handlers).

**RESOLVED — shipped in PR #154** (`717c8e35f fix: virtuoso scroll jank`). The threads regression flagged in Session 22 was fixed within the same PR (not a separate follow-up), so channels, DMs, and threads all landed together. Accepted residual: a single-frame visual flash on some sends that settles within ~1 frame (telemetry-clean). See Session 23 closeout and the [feature doc](../../docs/features/messages/scroll-anchoring.md).

**For ongoing reference:** see [`docs/features/messages/scroll-anchoring.md`](../../docs/features/messages/scroll-anchoring.md) — the canonical "how it works" doc for the scroll-anchoring system. That doc evolves with the code; this bug doc is the historical artifact.

## Current behavior

| Scenario | State |
|---|---|
| Channel: short send | Works |
| Channel: multi-line send | Works |
| Channel: send-from-up-in-history | Snaps to bottom (industry-standard behavior) |
| Channel: scroll-up to read history | Works, no snap-back |
| Channel: receive a message | Works |
| DM: short send | Works |
| DM: multi-line send | Works |
| DM: send-from-up-in-history | Snaps to bottom |
| DM: scroll-up | Works, no snap-back |
| DM: overscroll at bottom | Tiny visible bounce (because no bottom spacer; separate from snap logic) |
| Hash navigation `#msg-{id}` | Preserved — unaffected by the new anchoring |
| Auto-jump to first unread | Preserved |
| Jump-to-present button | Works via the hook's imperative `snapToBottom` |
| Thread panel: send reply | Fixed in #154 — explicit `snapToBottom()` on submit (see Session 23) |
| Thread panel: receive a reply while at bottom | Fixed in #154 — hook subscribes via `anchorQueryKeyPrefix` (see Session 23) |
| Thread panel: scroll-up | Works |

## Two root causes diagnosed

Both routed through Virtuoso's measurement-callback bug, but the triggers are on our side. Sessions 2-11 in the log below cover the diagnostic work.

### B1 — Sender-side compact-header flip (~24px on send)

`MessageService.ts:1911` force-sorts pending messages to the tail of the page. When `members` data resolves asynchronously after the optimistic addMessage, `mapSenderToUser` gets a new function identity, `rowRenderer` rebuilds, Virtuoso re-renders the row. The wrapper's `gapClass` toggles between `.message-row` (margin-top: 24px) and `.message-row-first` (margin-top: 0). Virtuoso re-measures the row at the new height. Its measurement callback writes scrollTop incorrectly. User sees a 24px upward jump on send.

Initially traced to the cache-mutation predecessor flip (Session 3); that theory was later disproven (Session 10) and corrected to the members-async-load mechanism (Session 11).

### B2 — Receiver-side `messageList` reference instability (~350-420px on inbound)

`MessageService.ts:1892` calls `setQueriesData` on every inbound message, returning a new `InfiniteData` object even when the relevant pages didn't change. `useChannelMessages.ts:67`'s `useMemo` re-runs `flatMap`, producing a new top-level array. MessageList sees a new `messageList` prop. Virtuoso re-evaluates its windowed view. With `increaseViewportBy={top: height, bottom: height}` (was ~800px), the rendered range briefly spans the entire list — items 0/1 mount at the top even when the user is near the bottom. Their insertion adds ~160px above the viewport. Virtuoso adjusts scrollTop backward by ~350-420px.

Mitigated by Fix R3 (overscan cap 800→300, kept). Eliminated by the hybrid anchoring hook.

### B3 (added in Session 18) — Post-snap re-window from late item-remount

After a successful snap, Virtuoso sometimes performs a LATE `item-removed`+`item-added` cycle (driven by member-data resolving, image loading, or other internal triggers). The re-mount grows `scrollHeight` without changing `scrollTop` — gap re-opens, no scroll event fires, no cache event fires. Hook has no trigger and the message ends up partially hidden.

The current hook architecture does NOT address B3 directly. Empirically, the imperative-snap-on-send (Session 18) combined with the re-armed `wasAnchoredRef` (Session 19) catches enough of B3's instances that it's no longer visibly problematic in most cases. A ResizeObserver on the scroller content was considered but not implemented — kept as a fallback if non-determinism returns.

## Final architecture (one-paragraph summary)

`useScrollAnchor` hook in `src/components/message/useScrollAnchor.ts` (will move to `src/hooks/ui/` before PR). Three signals: passive scroll listener maintains `wasAnchoredRef`; React Query cache subscription on the messages-key prefix snaps to bottom on APPEND or REPLACE when anchored; imperative `snapToBottom()` exposed on `MessageListRef` is called by send handlers in `Channel.tsx`/`DirectMessage.tsx` and by the jump-to-present button. Virtuoso's `followOutput` is permanently `false`. Anchor gate is suppressed when `hasJumpedToOldMessage` (hash nav, scrollToMessageId) or `deletionInProgress` is true — those paths are protected. Imperative snap force-sets `wasAnchoredRef=true` so a subsequent cache update from the send re-snaps.

Full reference: [`docs/features/messages/scroll-anchoring.md`](../../docs/features/messages/scroll-anchoring.md).

## Decisions made (what was tried, what we rejected)

| Option | Outcome | Why |
|---|---|---|
| Migrate to `@tanstack/react-virtual` | Rejected | Same bug class open since 2021 (Discussion #195, Issue #1093); would require rebuilding `alignToBottom` + `followOutput` ourselves |
| Migrate to plain scroll + cap-at-N | Rejected | Not viable at 100K-1M messages/channel scale targets |
| Custom virtualizer (Discord pattern) | Reserved as fallback | ~1-2 weeks of work; out of scope for this fix |
| Commercial `@virtuoso.dev/message-list` | Reserved as fallback | $168-312/seat/year; would solve the underlying problem |
| Fix R2 — stable `InfiniteData` ref | Reverted | No measurable improvement on receiver-side jump |
| Fix R3 — cap `increaseViewportBy` to 300px | **KEPT** | Real ~70% reduction in receiver-side jump magnitude (420→130px) |
| Fix R4 — stable `rowRenderer` via ref | **KEPT** | Render-efficiency win, neutral for bug after β |
| Fix C — freeze `isCompact` for pending | Reverted | Targeted the wrong cause (Session 10 disproved the predecessor-flip theory) |
| β.1-β.6 hook iterations (cache id-compare, delayed snaps, useLayoutEffect, atBottomStateChange readiness gate, pure-reactive only) | Iteratively refined, each kept or reverted based on telemetry | Six iterations to land on the current hybrid (Sessions 15-16) |
| Pure-reactive scroll listener only | Insufficient | Doesn't catch APPENDs where Virtuoso doesn't write scrollTop |
| Cache subscription only | Insufficient | Doesn't catch Virtuoso's late re-window writes |
| **Hybrid (current)** | **KEPT** | Cache subscription catches appends; scroll listener maintains anchor state; imperative snap handles send-from-up |
| Absorb branch on scroll listener | **Disabled** (Session 18 regression) | Caused user scroll-up to snap back due to anchor-state timing race; kept commented for possible smarter re-introduction |
| Explicit `snapToBottom()` on send | **KEPT** | Industry-standard behavior; sidesteps DM/Channel asymmetry from anchor-gate suppression |

## Known limitations / residuals

- **Single-frame visual flash on some sends.** The optimistic message can briefly appear partially visible before the snap lands. Settles correctly within ~1 frame. Telemetry-clean.
- **Non-deterministic edge cases.** Some message types (multi-line + image) occasionally have a less-clean landing than others. Telemetry-clean (no scrollTop drift events) but visual experience varies frame-to-frame.

(Note: earlier sessions discussed a "DM bottom spacing tighter than Channel" issue. Session 21 user-confirmed this was the temporary regression I caused while attempting the DM overlay refactor — not a pre-existing condition. After reverting that refactor, DM and Channel both behave the same way they always did. No remaining spacing issue.)

## Process discipline (user-stated, 2026-05-24)

- Do NOT accept residual jank as a known limitation. The most-used surface in the app must not have constant visual degradation.
- No stacking of patches; revert immediately when something doesn't help.
- Every change recorded in the bug doc BEFORE testing the change.
- Maintain alignment with documented features: see [`docs/features/messages/auto-jump-first-unread.md`](../docs/features/messages/auto-jump-first-unread.md) and [`docs/features/messages/hash-navigation-to-old-messages.md`](../docs/features/messages/hash-navigation-to-old-messages.md). The hook's `hasJumpedToOldMessage` suppression preserves both.

## What to check first if this regresses

In order of likelihood. (Same list lives in the architecture doc — kept here for self-contained debugging.)

1. **Did `followOutput={false}` get removed from `MessageList.tsx`?** If something restored Virtuoso's `followOutput`, the two anchoring systems will fight.
2. **Did the explicit `messageListRef.current?.scrollToBottom()` get removed from a submit handler in `Channel.tsx` or `DirectMessage.tsx`?**
3. **Did `anchorSpaceId`/`anchorChannelId` props stop being passed?** Cache subscription dies without them.
4. **Did a new cache write path start writing the messages key without growing the last page or changing the last-item reference?** Our filter wouldn't catch it; need to either expand the filter or call `snapToBottom()` imperatively from the new path.
5. **Did `MessageListRef.scrollToBottom` change shape?** TypeScript catches this.

The `__scrollDebug.ts` instrumentation captures every relevant signal — use it to characterize regressions. As of this writing, instrumentation is still in the branch and will be removed before final PR.

---

## Investigation log

Sessions 1-18 (compressed). Original session notes were considerably longer; preserved in git history of this file if needed. For the architectural conclusions, prefer the architecture doc above.

### Session 1 (2026-05-24) — Doc + branch + instrumentation
Archived the prior 273-line bug doc (20 phases of patching with no convergence). Created this doc and branch `fix/virtuoso-scroll-jank` off `main` post-PR #153. Built throwaway instrumentation: scrollTop setter wrapper, ResizeObserver per item, MutationObserver, addMessage cache hook, Virtuoso callback logging. Session start/end commands download Markdown reports. SessionStorage persistence across reloads. Auto-flag scrollTop drops >30px from non-our code as 🔴 suspect.

### Session 2 (2026-05-24) — First real capture
User ran a channel send. Telemetry showed item 100 rendered at 50px, shrank to 28px (Δ-24) ~170ms later, before any second addMessage. Visible range shifted [60..100] → [56..100] without our wrapper seeing a scrollTop write. Two findings: (1) Virtuoso has a silent-write path that bypasses our property descriptor wrapper. (2) The 24px shrink is real and pre-confirm. Multiple blind spots identified.

### Session 3 (2026-05-24) — Code-trace agent: predecessor-flip theory (LATER DISPROVEN)
Background agent traced the 24px shrink to `MessageService.ts:1911`'s pending-message sort + `shouldShowCompactHeader` in `quorum-shared/utils/messageGrouping.ts:76`. Theory: when the cache mutates after an optimistic insert, the predecessor flips from a different-sender message to a same-sender message, `isCompact` returns true, header strip removed, row shrinks. This theory was later disproven in Session 10; the real cause was members-async-load (Session 11). The Session 3 trace was a useful intermediate map but the wrong conclusion.

### Session 4 (2026-05-24) — Sender-side diagnosis confirmed with improved instrumentation
Improved instrumentation: dropped clipboard (didn't work), added native scroll event listener (catches silent writes), added child-element snapshot on item-resize. Sender-side telemetry confirmed at this point: `addMessage` → `item-added 74` → `scrollTop-set` (our snap, 505→481, Δ-24) → `item-resize 74→50`. All three theories (silent-write, height-change-trigger, compact-header) validated by single capture.

### Session 5 (2026-05-24) — Receiver-side capture: different and worse bug
User then tested receiver-side. Two backward jumps per inbound (-419, -351). 105 telemetry events vs ~40 sender. Range expanded to `[0..41]` even though user was at bottom — items mounted at the TOP of a 42-item list. The pattern was completely different from sender. Realized: not one bug, two bug classes (B1 sender, B2 receiver) with distinct mechanisms but a shared amplifier (Virtuoso's measurement callback).

### Session 6 (2026-05-24) — Receiver-side code trace: ROOT CAUSE confirmed
Background agent traced B2 to `MessageService.ts:1892` (`setQueriesData` returning new InfiniteData every call) + `useChannelMessages.ts:67` (flatMap producing new array) + `MessageList.tsx:597-598` (`increaseViewportBy={top: height, bottom: height}`, ~800px each). Combined: new array ref → Virtuoso re-windows → big overscan → items mount at top → backward scrollTop. Three audits planned: usage map, feature docs, alternatives research.

### Session 7 (2026-05-24) — Fix attempts R3, R2, R4
**R3** (cap `increaseViewportBy` to 300px): cut receiver jump 420→133px. KEPT (commit `09361de7`). **R2** (stable InfiniteData ref on no-op writes): jump went 133→124px (within noise); reverted (commit `db456a68` reverts `528ba7fd`). **R4** (stable rowRenderer via ref): jump went 124→135px (within noise); kept as render-efficiency improvement (commit `dd966df7`). Pattern: each fix closes one trigger, others remain open. Residual ~120-135px appears constant.

### Session 8 (2026-05-24) — Scale context + audit kickoff
User provided scale target: 100K-1M messages/channel, 50K+ members/space. This rules out plain-scroll as a fix path. Three background agents launched: Virtuoso-usage audit, feature-doc collation, alternatives research.

### Session 9 (2026-05-24) — Audits complete + DECISION: stay on Virtuoso
Usage audit: 6 Virtuoso usages, only MessageList has the bug. Feature-docs: 18+ behaviors hang off the message list (hash nav, auto-jump-to-unread, separator dismissal via `rangeChanged`, jump-to-present, pagination, thread panel, compact grouping, sending indicator, receipts, lazy media, date separators, lazy image loading). Alternatives research: TanStack Virtual has same bug class open since 2021; no MIT lib matches Virtuoso's chat primitives; Discord/Element wrote custom; off-the-shelf chat virtualization is empirically an unsolved problem at scale. Decision: stay on Virtuoso, fix at the application layer.

### Session 10 (2026-05-24) — Fix C attempted + REVERTED
Fix C froze `isCompact` for `sendStatus='sending'` messages. Sender-side test still showed the 24px shrink at t=5070 — 190ms BEFORE the second addMessage at t=5233. Critical insight: no cache mutation fired in the window when the shrink happened. The Session 3 predecessor-flip theory was WRONG. Fix C reverted. Also discovered sender-side has its own B2 instance (~85px jump after server-confirm cycle, same mechanism as receiver B2).

### Session 11 (2026-05-24) — Re-investigation: REAL cause found
Background agent with corrected premise (no cache mutation in the 190ms window). Found: `mapSenderToUser` (`MessageList.tsx:286`) is `useCallback([members])`. When `members` state updates asynchronously (member subscription firing post-mount), `mapSenderToUser` gets a new identity, `rowRenderer` rebuilds, Virtuoso re-invokes it. Refs from R4 are read at the new render time — `messageDisplayInfo.isCompact` may have flipped. Wrapper class toggles between `.message-row` (margin-top: 24px) and `.message-row-first` (margin-top: 0). Virtuoso re-measures the item including margin — the 24px IS the margin difference, not content. Important secondary finding: R4 is implicated in the observed mechanism (its synchronous ref-writes expose this race) but the underlying flip would happen pre-R4 too via a different path.

### Session 12 (2026-05-24) — User proposed "thin Virtuoso wrapper"
> Build a thin wrapper that owns scroll anchoring. Keep Virtuoso for the hard parts (dynamic-height measurement, windowing, item recycling). Strip the parts that fight you: `followOutput`, `alignToBottom`, scroll-anchoring-on-measurement. Concretely: `followOutput={false}` always, then "scroll-to-bottom-on-cache-write-while-anchored" ourselves. ~200-400 lines of our code on top of Virtuoso's 10K lines of solved problems.

Reframing accepted: target the consequence (Virtuoso's wrong scrollTop) rather than every cause (trigger inventory). Plan to be drafted next.

### Session 13 (2026-05-24) — β plan drafted
Plain-language plan first, then rewritten in document register for broader audience. Extracted to its own task doc at `.agents/tasks/2026-05-24-virtuoso-application-owned-scroll-anchoring.md` to keep the bug doc focused on diagnosis.

### Session 14 (2026-05-24) — Independent review: YELLOW verdict
Background reviewer agent surfaced four spec-level issues: (1) cache-subscription filter must explicitly compare last-page length before/after — original was prose-only; (2) factual error claiming "50px matches `useScrollTracking`" — that hook has no internal threshold, just wraps Virtuoso's 5000px; (3) two-rAF "defense" was hand-wavy — `useLayoutEffect` should be primary, not fallback; (4) `hasInteractedRef` first-scroll gate would break fresh-session sends — use `atBottomStateChange(true)` first-event as readiness. All four addressed in the task doc before any code.

### Session 15 (2026-05-24) — β implementation: six iterations
- **β.1** REPLACE detection by messageId-change: didn't work (optimistic and server-confirm share deterministic IDs)
- **β.2** delayed snap to catch late re-window: partial help, added complexity
- **β.3** readiness via first scroll event (not `atBottomStateChange`): correct fix — Virtuoso's initial imperative scroll DOES fire scroll events
- **β.4** REPLACE detection by object-reference comparison + seed-from-cache at subscription time: both correct
- **β.5** relax `notJumped` gate when user is anchored: needed because auto-jump-to-first-unread sets the flag at channel open and never clears it until `hasNextPage=false`
- **β.6** drop cache subscription entirely, pure-reactive scroll-listener: user-prompted reset after "whack-a-mole" feeling. ~250 lines → ~110 lines

Testing at end of session 15: single-word sender clean visually; multi-line sender had a visible single-frame flash.

### Session 16 (2026-05-24) — Architectural understanding: HYBRID needed
Multi-line UX gap revealed why pure-reactive isn't enough. When new content extends below the viewport, Virtuoso may not write scrollTop at all — scroll listener has nothing to react to. Cache subscription gives the missing signal. Architecture decision: HYBRID = scroll listener (reactive) + cache subscription (proactive). End of 2026-05-24: committed pure-reactive checkpoint as `64663d6d`, planned hybrid for next session.

### Session 17 (2026-05-25) — Visual test matrix: two distinct remaining bugs
User performed visual-only matrix (no script) with the checkpoint. Isolated: **Bug A** — snap not snapping FAR enough (composer overlay occludes the last 60-80px in Channel; existing `--composer-height` spacer not applied to DM). **Bug B** — DMs never scroll at all (telemetry shows zero scroll events; pure-reactive listener has nothing to react to). Confirmed hybrid was the right next step.

### Session 18 (2026-05-25) — Hybrid implementation + iteration findings
Cache subscription path re-added alongside scroll listener. Promoted `wasAnchored` to `wasAnchoredRef` so both effects share it. `queryClient`/`anchorSpaceId`/`anchorChannelId` wired through MessageList from Channel/DirectMessage. Visual testing: hybrid kills the always-broken cases (DMs scroll now). Non-deterministic class remains: multi-line + image sometimes works, sometimes leaves message partially hidden. Diagnostic capture revealed mechanism (B3): late `item-remove`+`item-add` cycle after the snap re-opens the gap without firing scroll OR cache events.

### Session 19 (2026-05-25) — Imperative snap on send + regression fix
User reported regression: hook fights user scroll-up (snap-back). Disabled the absorb branch (commented out). Confirmed: scroll-up works in DM, no jiggle on bottom-overscroll. But send-from-up didn't snap in DM (asymmetric with Channel). Investigated: neither submit handler had explicit snap; the asymmetry came from Channel's spacer making `wasAnchored` stay true while DM's tight layout flipped it false. Fix: added explicit `messageListRef.current?.scrollToBottom()` to both `Channel.tsx` and `DirectMessage.tsx` send handlers (industry-standard behavior matches Discord/Slack/Telegram). Also force-set `wasAnchoredRef=true` inside `snapToBottom()` so a subsequent cache update from the send re-snaps. All cases now snap correctly. Remaining issue: DM's tight bottom layout (a layout problem, not a snap problem).

### Session 20 (2026-05-25) — Doc reorganization + DM composer-overlay refactor planned
Bug doc had grown to 800+ lines. Extracted the canonical "how it works" content to a new architecture doc at `.agents/docs/features/messages/scroll-anchoring.md`. Restructured this bug doc with TL;DR + current behavior + decisions + receipts at the top, collapsed session log at the bottom. Next: apply PR #153's composer-overlay treatment to DM, address the tight-spacing layout issue identified in Session 17 (Bug A).

### Session 21 (2026-05-25) — DM composer-overlay attempted + REVERTED (caused regression in BOTH layouts)
Applied PR #153's composer-overlay pattern to DM: added `chat-area` class + `composerContainerRef` + ResizeObserver mirroring Channel.tsx; moved accept-chat warning inside `.message-editor-container` per Treatment A; changed DM's `.message-editor-container` SCSS from `position: sticky` to `position: absolute`. User immediately reported a regression: page content scrolls INTO the area below the composer in BOTH DMs and Channels (text peeks out below the composer pill). Bisect by `git stash` to commit `a01ad63e` confirmed: regression was introduced today. Found root cause: **the global `.message-editor-container { position: sticky }` rule in DirectMessage.scss was overriding Channel.scss's `position: absolute` rule due to CSS import order, meaning Channel had been silently using sticky positioning all along despite Channel.scss declaring absolute.** Channel's actual mechanism was sticky-in-flow + the bottom-spacer's `var(--composer-height, $s-16)` fallback to 64px providing comfortable bottom space. When my change made DM's rule identical to Channel's (both `absolute`), Channel switched to its actual SCSS-declared `absolute` behavior, exposing a layout that had never been tested. Reverted all DM JSX + SCSS overlay changes. Kept: explicit `messageListRef.current?.scrollToBottom()` on send in both Channel and DM submit handlers (industry-standard behavior). User then confirmed the "DM tight spacing" was actually the regression I'd caused, not a pre-existing condition. Once reverted, both layouts behave identically. No remaining DM spacing issue.

### Session 22 (2026-05-25) — Cleanup + thread regression identified, fix deferred to next session

**Cleanup done:**
- Hook moved from `src/components/message/useScrollAnchor.ts` → `src/hooks/ui/useScrollAnchor.ts` (per project convention; siblings `useScrollTracking.ts`).
- `__scrollDebug.ts` renamed and moved to `src/dev/scrollDebug.ts`. Header rewritten as a permanent dev tool (no longer "TEMPORARY DEBUG"). Documents how to wire it in temporarily for future debugging.
- All production `TEMPORARY DEBUG` blocks removed: `MessageList.tsx` (3 blocks), `DirectMessage.tsx`, `MessageService.ts`.
- All diagnostic `scrollDebug.log` calls inside the hook removed; dead code (commented-out absorb branch + unused `BACKWARD_JUMP_THRESHOLD_PX` constant) removed.
- Architecture doc updated with new file paths + dev-tool location.

**Thread regression found during pre-PR sanity check.** Visual test in threads:
- Sending a reply in a thread does NOT scroll to show the reply.
- Receiving a reply while at the bottom does NOT auto-scroll to it.
- Scroll-up in threads still works (no snap-back).

**Why it regressed:** ThreadPanel passes `alignToTop={false}` so it IS bottom-anchored (like Channel/DM). Previously, Virtuoso's `followOutput` handled the auto-scroll. We set `followOutput={false}` globally on MessageList. ThreadPanel does NOT pass `anchorSpaceId`/`anchorChannelId` props (thread messages live under a different query-key shape: `{ kind: 'thread', spaceId, channelId, threadId }` rather than `['Messages', spaceId, channelId]`), so the hook's cache subscription is inert in threads. ThreadPanel's submit handler does not call `messageListRef.current?.scrollToBottom()`. End result: no auto-snap path is active for threads.

User explicitly chose to defer to a fresh session — current session is approaching compaction, threads fix deserves clean context.

**Pickup plan for fresh session:**
1. Read the bug doc TL;DR + this Session 22.
2. Read [`docs/features/messages/scroll-anchoring.md`](../../docs/features/messages/scroll-anchoring.md) for the architecture.
3. Look at `src/hooks/queries/threads/` (and grep for how thread messages are queried) to find the thread-messages query-key shape.
4. Two-part fix:
   - **Extend `useScrollAnchor` options** to accept an optional `queryKeyPrefix?: readonly unknown[]`. If provided, use it directly. Otherwise derive from `spaceId`/`channelId` as today. Back-compat preserved for Channel/DirectMessage callers.
   - **ThreadPanel** passes its `queryKeyPrefix` and adds `messageListRef.current?.scrollToBottom()` to its submit handler (mirror of what Channel.tsx and DirectMessage.tsx already do — see Session 19).
5. Test: send-in-thread, receive-in-thread (if a second account is available), scroll-up-in-thread.
6. If clean: open PR.
7. If not clean: same diagnostic loop — `scrollDebug` is in `src/dev/` waiting; temporarily import + wire from ThreadPanel.

**Note for whoever picks this up:** the prefix-passing approach was chosen over a higher-level callback because it keeps the hook's filter logic centralized. If you find that thread message updates have semantics meaningfully different from channel/DM updates (e.g. APPEND vs REPLACE definitions don't carry over), reconsider.

### Session 23 (closeout) — threads fixed, whole thing shipped in PR #154

The Session 22 pickup plan was executed and folded into PR #154 rather than a separate follow-up. Confirmed against the merged code (`git log -S` traces both changes to commit `717c8e35f`):

- **Hook (`src/hooks/ui/useScrollAnchor.ts`):** gained the optional `queryKeyPrefix?: readonly unknown[]` option (takes precedence over `spaceId`/`channelId`), and `extractLastPageMessages` now handles the flat thread data shape (`{ messages }`) as well as the channel/DM `InfiniteData<{ pages }>` shape. So APPEND/REPLACE detection carries over to threads unchanged — the reconsideration flagged above wasn't needed.
- **`MessageList.tsx`:** accepts an `anchorQueryKeyPrefix` prop and passes it straight through to the hook's `queryKeyPrefix`.
- **`ThreadPanel.tsx`:** derives `anchorQueryKeyPrefix` via `useMemo` (line ~168), passes it to `MessageList` (line ~429), and its `handleSubmitMessage` calls `messageListRef.current?.scrollToBottom()` after submit (line ~50) — mirroring Channel/DirectMessage.

All three anticipated pieces are present and merged. Runtime behavior was verified by whoever merged #154; this closeout is a code-trace confirmation, not an independent re-test. Bug marked `resolved`.

---

*Last updated: 2026-05-25*
