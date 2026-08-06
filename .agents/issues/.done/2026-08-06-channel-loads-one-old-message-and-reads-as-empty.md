---
type: bug
title: "A channel you have never opened loads exactly one message — its oldest — and reads as empty"
status: done
priority: high
created: 2026-08-06
updated: 2026-08-06
severity: silent — the messages are on disk and the UI shows no error, so it reads as "this channel has nothing in it" rather than as a failure
area: channel message pagination / IndexedDB read path
repos: quorum-desktop (the same fetcher backs DMs, so both surfaces were affected)
related:
  - ".agents/docs/features/messages/auto-jump-first-unread.md"
  - ".agents/issues/.open/2025-01-08-pinned-messages-panel-clicks-and-message-list-disappearing.md"
---

# A channel you have never opened loads exactly one message — its oldest — and reads as empty

## Provenance

Found while investigating a report of channels showing as **completely empty**
until the page was reloaded. **This is not that bug** — that one is
[2026-08-06-synced-messages-never-reach-an-open-channel-so-it-stays-empty.md](2026-08-06-synced-messages-never-reach-an-open-channel-so-it-stays-empty.md),
a query-key variant mismatch, and it is the one that produces a genuinely empty
channel that a refresh fixes.

What is documented here is a separate, independently reproducible defect in the
same read path: the channel loads **one** message — its oldest — and cannot
reach anything newer. It presents as "I am not seeing the last message" rather
than as a blank channel. Both were fixed in the same session.

## Status

**2026-08-06 — shipped in PR #318.** Three defects, all measured against the real `MessageDB` on
`fake-indexeddb`, all fixed. 13-case regression suite.

Independently reviewed by two agents that had no part in writing the fix:

- **Cursor arithmetic review** — hand-traced every direction/fullness/edge
  combination, then wrote and ran its own adversarial test (25-message channel
  walked top-to-bottom) before deleting it. Verdict: no defects. Crucially it
  cleared `prevCursor`, the scroll-up path flagged as the weakest point, by
  enumerating every `getMessages(` call site in the codebase and proving the old
  and new formulas agree on all of them.
- **Test-strength audit** — rebuilt the suite in an isolated scratch copy against
  reverted source and confirmed the red/green split exactly as claimed: 5 tests
  genuinely fail without the fix, 5 are real controls exercising an untouched
  branch.

Acting on the audit, `prevCursor` gained the coverage it never had (three cases,
including a full walk to the top asserting no gaps or duplicates).

Behaviour is verified at the unit level, not yet observed in a live session with
real peers.

## Root causes

All three live in the read path that decides which slice of a channel's history
the message list is handed on mount.

### 1. "Never read" was treated as "everything is unread"

`determineInitialCursor` ([buildMessagesFetcher.ts](../../../src/hooks/queries/messages/buildMessagesFetcher.ts))
reads the conversation's `lastReadTimestamp`, defaults it to `0`, and asks for
the first message after it. For a channel that has never been opened there is no
read pointer, so `afterTimestamp: 0` returns **the oldest message in the
channel**, and the initial page is anchored there.

`Channel.tsx:933` already refuses to auto-jump in exactly this case
(`if (lastReadTimestamp === 0) return;`). The fetcher did not, so the two halves
of the same feature disagreed about where the channel starts.

### 2. `nextCursor` was gated on the page being full

`getMessages` ([db/messages.ts](../../../src/db/messages.ts)) only returned a
`nextCursor` when `messages.length === limit`. The initial page is scanned
*backwards* from the unread anchor, so it is short by definition — one message
in the never-read case. `nextCursor: null` makes `hasNextPage` false, so
`fetchNextPage()` at the bottom of the list is a no-op and **nothing newer than
the anchor can ever load** for the lifetime of that mount.

Page fullness answers "are there more in the direction I was scanning". It was
being used to answer "are there more in the *opposite* direction", which is a
different question.

### 3. Forward pages came back newest-first

Inside `request.onsuccess`, `const cursor = (event.target as IDBRequest).result`
**shadowed the `cursor` timestamp parameter** of the enclosing method. The
reverse test twelve lines below reads `if (!cursor || direction === 'backward')`
— intending "no caller cursor, i.e. initial load" — but saw the exhausted IDB
cursor, which is always `null` once the scan runs to the end. So every forward
page that did *not* stop at `limit` was reversed.

Knock-on effect: `loadMessagesAround` concatenates
`[...before, target, ...after]`, so hash navigation (`#msg-…`) and the unread
jump both rendered everything after the target backwards.

## Measurements

Against the real `MessageDB`, 50 messages saved through `saveMessage`, no read
pointer (exactly a channel that received messages and was never opened):

| | before | after |
|---|---|---|
| messages in first page | **1** (`msg-0001`, the oldest) | 50 |
| `hasNextPage` | `false` | `false` (nothing newer exists) |
| after remount + mark-read | 2, then 3, then 4 … | 50 every time |

Control arm — same channel, read pointer current: **50 of 50 before and after**,
which is what rules out the harness itself as the cause.

Stale read pointer, 20 messages, read up to #17:

| | before | after |
|---|---|---|
| first page | `msg-0001 … msg-0018` | same |
| `hasNextPage` | `false` — #19 and #20 unreachable | `true` |

Forward page ordering, 10 messages, forward from #3:

| | before | after |
|---|---|---|
| `limit: 40` (partial page) | `10,9,8,7,6,5,4` | `4,5,6,7,8,9,10` |
| `limit: 3` (full page) | `4,5,6` | `4,5,6` |

`loadMessagesAround('msg-0005')`: `[1,2,3,4,5,10,9,8,7,6]` → `[1,2,3,4,5,6,7,8,9,10]`.

## Fix

- `buildMessagesFetcher.ts` — `determineInitialCursor` returns `null` (load from
  the bottom) when there is no read pointer, matching `Channel.tsx:933`.
- `db/messages.ts` — the IDB cursor is named `idbCursor` so it stops shadowing
  the parameter; `nextCursor` is derived from "did the caller cap this scan"
  rather than from page fullness. `prevCursor` semantics are deliberately
  unchanged, to keep scroll-up pagination out of the blast radius.

Tests: `src/dev/tests/db/channelMessagePagination.test.ts` (13 cases). Five fail
on the pre-fix code, five are controls that pass either way — both verified by
rebuilding the suite against reverted source, not asserted. The remaining three
cover `prevCursor` / scroll-up, added after review pointed out that "deliberately
unchanged" had never actually been asserted anywhere.

## Resolved question

An earlier draft flagged that this defect does not explain "refreshing the page
fixes it": the never-read case *creeps* forward by one message per mount rather
than recovering, because `Channel.tsx:1347` marks the channel read at
`max(createdDate)` of the **loaded** list — which was the single stale message.

That mismatch was the tell. The reported symptom has a different cause, found
afterwards and filed separately: the sync-path refetch targeted the wrong
message-query variant, so a channel populated by sync never re-read IndexedDB
until a reload. See the linked issue.

## Also noticed, not fixed

- `getMessages` still conflates `cursor === 0` with "no cursor" (`!cursor`).
  That is now at least *consistent* across the range build, the scan direction
  and the new `hasNewer` test, so a `0` behaves exactly like "load from the
  bottom" rather than producing a mixed state. Harmless today because message
  timestamps are never `0`, but it remains a trap for anything that starts
  passing an explicit `0`.
- `Channel.tsx:1347` marking read from the loaded window rather than from the
  channel's own newest timestamp is what turned defect 1 into a slow creep. It
  is defensible on its own terms (do not mark read what was never rendered), but
  it means any future truncation of the loaded window silently rewinds the read
  pointer.

---
*Last updated: 2026-08-06*
