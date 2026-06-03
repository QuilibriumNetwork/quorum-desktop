---
type: doc
title: Responsive Layout System Documentation
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# Responsive Layout System Documentation

## Overview

The Quorum Desktop application uses a 3-column shell (NavRail + Sidebar + main content) that adapts to phone, tablet, and desktop viewports. On desktop the rail and sidebar are inline and the sidebar is user-resizable via a drag handle; on tablet they shrink to fixed-collapsed widths; on phone both collapse into an off-canvas drawer that opens from a per-view hamburger button.

## Breakpoint Strategy

The current shell uses three viewport buckets, computed from `window.innerWidth` in [useShellState.ts](src/components/shell/useShellState.ts) and mirrored in `_variables.scss`:

| Bucket | Width range | Source |
|--------|-------------|--------|
| `phone` | ≤ 767px | `PHONE_MAX = 767` |
| `tablet` | 768–1023px | `TABLET_MAX = 1023` |
| `desktop` | ≥ 1024px | (default) |

The shell exposes `viewport: 'phone' | 'tablet' | 'desktop'` from `useShellState()`. Components that need to branch on viewport read this value rather than running their own `matchMedia` queries.

> A legacy `useResponsiveLayout` hook still exists in `src/hooks/useResponsiveLayout.ts` and is consumed by a handful of feature components (Channel header, DirectMessage header, ThreadPanel, MessageComposer, the Appearance settings tab). New code should prefer `useShellState().viewport`.

## Core Components

### 1. Shell state (`src/components/shell/useShellState.ts`)

```typescript
export interface ShellState {
  railCollapsed: boolean;
  sidebarCollapsed: boolean;       // derived: sidebarWidth <= SIDEBAR_COLLAPSED_WIDTH
  sidebarWidth: number;            // px; persisted in localStorage as shell.sidebarWidth
  setSidebarWidth: (px: number) => void;
  toggleRailCollapsed: () => void;
  toggleSidebarCollapsed: () => void;

  viewport: 'phone' | 'tablet' | 'desktop';
  drawerOpen: boolean;             // phone-only off-canvas drawer
  openDrawer: () => void;
  closeDrawer: () => void;
}
```

**Key behaviours:**

- Mounted by `ShellStateProvider` inside `AppShell`; every consumer (NavRail, Sidebar, SpacesSidebar, etc.) reads from the same instance.
- On tablet/phone the effective `sidebarWidth` is forced to `SIDEBAR_COLLAPSED_WIDTH` regardless of the persisted desktop preference.
- Drawer auto-closes whenever the viewport grows past phone.

### 2. AppShell (`src/components/shell/AppShell.tsx`)

The shell renders three slots — `app-shell__rail`, `app-shell__sidebar`, `app-shell__main` — plus a drag handle and (on phone, when `drawerOpen`) a focus-trapped off-canvas drawer that mounts NavRail + Sidebar.

## Layout Behavior

### Desktop (≥ 1024px)

- **NavRail**: inline left rail. Collapsed (`$rail-width-collapsed: 72px`) or expanded (`$rail-width-expanded: 236px`) per the user's persisted preference (`shell.railCollapsed`).
- **Sidebar**: inline, user-resizable. Width persisted as `shell.sidebarWidth`. Range: `SIDEBAR_COLLAPSED_WIDTH` (72px) up to `SIDEBAR_MAX_WIDTH` (480px). Default `300px`.
- **Drag handle**: a thin separator on the sidebar's right edge. Hover-arms after 500ms to reveal the accent tint (`--shell-drag-handle-hover-color`). Releasing below `SIDEBAR_SNAP_THRESHOLD` (200px) snaps to the collapsed strip; releasing above snaps to `SIDEBAR_MIN_WIDTH` (240px). Keyboard: arrow keys nudge by 16px, Home/End jump to min/max.
- **Channels mode**: when the route matches `/spaces/:spaceId/:channelId`, the sidebar is pinned to a fixed 300px (`CHANNELS_SIDEBAR_WIDTH` in `AppShell.tsx`) and the drag handle is suppressed. The user's persisted width is left untouched and restored when leaving the channel.
- **Main**: receives `--shell-sidebar-width` as a CSS variable on the shell root.

### Tablet (768–1023px)

- **NavRail**: forced collapsed (`72px`).
- **Sidebar**: forced collapsed (`72px`) — the user's persisted desktop width is preserved but not applied.
- **Drag handle**: not rendered.

### Phone (≤ 767px)

- **NavRail** and **Sidebar**: hidden from the inline layout (`app-shell__rail--hidden`, `app-shell__sidebar--hidden`).
- **Drawer**: when `drawerOpen` is true, a slide-in panel mounts both the rail and the sidebar (with `forceExpanded` so avatars-only would be useless inside the drawer). The drawer is `role="dialog"` with a focus trap and an Escape handler; the previously-focused element is restored on close.
- **Drawer trigger**: lives in each view's chat header (`DirectMessage`, `Channel`, `EmptyDirectMessage`, `DiscoverPage`) — it's not part of the shell itself.
- **Auto-close**: navigating to a "leaf" route (a DM conversation, a channel, or Public Spaces) closes the drawer automatically.

## Key Implementation Files

### NavRail layout (`src/components/shell/NavRail.scss`, sizes in `_variables.scss`)

```scss
$rail-width-collapsed: 72px;
$rail-width-expanded: 236px;
```

The rail does not have its own breakpoint logic — its width follows the shell's `railCollapsed` / `viewport` state via the `app-shell__rail--collapsed | --expanded | --hidden` slot classes.

### Sidebar width (`_variables.scss` + `useShellState.ts`)

```scss
$sidebar-width: 300px;          // default expanded width
$sidebar-width-collapsed: 72px; // strip layout
```

```typescript
export const SIDEBAR_COLLAPSED_WIDTH = 72;
export const SIDEBAR_MIN_WIDTH = 240;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_SNAP_THRESHOLD = 200;
```

`shell.sidebarWidth` in localStorage holds the user's last free-drag width. The legacy `shell.sidebarCollapsed` boolean is read once on first load for migration and kept mirrored on write so a rollback still picks up a sensible state.

### Chat Content Width Fix (`src/styles/_chat.scss`)

```scss
// Override desktop width constraints for mobile
@media (max-width: 1023px) {
  .message-list {
    width: 100% !important; // Override calc(100vw - 584px)
  }

  .message-content {
    width: 100% !important;
    max-width: 100% !important;
  }

  .message-editor {
    max-width: 100% !important; // Override 850px constraint
  }
}
```

### Header Layout (`Channel.tsx` / `DirectMessage.tsx`)

```tsx
// Responsive header structure
<div className="flex flex-col lg:flex-row lg:justify-between lg:items-center">
  {/* Mobile: search + hamburger on top */}
  <div className="flex flex-row items-center gap-2 lg:order-2 justify-between lg:justify-start">
    {isMobile && (
      <FontAwesomeIcon
        onClick={toggleLeftSidebar}
        icon={faBars}
        className="hamburger-menu"
      />
    )}
    <GlobalSearch className="flex-1 lg:flex-none max-w-xs lg:max-w-none" />
    <FontAwesomeIcon icon={faUsers} onClick={toggleRightSidebar} />
  </div>

  {/* Title/channel info */}
  <div className="lg:order-1">{/* Channel/user information */}</div>
</div>
```

## Right Sidebar System

Both mobile and desktop use a consistent overlay system:

```tsx
<div
  className={
    'w-[260px] bg-mobile-sidebar p-3 overflow-scroll ' +
    'transition-transform duration-300 ease-in-out ' +
    (showUsers
      ? 'translate-x-0 fixed top-0 right-0 h-full z-50 lg:relative lg:top-auto lg:right-auto lg:h-auto lg:z-auto'
      : 'translate-x-full hidden')
  }
>
  {/* Sidebar content */}
</div>;

{
  /* Mobile backdrop */
}
{
  showUsers && (
    <div
      className="fixed inset-0 bg-mobile-overlay z-40 lg:hidden"
      onClick={() => setShowUsers(false)}
    />
  );
}
```

## CSS Class Patterns

### Responsive Layout Classes

- `lg:flex-row` / `flex-col` - Layout direction switching
- `lg:justify-between` / `justify-start` - Content justification
- `lg:order-1` / `lg:order-2` - Element reordering
- `lg:relative` / `fixed` - Positioning strategy

### Width Management

- `flex-1 lg:flex-none` - Flexible width on mobile, fixed on desktop
- `max-w-xs lg:max-w-none` - Width constraints
- `!important` overrides for desktop CSS conflicts

### Overlay System

- `fixed top-0 right-0 h-full z-50` - Mobile overlay positioning
- `lg:relative lg:top-auto lg:right-auto` - Desktop static positioning
- `translate-x-0` / `translate-x-full` - Slide animations

## Container Width

The shell exposes the current sidebar width as a CSS variable on the AppShell root:

```scss
.app-shell {
  // --shell-sidebar-width is set inline in AppShell.tsx (defaults to the
  // user's persisted shell.sidebarWidth, or CHANNELS_SIDEBAR_WIDTH when
  // the channels sidebar is mounted).
}
```

Downstream features can read `var(--shell-sidebar-width)` if they need to size relative to the sidebar, instead of hard-coding pixel widths. On phone the rail and sidebar are absent from the inline flow, so main occupies 100%.

## Common Issues & Solutions

### 1. Empty Space on Right Side

**Problem**: Desktop width constraints causing whitespace
**Solution**: Override with mobile-specific `width: 100% !important`

### 2. Left Sidebar Still Visible

**Problem**: Using only `transform` hiding
**Solution**: Use `display: none` by default, `display: flex` when open

### 3. Right Sidebar Breaking Desktop

**Problem**: Mobile overlay classes affecting desktop
**Solution**: Proper `lg:` prefix usage for desktop restoration

### 4. Search Bar Too Wide on Mobile

**Problem**: Full width search on small screens
**Solution**: `max-w-xs` constraint on mobile, `lg:max-w-none` on desktop

## Z-Index Hierarchy

- **Mobile Overlay Backdrop**: `z-40`
- **Right Sidebar**: `z-50`
- **Left Sidebar**: `z-60`
- **Modals/Dropdowns**: `z-[1000]+`

## Testing Guidelines

### Breakpoint Testing

1. Test at 1024px boundary (tablet ↔ desktop) — rail/sidebar should switch from forced-collapsed to user-controlled width.
2. Test at 768px boundary (phone ↔ tablet) — drawer should disappear from the layout in favour of the inline collapsed strip.
3. Verify the drag handle is present on desktop and absent on tablet/phone.
4. Verify channels mode pins the sidebar at 300px on desktop regardless of the user's persisted width.

### Interaction Testing

- Hamburger menu toggle functionality
- Backdrop dismissal for both sidebars
- Search bar responsiveness
- Auto-close on screen resize

### Visual Testing

- No horizontal scroll on any screen size
- Proper content expansion when sidebars hidden
- Smooth animations during transitions
- Icon and text legibility at all sizes

## Performance Considerations

- `useLayoutEffect` for immediate screen size detection
- CSS transforms for smooth animations
- `transition-transform duration-300` for consistent timing
- Minimal re-renders with proper dependency arrays

## Modal Responsive System

### Overview

A comprehensive modal system has been implemented with consistent responsive behavior and reusable CSS classes in `src/styles/_modal_common.scss`.

### Modal Types

#### Complex Modals (UserSettingsModal, SpaceSettingsModal)

- **Desktop**: Sidebar navigation with main content area
- **Mobile**: Stacked category navigation with 1-column or 2-column layouts
- Uses `.modal-complex-container`, `.modal-complex-layout`, `.modal-complex-content`

#### Small Modals (ChannelEditorModal)

- **All screens**: Compact, auto-sized containers
- Uses `.modal-small-container`, `.modal-small-layout`, `.modal-small-content`

### Navigation Patterns

```scss
// Single column for ≤3 categories
.modal-nav-mobile-single {
  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
}

// 2-column grid for 4-6 categories
.modal-nav-mobile-2col {
  @media (max-width: 768px) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 16px;
  }
}
```

### Common Classes

- `.modal-content-header` - Header with icon/banner and text
- `.modal-content-section` - Main content areas with auto-sizing
- `.modal-content-actions` - Button containers (right-aligned desktop, left-aligned mobile)
- `.modal-content-info` - Input fields and form content
- `.modal-icon-editable` / `.modal-banner-editable` - Interactive media elements

### Responsive Features

- **768px breakpoint** for mobile/desktop switching
- **Address truncation** (first 4 + last 4 characters) on mobile
- **Flexible button layouts** prevent text cutoff in different languages
- **Proper dropdown positioning** relative to parent containers

## Future Enhancement Areas

1. **Gesture Support**: Swipe gestures for sidebar navigation
2. **Persistence**: Remember sidebar preferences across sessions
3. **Animation Customization**: User-configurable animation speeds
4. **Accessibility**: Enhanced keyboard navigation and screen reader support

---

*Last updated: 2026-06-04*
