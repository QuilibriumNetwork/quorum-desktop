# Simplified Message Actions Toolbar

## Summary

Reduce the message hover toolbar from 12+ buttons to just 6: three preferred emoji reactions, emoji picker, reply, and a dots menu button that opens the full context menu.

## Current State

The `MessageActions` toolbar shows all available actions inline:
`[emoji1] [emoji2] [emoji3] | [emoji-picker] | [reply] [thread] [copy-link] [copy-msg] [bookmark] | [edit] [history] | [pin] [delete]`

## New Layout

`[emoji1] [emoji2] [emoji3] | [emoji-picker] [reply] [dots]`

- **Separator** moves to right after the 3 preferred emojis
- **Dots button** (`IconDots`, already in icon map) opens the full context menu
- All removed toolbar buttons remain accessible via the context menu

## Dots Button Behavior

- Opens `MessageActionsMenu` (same component as right-click context menu)
- **Positioning:** Anchored to dots button, menu appears to its **left**
- Flips upward if near viewport bottom (existing flip logic in `MessageActionsMenu`)
- Position derived from `getBoundingClientRect()` of the dots button

## Files to Change

1. **`MessageActions.tsx`** — Remove buttons after reply. Add dots button with ref. On click, compute position from bounding rect and invoke callback or open context menu.
2. **`Message.tsx`** — Wire dots click to show `MessageActionsMenu` at the provided position. Reuse existing `contextMenu` state.

## What Stays the Same

- Right-click context menu unchanged (same component, cursor-positioned)
- Mobile drawer behavior unchanged
- All action handlers unchanged
- `MessageActionsMenu` component unchanged
- Icon map unchanged (`dots` already mapped to `IconDots`)

---

*Updated: 2026-03-09*
