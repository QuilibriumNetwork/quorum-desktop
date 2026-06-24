# Global Notification Panel (Desktop) — Design

> Design spec. No code changed yet. Brings desktop to parity with mobile's
> global, in-app notification surface: one panel aggregating mentions/replies
> across ALL spaces, opened from the left shell rail. Mirrors the existing
> bookmarks pattern (global in the rail, scoped-to-here in the channel header).

## Status

- **Type:** feature design
- **Created:** 2026-06-23
- **Architecture decision:** Approach A (live-derived, extended global) — settled with user
- **Related docs:**
  - `.agents/docs/features/mention-notification-system.md` (desktop, current per-space panel)
  - `.agents/docs/features/notification-indicators-system.md` (desktop, badges/counts)
  - `../../quorum-mobile/.agents/docs/features/notification-system.md` (mobile reference)
  - `../../quorum-mobile/.agents/docs/2026-06-23-notification-system-mobile-vs-desktop.md` (divergence analysis)

---

## TL;DR

Desktop today has a **per-space** notification panel: a bell in the channel
header that lists unread mentions/replies for the current space only, derived
live from IndexedDB. This adds a **global** panel — one inbox across all spaces —
opened from a new **NavRail bell** as a **centered modal overlay**. The existing
per-space header bell stays exactly as-is. Same components, two scopes — the same
split bookmarks already uses (`/bookmarks` page global, header dropdown scoped).

No new storage, no persisted log, no schema migration. The global panel computes
its list the same way the per-space one does, just looped over every space.

---

## Decisions (settled with user, 2026-06-23)

1. **Architecture: Approach A (live-derived).** Aggregate the existing per-space
   live queries across all spaces. NOT a persisted log (mobile uses a log only
   because its WebSocket layer discards the message; desktop keeps every message
   in IndexedDB, so the data for live derivation is always present). No new store,
   no migration, no second source of truth — count badges and the panel stay in
   lockstep automatically.
2. **Cross-device sync: unchanged, out of scope.** `lastReadTimestamp` is
   device-local on both apps (`saveReadTime` is a local `store.put`, never sent to
   the server — confirmed `src/db/messages.ts:954`). Reading a mention on desktop
   does NOT clear it on mobile, and vice-versa. This is a deliberate privacy
   tradeoff (the server can't see channel IDs inside encrypted envelopes) and is
   identical under Approach A or B. This design does not change it.
3. **Entry point: new NavRail bell** (global) + keep the channel-header bell
   (per-space). Mirrors the bookmarks pattern.
4. **Presentation: centered modal overlay** from the rail bell
   (`DropdownPanel positionStyle="centered"`), dimmed backdrop, list scrolls
   inside, dismiss on backdrop-click/Escape, no route change. Header bell stays an
   anchored dropdown.
5. **Grouping: flat list, newest-first**, with a `Space › #channel` breadcrumb per
   row. No per-space sections, no type sections.
6. **Filtering: type filter only** (`@you / @everyone / @roles / Replies`), applied
   globally as a pure UI filter. No space filter (breadcrumb shows origin; the
   per-space view is the header bell).
7. **Rail badge: simple presence dot, no number.** Consistent with the existing
   Messages DM dot on the rail.
8. **Mark all as read: global scope, gated behind a confirm dialog** (danger
   variant) because the blast radius spans all spaces.

---

## Architecture & data flow

### Shared per-space fetch, two callers

The per-space query bodies of `useAllMentions` / `useAllReplies` are extracted
into plain async functions so the new global hooks reuse them verbatim (no
duplicated gating logic, zero behavior drift):

```
fetchSpaceMentions(messageDB, space, userAddress, { enabledTypes, userRoleIds })
   → MentionNotification[]   (for ONE space; existing per-space logic)
fetchSpaceReplies(messageDB, space, userAddress, { enabled })
   → ReplyNotification[]     (for ONE space)
```

Both encapsulate the current logic exactly:
- per-space `notificationSettings` lookup + `isMuted` short-circuit
- muted-channel exclusion (`getMutedChannelsForSpace`)
- per-channel `lastReadTimestamp` + per-thread `thread_read_times` gating
- `isMentionedWithSettings` (mentions) / `getUnreadReplies` (replies)

The existing per-space hooks (`useAllMentions`, `useAllReplies`) keep their exact
current public API — they just call the extracted function internally. **This
guarantees the existing header bell is untouched.**

### New global hooks

```
useAllMentionsGlobal({ spaces, enabledTypes })   // loops fetchSpaceMentions over spaces
useAllRepliesGlobal({ spaces, enabled })         // loops fetchSpaceReplies over spaces
```

- Source of `spaces`: `useSpaces()`.
- Each result row is augmented with `spaceId` + `spaceName` (in addition to the
  existing `channelId` / `channelName`) so the row can render the breadcrumb.
- Per-space user role IDs computed via `getUserRoles(userAddress, space)` inside
  the loop (same as `useSpaceMentionCounts` already does).
- Flatten + sort newest-first by `message.createdDate`.
- React Query keys: `['mention-notifications', 'global', userAddress, ...spaceIds.sort()]`
  and `['reply-notifications', 'global', ...]`. `staleTime: 30000`,
  `refetchOnWindowFocus: true` — matches per-space.

> Optional: a single `useGlobalNotifications` composing both hooks + the merged
> sorted list, to keep the panel component thin. Decided during planning.

### Performance: bounded global fetch (decided 2026-06-23)

Opening the global panel fans out per-channel IndexedDB reads across ALL spaces
(`getConversation` + `getThreadReadTimesForChannel` + `getUnreadMentions`/
`getUnreadReplies` per channel). This is local (no network) and React-Query-cached
(30s stale), and it is the SAME per-channel query the per-space panel already runs.
For typical users (a few spaces, modest unread) it is a non-issue. The worst case
(many large spaces, heavy unread) is bounded as follows so we never pull thousands
of message objects to render a panel that shows a few dozen:

- **Lower the per-channel limit** for the global path from `1000` to `GLOBAL_PER_CHANNEL_LIMIT = 50`.
  No single channel realistically contributes more than ~50 of the newest visible
  rows. (The per-space header bell keeps its existing `1000` — unchanged.)
- **Still fetch every space** (skipping spaces would drop newer items from
  later-iterated spaces), but each channel's contribution is bounded by the limit.
- **Sort the merged set newest-first, then slice to `GLOBAL_DISPLAY_CAP = 100`.**
  Slicing AFTER the global sort is order-independent — no bias toward
  whichever space was iterated first.
- **No silent truncation:** when the merged count exceeds the cap, the panel shows
  a subtle "Showing 100 most recent" footer/affordance rather than implying the
  list is exhaustive.
- The **unread dot** stays cheap: it reads the existing early-exit count hooks
  (`useSpaceMentionCounts`/`useSpaceReplyCounts`, capped at 10), NOT the panel
  fetch. So the always-on indicator cost is unchanged from today.

### Cache invalidation

`MessageService.ts` (new message) and `useUpdateReadTime` (channel read) already
invalidate `['mention-notifications', ...]` / `['reply-notifications', ...]`.
Confirm these prefixes also match the new `'global'` keys (React Query prefix
matching: `['mention-notifications']` invalidates `['mention-notifications', 'global', ...]`,
so a broad invalidation covers it — verify the existing calls aren't over-scoped
to a specific `spaceId` in a way that misses global). Add explicit global-key
invalidations where the existing ones are space-scoped.

---

## Entry point & presentation

### NavRail bell (`src/components/shell/NavRail.tsx`)

- Add a `notifications` entry to `buildItems()`: `icon: 'bell'`, `label: t\`Notifications\``.
- Unlike other rail items, it does **not** navigate. `onItemClick` gets a branch:
  `id === 'notifications'` toggles local `isPanelOpen` state instead of `navigate()`.
  (Bookmarks navigates to `/bookmarks`; ours opens a centered overlay — the one
  intentional divergence, driven by decision #4.)
- **Unread dot:** render `.icon-unread-dot` on the bell when any unread
  mention/reply exists across all spaces. Source:
  `useSpaceMentionCounts(spaces)` + `useSpaceReplyCounts(spaces)` — dot shows if
  either returned map is non-empty. (Both hooks exist, early-exit at 10, 90s
  stale.)
- The NavRail is a global shell component; it gains the `spaces` query +
  the global panel render. Keep added state minimal (one `isPanelOpen` boolean).

### Presentation

- Global panel = the existing `NotificationPanel` rendered with
  `positionStyle="centered"` → centered overlay, dimmed backdrop, internal scroll,
  dismiss on backdrop-click/Escape. No URL change.
- Header per-space bell (`src/components/space/Channel.tsx` ~L1497):
  **unchanged** — anchored dropdown, current-space scope.

### Sender-name resolution

The per-space `mapSenderToUser` is built inside `Channel` from that space's
member data. The global panel spans spaces, so resolve sender names per row from
the row's own `spaceId` → that space's member data (each row already carries
`spaceId`). No new infrastructure; confirm the cleanest resolver wiring during
planning (likely a small helper that takes `spaceId` + `senderId` and looks up
the member in the cached space data).

---

## Panel internals

### Layout

- Flat list, newest-first, across all spaces (`NotificationPanel` already sorts
  the combined mentions+replies array by `createdDate`).
- `NotificationItem` gains an **optional `spaceName` prop**. When present, render a
  `Space › #channel` breadcrumb (space name leads; `#channel` follows in muted
  channel styling, reusing existing classes). When absent (per-space header bell),
  render `#channel` only — **zero visual change to the existing header panel**.
- Thread rows keep the existing `#channel › Thread` treatment; with a space it
  becomes `Space › #channel › Thread`.

### Filtering

- Reuse the existing `@you / @everyone / @roles / Replies` multi-select filter,
  applied globally.
- **Global filter is a pure UI filter over types**, all four selected by default —
  NOT derived from any single space's saved `enabledNotificationTypes` (those
  differ per space). The per-space *eligibility gating* still happens inside the
  aggregation hooks per each space's own settings: a space where `@everyone` is
  disabled contributes no `@everyone` rows regardless of the global filter. The
  global filter only narrows what is already eligible.
- No space filter.

### Navigation

- Unchanged. `handleNavigate(spaceId, channelId, messageId, threadId?)` builds the
  `#msg-…` / `#thread-…-msg-…` hash and navigates to
  `/spaces/{spaceId}/{channelId}{hash}`. Rows carry `spaceId` explicitly, so
  cross-space jumps work as today. Navigating closes the centered panel.

---

## Global "Mark all as read" (with confirm)

- Reuse `useConfirmation({ type: 'modal', modalConfig: { variant: 'danger', … } })`
  + the existing `ConfirmationModalProvider`. The mark-all button opens a confirm
  dialog warning it marks notifications read across **all** spaces.
- On confirm: collect every `(spaceId, channelId)` present in the current global
  list, `saveReadTime` for each, gather their threads and `bulkSaveThreadReadTimes`,
  then invalidate global + space + channel caches. This is the per-space
  `handleMarkAllRead` routine (already in `NotificationPanel.tsx`) generalized over
  multiple spaces rather than one `spaceId`.

---

## Components & files

### New
- `src/hooks/business/mentions/useAllMentionsGlobal.ts` — global mention aggregation
- `src/hooks/business/replies/useAllRepliesGlobal.ts` — global reply aggregation
- (optional) `src/hooks/business/.../useGlobalNotifications.ts` — composition + merge

### Modified
- `src/hooks/business/mentions/useAllMentions.ts` — extract `fetchSpaceMentions`,
  call it internally (no API change)
- `src/hooks/business/replies/useAllReplies.ts` — extract `fetchSpaceReplies`,
  call it internally (no API change)
- `src/hooks/business/mentions/index.ts`, `.../replies/index.ts` — export new hooks
- `src/components/shell/NavRail.tsx` — bell item, toggle state, unread dot, render
  global panel
- `src/components/notifications/NotificationPanel.tsx` — accept a `global` mode:
  centered presentation, global hooks, breadcrumb-enabled rows, global mark-all +
  confirm. (Keep per-space path intact via props.)
- `src/components/notifications/NotificationItem.tsx` — optional `spaceName` prop +
  breadcrumb render
- `NotificationPanel.scss` / `NotificationItem.scss` — breadcrumb + centered-mode
  styling as needed

### Reused as-is
- `useSpaces`, `useSpaceMentionCounts`, `useSpaceReplyCounts`
- `DropdownPanel` (`positionStyle="centered"`)
- `useConfirmation` + `ConfirmationModalProvider`
- `buildMessageHash`, `useMessageFormatting`, `useSearchResultFormatting`
- `isMentionedWithSettings`, `getUnreadMentions`, `getUnreadReplies`,
  `getDefaultNotificationSettings`, `getUserRoles` (from `@quilibrium/quorum-shared`)

---

## Out of scope / non-goals

- **Cross-device read-state sync** (see decision #2) — separate, much larger
  project; unchanged by this work.
- **Persisted notification log / "Clear all" history** — explicitly rejected
  (Approach B). The global panel shows currently-unread items only, consistent
  with desktop's existing model.
- **DMs in the panel** — desktop surfaces DM unread via the NavRail dot; out of
  scope here (mirrors mobile, where DMs-in-panel is a separate open task).
- **Farcaster** — desktop has no Farcaster notifications; not applicable.
- **No `@quilibrium/quorum-shared` change** — detection + settings types already
  shared; nothing new on the wire.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Refactor of `useAllMentions`/`useAllReplies` breaks the existing header bell | Extract pure functions; keep hook public APIs byte-identical; the header bell path is unchanged |
| Global query is slow with many spaces × many channels | Same per-channel `getUnreadMentions`/`getUnreadReplies` queries the per-space panel already runs; 30s stale + focus-refetch; consider a result cap if needed (decide in planning) |
| Global cache keys missed by existing invalidations | Audit `MessageService` / `useUpdateReadTime` invalidations; rely on React Query prefix matching or add explicit global-key invalidations |
| Sender resolution differs from per-space `mapSenderToUser` | Resolve per row from the row's `spaceId` space data; confirm wiring in planning |

---

*Last updated: 2026-06-23*
