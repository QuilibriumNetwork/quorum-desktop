---
type: design
title: Per-Message Emoji Picker Portal Fix
status: approved
created: 2026-04-14
updated: 2026-04-14
---

# Per-Message Emoji Picker Portal Fix

## Problem

The per-message reaction emoji picker (opened by clicking the smiley icon in the message hover action bar) renders via `position: absolute` inside the message row. This causes it to be clipped by the channel header above and the message composer below, because it participates in the scroll container's stacking context.

The context-menu path already correctly uses a `Portal` + `position: fixed` (lines 693-713 in `Message.tsx`). The hover-bar path does not.

## Goal

Make the hover-bar emoji picker use the same Portal+fixed approach, so it renders above all UI elements without clipping.

## Architecture

### Current flow (broken)

1. User clicks smiley icon in `MessageActions.tsx` hover bar
2. `onMoreReactions(e.clientY)` is called
3. `Message.tsx` calls `emojiPicker.openDesktopEmojiPicker(messageId, clientY)`
4. `useEmojiPicker.ts` sets `emojiPickerOpen = messageId` and computes `emojiPickerOpenDirection` from `clientY / height`
5. `Message.tsx` renders inline `position: absolute` picker (no Portal) — clips behind header/composer

### New flow (fixed)

1. User clicks smiley icon in `MessageActions.tsx` hover bar
2. `onMoreReactions(e.currentTarget.getBoundingClientRect())` is called — passes full rect
3. `Message.tsx` calls `emojiPicker.openDesktopEmojiPicker(messageId, rect)`
4. `useEmojiPicker.ts` sets `emojiPickerOpen = messageId` and computes `{ x, y }` with clamping, stores in `emojiPickerPosition`
5. `Message.tsx` renders picker via existing Portal+fixed branch — no clipping

The inline `absolute` branch (`!emojiPickerPosition`) becomes dead code and is deleted.

## Files to Change

### `MessageActions.tsx`

Change `onMoreReactions` prop signature from `(clientY: number) => void` to `(rect: DOMRect) => void`.

In the click handler, change:
```tsx
onMoreReactions(e.clientY)
```
to:
```tsx
onMoreReactions((e.currentTarget as HTMLElement).getBoundingClientRect())
```

### `Message.tsx`

**Update `onMoreReactions` call site (hover bar, line 664):**

Change:
```tsx
onMoreReactions={messageActions.handleMoreReactions}
```
to pass a wrapper that captures the rect and routes through `openDesktopEmojiPicker`:
```tsx
onMoreReactions={(rect: DOMRect) => {
  emojiPicker.openDesktopEmojiPicker(message.messageId, rect);
}}
```

**Remove inline `absolute` branch (lines 673-689):**

Delete the entire `{emojiPickerOpen === message.messageId && !emojiPickerPosition && (...)}` block.

**Keep Portal branch unchanged (lines 693-713)** — this already works.

**Remove `emojiPickerOpenDirection` from props and usage** — no longer needed once inline branch is gone. Also remove from `arePropsEqual` (line 1464).

### `useEmojiPicker.ts`

Change `openDesktopEmojiPicker(messageId, clientY)` to `openDesktopEmojiPicker(messageId, rect)`:

```ts
const openDesktopEmojiPicker = useCallback(
  (messageId: string, rect: DOMRect) => {
    onSetEmojiPickerOpen(messageId);
    const pickerHeight = 480;
    const pickerWidth = 380;
    const y = rect.bottom + window.innerHeight - rect.bottom < pickerHeight + 16
      ? rect.top - pickerHeight - 4   // flip upward
      : rect.bottom + 4;              // open downward
    const x = Math.min(rect.right, window.innerWidth - pickerWidth - 8);
    onSetEmojiPickerPosition({ x, y });
  },
  [onSetEmojiPickerOpen, onSetEmojiPickerPosition]
);
```

Remove `onSetEmojiPickerDirection` from the hook's options and return value.

### Prop threading

`useEmojiPicker` currently only calls `onSetEmojiPickerOpen` and `onSetEmojiPickerDirection`. We add `onSetEmojiPickerPosition` to its options so it can set the Portal position directly, removing the split logic from `Message.tsx`.

This requires `Message.tsx` to pass `setEmojiPickerPosition` into `useEmojiPicker` options.

## State cleanup

After this change, `emojiPickerOpenDirection` and `setEmojiPickerOpenDirection` are unused. Remove them from:
- `MessageList.tsx` state declarations (lines 179-180) and prop passing (lines 338-339, 394-395)
- `Message.tsx` props interface and `arePropsEqual` comparator (line 1464)
- `useEmojiPicker.ts` options interface and internals

## Positioning logic

The Portal branch already clamps position:
```ts
left: Math.min(emojiPickerPosition.x, window.innerWidth - 400)
top: Math.min(emojiPickerPosition.y, window.innerHeight - 500)
```

We replace this with the rect-based calculation in `useEmojiPicker` (see above), which handles both downward/upward flip and right-edge clamping. The Portal branch then just uses `{ left: emojiPickerPosition.x, top: emojiPickerPosition.y }` directly.

## What is NOT changing

- Context-menu path (`onMoreReactions` in `MessageActionsMenu.tsx`) already uses Portal+position correctly — no change needed
- Mobile path (drawer) unchanged
- `EmojiPickerDrawer.tsx`, `ThreadPanel.tsx`, `DirectMessage.tsx` — no changes
- The `EmojiPicker` component itself — no changes

---

*Last updated: 2026-04-14*
