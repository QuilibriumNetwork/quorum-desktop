---
type: bug
title: MobileDrawer Virtuoso Double Scroller CSS Issues
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# MobileDrawer Virtuoso Double Scroller CSS Issues

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

### Primary Issue: Double Scrolling
When using Virtuoso components inside MobileDrawer for displaying lists (SearchResults, PinnedMessagesPanel), two scrollbars appear:
1. **Inner Virtuoso scroller**: Manages individual list items (EXPECTED)
2. **Outer MobileDrawer scroller**: Scrolls the entire panel content (PROBLEMATIC)

This creates a confusing UX where users can scroll at two different levels, causing:
- Difficulty reaching items at the bottom of lists
- Last items in lists being cut off or not completely visible
- Inconsistent scrolling behavior across different panels

### Component-Specific Behavior
Current status of affected components:

**NotificationPanel**: ✅ Perfect behavior
- Uses standard map() iteration, no Virtuoso
- Single scroller, proper height, boxed layout working

**PinnedMessagesPanel**: ⚠️ Intermittent issues
- Sometimes shows double scrollers when adaptive height is used
- Works correctly with static height (`350px` desktop, calculated mobile)

**SearchResults**: ❌ Multiple issues
- Double scroller appears frequently
- Search results don't show at all in mobile drawer (only search input visible)
- Complex CSS media query conflicts with Virtuoso height calculations

## Root Cause

### 1. CSS Height Conflicts
The core issue stems from conflicting height definitions between:
- **DropdownPanel maxHeight prop**: `Math.min(window.innerHeight * 0.8, 600)`
- **Virtuoso inline style height**: `style={{ height: calculatedHeight }}`
- **CSS media query overrides**: `max-height: none !important` in mobile styles

### 2. Virtuoso DOM Structure Interference
Virtuoso creates its own internal DOM wrapper structure that doesn't respond well to standard CSS spacing approaches:
```html
<div class="mobile-drawer__item-list">
  <div> <!-- Virtuoso wrapper -->
    <div> <!-- Virtuoso scroller -->
      <div class="mobile-drawer__item-box">Item 1</div>
      <div class="mobile-drawer__item-box">Item 2</div>
    </div>
  </div>
</div>
```

Standard CSS approaches that failed:
- `gap` property on container
- `margin-bottom` on items
- `padding` adjustments

### 3. Media Query Complexity
SearchResults.scss contains complex CSS that attempts to handle different behaviors for mobile vs desktop:

```scss
.search-results-list {
  @media (max-width: 768px) {
    max-height: none !important; // Conflicts with Virtuoso
    overflow-y: visible; // Causes double scrolling
  }
}
```

### 4. Conditional Rendering Structure
Different approaches used across components create inconsistent behavior:

**Working (NotificationPanel)**:
```tsx
{isTouchDevice() ? (
  <div className="mobile-drawer__item-list">
    {items.map(item => (
      <div className="mobile-drawer__item-box">{item}</div>
    ))}
  </div>
) : (
  <Container>{items.map(...)}</Container>
)}
```

**Problematic (SearchResults)**:
```tsx
{isTouch ? (
  <div className="mobile-drawer__item-list">
    <Virtuoso style={{ height: calculated }} data={results} />
  </div>
) : (
  <Virtuoso style={{ height: maxHeight }} data={results} />
)}
```

## Solution

### Implemented Fixes

#### 1. Spacing Solution for Virtuoso Items
After extensive testing, found the only working CSS approach:
```scss
.mobile-drawer__item-list {
  padding: $s-3;

  & > div .mobile-drawer__item-box {
    margin-top: $s-3;
  }

  & > div:first-child .mobile-drawer__item-box {
    margin-top: 0;
  }
}
```

#### 2. Simplified Height Management
- Use static heights instead of complex adaptive calculations
- Avoid CSS `max-height: none !important` overrides
- Let DropdownPanel control overall height, Virtuoso handle internal scrolling

#### 3. Component-Specific Approaches
**For SearchResults**: Simplify CSS, remove conflicting media queries
**For PinnedMessagesPanel**: Use proven static height approach
**For NotificationPanel**: Keep current working implementation

### Current Status After Fixes
- **NotificationPanel**: ✅ Working perfectly
- **PinnedMessagesPanel**: ✅ Working perfectly
- **SearchResults**: ❌ Needs investigation - results not displaying at all

## Prevention

### Best Practices for Future Virtuoso + MobileDrawer Integration

1. **Height Management**:
   - Use static heights when possible
   - Avoid `max-height: none !important` in mobile styles
   - Let parent container (DropdownPanel) control overall dimensions

2. **Spacing**:
   - Use the proven margin-top approach for Virtuoso item spacing
   - Don't rely on CSS gap or standard margin/padding patterns
   - Target Virtuoso's internal wrapper structure specifically

3. **Conditional Rendering**:
   - Keep mobile/desktop logic simple and consistent
   - Avoid complex CSS overrides within conditional branches
   - Test both paths thoroughly

4. **Testing Protocol**:
   - Test all three panel types when making changes
   - Verify both desktop dropdown and mobile drawer behaviors
   - Check for double scrollers on various viewport sizes
   - Ensure last items in lists are fully visible

### Code Review Checklist
When modifying MobileDrawer + Virtuoso components:
- [ ] No conflicting height definitions
- [ ] Single scroller per panel
- [ ] Consistent spacing approach
- [ ] Mobile and desktop paths both functional
- [ ] Last list items fully visible

---
