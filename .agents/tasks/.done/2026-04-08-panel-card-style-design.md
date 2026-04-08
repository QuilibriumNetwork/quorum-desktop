# Panel Card Style — Design Spec

**Date:** 2026-04-08
**Scope:** All desktop dropdown panels (threads, bookmarks, notifications, pinned messages, search results)

---

## Goal

Bring desktop panel item styling in line with the mobile "card box" pattern already in use in `MobileDrawer`. Each list item sits inside its own rounded, bordered box rather than being a flat row separated only by a bottom border.

Mobile panels are **not changed** — they already use `mobile-drawer__item-box` and that path stays as-is.

---

## 1. New Color Tokens

Add to `src/styles/_colors.scss`, both light and dark themes:

```scss
--color-bg-panel-item: var(--surface-2);
--color-bg-panel-item-hover: var(--surface-3);
```

The panel container background is `var(--surface-0)`, so `surface-2` gives one clear step of elevation — the same relative contrast the mobile drawer uses between its background and item boxes.

---

## 2. `.panel-item-box` Class

Add to `src/styles/_dropdown-result-item.scss`:

```scss
.panel-item-box {
  background: var(--color-bg-panel-item);
  border-radius: $rounded-lg;
  border: $border solid var(--color-border-default);
  margin: $s-1 $s-3;
  overflow: hidden;
  transition: background-color $duration-150 $ease-in-out;

  &--interactive {
    cursor: pointer;

    &:active {
      background: var(--color-bg-panel-item-hover);
    }
  }
}
```

Strip logic — when `.dropdown-result-item` is nested inside `.panel-item-box`, the item's own padding/border/background are removed so the box provides all card styling:

```scss
.panel-item-box .dropdown-result-item {
  padding: 0;
  border-bottom: none;
  background: transparent;
}
```

Each panel component wraps its item rows in `<div className="panel-item-box panel-item-box--interactive">` on desktop, mirroring how mobile wraps them in `mobile-drawer__item-box--interactive`.

---

## 3. Section Headers

Section headers (e.g. "JOINED THREADS", "OLDER THREADS") are sticky labels that group items. With cards on items, headers need to read clearly as labels — not cards.

- `position: sticky; top: 0` — keep existing sticky behavior
- `background: var(--surface-0)` — same as panel background, blends into panel
- `border-bottom: $border solid var(--color-border-muted)` — clean separator between header and cards below
- `font-size: $text-xs`, `font-weight: $font-semibold`, `color: var(--color-text-subtle)` — muted label style
- `padding: $s-3 $s-4 $s-1` — tight vertical, aligns with card margins
- No border-radius, no card box

---

## 4. Panel Container Border

The `DropdownPanel` container currently has only a `box-shadow`. Add:

```scss
border: $border solid var(--color-border-default);
```

This gives the panel a defined edge, separating it cleanly from the main UI content behind it. The existing shadow is kept.

**File:** `src/components/ui/DropdownPanel.scss` — add border to `.dropdown-panel`.

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/styles/_colors.scss` | Add `--color-bg-panel-item` and `--color-bg-panel-item-hover` to light + dark themes |
| `src/styles/_dropdown-result-item.scss` | Add `.panel-item-box` class + strip logic |
| `src/components/ui/DropdownPanel.scss` | Add border to `.dropdown-panel` |
| `src/components/bookmarks/BookmarksPanel.tsx` | Wrap desktop items in `.panel-item-box--interactive` |
| `src/components/bookmarks/BookmarksPanel.scss` | Adjust list padding to account for card margins |
| `src/components/notifications/NotificationPanel.tsx` | Wrap desktop items in `.panel-item-box--interactive` |
| `src/components/notifications/NotificationPanel.scss` | Adjust list padding |
| `src/components/message/PinnedMessagesPanel.tsx` | Wrap desktop items in `.panel-item-box--interactive` |
| `src/components/message/PinnedMessagesPanel.scss` | Adjust list padding |
| `src/components/search/SearchResultItem.tsx` | Wrap in `.panel-item-box--interactive` on desktop |
| `src/components/search/SearchResultItem.scss` | Adjust padding |
| `src/components/thread/ThreadsListPanel.tsx` | Wrap items + restyle section headers |
| `src/components/thread/ThreadsListPanel.scss` | Section header styles + list padding |

---

## 6. Out of Scope

- Mobile drawer styles — untouched
- `DropdownPanel` shadow value — untouched
- Any panel not listed above (e.g. emoji picker, member list)
- Light/dark theme color value tuning — done visually after implementation

---

*Last updated: 2026-04-08*
