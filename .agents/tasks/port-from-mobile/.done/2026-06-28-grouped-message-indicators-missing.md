# Grouped/continuation messages drop per-message indicators (desktop + mobile)

**Status:** open
**Created:** 2026-06-28
**Scope:** cross-repo — quorum-desktop AND quorum-mobile

## Problem

When messages are grouped (consecutive messages from the same sender collapse the
repeated avatar + username + timestamp into compact continuation rows), several
**per-message** indicators are hidden on the continuation rows because they live
in the header block, which is hidden when compact. These indicators belong to the
individual message, not the header, so they should still show on grouped rows.

Reference for correct behaviour: **Discord** — grouped/continuation messages keep
the `(edited)` marker (and other per-message indicators) inline next to the text,
even though the avatar/name/time header is collapsed.

## Desktop — verified state (src/components/message/Message.tsx)

The compact branch (`isCompact ? ... : ...`, ~line 894) renders **only** the
signature/unsigned warning icon inline. Everything else lives in the non-compact
`<>` branch and is therefore dropped on grouped rows:

- `(edited)` — only in the header layouts (lines ~988 and ~1001, both inside the
  `!isCompact` branch). **Dropped on compact. Diverges from Discord.**
- Pinned icon — line ~920, header branch only. Dropped on compact.
- Bookmark icon — line ~939, header branch only. Dropped on compact.
- Unsigned/signature warning — KEPT on compact (line ~896). This one is fine.

## Mobile — state (quorum-mobile/components/Chat/MessagesList.tsx)

Continuation rows hide the entire `messageHeader` View in the three avatar-bearing
renderers (post/embed/sticker), dropping: `(edited)`, pinned icon,
unsigned-warning, and the sending spinner. (Mobile drops MORE than desktop — it
also loses the unsigned warning, which desktop keeps.)

## Fix direction

On both platforms, render the per-message indicators on compact rows too —
inline next to the message text, Discord-style. Keep avatar + username + timestamp
collapsed (that's the point of grouping); only the per-message *signals* should
survive: `(edited)`, pinned, bookmark, unsigned-warning, (mobile) sending spinner.

Desktop is the higher-confidence repo and holds the reference layout, so fix and
validate desktop first, then mirror on mobile.

## Not in scope

The consecutive-message-grouping feature itself. On mobile it ships separately
(branch `feat/consecutive-message-grouping`) and intentionally matches the
*current* desktop compact behaviour; this task fixes the indicator gap on both
platforms afterward.

*Last updated: 2026-06-28*
