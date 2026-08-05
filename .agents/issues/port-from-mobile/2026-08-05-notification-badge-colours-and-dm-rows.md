---
type: task
title: "Notification badges: colour the type badge per kind, and decide whether DMs belong in the panel at all"
status: open
priority: medium
created: 2026-08-05
area: notifications / NotificationItem / theme tokens
runtime_test: required
related:
  - "quorum-mobile/.agents/issues/2026-08-05-rich-in-app-notifications-plan.md (the mobile work this comes from)"
  - "quorum-mobile/.agents/docs/features/notification-system.md (mobile reference spec)"
  - "candidates.md"
---

# Notification badges: colour per kind, and the DM question

Two parts, deliberately unequal. **Part 1 is a small, fully-specified port.**
**Part 2 is a research task with no design attached** — do not treat them as one
piece of work, and do not let part 2 hold part 1 up.

## Part 1 — colour the type badge per notification kind

### What mobile does

Mobile gives the leading 36px badge a hue per kind, so the kind is readable
while scanning without reading a word of the row:

| Kind | Hue | Reasoning |
|---|---|---|
| `@everyone` | red | interrupts a whole space |
| `@you` | orange | aimed at you by name |
| role mention | green | reached you via a hat you happen to wear |
| reply | blue | continues something you already said |

The circle behind the glyph is the **same hue at 16% alpha**, and the glyph
itself is the solid hue, so the badge reads as one tinted object rather than a
coloured mark on a grey disc.

`@you` and reply take the two most separated hues on purpose: they are the two
*personal* kinds and sit next to each other constantly, so two shades of one
idea would not separate them.

### Why this is nearly free here

Desktop's badge is already the same object, built from the same reasoning — see
the comment in `NotificationItem.scss`: *"Mirrors the mobile notifications
screen so the type is scannable at a glance."* It already uses a **16%
color-mix wash**, the same ratio mobile settled on independently:

```scss
.notification-badge {
  background-color: color-mix(in srgb, var(--accent) 16%, transparent);
}
.notification-badge-icon { color: var(--accent); }
```

The only thing missing is that both read one fixed `var(--accent)`. The kind is
already computed one screen up, in `NotificationItem.tsx`, to pick the glyph:

```ts
const isReply = 'type' in notification && notification.type === 'reply';
const mentionType = 'mentionType' in notification ? notification.mentionType : null;
const typeIcon: IconName = isReply ? 'reply'
  : mentionType === 'everyone' ? 'bullhorn'
  : mentionType === 'roles' ? 'shield'
  : 'at';
```

So the port is: derive a kind slug next to `typeIcon`, put it on the badge as a
modifier class, and let SCSS pick the hue.

### Tokens

Three of the four already exist as semantic CSS variables and should be used
rather than raw hexes — they are already light/dark aware:

| Kind | Token |
|---|---|
| `@everyone` | `var(--danger)` |
| role mention | `var(--success)` |
| reply | `var(--info)` |
| generic / fallback | `var(--accent)` |

**Orange is the one gap.** There is no orange semantic token. Do NOT reach for
`--warning` — it is an amber that reads as a caution state, and a mention is not
a warning. Mobile uses `#f97316` (the `orange.500` step of its accent palette).
Add a token for it alongside the others rather than inlining the hex, so a skin
can override it like everything else.

### Suggested shape

Drive both the wash and the glyph from one local custom property, so they can
never drift apart:

```scss
.notification-badge {
  --badge-accent: var(--accent);
  background-color: color-mix(in srgb, var(--badge-accent) 16%, transparent);

  &--everyone { --badge-accent: var(--danger); }
  &--you      { --badge-accent: var(--mention-you); }  // the new orange token
  &--roles    { --badge-accent: var(--success); }
  &--reply    { --badge-accent: var(--info); }
}

.notification-badge-icon { color: var(--badge-accent); }  // inherits
```

### Verify

- One of each kind in the panel, in **both light and dark** — the wash has to
  stay visible against `--surface-2` and `--surface-3` on both. Mobile's plain
  untinted `--surface-3` was "nearly invisible in dark mode" per the existing
  SCSS comment, so this is a known-live risk on this surface.
- A kind with no modifier class still renders a themed badge, not a transparent
  hole (the `--badge-accent` default covers it — confirm it does).
- The badge is `aria-hidden`, so colour is decorative and carries no information
  a screen reader loses. Confirm that stays true: if colour ever becomes the
  ONLY signal for a kind, the glyph must keep carrying it too.

## Part 2 — DMs in the notification panel (research, no design attached)

**Desktop has no DM notifications at all today.** The panel is built from
`MentionNotification` (`hooks/business/mentions`) and `ReplyNotification`
(`types/notifications`) — both space-scoped. There is no DM row to colour, which
is why part 1 says nothing about one.

Mobile now has them, and the shape it landed on is worth knowing before
designing anything here:

- A DM row is keyed **per conversation**, not per message, so an active chat
  refreshes one row instead of appending one per message.
- The leading slot shows the **sender's avatar**, or their **initials** when
  there is no picture. Never a glyph. A DM is from somebody and the row should
  say who.
- Rows are gated on DM mute, and never raised for your own messages echoed from
  another device.

**Do not port this as-is.** Per `workflow.md`: port the capability, not the UX
pattern — and here the underlying architectures genuinely differ. Mobile can do
this cheaply because it PERSISTS a notification log at the WebSocket receive
point; desktop derives notifications live from `MessageDB` per-space. Adding DMs
to a live-derived, space-scoped panel is a design question, not a port.

Before any of that, there is a **product-scope call to make**: desktop's panel
is per-space (a bell in the channel header), so "a DM notification" has no
obvious home in it. That may mean desktop wants a global panel first, or that
DMs belong somewhere else entirely on this client.

So the actual task here is:

1. Decide whether desktop wants DM notifications at all, and in which surface.
2. If yes, work out where they come from given the live-derived model — and
   whether that pushes desktop toward a persisted log (which is the bigger,
   separate question mobile's reference spec discusses under "Critical design
   point for the desktop port").
3. Only then design the row.

Log the outcome in `candidates.md` either way, including "decided against" —
that is worth as much as a port.

## Scope note

Part 1 does not depend on part 2 and should ship on its own. If part 2 later
adds a DM row, it will want an avatar in the leading slot rather than a badge,
so it will not need a fifth hue.

*Last updated: 2026-08-05*
