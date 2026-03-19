---
type: bug
title: "Message list scroll jank on send — Virtuoso scroll position drift"
status: in-progress
priority: medium
ai_generated: true
created: 2026-03-19
updated: 2026-03-19
---

# Message list scroll jank on send — Virtuoso scroll position drift

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

When sending a message (both DMs and channels), the message list visually scrolls in the wrong direction before snapping back:
- **At bottom**: send message → list scrolls up briefly, then snaps back down to show the message
- **Scrolled up**: send message → list scrolls toward bottom but overshoots/undershoots, then corrects

The jank is intermittent — sometimes it works, sometimes not. Both single-line and multi-line messages are affected. The issue is a visual bounce (scroll one direction, then snap back) rather than a clean single-direction scroll like Discord.

## Components Affected

- `src/components/message/MessageList.tsx` — Virtuoso list, `followOutput`, `alignToBottom`
- `src/components/message/MessageComposer.tsx` — auto-resize effect on send
- `src/components/space/Channel.tsx` — flex layout container
- `src/components/direct/DirectMessage.tsx` — flex layout container
- `src/styles/_chat.scss` — `.message-list` flex sizing
- `src/services/MessageService.ts` — DM vs channel message submission paths

## Related

- `.agents/bugs/.solved/message-scroll-jank-on-send.md` — Previous fix (2026-01-05) addressed a *different* scroll jank: two competing scroll mechanisms (`followOutput` smooth + manual `scrollToBottom` instant) fighting each other. That fix removed the manual calls but the underlying Virtuoso drift remained.

## Root Cause (IDENTIFIED)

**The root cause is `followOutput` and manual `scrollToIndex` calls interfering with Virtuoso's native scroll management.**

When `followOutput` returns `'smooth'` or `'auto'`, or when we call `scrollToIndex`, the explicit scroll command fights with Virtuoso's internal layout recalculation (triggered by `alignToBottom` and item measurement). This causes a ~98px drift at ~200ms that Virtuoso then self-corrects at ~800ms — resulting in visible bounce.

**Proof**: When ALL scroll intervention is removed (`followOutput={false}`, no `scrollToIndex`, no ResizeObserver), Virtuoso handles new messages perfectly on its own — `gap:0` every time with no drift:
```
[SCROLLBUG] NO-SCROLL count:1->2 atBottom:true scrollTop:0 gap:0 clientH:785
[SCROLLBUG] NO-SCROLL count:40->41 atBottom:true scrollTop:1793 gap:0 clientH:785
[SCROLLBUG] NO-SCROLL count:12->13 atBottom:true scrollTop:81 gap:0 clientH:785
```

## Current State (end of session 2026-03-19)

### What works

- **Channels (sending own messages)**: Works perfectly with `followOutput: 'auto'`
- **Channels (receiving messages)**: Minor jank (scroll down then snap up) but message is always visible
- `alignToBottom` re-enabled — needed for channels with few messages to pin content to bottom

### What doesn't work

- **DMs (sending)**: Scrolls up and hides the sent message + a few messages above
- **DMs (receiving)**: Same — scrolls up and hides messages

### Current code state

- `followOutput` returns `'auto'` when `isAtBottom && hasNextPage === false`
- `alignToBottom={!alignToTop}` (re-enabled)
- All ResizeObserver/rAF/useEffect scroll code removed
- Debug logging active with `[SCROLLBUG]` prefix in `followOutput`

### Key difference: Channels vs DMs

**Channel message submission** (`MessageService.submitChannelMessage`):
1. Creates message object with `sendStatus: 'sending'`
2. **Immediately** calls `this.addMessage()` → optimistic update to React Query cache
3. Enqueues to ActionQueue for delivery
4. The `await submitChannelMessage()` in `useMessageComposer.submitMessage` resolves AFTER the optimistic update
5. `setPendingMessage('')` fires → composer shrinks
6. `followOutput` already fired during step 2 (before composer resize)

**DM message submission** (`MessageService.submitMessage`):
1. Calls `this.enqueueOutbound(async () => { ... })` — fire-and-forget
2. The `await submitMessage()` resolves IMMEDIATELY (before the message is added to cache)
3. `setPendingMessage('')` fires → composer shrinks
4. **Later** (async), the enqueued function runs: encrypts, sends, saves, calls `this.addMessage()`
5. `followOutput` fires AFTER composer has already resized

**This timing difference is why channels work and DMs don't.**

In channels, `followOutput` fires while the composer is still at its original size, so Virtuoso's scroll calculation is correct. In DMs, `followOutput` fires after the composer has already shrunk and the layout has changed, causing incorrect scroll position.

## Investigation Log

### Phase 1: Initial hypothesis — composer resize race (REJECTED)

**Theory**: When `followOutput` returns `'smooth'`, the smooth scroll animation calculates its target. Then `setPendingMessage('')` clears the textarea, the composer shrinks, flex layout redistributes space, the message-list container grows taller, and the scroll target becomes invalid.

**Evidence against**: Diagnostic logs showed the jank happening even with NO container resize (single-line messages where `clientHeight` stays at 785px throughout). The ~338px drift occurred with no ResizeObserver events.

### Phase 2: `followOutput: 'smooth'` vs `'auto'`

Changed `followOutput` to return `'auto'` (instant) instead of `'smooth'`.

**Result**: The final position was now correct (always ended at `gap:0`), but the visual jank pattern reversed — it now scrolled down then snapped back up, instead of up then down. The drift still happens at +200ms regardless.

### Phase 3: ResizeObserver compensation (PARTIALLY EFFECTIVE)

Added a ResizeObserver on the Virtuoso scroller element to detect container height changes and compensate `scrollTop`.

**Result**: Only helped for the composer-resize case (multi-line → single-line). Did NOT help for the main issue where scroll drifts without any container resize.

### Phase 4: Disable `followOutput`, use `useEffect` scroll (SAME BEHAVIOR)

Disabled `followOutput` entirely (`followOutput={false}`) and added a `useEffect` watching `messageList.length` that calls `virtuoso.scrollToIndex({ align: 'end', behavior: 'auto' })`.

**Result**: Same drift pattern. Our `scrollToIndex` fires correctly at `gap:0`, but ~200ms later `scrollTop` decreases by ~98-120px. Virtuoso internally recalculates and shifts the scroll, then corrects itself ~600ms later.

### Phase 5: Disable `alignToBottom` (SAME BEHAVIOR)

Set `alignToBottom={false}` to test if Virtuoso's bottom-alignment recalculation was causing the drift.

**Result**: No change. Same ~98px drift at +200ms. This rules out `alignToBottom` as the direct cause of the drift (but it's needed for visual correctness with few messages).

### Phase 6: rAF correction loop (WRONG DIRECTION)

Added a `requestAnimationFrame` polling loop after `followOutput` to detect drift and snap back to bottom.

**Result**: Too aggressive — caused the opposite bounce (snap down then up).

### Phase 7: NO scroll intervention (CHANNELS FIXED, DMs BROKEN)

Disabled ALL scroll intervention: `followOutput={false}`, no `scrollToIndex`, no ResizeObserver. Virtuoso handles channels perfectly on its own (`gap:0` every time). But DMs don't scroll to show new messages at all.

### Phase 8: `followOutput: 'auto'` (CHANNELS FIXED, DMs STILL BROKEN)

Re-enabled `followOutput` returning `'auto'`. Channels work perfectly (both sending and receiving). DMs are still broken — scrolls up and hides messages.

**Root cause identified**: DMs use fire-and-forget `enqueueOutbound` for message submission, so the cache update (and thus `followOutput`) fires AFTER the composer has already resized, at an unpredictable time.

## Next Steps (for next session)

### Option A: Add optimistic update to DM online send path (RECOMMENDED)

**Why DMs don't have optimistic updates currently**: NOT a privacy or security concern. The code at `MessageService.ts:1851` already has an optimistic update path, but it only runs when `ENABLE_DM_ACTION_QUEUE && hasEstablishedSessions && !isOnline`. When **online** (normal case), the code falls through to the legacy `enqueueOutbound` path (line 1893) which does NOT do an optimistic update. The comment says: *"Use Action Queue ONLY when offline — when online, legacy path handles new devices better"*.

**The fix**: The message object is already fully created, signed, and ready at line 1824 (before the offline/online branch). We just need to add `this.addMessage(queryClient, address, address, { ...message, sendStatus: 'sending' })` before `this.enqueueOutbound()` at line 1893 for post messages. The encryption and delivery still happen async inside `enqueueOutbound` — we just show the message immediately.

**Files to modify**: `src/services/MessageService.ts` — add optimistic `addMessage` call before `enqueueOutbound` at line 1893, guarded by `isPostMessage`
**Risk**: Low — channels already use this exact pattern. The `addMessage` function already deduplicates by `messageId`, so the later `addMessage` inside `enqueueOutbound` (line 2087/2271) will just update the existing entry (removing `sendStatus: 'sending'`).
**Key detail**: The `message` variable is already in scope at line 1893 (created at line 1802) for post messages. For non-post messages (edits, reactions, delete-conversation), we should NOT add optimistic updates — those already handle their own cache updates differently.

### Option B: Fix channel receiving jank
Even with `followOutput: 'auto'`, receiving messages in channels has minor jank (scroll down then snap up). This is lower priority since the message is always visible, but worth investigating. May be the same root cause — `followOutput` interfering with Virtuoso's native handling.

Could test: for received messages (not own), disable `followOutput` and let Virtuoso handle natively (like the Phase 7 finding).

### Option C: Investigate `increaseViewportBy` / `overscan`
Both set to full window height — could be causing excessive recalculation contributing to channel receiving jank.

### Debug logging in place
`[SCROLLBUG]` prefix in `followOutput` callback — filter console by "SCROLLBUG" to see all events.

---

*Last updated: 2026-03-19*
