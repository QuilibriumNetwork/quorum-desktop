---
type: spec
title: Thread Mention Notifications
status: draft
created: 2026-03-14
updated: 2026-03-14
related_docs:
  - "docs/features/messages/thread-panel.md"
  - "docs/features/mention-notification-system.md"
  - "docs/features/notification-indicators-system.md"
---

# Thread Mention Notifications

## Problem

When a user is @mentioned inside a thread reply, the mention does not appear in the Notification Panel. This is because `useAllMentions()` fetches messages via `getMessages()`, which filters out all `isThreadReply` messages at the DB cursor level. The mention is silently swallowed — the user never knows they were mentioned.

Additionally, opening a channel currently marks all messages as read (including thread replies the user never saw), which would cause thread mention notifications to disappear before the user ever sees them.

## Solution

1. Switch `useAllMentions()` from `getMessages()` to `getUnreadMentions()`, which already returns messages regardless of `isThreadReply` status
2. Add per-thread read tracking so thread mentions only clear when the user opens that specific thread
3. Add a thread breadcrumb indicator in `NotificationItem` so users know the mention came from a thread
4. Fix `NotificationPanel.handleNavigate` to accept the `threadId` that `useSearchResultFormatting` already passes

## Design

### 1. Per-Thread Read Tracking

#### New IndexedDB Store

```
Store: thread_read_times
KeyPath: threadId
Fields: { threadId: string, lastReadTimestamp: number }
Index: by_channel — compound index on [spaceId, channelId] for batch lookups per channel
```

DB migration: version 11. The `by_channel` index is needed so mention/reply hooks can fetch all thread read times for a channel in a single query without needing to know threadIds upfront.

#### When Thread Read Time Is Saved

When the user opens a thread and stays for 2 seconds (same delay pattern as channel read tracking), save `{ threadId, spaceId, channelId, lastReadTimestamp: Date.now() }`. The trigger point is in `ThreadPanel` — matching the existing pattern where `Channel.tsx` uses a 2-second interval to mark channel content as read.

When new messages arrive in an already-open thread, the read time updates on the same 2-second cycle.

#### How Mention/Reply Queries Change

The calling hooks (`useAllMentions`, `useChannelMentionCounts`, `useAllReplies`, `useReplyNotificationCounts`) change their unread logic:

- Before processing messages, fetch all `thread_read_times` for the channel via the `by_channel` index (one DB call per channel, returns all thread read times regardless of whether we know the threadIds yet)
- For each message in the results:
  - If `message.isThreadReply` and `message.threadId` exists → compare `message.createdDate` against `threadReadTimes[message.threadId].lastReadTimestamp`
  - If no thread read time exists for that threadId → the message is unread
  - If message is NOT a thread reply → use the channel `lastReadTimestamp` as before

#### afterTimestamp and Thread Messages

`getUnreadMentions()` and `getUnreadReplies()` use the channel `lastReadTimestamp` as the `afterTimestamp` lower bound for the DB cursor. This means thread reply mentions posted **before** the channel was last read will not be returned by these queries.

This is an acceptable trade-off: when a user opens a channel, channel-level read tracking advances. Any thread mentions that existed before that point would have been visible in the notification panel until then. If the user didn't act on them before opening the channel, they are considered implicitly dismissed at the channel level.

The key behavior we're protecting is: **new thread mentions that arrive after the user last read the channel will persist in notifications until the user opens that specific thread or uses "Mark All as Read."** This covers the primary use case — being mentioned in a thread you haven't opened yet.

#### Channel Read Time No Longer Clears Thread Mentions

When the channel-level 2-second timer fires in `Channel.tsx`, thread reply mentions must survive. The mention/reply hooks already handle this by checking thread read times for thread messages — so even if the channel `lastReadTimestamp` advances, thread messages are compared against their own thread read time.

#### "Mark All as Read" Clears Everything

Both the NotificationPanel "Mark All as Read" button and the Space icon context menu "Mark All as Read" action should also save thread read times for all threads that have unread notifications. This gives users a way to bulk-dismiss thread notifications without opening each thread individually.

Implementation: "Mark All as Read" should collect threadIds from the **unfiltered** notification data (not the UI-filtered list), so that thread notifications for types currently hidden by filters are also cleared. This means running a quick scan of all notifications before the UI filter is applied.

#### Cache Invalidation

When thread read time is saved, invalidate the same caches that `useUpdateReadTime` invalidates:
- `['mention-counts', 'channel', spaceId]`
- `['mention-counts', 'space']`
- `['reply-counts', 'channel', spaceId]`
- `['reply-counts', 'space']`
- `['mention-notifications', spaceId]`
- `['reply-notifications', spaceId]`
- `['unread-counts', 'channel', spaceId]`
- `['unread-counts', 'space']`

Create a dedicated `useUpdateThreadReadTime` mutation hook (preferred over extending `useUpdateReadTime`, since thread and channel read times are stored in different IndexedDB stores).

### 2. useAllMentions — Switch to getUnreadMentions()

Current: calls `getMessages()` (which filters `isThreadReply`) then filters for mentions in JS.

Change to: call `getUnreadMentions()` (which already iterates `by_conversation_time` index without filtering `isThreadReply`) with `limit: 1000`. Note: this limit counts messages that have **any** `mentions` field, not total messages — this is a behavioral improvement over the current approach which fetches up to 10,000 total messages then filters. Then apply the thread-aware unread check described above.

The `threadId` field already exists on thread reply messages, so no additional data fetching is needed to determine thread context.

No changes needed to the `MentionNotification` interface for navigation (see Section 5). The `NotificationItem` breadcrumb can read `notification.message.threadId` or `notification.message.isThreadReply` directly from the `Message` object.

### 3. useAllReplies — Add Thread Read Time Check

`getUnreadReplies()` already doesn't filter `isThreadReply`, so thread reply notifications may already appear. The change needed is applying the thread-aware unread check (compare against thread read time instead of channel read time for thread messages).

No changes needed to the `ReplyNotification` interface — `message.threadId` on the `Message` object is sufficient.

### 4. Counting Hooks — Thread-Aware Unread Check

`useChannelMentionCounts` and `useReplyNotificationCounts` use `getUnreadMentions()` and `getUnreadReplies()` respectively, which already return thread replies. But they currently compare all messages against the channel `lastReadTimestamp`.

Change: fetch thread read times for the channel (via `by_channel` index) and apply the same per-message branching logic. Thread mentions where `message.createdDate <= threadReadTimes[threadId].lastReadTimestamp` are excluded from the count.

`useSpaceMentionCounts` and `useSpaceReplyCounts` aggregate channel-level counts, so they inherit the fix automatically.

### 5. NotificationItem — Thread Breadcrumb

When `notification.message.threadId` or `notification.message.isThreadReply` exists, the notification header changes from:

```
[#] general  [@] sender-name                    [cal] date
```

to:

```
[#] general › Thread  [@] sender-name           [cal] date
```

- The `›` chevron separator uses muted color styling
- "Thread" text uses the same muted styling as the chevron
- No thread icon needed — the chevron + text is clear enough

### 6. NotificationPanel — Fix handleNavigate Signature

`useSearchResultFormatting` (used by `NotificationItem`) already extracts `threadId` from `message.threadId ?? message.threadMeta?.threadId` and passes it as the 4th argument to `onNavigate`. The `onNavigate` prop type in `NotificationItem` already includes `threadId?: string` in its signature.

The actual fix is that `handleNavigate` in `NotificationPanel.tsx` currently accepts only 3 parameters `(spaceId, channelId, messageId)` and drops the `threadId`. Change the signature to accept `threadId?` as the 4th parameter and use `buildMessageHash`:

```typescript
const handleNavigate = useCallback((spaceId: string, channelId: string, messageId: string, threadId?: string) => {
  onClose();
  // buildMessageHash returns #msg-{id} or #thread-{threadId}-msg-{id}
  const hash = buildMessageHash(messageId, threadId);
  navigate(`/spaces/${spaceId}/${channelId}${hash}`);
  // ... existing hash cleanup timeout
}, [navigate, onClose]);
```

Note: `buildMessageHash`'s second parameter is named `rootMessageId`. In our data model, `threadId` IS the root message ID (deterministic SHA-256 hash), so passing `threadId` as `rootMessageId` is correct.

The existing thread navigation system in `Channel.tsx` already handles `#thread-{threadId}-msg-{messageId}` — it opens the thread panel and scrolls to the target message.

### 7. Database Layer — New Methods

Add to `messages.ts`:

- `saveThreadReadTime({ threadId, spaceId, channelId, lastReadTimestamp })` — upsert into `thread_read_times`
- `getThreadReadTime(threadId)` — single lookup by key
- `getThreadReadTimesForChannel({ spaceId, channelId })` — batch lookup via `by_channel` index (returns all thread read times for a channel)
- `bulkSaveThreadReadTimes(entries)` — batch save for "Mark All as Read"

## Files to Modify

| File | Change |
|------|--------|
| `src/db/messages.ts` | DB migration v11: add `thread_read_times` store with `by_channel` index. Add `saveThreadReadTime`, `getThreadReadTime`, `getThreadReadTimesForChannel`, `bulkSaveThreadReadTimes` methods |
| `src/hooks/business/mentions/useAllMentions.ts` | Switch from `getMessages()` to `getUnreadMentions()`. Add thread-aware unread check using `getThreadReadTimesForChannel` |
| `src/hooks/business/mentions/useChannelMentionCounts.ts` | Add thread-aware unread check |
| `src/hooks/business/mentions/useSpaceMentionCounts.ts` | Inherits fix from channel counts (verify) |
| `src/hooks/business/replies/useAllReplies.ts` | Add thread-aware unread check |
| `src/hooks/business/replies/useReplyNotificationCounts.ts` | Add thread-aware unread check |
| `src/components/notifications/NotificationItem.tsx` | Thread breadcrumb UI (`channel › Thread`) using `message.threadId` |
| `src/components/notifications/NotificationItem.scss` | Chevron + "Thread" styling |
| `src/components/notifications/NotificationPanel.tsx` | Fix `handleNavigate` signature to accept 4th `threadId` param and use `buildMessageHash`. Update "Mark All as Read" to save thread read times from unfiltered notification data |
| `src/components/thread/ThreadPanel.tsx` | Save thread read time on 2-second delay (same pattern as channel read tracking) |
| `src/components/navbar/NavMenu.tsx` | Update `handleMarkSpaceAsRead` to also save thread read times |
| `src/hooks/business/conversations/useUpdateThreadReadTime.ts` | New hook: mutation for saving thread read time + cache invalidation |

## What We're NOT Doing

- Thread follow/unfollow system
- Thread unread indicators on ThreadIndicator or ThreadsListPanel
- Per-thread notification settings
- Thread-specific notification types in the filter dropdown
- Recovering thread mentions posted before the channel was last read (acceptable trade-off — see afterTimestamp section)

## Known Limitations

- Thread read time is only saved when the user opens the thread panel — if a user is mentioned in a thread they've never opened, the mention stays unread until they open it or use "Mark All as Read"
- No granular "mark thread as read" UI outside of opening the thread or bulk mark-all-as-read
- Thread mentions posted before the channel's `lastReadTimestamp` are not recovered — the DB cursor's lower bound excludes them. New mentions after the last channel read are properly tracked.

---

_Created: 2026-03-14_
