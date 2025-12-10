# Responsive Layout System Documentation

## Overview

The Quorum Desktop application has been enhanced with a comprehensive responsive layout system to provide optimal user experience across desktop, tablet, and mobile devices. The system transforms the multi-sidebar desktop layout into a mobile-friendly overlay system while maintaining full desktop functionality.

## Breakpoint Strategy

### Primary Breakpoint: 1024px

- **Desktop**: ≥1024px - Full sidebar layout with fixed positioning
- **Mobile/Tablet**: <1024px - Overlay system with hidden left sidebar

### Phone-specific Optimization: 480px

- **Phones**: ≤480px - Additional optimizations for very small screens
- NavMenu width reduction (74px → 50px)
- Icon size reduction (48px → 32px)

## Core Components

### 1. Responsive Layout Context (`src/hooks/useResponsiveLayout.ts`)

```typescript
interface ResponsiveLayoutState {
  isMobile: boolean; // Screen width < 1024px
  leftSidebarOpen: boolean; // Left sidebar overlay state
  toggleLeftSidebar: () => void;
  closeLeftSidebar: () => void;
}
```

**Key Features:**

- Automatic screen size detection using `window.matchMedia`
- Centralized sidebar state management
- Auto-close on desktop transition

### 2. Context Provider (`src/components/context/ResponsiveLayoutProvider.tsx`)

Wraps the entire application in `App.tsx` to provide global responsive state access.

## Layout Behavior

### Desktop (≥1024px)

- **Left Sidebar**: Always visible, fixed position
- **Right Sidebar**: Pushes content when open
- **NavMenu**: Full width (74px)
- **Search Bar**: Full width available
- **Layout**: `lg:relative lg:flex-row lg:justify-between`

### Mobile/Tablet (<1024px)

- **Left Sidebar**: Hidden by default, overlay when open
- **Right Sidebar**: Overlay system with backdrop
- **NavMenu**: Compact width (50px on phones)
- **Search Bar**: Limited width with responsive constraints
- **Layout**: `flex-col` stacking with hamburger navigation

## Key Implementation Files

### NavMenu Optimization (`src/components/navbar/NavMenu.scss`)

```scss
// Mobile optimization for phones
@media (max-width: 480px) {
  .nav-menu {
    width: 50px; // Reduced from 74px
  }
  .nav-icon {
    width: 32px; // Reduced from 48px
    height: 32px;
  }
}
```

### Left Sidebar Responsive Behavior

**Space.scss / DirectMessages.scss:**

```scss
@media (max-width: 1023px) {
  .left-sidebar {
    display: none; // Hidden by default

    &.open {
      display: flex;
      position: fixed;
      left: 74px; // After NavMenu (50px on phones)
      width: 250px; // 220px on phones
      height: 100vh;
      z-index: 60;
      transform: translateX(0);
      transition: transform 0.3s ease-in-out;
    }
  }
}
```

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

## Container Width Calculations

```scss
// Container.scss responsive width
.container {
  @media (max-width: 1023px) {
    width: calc(100vw - 74px); // Tablet
  }

  @media (max-width: 480px) {
    width: calc(100vw - 50px); // Phone
  }
}
```

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

1. Test at 1024px boundary (desktop ↔ mobile transition)
2. Test at 480px boundary (tablet ↔ phone transition)
3. Verify sidebar behavior at each breakpoint

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

_Verified: 2025-12-09 - File paths confirmed current_
