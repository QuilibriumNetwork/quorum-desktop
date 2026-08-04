---
type: task
title: "DM unread dot never clears — the list renders a frozen snapshot of the conversation rows"
status: open
priority: high
created: 2026-08-01
updated: 2026-08-01
severity: UX (the DM list lies about read state; the primary daily-use surface)
area: DM contacts list / read-state propagation (React Query cache shape)
repos: quorum-desktop (implement here). quorum-mobile is affected by a DIFFERENT,
  unrelated gap — see §6. Do NOT implement mobile changes from this task.
related:
  - .agents/issues/.done/dm-mark-all-read-no-immediate-ui-update.md (same fingerprint,
    fixed by overlaying a context instead of fixing the staleness — see §1.3)
  - .agents/docs/features/notification-indicators-system.md (documents the invalidation
    fan-out that is missing one key)
---

# DM unread dot never clears

## §0. What the operator sees

1. Open a DM, read it, leave without replying → the unread dot is still on the row.
2. Exchange messages in a DM, leave → the unread dot is still on the row.
3. Sometimes it clears on its own after navigating into a Space and back. That is not
   randomness, it is the sidebar unmounting and remounting (§2.3).

The NavRail "Messages" dot clears correctly. Only the per-contact rows in the DM list are
wrong. Spaces and channels are unaffected.

## §1. Root cause

**The DM list does not render the live conversation rows. It renders a frozen copy of
them held inside the previews query.**

### §1.1 The read path

[`DirectMessageContactsList.tsx:66-78`](../../src/components/direct/DirectMessageContactsList.tsx#L66-L78):

```
useConversationPolling()                 → fresh rows from IndexedDB every 2s ✅
  └─ useConversationsWithProfileBackfill()  (pass-through)
       └─ useConversationPreviews()
            → useQuery(['conversation-previews', messageIdMap])
              queryFn returns { ...conv, preview, previewIcon }
              ── a FULL COPY of every conversation row, including
                 lastReadTimestamp and timestamp
                 └─ unread = c.lastReadTimestamp < c.timestamp   ← reads the COPY
```

The `unread` flag is computed at
[`DirectMessageContactsList.tsx:502-507`](../../src/components/direct/DirectMessageContactsList.tsx#L502-L507)
(expanded list) and
[`:348-351`](../../src/components/direct/DirectMessageContactsList.tsx#L348-L351)
(collapsed strip) — both off `conversationsWithPreviews`, i.e. off the copy. The live
polled row is never consulted for read state.

### §1.2 Why the copy never refreshes

[`useConversationPreviews.ts:16-22`](../../src/hooks/business/conversations/useConversationPreviews.ts#L16-L22)
keys the query **only on `conversationId:lastMessageId` pairs**:

```ts
const messageIdMap = useMemo(
  () => Object.fromEntries(conversations.map((c) => [c.conversationId, c.lastMessageId])),
  [conversations.map((c) => `${c.conversationId}:${c.lastMessageId}`).join(',')]
);
return useQuery({
  queryKey: ['conversation-previews', messageIdMap],
  staleTime: 30000,
  refetchOnWindowFocus: false,   // and there is no refetchInterval
  ...
});
```

Reading a DM advances `lastReadTimestamp`. It changes **no** `lastMessageId`. So the key
does not change, and React Query keeps serving the pre-read snapshot. `staleTime: 30000`
is not a 30-second self-heal: a stale query only refetches on a new observer mounting, on
window focus (disabled here), on reconnect, or on invalidation. A re-render of a mounted
observer does nothing. **The snapshot is stale indefinitely while the sidebar stays
mounted.**

### §1.3 The missing invalidation

[`useUpdateReadTime.ts:38-96`](../../src/hooks/business/conversations/useUpdateReadTime.ts#L38-L96)
invalidates nine keys after the DB write — `Conversation`, `mention-counts` ×2,
`reply-counts` ×2, `mention-notifications`, `reply-notifications`, `unread-counts` ×3,
`Conversations/direct`. It never invalidates `['conversation-previews']`.

The invalidator that *does* cover it,
[`useInvalidateConversation.ts:16`](../../src/hooks/queries/conversation/useInvalidateConversation.ts#L16),
is not the one this mutation uses.

### §1.4 Corroboration — this has been patched around twice already

- [`dm-mark-all-read-no-immediate-ui-update.md`](../.done/dm-mark-all-read-no-immediate-ui-update.md)
  records exactly this fingerprint (rail dot clears, contact rows don't) and was closed by
  building [`DmReadStateContext.tsx`](../../src/context/DmReadStateContext.tsx) to overlay
  a forced read timestamp on top of the stale list. The cause was never removed.
- The `primaryUsername` re-attach hack at
  [`DirectMessageContactsList.tsx:70-78`](../../src/components/direct/DirectMessageContactsList.tsx#L70-L78)
  exists because the same snapshot also drops QNS names attached after it was taken. Its
  own comment says so.

Two independent workarounds for one cause is the strongest signal that the cause is worth
fixing rather than papering over a third time.

## §2. Why each symptom follows

### §2.1 Opened, read, left without replying
DB updated ✅ → poll returns the correct row ✅ → previews key unchanged → stale snapshot
rendered → dot stays. Direct hit.

### §2.2 "Still there after I replied"
While you are inside the DM the dot is suppressed regardless of state, by
`props.unread && address !== props.address`
([`DirectMessageContact.tsx:103`](../../src/components/direct/DirectMessageContact.tsx#L103)).
So the visible sequence is:

1. Peer's message lands → new `lastMessageId` → key changes → snapshot recomputed as
   `unread: true`. Correct at that instant.
2. You are in the conversation; the dot is hidden by the active-row rule.
3. You read it. The 2s interval writes the read time to IndexedDB. No `lastMessageId`
   changed, no previews invalidation → **the `unread: true` snapshot survives.**
4. You leave. The active-row suppression lifts. Dot.

### §2.3 Why it sometimes clears by itself
Navigating to a Space swaps the sidebar and unmounts `DirectMessageContactsList`. Coming
back mounts a new observer on an already-stale query → `refetchOnMount` fires → fresh
snapshot. This is why it reads as "keeps showing" rather than "always shows", and it is
the reason the bug has survived: the obvious manual re-test accidentally clears it.

## §3. ⚠️ The defect that MUST land in the same PR

[`MessageService.ts:3396-3407`](../../src/services/MessageService.ts#L3396-L3407) — the
optimistic conversation-row write on outbound DM send:

```ts
await this.addOrUpdateConversation(
  queryClient,
  address,
  Date.now(),           // timestamp — evaluated AFTER encrypt + enqueue
  message.createdDate,  // lastReadTimestamp — stamped BEFORE all of that
  ...
);
```

`Date.now()` here is strictly later than `message.createdDate`, so the row it writes is
`lastReadTimestamp < timestamp` — **unread the instant you send a message.**

Today the previews snapshot masks this, because that optimistic write keeps the old
`lastMessageId` and therefore never reaches the rendered copy. **Remove the mask in §4.1
and this becomes a new, louder bug: every message you send marks its own conversation
unread.** Both must land together.

Fix: pass `message.createdDate` for both arguments (or `Math.max` of the two). Verify the
same shape at [`:3664-3670`](../../src/services/MessageService.ts#L3664-L3670) and
[`:3806-3812`](../../src/services/MessageService.ts#L3806-L3812) while in there — see §5.

## §4. Slices

Each slice ends in something observable without reading a diff.

### §4.1 — Slice 1: the DM list reads live read-state (+ §3)

**Change:** make `useConversationPreviews` stop copying conversation rows. It should
return only the preview payload — `Map<conversationId, { preview, previewIcon }>` keyed by
`lastMessageId`, which is the only thing that genuinely needs caching. Merge it onto the
live polled rows at render time in `DirectMessageContactsList`.

Then apply the §3 fix in the same commit.

**Why this shape and not just adding the missing invalidation:** invalidating
`['conversation-previews']` from `useUpdateReadTime` fixes today's symptom and leaves the
trap armed for every other field on the row — it already caught `primaryUsername`, and it
will catch the next one. It also forces a re-read of N messages from IndexedDB on every
read-time write. Option B is the acceptable hotfix if this needs to ship before the
refactor is reviewed; it is not the destination.

**Operator-visible outcome:**
- Open a DM, read it, click away → dot gone immediately, name back to normal weight.
- Exchange messages, leave the conversation → no dot.
- Send a message to a quiet contact → that contact does **not** acquire a dot.
- Preview text and timestamps still correct and still update on new messages.

### §4.2 — Slice 2: delete the workarounds the fix makes redundant

Only after Slice 1 is operator-verified.

- Drop the `primaryUsername` re-attach block
  ([`DirectMessageContactsList.tsx:70-78`](../../src/components/direct/DirectMessageContactsList.tsx#L70-L78)) —
  live rows already carry it.
- Evaluate removing [`DmReadStateContext`](../../src/context/DmReadStateContext.tsx)
  entirely. "Mark all as read" writes to the DB and the list now reads the DB, so the
  forced-timestamp overlay should be dead weight. Consumers to check:
  `DirectMessageContactsList`, `useDirectMessageUnreadCount`, `useSpaceContextMenu`.

**Operator-visible outcome:** "Mark all as read" from the DM context menu still clears
every dot instantly, with the overlay gone. QNS `name.q` names still render in the list.

### §4.3 — Slice 3: a regression test that would have caught this

The failure is not visible in a component snapshot — it needs the *sequence*. Cover:
"row is unread → read time is written → row is read", asserting on what the list computes,
with no `lastMessageId` change anywhere in between. See [`.agents/tasks/messagedb/`](messagedb/)
for the existing DB-test harness conventions.

**Operator-visible outcome:** a named test in the suite that fails on `main` and passes on
the branch.

## §5. Secondary defects found in the same area

Real, independently reproducible, **not** required for §4. Each is small enough to be its
own PR; none should be bundled into Slice 1.

| # | Where | Problem |
|---|---|---|
| 1 | [`MessageService.ts:3664`](../../src/services/MessageService.ts#L3664), [`:3806`](../../src/services/MessageService.ts#L3806) | Init path passes `lastReadTimestamp: 0` hardcoded into `addOrUpdateConversation`, force-marking an already-read conversation unread in the list cache. Should pass `conversation?.conversation?.lastReadTimestamp ?? 0`. |
| 2 | [`MessageDB.tsx:374`](../../src/components/context/MessageDB.tsx#L374) vs [`messages.ts:1367`](../../src/db/messages.ts#L1367) | `conversation.timestamp` is written from two different clocks — `envelope.timestamp` (server/inbox) on one path, `message.createdDate` (sender) on the other. The entire unread comparison hangs off this field. Pick one and document it. |
| 3 | [`messages.ts:1367`](../../src/db/messages.ts#L1367) | `saveMessage` sets `timestamp` and `lastMessageId` unconditionally, no `Math.max` guard. `MessageService.saveMessage` re-puts the **target** message when a reaction arrives, so reacting to an old message **regresses** the conversation's timestamp, sort position, preview and `lastMessageId`. |
| 4 | [`messages.ts:1042-1066`](../../src/db/messages.ts#L1042-L1066) | `saveReadTime` reads the row in a `readonly` transaction and writes the whole spread row back in a separate `readwrite` one. A message landing in between is silently clobbered. Should be a single `readwrite` transaction and monotonic: `Math.max(existing.lastReadTimestamp ?? 0, ts)`. |
| 5 | [`MessageService.ts:5647`](../../src/services/MessageService.ts#L5647) | Inbound DM `saveMessage` omits `currentUserAddress`, so a self-echo arriving from your own second device does not advance `lastReadTimestamp`. Every other call site passes it. |
| 6 | [`useDirectMessagesList.ts:73-84`](../../src/hooks/business/conversations/useDirectMessagesList.ts#L73-L84) | `saveReadTime` is exported and never consumed — a second, divergent read-time write path (it uses `useInvalidateConversation`, which is the *correct* invalidator) sitting there waiting to be wired up by mistake. Delete it, or make it the one true path. |
| 7 | [`useDirectMessageUnreadCount.ts:65`](../../src/hooks/business/messages/useDirectMessageUnreadCount.ts#L65) | `staleTime: 90000` means the NavRail dot is correct only as long as every write path remembers to invalidate `['unread-counts', 'direct-messages']`. It works today; it is the same class of fragility as §1.3. |

Defect 6 is worth doing alongside Slice 2 — it is three lines and it removes a live
footgun.

## §6. Mobile — different problem, do not fold it in

This fix does not carry over. Mobile's DM unread indicator is not wired up at all:

- `quorum-mobile/app/(tabs)/messages/index.tsx:209` and
  `quorum-mobile/components/Chat/DirectMessagesList.tsx:86` both compute
  `hasUnread = conv.lastReadTimestamp ? conv.timestamp > conv.lastReadTimestamp : false`.
  The truthiness guard means `0`/`undefined` reads as **read** — the opposite of desktop's
  `(lastRead ?? 0) < timestamp`, so a never-opened conversation shows no dot.
- **Nothing in the mobile repo ever writes `lastReadTimestamp`.** The only occurrence
  outside type declarations is `lastReadTimestamp: undefined` in
  `quorum-mobile/components/NewConversationModal.tsx:169`. There is no `saveReadTime`
  equivalent anywhere.

So the mobile badge can never turn on, and if it did there would be no way to turn it off.
Mobile already tracks this: `quorum-mobile/.agents/tasks/.todo/2026-06-18-channel-unread-dot-lastread-timestamp.md`
opens with "No per-channel last-read timestamp."

**Therefore:** do not treat "check it on mobile" as a verification step for this task —
there is nothing there to verify. Mobile needs its own task to build the read-state write
path first. When it does, adopt desktop's `(lastRead ?? 0) < timestamp` semantics so the
two platforms agree on what a fresh conversation means.

## §7. Verification (desktop, two accounts)

Nothing here is checkable from a diff. Run all of it manually before closing.

1. **Read, no reply.** B sends to A → A's list shows the dot → A opens the DM, waits 3s,
   clicks another contact → **dot gone immediately**, name weight back to normal.
2. **Full exchange.** B sends → A opens → A replies → B replies → A reads → A leaves →
   **no dot**.
3. **Send to a quiet contact** (the §3 case). A sends to C, who has said nothing → C's row
   **never** acquires a dot, not even for a frame.
4. **Genuine unread still works.** A is on a Space screen; B sends → A's DM list shows the
   dot and the NavRail dot, and the row sorts to the top with the right preview.
5. **Mark all as read** from the DM context menu clears every dot instantly (regression
   guard for Slice 2).
6. **Collapsed strip.** Repeat 1 and 4 with the sidebar collapsed — it renders from the
   same array ([`:346-351`](../../src/components/direct/DirectMessageContactsList.tsx#L346-L351))
   and must behave identically.
7. **Muted conversations** stay dot-free throughout.
8. **No unmount cheating.** Never navigate into a Space and back while checking — that
   remounts the sidebar and refetches the query, which hides the bug (§2.3). Click between
   DM contacts only.

---
*Last updated: 2026-08-01*
