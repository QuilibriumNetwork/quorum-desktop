---
type: spec
title: "Space/Channel Thread Toggle"
status: approved
created: 2026-03-14
related_docs:
  - "docs/features/messages/thread-panel.md"
---

# Space/Channel Thread Toggle — Design Spec

## Overview

Two-level toggle system that controls whether threaded conversations are available in a space's channels. A space-level "Allow Threads" setting acts as a master gate (default: off). When enabled, threads become available in all channels by default. Each channel then has its own "Allow Threads" toggle (default: on) to opt out individually.

When threads are disabled, existing thread replies flow back into the main channel feed non-destructively. Re-enabling threads restores the full thread structure.

## Data Model

### Type Changes

**`Space` type** (`src/api/quorumApi.ts`):
```typescript
export type Space = {
  // ... existing fields
  allowThreads?: boolean; // Master gate for threads (default: undefined = false)
};
```

**`Channel` type** (`src/api/quorumApi.ts`):
```typescript
export type Channel = {
  // ... existing fields
  allowThreads?: boolean; // Per-channel thread toggle (default: undefined = true)
};
```

### Resolution Logic

```typescript
const threadsEnabled = !!space.allowThreads && (channel.allowThreads !== false);
```

- Space toggle is the master gate. `undefined` / `false` = threads off globally.
- Channel toggle only matters when the space enables threads. `undefined` / `true` = threads on. Must be explicitly `false` to disable per-channel.
- Enabling threads at the space level immediately enables them in all channels. Individual channels can then opt out.

**Note on opposite defaults:** `Space.allowThreads` defaults to off (`undefined` = `false`) because threads are opt-in at the space level. `Channel.allowThreads` defaults to on (`undefined` = `true`) because once a space enables threads, channels should have them unless explicitly opted out. The resolution logic reflects this: `!!space.allowThreads` requires an explicit `true`, while `channel.allowThreads !== false` allows `undefined`/`true`.

### Sync

No new DB schema version needed. The `allowThreads` fields live on the `Space` object, which is synced via `updateSpace()`. Peers receive the updated Space with the new fields automatically.

## UI Gating

When `threadsEnabled` is `false` for a channel, the following thread UI elements are hidden:

| Element | Location | Gating mechanism |
|---------|----------|-----------------|
| "Start Thread" / "View Thread" in context menu | `MessageActionsMenu.tsx` | `onStartThread` prop not passed (renders as `undefined`) |
| ThreadIndicator on root messages | `Message.tsx` → `ThreadIndicator.tsx` | Flag passed through `MessageList` |
| "Threads" button in channel header | `Channel.tsx` | Conditional render |
| ThreadsListPanel dropdown | `Channel.tsx` | Conditional render (tied to Threads button) |

**Computation location:** `Channel.tsx` computes `threadsEnabled` from the `space` and current `channel` objects (both already available). It passes `onStartThread={threadsEnabled ? handleOpenThread : undefined}` to `MessageList` and conditionally renders the Threads header button.

**No changes to ThreadPanel itself.** If threads are disabled, there's no UI path to open the panel, so it never renders.

## Filter Layer Bypass

When `threadsEnabled` is `false`, the three `isThreadReply` filter layers stop filtering, so thread replies appear inline in the main channel feed:

### Layer 1 — DB Cursor (`src/db/messages.ts`, `getMessages()`)

Currently skips messages where `isThreadReply` is `true` during cursor iteration. Add an optional `includeThreadReplies?: boolean` parameter to the options. When `true`, the cursor skip is bypassed.

### Layer 2 — DB Unread Query (`src/db/messages.ts`, `getFirstUnreadMessage()`)

Currently skips `isThreadReply` messages. Same pattern — add `includeThreadReplies?: boolean` option.

### Layer 3 — React Hook (`src/hooks/business/channels/useChannelMessages.ts`)

The `msg.isThreadReply` filter becomes conditional:
```typescript
if (msg.isThreadReply && threadsEnabled) return false;
```

The hook receives `threadsEnabled` as a parameter.

### loadMessagesAround (`src/hooks/queries/messages/loadMessagesAround.ts`)

The thread reply exclusion for the target message injection is also conditional on `threadsEnabled`.

### How `threadsEnabled` reaches these layers

The call chain is: `Channel.tsx` → `useChannelMessages` → `useMessages` → `buildMessagesFetcher` → `messageDB.getMessages()`. The `includeThreadReplies: !threadsEnabled` flag must be threaded through each layer:

1. `Channel.tsx` passes `includeThreadReplies` to `useChannelMessages`
2. `useChannelMessages` passes it to `useMessages`
3. `useMessages` passes it to `buildMessagesFetcher`
4. `buildMessagesFetcher` passes it to `messageDB.getMessages()` and `messageDB.getFirstUnreadMessage()`

The React filter layer in `useChannelMessages` receives `threadsEnabled` directly.

## Settings UI

### Space Settings Modal — General Tab

- **Section title renamed:** "Privacy Settings" → "Features"
- **New toggle:** `Switch` primitive with label "Allow Threads"
- **Tooltip:** "Enable threaded conversations in channels"
- **Position:** After the existing toggles in the "Features" section (note: "Save Edit History" is behind a feature flag and may not be visible)
- **Hook:** `useSpaceManagement` gets an `allowThreads` state field, same pattern as `isRepudiable` and `saveEditHistory`

### Channel Editor Modal

- **New toggle:** `Switch` primitive with label "Allow Threads"
- **No description or tooltip** — label is self-explanatory in channel context
- **Visibility condition:** Only rendered when `space.allowThreads === true`. When the space disables threads globally, showing a per-channel toggle is confusing since it has no effect.
- **Hook:** `useChannelManagement` gets `allowThreads` in `ChannelData`, same pattern as `isReadOnly`

### Save Flow

Both use the existing `updateSpace()` path:
- Space toggle updates `space.allowThreads`
- Channel toggle updates the channel's `allowThreads` within the space's `groups[].channels[]` structure — identical to how `isReadOnly`, `isPinned`, etc. are saved today

### Permissions

Same as existing settings:
- Space-level toggle: space owner only
- Channel-level toggle: space owner + channel managers (`managerRoleIds`)

## Edge Cases

### Peer sync
When a space owner toggles `allowThreads`, the updated `Space` object is broadcast via `updateSpace()`. All peers receive the new value and their UI immediately reflects it — thread entry points appear/disappear and the `isThreadReply` filters adjust. No special broadcast message needed.

### Thread panel already open
If a user has a thread panel open and the space owner disables threads, the panel doesn't auto-close. This is harmless stale state — thread replies are now visible inline in the main feed. On next channel navigation or app reload, the panel won't reopen since there's no UI path to trigger it.

### Thread hash navigation
If a user clicks a bookmark or search result with a `#thread-{id}-msg-{id}` hash while threads are disabled, the hash parsing in `Channel.tsx` skips thread panel opening. The target message is already visible inline, so it falls through to regular `#msg-{id}` scroll behavior.

### Non-destructive toggle
Disabling threads does NOT modify any message data. `threadMeta`, `threadId`, and `isThreadReply` fields remain intact on all messages. The filter layers simply stop excluding thread replies from the main feed. Re-enabling threads restores the full thread structure — messages return to their threads, ThreadIndicators reappear, etc.

### New thread creation blocked
When threads are disabled, `onStartThread` is not passed to `MessageActionsMenu`, so the option doesn't render. `ThreadIndicator` is hidden. There is no UI path to create a thread. No server-side guard needed since this is a client-side app with peer-to-peer sync.

### Unread count spike
When threads are disabled, previously-hidden thread replies become visible in the main feed. If any of these messages are newer than the user's last-read timestamp, unread counts and badges may spike. This is an acceptable, expected side-effect — the messages are genuinely "new" to the main feed. No special reset or recalculation is needed.

## Files to Modify

| File | Change |
|------|--------|
| `src/api/quorumApi.ts` | Add `allowThreads?: boolean` to `Space` and `Channel` types |
| `src/components/space/Channel.tsx` | Compute `threadsEnabled`, conditional thread UI, pass flag to hooks |
| `src/db/messages.ts` | Add `includeThreadReplies` option to `getMessages()` and `getFirstUnreadMessage()` |
| `src/hooks/business/channels/useChannelMessages.ts` | Conditional `isThreadReply` filter |
| `src/hooks/queries/messages/loadMessagesAround.ts` | Conditional thread reply exclusion |
| `src/hooks/queries/messages/useMessages.ts` | Pass `includeThreadReplies` to `buildMessagesFetcher` |
| `src/hooks/queries/messages/buildMessagesFetcher.ts` | Pass `includeThreadReplies` to `messageDB.getMessages()` |
| `src/hooks/business/spaces/useSpaceManagement.ts` | Add `allowThreads` state |
| `src/hooks/business/channels/useChannelManagement.ts` | Add `allowThreads` to `ChannelData` |
| `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` | Pass `allowThreads` state to General |
| `src/components/modals/SpaceSettingsModal/General.tsx` | Rename section, add toggle |
| `src/components/modals/ChannelEditorModal.tsx` | Add conditional toggle |

---

_Created: 2026-03-14_
_Updated: 2026-03-14 (spec review fixes: corrected hook reference to useSpaceManagement, added buildMessagesFetcher/useMessages to call chain and file list, added General.tsx to file list, documented opposite default semantics, added unread count spike edge case, fixed toggle position description)_
