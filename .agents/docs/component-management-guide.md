---
type: doc
title: Component Management & Development Guide
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-08-14T00:00:00.000Z
---

# Component Management & Development Guide

**READY FOR OFFICIAL DOCS: _Last review: 2025-08-14 10:45 UTC_**

This guide helps developers manage existing components and create new ones in our cross-platform architecture.

## Architecture Awareness

### The Golden Rule

**This is a shared codebase that builds three separate apps: web (browser), desktop (Electron), and mobile (React Native).** We maximize code reuse by sharing business logic, components, and primitives between all platforms. Every component decision must consider all build targets.

### What We Have

- **Primitives Collection**: `src/components/primitives/` - Cross-platform UI building blocks
- **Theming System**: `src/components/primitives/theme/colors.ts` - Mirrors web CSS variables as hex colors for native app
- **Dev Playground**: Test primitives on both web (`/playground`) and mobile (React Native via Expo)
- **Platform Files**: `.web.tsx` for browser, `.native.tsx` for React Native
- **Mobile Testing**: `/mobile` workspace with test screens for real device testing
- **Components Audit**: `/src/dev` audit of all components (WIP) accessible via `/dev/audit` in forntend

## Quick Decision Framework

### 1. Should I Create a New Component?

Ask yourself:

- **Is this interactive?** (buttons, inputs, modals) → Use existing primitive or create new one
- **Is this layout-related?** (flex patterns, containers) → Use existing primitive
- **Is this business logic?** (user profiles, chat messages) → Create regular component using primitives
- **Is this highly specialized?** (charts, animations) → Regular component with custom code

### 2. Platform-Specific vs Shared?

**Most components are platform-specific** (only very simple components can be truly shared). Components can be shared when:

- They only use primitives
- The logic flow is identical between web and native
- They have minimal complexity (e.g., AccentColorSwitcher, KickUserModal, LeaveSpaceModal)

Create platform-specific components for:

- Deep OS integration needs
- Platform-specific gestures/interactions
- Performance-critical sections

### 3. Primitive vs Regular Component?

**Create a primitive when:**

- Multiple components need the same UI pattern
- You're using raw HTML elements (`<div>`, `<button>`, `<input>`)
- Cross-platform consistency matters
- It's a basic building block (not business logic)

**Create a regular component when:**

- It contains business logic or data fetching
- It combines multiple primitives
- It's specific to one feature/page

### Business Logic Extraction Rule

**When creating business components, always extract logic into custom hooks** in `src/hooks/`. This keeps the component focused on UI rendering while making the logic reusable and testable across all platforms.

```tsx
// ❌ Bad - Logic mixed with UI
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId)
      .then(setUser)
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <Container>
      {loading ? <Text>Loading...</Text> : <Text>{user.name}</Text>}
    </Container>
  );
}

// ✅ Good - Logic extracted to hook
function UserProfile({ userId }) {
  const { user, loading } = useUserProfile(userId);

  return (
    <Container>
      {loading ? <Text>Loading...</Text> : <Text>{user.name}</Text>}
    </Container>
  );
}
```

The hook goes in `src/hooks/` following existing categories and index structure.

## Using Existing Primitives

### Available Primitives

```tsx
// Layout
import { FlexRow, FlexBetween, FlexCenter, FlexColumn } from '../primitives';
import { Container, ResponsiveContainer } from '../primitives';
import { ModalContainer, OverlayBackdrop } from '../primitives';

// Interaction
import { Button, Input, TextArea, Select } from '../primitives';
import { Modal, Switch, RadioGroup } from '../primitives';

// Display
import { Text, Icon, ColorSwatch, Tooltip } from '../primitives';
```

### Developer Guidelines by Approach

**🏆 PREFERRED - Use Primitives Where They Add Value:**

```tsx
function UserCard({ user }) {
  return (
    <Container className="p-4 bg-surface-0 rounded-lg">
      <FlexBetween>
        <Text variant="strong">{user.name}</Text>
        <Button size="small" onClick={onEdit}>
          Edit
        </Button>
      </FlexBetween>
    </Container>
  );
}
// Good: Interactive elements + layout patterns benefit from primitives
```

**👌 PRAGMATIC - Mixed Approach (Common and Acceptable):**

```tsx
function ComplexComponent() {
  return (
    <Container className="p-4">
      {/* Use primitives for interactive/theme elements */}
      <Text variant="strong">Settings</Text>
      <Button onClick={onSave}>Save</Button>

      {/* Raw HTML for specialized needs */}
      <div className="complex-animation-container">
        <span className="text-subtle">Loading animation...</span>
      </div>
    </Container>
  );
}
// Good: Primitives where they add value, raw HTML where needed
```

**⚠️ AVOID - Raw HTML When Primitives Would Help:**

```tsx
function ComponentThatShouldUsePrimitives() {
  return (
    <div className="p-4 bg-surface-0 rounded-lg">
      <div className="flex items-center justify-between">
        <span className="font-bold text-strong">{user.name}</span>
        <button className="btn-small" onClick={onEdit}>
          Edit
        </button>
      </div>
    </div>
  );
}
// Bad: Missing consistency benefits of Button primitive and FlexBetween layout
```

### When to Use Primitives

Follow the guidelines in [when-to-use-primitives.md](./when-to-use-primitives.md):

- **Always**: Interactive elements (Button, Input, Modal)
- **Usually**: Layout containers with theme colors
- **Sometimes**: Text elements needing semantic colors
- **Almost Never**: Complex animations, third-party wrappers, performance-critical sections

## Creating New Primitives

### Before You Start

**Rarely needed** - we have most primitives already. Only create new ones if:

- Pattern appears in 3+ different places
- No existing primitive fits the need
- Cross-platform consistency is critical

### Primitive Creation Rules

Based on [primitive-styling-guide.md](./primitive-styling-guide.md):

#### 1. **File Structure**

```
src/components/primitives/MyPrimitive/
├── MyPrimitive.web.tsx     # Web implementation
├── MyPrimitive.native.tsx  # Mobile implementation
├── MyPrimitive.scss        # Web styles (if needed)
├── types.ts                # Shared TypeScript types
└── index.ts                # Platform resolution
```

#### 2. **Styling Consistency**

**Form fields must use semantic color variables:**

```scss
// Web (.scss)
background-color: var(--color-field-bg);
border: 1px solid var(--color-field-border);
&:focus {
  border-color: var(--color-field-border-focus);
}
```

```typescript
// Mobile (.native.tsx)
backgroundColor: colors.field.bg,
borderColor: colors.field.border,
// Focus: colors.field.borderFocus
```

#### 3. **Design System Integration**

Always use existing tokens:

- **Colors**: `bg-surface-0`, `text-strong`, `bg-accent`
- **Spacing**: `p-4`, `m-2`, `space-y-4`
- **Typography**: `text-base`, `font-medium`

## Styling Best Practices

### Web Styling Hierarchy

From [component-development-guide.md](./component-development-guide.md#web-styling-hierarchy):

1. **Tailwind Utilities First**

```tsx
<div className="flex items-center justify-between p-4 bg-surface-0 rounded-lg">
```

2. **@apply for Reusable Patterns**

```scss
.card-base {
  @apply bg-surface-0 rounded-lg shadow-sm border border-default;
  @apply p-4 transition-shadow duration-200;
}
```

3. **Raw CSS Only for Complex Needs**

```scss
.complex-animation {
  @apply card-base;
  animation: complexBounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

### Mobile Considerations

- Use density-independent pixels (dp) not CSS units
- Minimum 44dp touch targets
- Use StyleSheet.create() for performance
- Test on both iOS and Android

## Testing with Playground

### Web Testing (Primary)

1. Run `yarn dev`
2. Navigate to `/playground` (web playground for primitives)
3. Test your component with different props/states
4. Verify responsive behavior and theme switching

### Mobile Testing (When Needed)

1. Run `yarn mobile` to start the mobile test playground
2. Use Expo Go app to test on real device
3. Navigate through test screens in the mobile app to test your primitive

### Testing Checklist

- [ ] Component renders correctly on web
- [ ] All interactions work (click, hover, focus)
- [ ] Responsive behavior at different screen sizes
- [ ] Dark/light theme both work
- [ ] Mobile touch targets are adequate (if testing mobile)
- [ ] No console errors or layout shifts

## Platform Files & Resolution

### File Extensions

- **`.web.tsx`** - Web implementation (uses CSS: px, rem, em, %)
- **`.native.tsx`** - React Native implementation (uses density-independent pixels: dp)
- **`.ios.tsx`** - iOS-specific code (optional, takes priority over .native.tsx)
- **`.android.tsx`** - Android-specific code (optional, takes priority over .native.tsx)
- **`.scss`** - Web styles only

### Platform Resolution

```typescript
// This import automatically resolves to the correct platform file:
import { Button } from '../primitives/Button';

// Bundler selects:
// - Button.web.tsx on web/desktop
// - Button.native.tsx on React Native
// - Button.ios.tsx on iOS (if exists, takes priority)
// - Button.android.tsx on Android (if exists, takes priority)
```

## Responsive & Platform Utilities

We have two complementary systems for responsive behavior that work together to create sophisticated UX patterns.

### Touch Device Detection

**Centralized Detection** (now in `src/utils/platform.ts`):

```typescript
import { isTouchDevice } from '../utils/platform';

// Comprehensive touch detection
const isTouch = isTouchDevice(); // Uses 3-layer detection for maximum compatibility
```

**Detection Logic:**

```typescript
'ontouchstart' in window || // DOM touch event support
  navigator.maxTouchPoints > 0 || // Modern touch points API
  (navigator as any).msMaxTouchPoints > 0; // Legacy IE/Edge support
```

**Usage:** Input interaction patterns (hover vs tap), tooltip behavior, gesture handling

### Screen Size Detection (ResponsiveLayout)

**Purpose:** Viewport-based layout decisions and sidebar state management

```typescript
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';

function MyComponent() {
  const { isMobile, isTablet, isDesktop, leftSidebarOpen, toggleLeftSidebar } = useResponsiveLayoutContext();

  return (
    <div>
      {isMobile && <MobileNav />}
      {isDesktop && <DesktopSidebar />}
    </div>
  );
}
```

**Breakpoints:**

- `isMobile`: < 768px (viewport width)
- `isTablet`: 768px - 1024px (viewport width)
- `isDesktop`: ≥ 1024px (viewport width)

**Usage:** Layout structure, component visibility, sidebar behavior

**Note:** This is viewport-based, not touch-based. A desktop with touchscreen at 1920px will be `isDesktop: true`.

### Platform Detection Utility

**Purpose:** Runtime environment detection (web/native/electron)

```typescript
import {
  isWeb,
  isNative,
  isElectron,
  getPlatform,
  isTouchDevice,
} from '../utils/platform';

// Platform environment checks
if (isWeb()) {
  // Web browser code
}
if (isNative() || isMobile()) {
  // Both are aliases
  // React Native code
}
if (isElectron()) {
  // Electron desktop app code
}

// Get platform string
const platform = getPlatform(); // Returns: 'web' | 'mobile' | 'electron'

// Combined platform features
const features = {
  hasFileSystem: isElectron(),
  hasNativeNotifications: isElectron() || isMobile(),
  hasCamera: isMobile(),
  hasDeepLinking: isMobile() || isElectron(),
  hasPushNotifications: isMobile(),
  hasTouch: isTouchDevice(),
};
```

**Usage:** Platform-specific code paths, feature availability checks

### System Integration: Creating Sophisticated UX Patterns

The two detection systems work together to create **three distinct interaction modes**:

```typescript
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { isTouchDevice } from '../utils/platform';

function useInteractionMode() {
  const { isMobile } = useResponsiveLayoutContext(); // Screen size
  const isTouch = isTouchDevice(); // Touch capability

  const useMobileDrawer = isMobile; // Phone: Drawer UI
  const useDesktopTap = !isMobile && isTouch; // Tablet: Tap UI
  const useDesktopHover = !isMobile && !isTouch; // Desktop: Hover UI

  return { useMobileDrawer, useDesktopTap, useDesktopHover };
}
```

**Interaction Mode Matrix:**

| Device Type  | Screen Size | Touch | Result            | UI Pattern          |
| ------------ | ----------- | ----- | ----------------- | ------------------- |
| Phone        | < 768px     | ✓     | `useMobileDrawer` | Long-press → drawer |
| Tablet       | ≥ 768px     | ✓     | `useDesktopTap`   | Tap → show/hide     |
| Desktop      | ≥ 1024px    | ✗     | `useDesktopHover` | Hover → show        |
| Touch Laptop | ≥ 1024px    | ✓     | `useDesktopTap`   | Tap → show/hide     |

### Understanding the Different "Mobile" Concepts

**Be precise about which detection you need:**

1. **Viewport Mobile** (`useResponsiveLayout`'s `isMobile`)
   - **What:** Screen width < 768px
   - **When:** Layout decisions, component sizing
   - **Example:** A desktop browser resized to 600px is "mobile"

2. **Platform Mobile** (`utils/platform`'s `isMobile()`)
   - **What:** React Native runtime environment
   - **When:** Platform-specific code paths
   - **Example:** Mobile Safari returns `false` (it's "web" platform)

3. **Touch Device** (`isTouchDevice()`)
   - **What:** Touch input capability
   - **When:** Interaction behavior (hover vs tap)
   - **Example:** Surface Pro at 1920px is touch-enabled desktop

**✅ Systems Work Together:** No conflicts, complementary purposes, well-architected integration patterns.

## Troubleshooting

### Common Issues

**Import errors with primitives**

```tsx
// ❌ Wrong
import Button from '../primitives/Button';

// ✅ Correct
import { Button } from '../primitives/Button';
```

**Styling not working**

- Check if you're using semantic CSS variables correctly
- Verify Tailwind classes are applied properly
- Use browser DevTools to inspect computed styles

**Mobile testing issues**

- Use `--tunnel` flag for Expo from WSL2
- Test primitives on mobile: `yarn mobile`
- Ensure touch targets are minimum 44dp

**Performance problems**

- Avoid deep nesting of primitives
- Use raw HTML for simple static content
- Profile with React DevTools

### Getting Help

1. Check existing primitives first - don't reinvent
2. Review [when-to-use-primitives.md](./when-to-use-primitives.md) for guidance
3. Test with web playground (`/playground`) and mobile testing (`yarn mobile`) before implementing in main app
4. Follow existing patterns from similar components

## Best Practices Summary

### ✅ DO:

- Think mobile-first for every component
- Use existing primitives for UI consistency
- Follow the styling hierarchy (Tailwind → @apply → raw CSS)
- Test with both web playground and mobile testing before shipping
- Use semantic color variables for consistency
- Keep business logic separate from UI primitives

### ❌ DON'T:

- Use raw HTML in business components (use primitives)
- Create primitives for one-off use cases
- Break existing component APIs
- Force primitives where they don't add value
- Ignore cross-platform testing
- Hardcode colors/spacing (use design tokens)

---

_Created: 2025-07-31_
_Updated: 2025-08-14 10:45 UTC_
_This guide focuses on practical decision-making for component development in our cross-platform architecture._
