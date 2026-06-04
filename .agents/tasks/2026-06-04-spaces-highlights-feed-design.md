---
type: design
title: Spaces Highlights Feed — Design Spec
status: draft
created: 2026-06-04
related_docs:
  - docs/data-management-architecture-guide.md
  - docs/quorum-shared-architecture.md
  - docs/features/messages/hash-navigation-to-old-messages.md
  - docs/features/channel-space-mute-system.md
  - docs/features/messages/markdown-stripping.md
related_components:
  - src/components/discover-page/DiscoverPage.tsx
  - src/components/bookmarks/BookmarkCard.tsx
  - src/hooks/business/mentions/useAllMentions.ts
---

# Spaces Highlights Feed — Design Spec

## 1. Goal & Scope

Transform the `/spaces` route from a static three-card empty state into a **Highlights feed** — a re-engagement hub that surfaces high-signal messages (`@everyone` mentions and pinned messages) from all joined spaces in the last 30 days.

### Problem

Today, `/spaces` renders three onboarding cards (Discover / Join / Create) regardless of whether the user has joined any spaces. For users who already participate in communities, the route is empty space that adds no value — they navigate past it immediately. The route should be the user's home surface, not a permanent empty state.

### Solution

Replace the static empty state with an aggregated feed of high-signal items pulled from local IndexedDB across all joined spaces. Items are clickable cards that navigate to the source message in its channel. The three-card view is preserved as the fallback for users with zero joined spaces.

### Primary job

**Re-engagement.** "Show me what's worth my attention across all my spaces right now." The feed must have high signal-to-noise — if it shows mediocre content, users learn to ignore the page.

### In scope (v1)

- Aggregate `@everyone` mentions + pinned messages across joined spaces
- Strict reverse-chronological order
- 30-day lookback window
- Medium-density item cards (~280 chars, markdown stripped, single thumbnail for media)
- Click-to-navigate via existing hash navigation
- Respects mute state (hide muted spaces and muted channels entirely)
- Read / unread styling consistent with the sidebar
- Snapshot on mount + auto-invalidate via React Query (no live "N new items" pill)
- Keep today's three-card empty state for users with zero joined spaces

### Explicitly out of scope (v1)

- Threads in the feed (deferred to v2)
- Filter UI — per-space chips, content-type toggles (v2)
- "N new items" pill / live insertion animations (v2 if needed)
- Inline expansion / "read more" toggle
- Inline reaction interaction
- Per-user dismissal of feed items (would require config sync)
- Modifying the "no spaces joined" empty state (today's three cards stay)
- Mobile parity (separate quorum-mobile task)
- Migration of new hook to quorum-shared (waits for PR #4 unblock — see Section 8)

---

## 2. Architecture

### Routing change

The `/spaces` route currently renders `<DiscoverPage mode="spaces-empty" />` in [src/components/Router/Router.web.tsx](src/components/Router/Router.web.tsx#L140-L155), which renders the three cards via `SpacesEmpty` inside [src/components/discover-page/DiscoverPage.tsx](src/components/discover-page/DiscoverPage.tsx#L66-L100).

Change: `/spaces` renders a new `<SpacesHighlights />` component. The `SpacesEmpty` three-card view is **extracted into its own file** and reused by `SpacesHighlights` for the zero-joined-spaces fallback. The `mode="spaces-empty"` prop on `DiscoverPage` is removed.

```
/spaces
  └── <SpacesHighlights />
        ├── if (spaces.length === 0) → <SpacesEmpty />           (the existing three cards)
        ├── if (highlights.length === 0) → <HighlightsEmpty />   (simple "no highlights yet")
        └── else → <HighlightsFeed items={highlights} />
```

### Component structure

```
src/components/highlights/
  ├── SpacesHighlights.tsx     — route component, branches on state
  ├── HighlightsFeed.tsx        — renders the list
  ├── HighlightItem.tsx         — single feed card
  ├── HighlightsEmpty.tsx       — "no highlights in the last 30 days"
  ├── HighlightsSkeleton.tsx    — Suspense fallback + loading state (3 placeholder cards)
  └── SpacesHighlights.scss
```

`HighlightsSkeleton` has no prior art in the codebase (a grep for `Skeleton` across `src/components/` returns zero results). Build it from scratch using the same card structure as `HighlightItem`: avatar circle, two lines of muted-color rectangles for the source line and preview. Animate with a subtle pulse via CSS — no third-party skeleton library.

`SpacesEmpty` extracted from `DiscoverPage.tsx` into `src/components/discover-page/SpacesEmpty.tsx` so it can be imported by both `SpacesHighlights` and (if needed) legacy callers. The `mode` prop on `DiscoverPage` is removed in the same PR.

### Data layer

One new business hook: `useHighlights()` in `src/hooks/business/highlights/useHighlights.ts`. It queries the existing `messages` IndexedDB store across all joined non-muted spaces, filters for `mentions.everyone === true || isPinned === true`, applies the 30-day window, and returns a flat reverse-chronological array with denormalized metadata attached.

No new IndexedDB store. No new schema version bump. No new sync logic.

### Where it lives in the layout

`/spaces` already wraps in `<Layout>` (sidebar + main content). The `SpacesHighlights` component renders inside the main content area, identical layout slot to what the three cards occupy today. The sidebar continues to work normally — selecting any space navigates away from `/spaces` to `/spaces/:spaceId/:channelId`.

### Reuse from existing systems

| Capability | Source |
|---|---|
| Joined spaces list | `useSpaces({})` |
| Muted spaces set | `useMutedSpacesSet()` |
| Per-channel mute filtering | `getMutedChannelsForSpace()` in [src/utils/channelUtils.ts](src/utils/channelUtils.ts) |
| Hash navigation pattern | `navigate('/spaces/:spaceId/:channelId#msg-:messageId')` |
| Markdown stripping | existing utility in `src/utils/` (verify exists and is reused, not duplicated) |
| Space icon | `<SpaceIcon>` primitive |
| Avatar + display name | same lookup pattern as `Message.tsx` and `BookmarkCard.tsx` |
| Card visual structure | adapted from `BookmarkCard.tsx` |
| Cross-channel aggregation pattern | mirrors `useAllMentions.ts` |

---

## 3. Data flow & query design

### High-level flow

```
SpacesHighlights mounts
       │
       ▼
useHighlights() runs
       │
       ▼
1. Get joined spaces            (useSpaces)
2. Get muted spaces set         (useMutedSpacesSet)
3. Get user config              (for muted channels per space)
4. Filter out muted spaces
5. For each remaining space, in parallel across spaces AND channels (Promise.all outside and inside):
     For each channel in space (excluding muted channels):
       ► messageDB.getHighlightCandidates(spaceId, channelId, since)
6. Merge all results into flat array
7. Attach denormalized metadata (space, channel, sender, isUnread)
8. Sort by createdDate DESC
9. Return to component
       │
       ▼
HighlightsFeed renders array
HighlightItem renders each row
       │
       ▼
Click → navigate(`/spaces/${spaceId}/${channelId}${buildMessageHash(messageId)}`)
```

The click URL is constructed via the existing `buildMessageHash()` utility from [src/utils/messageHashNavigation.ts](src/utils/messageHashNavigation.ts) — do not hand-craft the hash string. For v1, thread replies are excluded from the feed entirely (see the next subsection), so only the `#msg-{messageId}` form is needed; the more complex `#thread-{rootId}-msg-{replyId}` form is irrelevant.

### The DB query: `getHighlightCandidates`

New method on `MessageDB` in [src/db/messages.ts](src/db/messages.ts). Same shape as the existing `getPinnedMessages` method — scan the channel via `by_conversation_time` index over a time range, filter in memory.

```typescript
async getHighlightCandidates(
  spaceId: string,
  channelId: string,
  sinceTimestamp: number,
): Promise<Message[]> {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction('messages', 'readonly');
    const store = transaction.objectStore('messages');
    const index = store.index('by_conversation_time');

    const range = IDBKeyRange.bound(
      [spaceId, channelId, sinceTimestamp],
      [spaceId, channelId, Number.MAX_SAFE_INTEGER],
    );

    const request = index.getAll(range);
    request.onsuccess = () => {
      const messages = (request.result || []).filter(
        (m) =>
          !m.isThreadReply &&
          (m.mentions?.everyone === true || m.isPinned === true),
      );
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}
```

**Three notes on the filter:**

1. **`!m.isThreadReply` is required.** The `by_conversation_time` index includes thread replies for the channel. Thread replies can carry `@everyone` and can be pinned, but they navigate via a different hash format (`#thread-{rootId}-msg-{replyId}`) and we've scoped threads out of v1. Excluding them at the DB query layer keeps the rest of the design simpler. **Caveat:** `isThreadReply` may be `undefined` on older messages predating the thread feature. JS falsy semantics (`!undefined === true`) mean those older messages WILL be included — which is correct behavior (they really aren't thread replies). Verified in `useAllMentions.ts` line 123, which uses the same `if (message.isThreadReply && message.threadId)` guard pattern.
2. **Soft-deleted messages.** Already excluded implicitly — deleted messages are removed from the `messages` store and held only in the `deleted_messages` tombstone store ([src/db/messages.ts:1241-1254](src/db/messages.ts#L1241-L1254)). No explicit tombstone filter needed.
3. **`Number.MAX_SAFE_INTEGER` upper bound** matches the existing convention in `getPinnedMessages` (other methods in the file use `Number.MAX_VALUE`; this is the right choice for the pin-style range pattern).

**Why scan + in-memory filter rather than a dedicated index:** the existing pattern in `getPinnedMessages` does the same, and the time-bounded range (30 days) keeps the scan small per channel. Adding a new index requires a `DB_VERSION` bump and migration; not worth it for v1.

### The hook: `useHighlights`

```typescript
interface Highlight {
  messageId: string;
  spaceId: string;
  channelId: string;
  createdDate: number;
  reason: 'everyone' | 'pinned'; // when both apply, 'everyone' wins (higher signal)
  // Denormalized for rendering:
  space: { spaceId: string; spaceName: string; iconUrl: string };
  channel: { channelId: string; channelName: string };
  sender: { address: string; displayName: string; iconUrl?: string };
  // Content for the preview:
  preview: string;        // stripped + truncated text
  hasMedia: boolean;
  mediaThumb?: string;
  isUnread: boolean;
  // Original message for hash nav:
  message: Message;
}

function useHighlights(): {
  highlights: Highlight[];
  isLoading: boolean;
}
```

Signature, query key, and execution:

```typescript
const { currentPasskeyInfo } = usePasskeysContext();
const userAddress = currentPasskeyInfo?.address;
const { data: spaces = [] } = useSpaces({});
const { mutedSpacesSet } = useMutedSpacesSet();
const { messageDB } = useMessageDB();
const { data: config } = useConfig({ userAddress: userAddress || '' });

// Canonical serialization of mutedChannels for the query key — see "Query key stability" below.
const mutedChannelsKey = buildMutedChannelsKey(config?.mutedChannels);

return useQuery({
  queryKey: [
    'highlights',
    userAddress,
    spaces.map(s => s.spaceId).sort(),
    Array.from(mutedSpacesSet).sort(),
    mutedChannelsKey,
  ],
  queryFn: async () => {
    if (!userAddress) return [];
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const eligible = spaces.filter((s) => !mutedSpacesSet.has(s.spaceId));

    // Parallelize across BOTH spaces and channels — the outer Promise.all
    // matters at the heavy-user tail (30 spaces).
    const perSpace = await Promise.all(
      eligible.map(async (space) => {
        const mutedChannelIds = new Set(
          getMutedChannelsForSpace(space.spaceId, config?.mutedChannels) ?? []
        );
        const channels = (space.groups || []).flatMap((g) => g.channels);
        const results = await Promise.all(
          channels
            .filter((c) => !mutedChannelIds.has(c.channelId))
            .map((c) => messageDB.getHighlightCandidates(space.spaceId, c.channelId, since))
        );
        return results.flat().map((m) => buildHighlight(m, space, /* channel + sender lookups */));
      })
    );

    return perSpace.flat().sort((a, b) => b.createdDate - a.createdDate);
  },
  staleTime: 60_000,
  refetchOnWindowFocus: true,
  enabled: !!userAddress, // prevents queryFn from running with an empty userAddress
});
```

### Suspense boundary requirement

`useConfig` is a `useSuspenseQuery` ([src/hooks/queries/config/useConfig.ts:9](src/hooks/queries/config/useConfig.ts#L9)). `useMutedSpacesSet` internally calls `useConfig`. That means `useHighlights` — which calls both `useConfig` directly and `useMutedSpacesSet` — will Suspend on the config load **before** the outer `useQuery` (and its `enabled` flag) is even consulted.

To be clear about the role of `enabled: !!userAddress`: it is **not** the auth-loading guard. Suspense handles the loading UX; `enabled` only prevents the `queryFn` from running with an empty `userAddress` (the `|| ''` fallback in the `useConfig` call would otherwise let the queryFn proceed with no user).

**`SpacesHighlights` must be wrapped in a Suspense boundary** at the route level. The cleanest place is in `Router.web.tsx` where the route is mounted:

```tsx
<RouteErrorBoundary fallback={<Navigate to="/" replace />}>
  <React.Suspense fallback={<HighlightsSkeleton />}>
    <SpacesHighlights />
  </React.Suspense>
</RouteErrorBoundary>
```

`<HighlightsSkeleton />` is the skeleton render described in Section 4 (3 placeholder cards). See the file list update in Section 2 — `HighlightsSkeleton.tsx` is a deliverable. The existing `/discover/:section` route already wraps its body in `Suspense` ([src/components/Router/Router.web.tsx:165-167](src/components/Router/Router.web.tsx#L165-L167)) — same pattern.

The `buildHighlight()` helper denormalizes metadata, computes `reason`, strips markdown, truncates text, extracts a media thumb if present, and computes `isUnread` from the per-conversation `lastReadTimestamp`.

**Sender denormalization — read once per space, not once per message.** A naive `buildHighlight()` that calls `messageDB.getSpaceMember(spaceId, senderId)` per message would issue N async DB calls for N highlights — destroying the perf budget at the tail (200 items × ~3ms = 600ms).

Instead: before the per-channel `Promise.all`, fetch the full space-members map **once per space** with a single `messageDB.getSpaceMembers(spaceId)` call (already batched at the IDB layer). Pass the resulting `Map<address, SpaceMember>` into `buildHighlight()` for lookups. Two consequences:

1. `buildHighlight()` becomes pure synchronous — no awaits inside the per-message loop.
2. Sender info is read at hook execution time, not at message receive time. Renamed users / updated avatars are picked up automatically.

If a sender address isn't in the members map (e.g., a kicked user's old message), fall back to a generic display: address-suffix + default avatar, same fallback `BookmarkCard.tsx` uses for missing senders.

Channel info is denormalized from the `space.groups[].channels[]` already in scope — no extra fetch.

### Auto-invalidation

The feed needs `['highlights']` invalidation at **five** distinct sites — four in `MessageService` for remote events (peer messages, peer pins, peer edits) and one local-user site (own pin/unpin). The first reviewer's recommendation to piggyback on the existing mention-invalidation block was rejected because that block guards on `mentions.memberIds.length > 0`, which would skip an `@everyone` with empty memberIds.

Each insertion is an independent `queryClient.invalidateQueries({ queryKey: ['highlights'] })` call.

> **Important context on MessageService's two-pass structure:** incoming messages flow through `MessageService` in two sequential phases: a **save/validation phase** (writes to IndexedDB via `messageDB.saveMessage`) and a **cache-update phase** (updates React Query caches via `queryClient.setQueriesData`). Both phases have their own `if/else` chain over `decryptedContent.content.type`. For correct invalidation, we want IndexedDB to be written first (so `getHighlightCandidates` reads the fresh value), then invalidate. **The invalidation always goes in the cache-update phase**, which runs after the save-phase has completed.

**Insertion 1 — new message with `@everyone`** ([src/services/MessageService.ts:~1937](src/services/MessageService.ts#L1937), inside the cache-update phase's `post`-message branch, after the existing `setQueriesData` block but NOT inside the `if (memberIds.length > 0)` block):

```typescript
if (decryptedContent.mentions?.everyone === true) {
  queryClient.invalidateQueries({ queryKey: ['highlights'] });
}
```

Thread replies are skipped earlier in the save phase (around line 1769) so `@everyone` thread replies never reach this point — consistent with the `!m.isThreadReply` filter in `getHighlightCandidates`.

**Insertion 2 — pin/unpin control message from a peer** ([src/services/MessageService.ts:~1640](src/services/MessageService.ts#L1640), in the cache-update phase's `type === 'pin'` branch, immediately after the existing `['pinnedMessages']` and `['pinnedMessageCount']` invalidations):

```typescript
queryClient.invalidateQueries({ queryKey: ['highlights'] });
```

Unconditional — any pin/unpin event affects the feed.

**Insertion 3 — incoming edit message** ([src/services/MessageService.ts:~1382](src/services/MessageService.ts#L1382), in the cache-update phase's `type === 'edit-message'` branch, immediately after the `setQueriesData` block that ends at ~line 1381):

```typescript
queryClient.invalidateQueries({ queryKey: ['highlights'] });
```

Insert in the cache-update branch at ~1382, **not** the save/validation branch at ~928. The save branch has multiple early returns (permission check fails, message past edit-window, etc.). The cache-update branch only runs after the save branch has already written `updatedMessage` to IndexedDB via `messageDB.saveMessage` at ~line 1054. By the time `['highlights']` is invalidated here, IndexedDB is already current — the next `getHighlightCandidates` reads the fresh `mentions.everyone` value, which is what we need to drop the item from the feed if `@everyone` was edited out.

A future optimization is to only invalidate when the edit changes the `@everyone` flag (comparing old and new mention state), but that requires reading the pre-edit message back — not worth the complexity in v1.

**Insertion 4 — local pin/unpin by the current user** ([src/hooks/business/messages/usePinnedMessages.ts](src/hooks/business/messages/usePinnedMessages.ts), inside `doPinMessage` and `doUnpinMessage`, immediately after the IndexedDB write (`messageDB.updateMessagePinStatus`) and the existing optimistic cache updates):

```typescript
queryClient.invalidateQueries({ queryKey: ['highlights'] });
```

**Critical:** local pin events do NOT flow through `MessageService.handleNewMessage` — `usePinnedMessages` writes directly to IndexedDB at line 126, updates React Query caches inline, and enqueues a broadcast via `actionQueueService.enqueue`. Insertion 2 only fires on **received** pin events from peers. Without Insertion 4, the local user pinning their own message wouldn't update the feed until window refocus or the next staleTime expiry. Both `doPinMessage` and `doUnpinMessage` need the invalidation.

**Insertion 5 — read-time update** ([src/hooks/business/conversations/useUpdateReadTime.ts](src/hooks/business/conversations/useUpdateReadTime.ts), in the `onSuccess` callback alongside the existing 8 invalidations):

```typescript
queryClient.invalidateQueries({ queryKey: ['highlights'] });
```

Without this, the feed's unread/read styling lags the sidebar by up to 60 seconds (the `staleTime`). The user scrolls past a highlighted item in the channel, expects the feed to reflect "read," but the feed shows it as unread until window refocus. Invalidating here keeps the visual consistent across surfaces.

**`useUpdateThreadReadTime` does NOT need invalidation.** Thread replies are excluded from the feed at the DB filter (`!m.isThreadReply` in `getHighlightCandidates`), so thread read-time changes can't affect the feed.

**Tab focus / window refocus** is covered by React Query's `refetchOnWindowFocus: true` (already in the hook config). No extra wiring.

### Read / unread styling

A highlight is **unread** when `message.createdDate > conversation.lastReadTimestamp` for its `(spaceId, channelId)`. The same lookup `useAllMentions` performs. Attached to the `Highlight` as `isUnread: boolean`.

### Performance reasoning

Worst-case heavy user:
- 30 spaces × 10 channels = 300 (space, channel) pairs
- 30-day window
- Each `getHighlightCandidates` call: one `index.getAll` range read followed by an in-memory filter, ~5ms for a channel with low-hundreds of messages in the window

**Sequentially:** 300 × 5ms = 1.5s. Too slow.

**With `Promise.all` across both spaces AND channels** (true parallelism): the slowest channel scan dominates — well under 50ms in practice, even at the heavy-user tail. Fine.

Median user (5 spaces, 5 channels = 25 pairs): well under 25ms total. Trivial.

**Caveat about `index.getAll` and memory:** `index.getAll(range)` materializes every message in the 30-day range into a JS array before we filter to qualifying messages. For a chat channel with thousands of messages in 30 days (say a popular `#general`), that array could be in the low thousands of `Message` objects briefly held in memory per channel scan. With the channel-parallel `Promise.all`, peak memory across a heavy user's full feed scan could touch a few tens of MB transiently. Acceptable for desktop / browser environments but worth measuring.

If this becomes a problem (measure first), the lever is a cursor-based scan that streams messages and filters as it goes, instead of `getAll` + filter — roughly 10× cheaper in memory at the cost of slightly more code. Not in v1.

Further latency optimization (single transaction per space, multiple ranges) is available if measured slow. **Do not optimize prematurely.**

### Query key stability

The query key includes `userAddress`, sorted joined space IDs, sorted muted-space IDs, and a **canonically-serialized** snapshot of `config.mutedChannels`.

**Why canonical serialization for `config.mutedChannels`:** it is a nested object (`{ [spaceId: string]: string[] }`). React Query compares query keys with `shallowEqual` semantics; nested objects compared by reference would treat every `useConfig` re-fetch as a key change, triggering excessive refetches.

`JSON.stringify` alone is not enough — V8 preserves insertion order for string keys, but config sync can produce the same `mutedChannels` object with different key ordering (e.g., the user muted channels in a different order on another device). And the inner `string[]` arrays carry their own ordering that may not be stable across sync.

Build the key value with both levels sorted:

```typescript
const mutedChannelsKey = config?.mutedChannels
  ? JSON.stringify(
      Object.keys(config.mutedChannels).sort().reduce((acc, spaceId) => {
        acc[spaceId] = [...(config.mutedChannels![spaceId] || [])].sort();
        return acc;
      }, {} as Record<string, string[]>)
    )
  : 'null';
```

`mutedSpacesSet` is already a primitive-array of space IDs after `Array.from().sort()`, so it doesn't need serialization.

Cost of the canonical-key build is negligible — `mutedChannels` is bounded by the number of muted channels per user (typically tens at most).

### What this design deliberately omits

- **Pagination.** With a 30-day window and only two content types, the feed is bounded — typically <50 items, low hundreds at the tail. Render all in one pass. No infinite scroll.
- **Cross-platform shared hook.** Stays in desktop for v1 (see Section 8).

(Optimistic updates for local pin/unpin are now explicitly handled — see Insertion 4 above. An earlier draft of this spec incorrectly claimed the message-write path covered local pins; it does not.)

---

## 4. Visual design

### Page structure

Single column, max-width ~720px, centered in the main content area. Vertical scroll within the column (the column owns its own scroll, matching `Channel` and `BookmarksPanel` today). Card spacing: ~12px gap. Top of column: minimal `Highlights` title (h1).

### Highlight item layout

Adapted from `BookmarkCard.tsx` structure with the agreed changes (stripped + truncated text, no full markdown render, no inline image modal):

```
┌──────────────────────────────────────────────────────────────┐
│  ◉ Space Name  ›  # channel-name              📢 @everyone   │  ← source line + badge
│                                                              │
│  [Avatar]  Author Name · 2 hours ago                         │  ← header row
│                                                              │
│            Maintenance window scheduled for Tuesday at       │
│            3am UTC. Expected downtime ~30 minutes. We'll     │
│            be migrating to the new sync v2 protocol — most…  │  ← preview (~280 chars)
│            [thumbnail]                                       │  ← optional media thumb
│                                                              │
└──────────────────────────────────────────────────────────────┘
       ↑ hover: subtle accent border, cursor-pointer
       ↑ click anywhere on card → hash nav to message
```

**Three rows:**

1. **Source line** — `<SpaceIcon size="sm">` + space name + `›` separator + `#channel-name`. Right-aligned: badge — `📢 @everyone` (using Tabler `megaphone` icon, not the emoji) or `📌 Pinned` (using Tabler `pin` icon). If both apply, show `@everyone` only (higher signal).

2. **Header row** — `<UserAvatar>` (~36px) + author display name + relative timestamp via `formatMessageDate`. Same lookup pattern `BookmarkCard` uses.

3. **Preview row** — Stripped + truncated text (~280 chars), ending with `…` if cut. Markdown is stripped using the existing utility. If the message has embedded images, a single small thumbnail (~60×60, rounded) renders inline at the end of the text. Click anywhere on the card navigates — clicking the thumbnail does **not** open an image modal.

**No reaction count, no reply count.** Adding those shifts the feed toward "stats matter" / engagement-dashboard territory and dilutes the curation premise.

**Single affordance per card:** click navigates. No "remove from feed," no per-card menu.

### Badges

| Badge | Icon (Tabler) | Background |
|---|---|---|
| `@everyone` | `megaphone` | accent-color pill (similar to mention pill) |
| `Pinned` | `pin` | neutral surface pill |

Position: top-right of the source line, vertically centered with the space chip.

### Read / unread styling

- **Unread:** subtle 3–4px left border in the user's accent color, slightly bolder author name.
- **Read:** no left border, normal weight.
- Matches the visual language of unread channels in the sidebar.

### Hover & interaction

- Whole card is `cursor-pointer`.
- On hover: 1px accent-color border (or subtle background shift, matching existing card hover patterns in `BookmarkCard.scss`).

### Empty states

**No spaces joined at all (`spaces.length === 0`):** render `<SpacesEmpty />` — the existing three-card layout, unchanged. Extracted from `DiscoverPage.tsx` into its own file.

**Has spaces but no highlights in last 30 days:** render `<HighlightsEmpty />`:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                        Highlights                          │
│                                                            │
│              ┌─────────────────────────┐                  │
│              │      [megaphone icon]   │                  │
│              │                         │                  │
│              │   No highlights yet     │                  │
│              │                         │                  │
│              │   Important messages    │                  │
│              │   from your spaces will │                  │
│              │   show up here.         │                  │
│              └─────────────────────────┘                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

No CTA buttons (Discover / Join / Create are reachable from the sidebar `+` button and the Discover route).

### Loading state

While `useHighlights` is loading: render 3 skeleton cards (matching the highlight item layout dimensions). Avoid flashing the empty state for users who actually have highlights.

### Mobile / responsive

- Phone widths: single column collapses to full-width via existing `<Layout>` responsive behavior. No special work.
- Cards remain readable down to 320px (avatar shrinks slightly; badges drop to a new line if cramped).
- `PhoneHeader` (drawer trigger) reused at the top, same pattern as the existing empty state.

### Styling alignment

- Follow the [styling guidelines](../docs/styling-guidelines.md): no inline colors, all values via `_colors.scss` semantic variables.
- Card surface: same `--surface-*` token `BookmarkCard` uses.
- Border radius, shadow, padding: borrow from `BookmarkCard.scss` so the visual feels native to the app.
- No emoji in production UI — use Tabler icons only.

---

## 5. Testing

### Unit tests

**`getHighlightCandidates(spaceId, channelId, since)`:**
- Empty channel returns empty
- No matching messages returns empty
- Mixed pins + everyones returns both
- Respects `sinceTimestamp` boundary
- Thread replies (`isThreadReply === true`) excluded even when they carry `@everyone` or `isPinned`
- Soft-deleted messages do not appear (verified by the messages-store / tombstone-store split, not by explicit filter logic — see [src/db/messages.ts:1241-1254](src/db/messages.ts#L1241-L1254))

**`buildHighlight()` helper:**
- Denormalization correctness (space, channel, sender attached)
- `reason` derivation: when `mentions.everyone === true` AND `isPinned === true`, `reason` is `'everyone'` (higher signal wins)
- Preview: markdown stripping + truncation at ~280 chars
- Media thumb extraction when embedded image present
- `isUnread` correctly derived from `lastReadTimestamp`

### Hook tests (`useHighlights`)

- Filters muted spaces — none of their items appear
- Filters muted channels — items from those channels excluded, others retained
- Sorts strictly reverse-chronological across spaces
- Empty result when no joined spaces (caller renders `SpacesEmpty`)
- Empty result when joined spaces have no qualifying messages (caller renders `HighlightsEmpty`)
- Re-query when `spaces` set changes (join/leave invalidates via key)
- Re-query when `mutedSpacesSet` or `config.mutedChannels` change

### Component tests

- `HighlightItem` renders correct badge for each `reason`
- `HighlightItem` shows media thumb when `hasMedia === true`
- `HighlightItem` truncation visible at ~280 chars
- `HighlightItem` click invokes `navigate('/spaces/:spaceId/:channelId#msg-:messageId')`
- Unread styling appears when `isUnread === true`, absent otherwise
- `SpacesHighlights` branches correctly: no spaces / no highlights / has highlights / loading

### Integration test

- Mount route at `/spaces`, seed 3 spaces with mixed content (mentions, pins, plain chat), verify feed shows only qualifying items in correct order.
- Add a new `@everyone` message via MessageService; verify the feed invalidates and re-renders with the new item at the top.

Follow existing test conventions in [src/dev/tests/](src/dev/tests/). No new test infra.

### Manual QA checklist

Extend the existing dev-only mock mechanism (`debug_mock_spaces=true`) — the mock generators live in [src/utils/mock/](src/utils/mock/) (a directory, not a single file; the entry point is `mockSpaces.ts`). Modify whichever generator produces mock channel messages to inject `mentions.everyone: true` on a subset and `isPinned: true` on another subset, plus a control set with neither flag.

- ✅ `/spaces` with zero joined spaces shows three cards
- ✅ Joined spaces with no qualifying messages → "No highlights yet" empty state
- ✅ Qualifying messages render in reverse-chrono order
- ✅ Muting a space removes its items from the feed
- ✅ Muting a channel within an unmuted space removes only that channel's items
- ✅ Click navigates to message with hash highlight
- ✅ Unread highlight gains read styling after navigating + scrolling past it
- ✅ Refresh tab → feed re-fetches (window focus)
- ✅ Receive a new `@everyone` from another device while feed is open → item appears at top
- ✅ Phone width: layout collapses cleanly, drawer button accessible
- ✅ Performance: with 30 mock spaces × 10 channels, initial render under 200ms

---

## 6. Rollout

No feature flag. The change replaces an empty state — the worst case is a user with no qualifying messages sees "No highlights yet" instead of the three cards. They can still create/join/discover from the sidebar `+` button and the Discover route. Safe to ship to all users on merge.

Migration of `mode="spaces-empty"` prop on `DiscoverPage`: the prop is removed in the same PR. `SpacesEmpty` is extracted into its own file. No other callers of `mode="spaces-empty"` exist (verified via grep).

---

## 7. Risks & mitigations

1. **Performance on heavy users.** Mitigated by `Promise.all` per space (Section 3). If a real user reports slowness, the next lever is single-transaction per space with multiple ranges. Don't optimize until measured.

2. **Stale items dominating the feed.** A space owner who pinned 20 messages 25 days ago will fill the feed for that user. By design (pins are signal). If users find it noisy, the v2 lever is a per-source cap (max N items per space, with a "show more from this space" affordance). Not now.

3. **`@everyone` abuse / spam.** A careless or malicious space owner can flood feeds. Existing role permissions already gate `mention:everyone` ([src/components/modals/SpaceSettingsModal/Roles.tsx](src/components/modals/SpaceSettingsModal/Roles.tsx)), so this isn't a new risk — but the feed amplifies visibility. **Escape valve already exists:** muting a space (one click in sidebar context menu) removes all of its items from the feed.

4. **`useAllMentions` pattern divergence.** Two hooks now do similar things (cross-channel iteration, mute filtering, sender denormalization). When PR #4 (hooks migration) unblocks, both should migrate together and share a common helper. Noted for the migration audit.

5. **`SpacesEmpty` extraction breaks something.** Low risk — pure functional component, no side effects, single caller (`DiscoverPage` with `mode="spaces-empty"`, which is removed in the same PR).

6. **Long-absence users see many items.** A user returning after 4 weeks across 30 active spaces could see hundreds of items. Rendering plain cards in a non-virtualized list is cheap for low hundreds, but at the high tail layout thrashing becomes possible. If DOM nodes become a measured problem, the lever is **Virtuoso** (already used in [BookmarksPanel.tsx](src/components/bookmarks/BookmarksPanel.tsx) for similar card lists). Add a "show more" affordance at item #50 as a simpler interim. Not now.

7. **Partial failure inside `Promise.all`.** If one channel's `getHighlightCandidates` rejects (e.g., transient IDB error), the whole `Promise.all` rejects and the user sees no feed at all. Mitigation: wrap each per-channel call in `.catch(() => [])` so a single bad channel degrades to "no items from that channel" rather than blanking the feed. Log the failure via the shared `logger` so we notice it in dev.

8. **Edited-away `@everyone` lag.** When a sender edits a message to remove `@everyone`, the feed invalidation (Insertion 3 in Section 3) fires and the item drops out — but the invalidation race-free-ness depends on the edit handler completing before the next render. In practice the existing edit pipeline updates the React Query message caches first and the invalidation is synchronous, so the user shouldn't see a flash of stale content. Worth verifying in manual QA.

---

## 8. quorum-shared placement decisions

This feature touches multiple layers. Each layer's placement was decided deliberately.

| Piece | Lives in | Reason |
|---|---|---|
| `Message` type with `mentions.everyone` and `isPinned` | quorum-shared (existing) | Already there, no changes |
| `useSpaces`, `useMutedSpacesSet`, `useConfig` | desktop (existing) | No changes |
| `getHighlightCandidates` DB query | **desktop** (`MessageDB`) | Mirrors `getPinnedMessages` placement. `StorageAdapter` interface in shared doesn't expose this query shape. Adding it requires coordinating with mobile — defer to v2. |
| `useHighlights` business hook | **desktop** | Mirrors `useAllMentions` placement. PR #4 (hooks migration) is blocked; landing a new shared hook now would tangle in that block. |
| `SpacesHighlights`, `HighlightsFeed`, `HighlightItem` UI components | **desktop** | UI components are not shared. Only primitives go to shared. |
| `formatRelativeTime`, `logger`, `Message` type | quorum-shared (existing) | Use as-is. |
| `stripMarkdown` | quorum-shared (existing) | Already used in `channelThreadHelpers.ts` and `SearchResultItem.tsx`. Use as-is. |
| `truncateText` | **new, write inline** | No such export exists in shared. The truncation logic is a one-liner (`text.length > N ? text.slice(0, N).trimEnd() + '…' : text`) — keep it inline in `buildHighlight()`, no need for a util. |

### Cross-platform sync implications

**No new data syncs.** This is critical. The feature reads existing message data — no new fields on `Message`, `UserConfig`, `space_keys`, or `space_members`. No new sync schema, no `DB_VERSION` bump. Mobile parity is opt-in and asynchronous — mobile can build a `useHighlights()` equivalent on its own schedule without coordination.

If we later want **per-user feed read state** (e.g., "user dismissed this item"), that would need to sync via `UserConfig` and require shared schema changes. Explicitly deferred to v2.

### Migration plan (v2, after v1 ships)

When PR #4 (hooks migration) unblocks:

1. Add optional `getHighlightCandidates?(spaceId, channelId, since)` to `StorageAdapter` interface in quorum-shared
2. Implement on `IndexedDBAdapter` (desktop) and the mobile equivalent
3. Migrate `useHighlights()` to quorum-shared `hooks/` — **bundle with `useAllMentions` migration** since they share patterns and a common helper
4. Mobile builds its own UI on top of the shared hook

Same pattern receipts and typing followed (desktop ships first, mobile follows once the hook contract stabilizes — see [shipped log](quorum-shared-migration/shipped-log.md)).

---

## 9. Decisions made during deep review (2026-06-04)

After two agent-led deep-review passes of this spec, the following decisions were made and incorporated into the sections above.

### From first review pass

- **Pin invalidation lives in the `type === 'pin'` control-message branch**, not in `handleNewMessage`. Pins are control messages that update the target's `isPinned` field; they never arrive as messages with `isPinned: true` directly.
- **`@everyone` invalidation is a standalone check**, not a piggyback on the existing `mentions.memberIds.length > 0` block — the latter skips `@everyone`-only messages.
- **`useUpdateReadTime` also invalidates `['highlights']`** so the feed's read/unread styling tracks the sidebar in real-time, not at the 60s `staleTime`.
- **Thread replies are filtered out at the DB query layer** (`!m.isThreadReply` in `getHighlightCandidates`) — they navigate via a different hash format and we've scoped threads out of v1.
- **`config.mutedChannels` is canonically-serialized in the query key** to defeat React Query's reference-based key comparison on nested objects.
- **`SpacesHighlights` requires a Suspense boundary at the route level** because `useConfig` is a `useSuspenseQuery`.
- **`Promise.all` is applied across both spaces AND channels** for true parallelism.
- **Click navigation uses the existing `buildMessageHash()` utility**, not a hand-crafted hash string.
- **`truncateText` is inline, not a utility** — no such export exists in quorum-shared, and a one-liner doesn't merit one.

### From second review pass

- **Edit invalidation goes in the cache-update branch at ~line 1382**, not the save/validation branch at ~line 928. The save branch has multiple early returns and runs BEFORE the cache branch (which only executes once the save has written to IndexedDB via `messageDB.saveMessage` at ~line 1054). Invalidating at 1382 guarantees the next `getHighlightCandidates` reads the fresh IndexedDB value.
- **Local pin/unpin needs its own invalidation** in `usePinnedMessages.ts` (Insertion 4). Local pins do NOT flow through `MessageService.handleNewMessage` — they write directly to IndexedDB + React Query and enqueue a broadcast. Earlier draft incorrectly claimed the message-write path covered this.
- **`enabled: !!userAddress` is not the auth-loading guard.** Suspense handles that. The flag's actual role is preventing the queryFn from running with an empty userAddress string.
- **Sender denormalization is done once per space**, not once per message. Use `messageDB.getSpaceMembers(spaceId)` to build a per-space `Map<address, SpaceMember>` before the per-channel `Promise.all`. Otherwise 200 highlights = 200 sequential async lookups.
- **`mutedChannels` query-key canonicalization sorts both levels** — outer keys (spaceIds) and inner arrays (channelIds). JSON.stringify alone is insufficient because config sync from another device may yield different key/value orderings.
- **`HighlightsSkeleton.tsx` is an explicit deliverable.** No prior skeleton pattern exists in the codebase. Build it inline with the card structure using CSS pulse animation.
- **`useUpdateThreadReadTime` does NOT need invalidation.** Thread replies are excluded from the feed by the DB filter, so thread read-time updates can't affect highlights.

No open questions remain at the design level. Items deferred to v2 are listed in Section 1 ("Explicitly out of scope") and Section 7 (risks with potential future levers).

---

*Last updated: 2026-06-04 — revisions from two deep-review passes*
