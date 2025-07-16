# Right Sidebar Overlay Issue - Navbar Still Visible

## Issue Description

When the right sidebar (users panel) is opened on mobile/tablet screens (below 1024px), the navbar space icons remain visible on top of the overlay backdrop. This creates a broken UX where the navbar appears to "float" above the overlay.

## Expected Behavior

- User clicks users icon (👥) to open right sidebar
- Overlay backdrop should cover the entire screen including navbar
- Only the right sidebar should be visible above the overlay
- Clicking overlay should close the sidebar

## Current Behavior

- User clicks users icon (👥) to open right sidebar
- Overlay backdrop appears but navbar space icons are still visible on top
- Navbar appears to "float" above the overlay
- Right sidebar appears correctly above overlay

## Screenshots

Latest screenshot: `.claude/screenshots/172.png` shows the issue clearly - space icons (Quorum logo, blue icon, green icon) are visible on top of the dark overlay.

## Technical Context

### Z-Index Hierarchy Attempted

Multiple z-index values have been tried:

- **Navbar**: `z-index: 999` (fixed in NavMenu.scss)
- **Overlay**: Tried `z-40`, `z-[1000]`, `z-[9998]`
- **Right Sidebar**: Tried `z-50`, `z-[1001]`, `z-[9999]`

### Components Involved

**1. Right Sidebar Overlay (both components):**

```tsx
// DirectMessage.tsx line ~517
{
  showUsers && (
    <div
      className="fixed inset-0 bg-mobile-overlay z-[9998] lg:hidden"
      onClick={() => setShowUsers(false)}
    />
  );
}

// Channel.tsx line ~613
{
  showUsers && (
    <div
      className="fixed inset-0 bg-mobile-overlay z-[9998] lg:hidden"
      onClick={() => setShowUsers(false)}
    />
  );
}
```

**2. Right Sidebar Content:**

```tsx
// Both components have similar structure
<div className={
  'w-[260px] bg-mobile-sidebar mobile-sidebar-right overflow-scroll ' +
  'transition-transform duration-300 ease-in-out ' +
  (showUsers
    ? 'translate-x-0 fixed top-0 right-0 h-full z-[9999] lg:relative lg:top-auto lg:right-auto lg:h-auto lg:z-auto'
    : 'translate-x-full fixed top-0 right-0 h-full z-[9999] lg:relative lg:top-auto lg:right-auto lg:h-auto lg:z-auto')
}>
```

**3. Navbar (NavMenu.tsx):**

```tsx
<header>
  {' '}
  // Has z-index: 999 in NavMenu.scss
  <div className="nav-menu-logo">
    <Link to="/messages">
      <SpaceIcon /> // These icons remain visible
    </Link>
  </div>
  <div className="nav-menu-spaces">
    {spaces.map((space) => (
      <SpaceButton />
    ))}{' '}
    // These remain visible
  </div>
</header>
```

### Root Cause Analysis

The issue persists despite using the same z-index solution (`z-[9998]` and `z-[9999]`) that successfully fixed the modal navbar issue documented in `.claude/docs/new-modal-component.md`.

**Possible Causes:**

1. **Stacking Context Issues**: The navbar might be creating its own stacking context that isolates it from the overlay's z-index
2. **Component Hierarchy**: The overlay might be rendered at a level in the component tree that doesn't affect the navbar
3. **CSS Specificity**: Some CSS rule might be overriding the z-index values
4. **Transform Context**: The responsive layout transforms might be creating new stacking contexts

### Attempted Solutions

1. **Z-Index Escalation**: Tried increasing from `z-40` → `z-[1000]` → `z-[9998]`
2. **Modal Solution Application**: Applied exact same z-index values as the successful modal fix
3. **Hierarchy Adjustment**: Updated both overlay and sidebar z-index values together

### Related Solutions

Check `.claude/docs/new-modal-component.md` for the successful modal fix that solved a similar navbar z-index issue. The modal solution used:

- Direct rendering (no portals)
- `z-[9999]` for modal content
- Rendering at AppWithSearch level

### Files Modified During Debugging

- `src/components/direct/DirectMessage.tsx` - Overlay z-index changes
- `src/components/channel/Channel.tsx` - Overlay z-index changes
- `src/components/search/SearchBar.tsx` - Fixed search highlighting issue (working)

### Additional Context

**Search Field Issue**: Successfully fixed the search field highlighting issue using centralized focus management. This part is working correctly.

**Left Sidebar**: Working correctly with smooth animations and proper z-index behavior.

**Right Sidebar Animation**: Working correctly - slides in/out with proper transitions.

**The Core Problem**: Only the navbar visibility over overlay remains broken.

## Next Steps for Investigation

1. **Inspect Stacking Context**: Check if navbar creates its own stacking context
2. **Component Tree Analysis**: Verify where overlay is rendered vs navbar
3. **CSS Audit**: Look for any CSS rules affecting navbar z-index
4. **Alternative Solutions**: Consider moving overlay to higher component level like modal solution did
5. **Browser DevTools**: Use z-index inspector to understand actual stacking order

## Browser Info

Issue occurs across different screen sizes between 768px-1024px (mobile/tablet breakpoint).

## Priority

High - This breaks the mobile UX for the users panel feature.
