---
type: doc
title: Dropdown Panels
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-04-08T00:00:00.000Z
---

# Dropdown Panels

## Overview

Dropdown panels are the desktop overlay UI for Search, Notifications, Bookmarks, Pinned Messages, and Threads. On mobile they render inside `MobileDrawer` (bottom sheet). On desktop they render as floating `DropdownPanel` cards with a shared visual design: elevated surface, bordered item cards, and panel-scoped field styles.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/components/ui/DropdownPanel.tsx` / `.scss` | Shared panel shell (header, close button, content wrapper, animations) |
| `src/styles/_dropdown-result-item.scss` | All shared item classes: `.panel-item-box`, `.dropdown-result-item`, `.dropdown-results-list`, empty/loading states |
| `src/styles/_colors.scss` | Panel-specific CSS tokens (see below) |
| `src/components/ui/MobileDrawer.tsx` | Bottom sheet used on touch devices |

---

## Desktop Visual Design (panel card pattern)

Each panel uses a layered surface approach:

```
DropdownPanel (surface-2 background, surface-5 border)
  └── .dropdown-results-list (same surface-2 bg, padding-top: $s-4, desktop-only)
        └── .panel-item-box  (surface-2 bg, surface-5 border, $s-4 margin)
              └── item component (transparent bg, no border-bottom)
```

### CSS Tokens (`src/styles/_colors.scss`)

```scss
--color-bg-panel:            var(--surface-2);  // panel and list background
--color-bg-panel-item:       var(--surface-2);  // card background (same as panel)
--color-bg-panel-item-hover: var(--surface-3);  // card hover state
--color-border-panel:        var(--surface-5);  // panel outer border + card borders
```

Cards have the same background as the panel — the border (`surface-5`) provides visual separation. Hover lifts to `surface-3`.

### `.panel-item-box` modifiers

```scss
.panel-item-box--interactive   // cursor: pointer + hover + active (fully clickable card)
.panel-item-box--hoverable     // hover only, no pointer cursor (card has child buttons)
```

Bookmarks and Pinned Messages use `--hoverable`; Search, Notifications, and Threads use `--interactive`.

### Transparent item children (global rule)

```scss
// src/styles/_dropdown-result-item.scss
.panel-item-box > * {
  background-color: transparent !important;
  border-bottom: none !important;
  &:hover, &:focus { background-color: transparent !important; }
}
```

This globally resets any item component's own hover/bg styles when inside a panel card, regardless of whether the item extends `.dropdown-result-item` or not (e.g. `notification-item` does not extend it). No per-component override needed.

### Input/Select field styles inside panels

`.dropdown-panel` overrides the field CSS variables so inputs and selects blend with the panel background:

```scss
.dropdown-panel {
  --color-field-bg:              var(--color-bg-panel-item);
  --color-field-bg-focus:        var(--color-bg-panel-item-hover);
  --color-field-bg-filled:       var(--color-bg-panel-item);
  --color-field-bg-filled-focus: var(--color-bg-panel-item-hover);
  --color-field-border-focus:    var(--color-border-stronger); // subtle, not accent
  --color-field-focus-shadow:    transparent;
}
```

These cascade to all `Input` and `Select` primitives inside the panel (header and content) without repeating the overrides.

### Desktop-only list styles

`.dropdown-results-list` scopes background, padding, and scroll to desktop only:

```scss
.dropdown-results-list {
  @media (hover: hover) and (pointer: fine) {
    background: var(--color-bg-panel);
    padding-top: $s-4;
    padding-bottom: 0;
    overflow-y: auto;
    max-height: $s-80 + $s-7; // 350px default, overridden per panel
  }
}
```

**Critical:** some components apply `search-results-list` / `pinned-messages-list` to Virtuoso in **both** mobile and desktop paths. Keeping background/padding inside the media query prevents panel styles from leaking into the mobile drawer.

---

## Mobile Implementation

On touch devices (`isTouchDevice() === true`) each panel renders its items inside `MobileDrawer` using:

```tsx
<div className="mobile-drawer__item-box mobile-drawer__item-box--interactive">
  <ItemComponent />
</div>
```

**Never** use `.panel-item-box` on mobile. The `mobile-drawer__item-box` class provides the mobile card styling via `_mobile-drawer.scss`. The `.panel-item-box > *` rule in `_dropdown-result-item.scss` does not affect mobile because `panel-item-box` is never present there.

### Section headers (Threads)

`threads-section-header` is shared between mobile and desktop paths in the same component. The background is scoped by list wrapper:

```scss
.threads-section-header {
  background: var(--color-bg-mobile-drawer); // mobile default
}
.threads-results-list .threads-section-header {
  background: var(--color-bg-panel); // desktop override
}
```

---

## Per-Panel Notes

| Panel | List class | Desktop item wrapper | Max-height |
|-------|-----------|----------------------|------------|
| Search | `search-results-list` | `panel-item-box--interactive` | 340px |
| Notifications | `notification-panel__list` | `panel-item-box--interactive` | 350px |
| Bookmarks | `bookmarks-list` | `panel-item-box--hoverable` | 400px (inline) |
| Pinned Messages | `pinned-messages-list` | `panel-item-box--hoverable` | 350px (inline) |
| Threads | `threads-results-list` | `panel-item-box--interactive` | 600px (inline) |

---

## Adding a New Panel

1. Wrap desktop items in `<div className="panel-item-box panel-item-box--interactive">` (or `--hoverable`).
2. Wrap mobile items in `<div className="mobile-drawer__item-box mobile-drawer__item-box--interactive">`.
3. Apply `@extend .dropdown-results-list` to the list container in the panel's SCSS.
4. Any shared CSS classes applied to Virtuoso in **both** paths must not carry desktop-only styles — use the media query guard in `.dropdown-results-list` as the pattern.
5. No per-panel overrides for field bg, item bg, border resets, or hover resets — those are all handled globally.

---

_Last updated: 2026-04-08_
