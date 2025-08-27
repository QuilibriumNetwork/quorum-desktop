# Component Architecture Masterplan - Desktop/Mobile Unification

## Executive Summary

This masterplan defines the **architectural philosophy and technical approach** for creating a unified codebase that supports both desktop and mobile platforms. The approach extracts only the "raw HTML portion" into platform-specific primitives while keeping 90%+ of the codebase shared.

**For step-by-step implementation**, see [`mobile-dev-plan.md`](./mobile-dev-plan.md).  
**For detailed development workflows**, see [`component-dev-guidelines.md`](../../docs/component-dev-guidelines.md).

## Current State Analysis

### Problems Identified
1. **Direct HTML Usage**: 20+ instances of raw `<button>`, `<input>`, `<select>`, `<textarea>` scattered throughout components
2. **Inconsistent Patterns**: Some components use `Button.jsx`, others use raw `<button>`
3. **Modal Complexity**: 3 different modal implementation patterns
4. **Code Duplication**: Mobile would need to mirror complex components like Message.tsx (850+ lines)

### Architecture Opportunities
- **90% of code is business logic** that can be shared as-is
- **Only 10% is raw HTML rendering** that needs platform-specific implementation
- **Existing component APIs** can be preserved for zero-breaking changes

## Proposed Architecture

### Layer 1: Platform-Specific Primitives
Extract **only raw HTML/React Native rendering** into tightly contained components with identical APIs.

### Layer 2: Shared Business Logic
All existing complex components remain **completely unchanged** and work on both platforms.

## Architecture Concepts

### Primitive vs Business Component Classification

**Primitives** - Platform-specific rendering components:
- Contain raw HTML elements (`<div>`, `<span>`, `<button>`) or React Native components
- Minimal business logic, focus on rendering and basic interactions  
- Examples: Button, Input, Modal, Container, Card

**Business Components** - Shared logic components:
- Use other components (primitives or business components)
- Contain complex logic, state management, data fetching
- Work identically on both platforms
- Examples: Message, Channel, UserProfile, SearchBar

### Platform-Specific Implementation Strategy

Each primitive has platform-specific implementations that maintain identical APIs:

```
Primitive Structure:
├── ComponentName.web.tsx      # Desktop implementation
├── ComponentName.native.tsx   # Mobile implementation  
├── ComponentName.types.ts     # Shared interface
├── ComponentName.scss         # Web-only styles
└── index.ts                  # Platform resolution
```

**Key Principle**: Business components import primitives with no knowledge of the underlying platform.

### Core Primitive Categories

Based on codebase audit, primitives fall into these categories:

#### Layout Primitives
- **ModalContainer/OverlayBackdrop** - Backdrop and overlay patterns
- **FlexRow/FlexBetween/FlexCenter** - Common flexbox layouts
- **ResponsiveContainer** - Responsive width calculations
- **Card** - Content containers with consistent styling

#### Interaction Primitives  
- **Button** - All button variants and interactions
- **Input/TextArea** - Form input elements
- **Select** - Dropdown selections
- **Modal** - Overlay content (desktop modal, mobile drawer)

#### Specialized Primitives
- **Tooltip** - Hover/tap information displays
- **Switch/Toggle** - Boolean controls
- **IconButton** - Icon-based interactions

## The Modal-to-Drawer Transformation

### Architectural Significance

The Modal primitive represents the **most impactful architectural transformation**:

**Desktop Behavior**: Traditional centered modal with backdrop
**Mobile Behavior**: Bottom drawer using existing MobileDrawer component

### Why This Approach Works

1. **Zero Code Changes**: Existing modal usage requires no modifications
2. **Native Mobile UX**: Bottom drawers are the standard mobile pattern
3. **Leverages Existing Code**: Reuses MobileDrawer with swipe gestures
4. **Automatic Transformation**: All existing modals become mobile-optimized

### Universal Modal Benefits

**Simple Modals** automatically become mobile-optimized:
- CreateSpaceModal → Space creation drawer
- KickUserModal → Confirmation drawer  
- NewDirectMessageModal → Address input drawer

**Complex Modals** may need responsive layout adjustments:
- UserSettingsModal → Multi-tab interface in full-height drawer
- SpaceEditor → Complex editor as mobile navigation flow
- JoinSpaceModal → Join flow in drawer format

### Business Component Impact

```tsx
// Existing modal usage works unchanged:
import { Modal } from '../primitives/Modal';

export function MyFeature({ visible, onClose }) {
  return (
    <Modal title="Settings" visible={visible} onClose={onClose}>
      {/* Existing content works on both platforms */}
    </Modal>
  );
}
```

**Result**: Desktop modal, mobile drawer - same code, platform-appropriate UX.

## Platform-Specific Considerations

### Large Tablet Optimization

**Problem**: Full-width drawers look awkward on large tablets (iPad Pro 12.9", Galaxy Tab)
**Solution**: Responsive width constraints in primitive implementations

Mobile primitives detect large tablets and apply appropriate sizing:
- **Phone**: Full-width drawer (natural)
- **Small tablet**: Full-width drawer (acceptable)  
- **Large tablet**: Centered drawer with max-width constraint

### Styling Unit Differences

**Web Platforms** (`.web.tsx`): Use CSS units (`px`, `rem`, `em`, `%`, `vh`, `vw`)
**React Native** (`.native.tsx`): Use density-independent pixels (dp) - just numbers, no units

### Platform File Extensions

**Standard React Native Conventions**:
- ✅ `.web.tsx` for web-specific code
- ✅ `.native.tsx` for React Native code (iOS + Android)
- ✅ `.ios.tsx` for iOS-specific code (optional)
- ✅ `.android.tsx` for Android-specific code (optional)
- ❌ Never use `.mobile.tsx` (not supported by tooling)

## Components That DON'T Need Changes

These complex business components work perfectly on both platforms once primitives are in place:

1. **Message.tsx** (850+ lines)
   - Complex reaction handling
   - Reply threading logic
   - Long-press interactions
   - Just needs primitive buttons/inputs

2. **Channel.tsx** 
   - Permission management
   - Role handling
   - Channel state logic
   - Works as-is with primitives

3. **WebsocketProvider.tsx**
   - Pure business logic
   - No UI elements
   - 100% shared

4. **All Context Providers**
   - ThemeProvider
   - MessageDB
   - ResponsiveLayoutProvider
   - Pure logic, no changes needed

5. **All Hooks**
   - useGlobalSearch
   - useLongPress
   - useResponsiveLayout
   - Platform-agnostic logic

## Special Considerations for Modal-to-Drawer Transformation

### Complex Modals That Need Adjustments

#### UserSettingsModal & SpaceEditor
These complex modals with sidebar navigation need special handling:

**Desktop**: Side-by-side layout with sidebar
**Mobile**: Convert to stacked layout or tabs

```tsx
// Shared business component detects mobile and adjusts layout
export function UserSettingsModal() {
  const { isMobile } = useResponsiveLayout();
  
  return (
    <Modal title={t`Settings`} visible={visible} onClose={onClose}>
      <div className={isMobile ? 'settings-mobile' : 'settings-desktop'}>
        {isMobile ? (
          // Mobile: Tab-based navigation
          <TabView sections={sections} />
        ) : (
          // Desktop: Sidebar navigation
          <SidebarLayout sections={sections} />
        )}
      </div>
    </Modal>
  );
}
```

### Modal Behavior Differences

| Feature | Desktop Modal | Mobile Drawer | Large Tablet Native |
|---------|---------------|---------------|-------------------|
| Position | Centered | Bottom sheet | Bottom sheet (centered) |
| Width | Auto/max-width | 100% screen | Max 500px centered |
| Backdrop | Click to close | Swipe down or tap backdrop | Tap backdrop |
| Animation | Fade in | Slide up | Slide up |
| Max Height | 90vh | 100vh - safe area | 80vh |
| Scrolling | Content scrolls | Entire drawer scrolls | Entire drawer scrolls |
| Close Button | Top right X | Header X + swipe | Header X + swipe |

### Large Tablet Considerations (iPad Pro, Galaxy Tab)

For React Native apps running on large tablets, bottom drawers need width constraints:

**Problem**: Full-width drawer looks awkward on 12.9" iPad Pro
**Solution**: Center drawer with max-width constraint

```tsx
// Modal.native.tsx enhancement for large tablets
import { Dimensions } from 'react-native';

export function Modal({ title, visible, onClose, children }: ModalProps) {
  const screenWidth = Dimensions.get('window').width;
  const isLargeTablet = screenWidth > 768;
  
  return (
    <MobileDrawer
      isOpen={visible}
      onClose={onClose}
      title={title}
      style={isLargeTablet && styles.largeTabletDrawer}
    >
      {children}
    </MobileDrawer>
  );
}

// React Native StyleSheet uses density-independent pixels (dp)
const styles = StyleSheet.create({
  largeTabletDrawer: {
    alignSelf: 'center',
    maxWidth: 500,        // 500dp max width for large tablets
    width: '100%',
    marginHorizontal: 'auto',
  }
});
```

This ensures optimal UX across all device sizes:
- **Phone**: Full-width drawer (natural)
- **Small tablet**: Full-width drawer (still good)
- **Large tablet**: Constrained width drawer (prevents awkward stretching)

### Guidelines for Modal Content

1. **Keep Headers Concise**: Mobile drawers have less horizontal space
2. **Responsive Forms**: Stack inputs vertically on mobile
3. **Button Placement**: Full-width buttons on mobile
4. **Scrollable Content**: Ensure content is scrollable within drawer
5. **Safe Areas**: Account for device notches and home indicators

## File Structure Reorganization

```
src/
├── components/
│   ├── primitives/           # NEW: Platform-specific implementations
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── TextArea/
│   │   ├── Select/
│   │   ├── Container/
│   │   ├── IconButton/
│   │   ├── Modal/
│   │   └── Card/
│   │
│   ├── channel/             # UNCHANGED: Complex business components
│   ├── direct/              # UNCHANGED: Complex business components
│   ├── message/             # UNCHANGED: Complex business components
│   ├── modals/              # REFACTORED: Use Modal primitive
│   ├── search/              # REFACTORED: Use Input/Button primitives
│   └── user/                # UNCHANGED: Mostly business logic
│
├── hooks/                   # UNCHANGED: 100% shared
├── api/                     # UNCHANGED: 100% shared
├── services/                # UNCHANGED: 100% shared
└── utils/                   # UNCHANGED: 100% shared
```

## Migration Strategy

### Phase 1: Create Core Primitives (Week 1)
1. Button (already exists, just reorganize)
2. Input
3. TextArea
4. Container/Box
5. IconButton

### Phase 2: Create UI Primitives (Week 2)
1. Select/Dropdown
2. Modal
3. Card
4. Tooltip wrapper
5. Drawer (for mobile)

### Phase 3: Refactor Components (Week 3-4)
1. Replace all raw HTML with primitives
2. Start with simple components (SearchBar)
3. Move to complex components (Message actions)
4. Test thoroughly on web first

### Phase 4: Mobile Implementation (Week 5-6)
1. Implement .native.tsx versions
2. Test with React Native
3. Adjust styling for mobile
4. Handle platform differences

## Step-by-Step Guide for New Component Development

### 1. Identify Component Type

**Is it a Primitive?**
- Contains raw HTML elements (`<div>`, `<span>`, `<button>`, etc.)
- Has minimal business logic
- Focuses on rendering and basic interactions
- Examples: Button, Input, Card

**Is it a Business Component?**
- Uses other components (primitives or business)
- Contains complex logic, state management
- Handles data fetching, transformations
- Examples: Message, Channel, UserProfile

### 2. For NEW Primitives

```bash
# Create structure
mkdir -p src/components/primitives/MyPrimitive
cd src/components/primitives/MyPrimitive
```

Create these files:
1. **MyPrimitive.types.ts** - Define the interface
2. **MyPrimitive.web.tsx** - Web implementation
3. **MyPrimitive.native.tsx** - Mobile implementation
4. **MyPrimitive.scss** - Web styles (if needed)
5. **index.ts** - Export with platform resolution

### 3. For NEW Business Components

```tsx
// MyFeature.tsx - Works on BOTH platforms
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Container } from '../primitives/Container';

export function MyFeature() {
  // Complex business logic here
  
  return (
    <Container>
      <Input value={value} onChange={setValue} />
      <Button onClick={handleSubmit}>Submit</Button>
    </Container>
  );
}
```

### 4. Testing Checklist

- [ ] Component renders correctly on web
- [ ] All interactions work (click, type, etc.)
- [ ] Styles match design system
- [ ] No raw HTML elements used
- [ ] TypeScript types are correct
- [ ] Mobile version matches web behavior

### 5. Best Practices

**DO:**
- ✅ Use primitives for ALL UI elements
- ✅ Keep business logic in shared components
- ✅ Maintain identical APIs across platforms
- ✅ Use TypeScript for type safety
- ✅ Follow existing naming conventions
- ✅ Use `.native.tsx` extension (NOT `.mobile.tsx`) for React Native files
- ✅ Leverage MobileDrawer for modal primitives on mobile
- ✅ **Styling**: Use Tailwind utilities first, then `@apply` for patterns
- ✅ **Styling**: Extract shared patterns into reusable semantic classes
- ✅ **Styling**: Use existing design tokens (accent, surface, text colors)

**DON'T:**
- ❌ Use raw HTML in business components
- ❌ Put business logic in primitives
- ❌ Create platform-specific business components
- ❌ Break existing component APIs
- ❌ Mix concerns (UI rendering + business logic)
- ❌ Use `.mobile.tsx` extension (not recognized by React Native tooling)
- ❌ Create custom drawer implementations when MobileDrawer exists
- ❌ **Styling**: Write raw CSS for basic layouts (use Tailwind)
- ❌ **Styling**: Create one-off CSS classes without `@apply`
- ❌ **Styling**: Ignore the existing design system colors/spacing

## Success Metrics

1. **90%+ Code Sharing**: Most components work on both platforms unchanged
2. **Zero Breaking Changes**: Existing code continues working
3. **Clean Separation**: Clear distinction between primitives and business logic
4. **Maintainability**: Single source of truth for business logic
5. **Developer Experience**: Easy to add new features for both platforms

## Implementation Resources

### Related Documentation

**For Step-by-Step Implementation**:
- [`mobile-dev-plan.md`](./mobile-dev-plan.md) - Detailed phase-by-phase execution plan
- [`component-dev-guidelines.md`](../../docs/component-dev-guidelines.md) - Development workflows and code examples

**For Understanding the Architecture**:
- This document provides the conceptual foundation and reasoning
- Implementation documents reference this for architectural context

## Key Architectural Insights

### The Modal-to-Drawer Pattern
The Modal primitive transformation is the **crown jewel** of this architecture:
- **Zero code changes** in business components
- **Automatic mobile optimization** for all modals
- **Native mobile UX** with swipe gestures
- **Reuses existing MobileDrawer** component

This single primitive change transforms the entire mobile experience while maintaining 100% code compatibility.

### Web Styling Philosophy: "Tailwind First, Raw CSS When Needed"

For all web components (`.web.tsx`), follow this styling hierarchy:

1. **Tailwind Utilities First**: Use Tailwind classes for basic styling
2. **@apply for Patterns**: Group utilities into semantic classes for reusable patterns
3. **Raw CSS Last**: Add custom CSS only when Tailwind can't handle it cleanly
4. **Extract Shared Patterns**: Always create reusable classes for repeated styling

**Detailed styling examples and workflows**: See [`component-dev-guidelines.md`](../../docs/component-dev-guidelines.md)

#### Styling Best Practices

**✅ Good: Tailwind-first approach**
```tsx
// Button.web.tsx
export function Button({ type, size, children, className }: ButtonProps) {
  return (
    <span
      className={`
        inline-flex items-center justify-center
        px-4 py-2 rounded-md font-medium
        transition-colors duration-200
        ${type === 'primary' ? 'bg-accent text-white hover:bg-accent/90' : ''}
        ${type === 'secondary' ? 'bg-surface-2 text-main hover:bg-surface-3' : ''}
        ${size === 'small' ? 'px-3 py-1 text-sm' : ''}
        ${className || ''}
      `}
      onClick={onClick}
    >
      {children}
    </span>
  );
}
```

**✅ Good: @apply for reusable patterns**
```scss
// Button.scss - semantic classes using @apply
.btn-base {
  @apply inline-flex items-center justify-center;
  @apply px-4 py-2 rounded-md font-medium;
  @apply transition-colors duration-200;
}

.btn-primary {
  @apply btn-base bg-accent text-white hover:bg-accent/90;
}

.btn-secondary {
  @apply btn-base bg-surface-2 text-main hover:bg-surface-3;
}

.btn-small {
  @apply px-3 py-1 text-sm;
}
```

**❌ Avoid: Raw CSS for basic styling**
```scss
// Don't do this - use Tailwind instead
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: 0.375rem;
  font-weight: 500;
}
```

**✅ Good: Raw CSS for complex patterns Tailwind can't handle**
```scss
// Modal.scss - complex animations and effects
.quorum-modal {
  @apply bg-surface-0 rounded-lg shadow-2xl;
  
  /* Custom animation that Tailwind can't handle cleanly */
  animation: modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(8px);
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-16px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

#### Gradual Migration Strategy

**Phase 1**: New components use Tailwind-first approach
**Phase 2**: Refactor existing SCSS files to use `@apply` 
**Phase 3**: Convert remaining raw CSS to Tailwind utilities where possible
**Phase 4**: Keep only complex CSS that Tailwind can't handle

#### Example: Modal Primitive Styling

```tsx
// Modal.web.tsx - Tailwind-first approach
export function Modal({ title, visible, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay backdrop-blur">
      <div className="quorum-modal">
        <div className="flex items-center justify-between p-4 border-b border-default">
          <h2 className="text-lg font-semibold text-strong">{title}</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-2 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="w-4 h-4 text-subtle" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
```

```scss
// Modal.scss - @apply for complex patterns + custom animations
.quorum-modal {
  @apply bg-surface-0 rounded-lg shadow-2xl max-w-md w-full mx-4;
  
  /* Keep custom animation - Tailwind can't handle this cleanly */
  animation: modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-16px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

## Conclusion

This architecture achieves the vision of *"everything else can then be shared instead of being mirrors"* while requiring minimal changes to the existing codebase. By extracting only the raw HTML portions into primitives, we enable massive code reuse while maintaining platform-specific optimizations where needed.

The Modal-to-Drawer transformation exemplifies the power of this approach: complex features like CreateSpaceModal, UserSettingsModal, and SpaceEditor automatically become mobile-optimized without changing a single line of their business logic.