# Component Management & Development Guide

[← Back to INDEX](../INDEX.md)

This guide helps developers manage existing components and create new ones in our cross-platform architecture.

## Architecture Awareness

### The Golden Rule

**This is a shared codebase that builds three separate apps: web (browser), desktop (Electron), and mobile (React Native).** We maximize code reuse by sharing business logic, components, and primitives between all platforms. Every component decision must consider all build targets.

### What We Have

- **Primitives Collection**: `src/components/primitives/` - Cross-platform UI building blocks
- **Theming System**: `src/components/primitives/theme/colors.ts` - Mirrors web CSS variables as hex colors for native app
- **Dev Playground**: Test primitives on both web (`/playground`) and mobile (Expo Go)
- **Platform Files**: `.web.tsx` for browser, `.native.tsx` for React Native
- **Auto-sync Script** _(planned)_: Will automatically sync CSS color changes to native theme

## Quick Decision Framework

### 1. Should I Create a New Component?

Ask yourself:

- **Is this interactive?** (buttons, inputs, modals) → Use existing primitive or create new one
- **Is this layout-related?** (flex patterns, containers) → Use existing primitive
- **Is this business logic?** (user profiles, chat messages) → Create regular component using primitives
- **Is this highly specialized?** (charts, animations) → Regular component with custom code

### 2. Platform-Specific vs Shared?

**Most components are shared** (use primitives internally). Only create platform-specific components for:

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
- **Never**: Complex animations, third-party wrappers, performance-critical sections

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
2. Navigate to `/playground`
3. Test your component with different props/states
4. Verify responsive behavior and theme switching

### Mobile Testing (When Needed)

1. Navigate to `src/dev/playground/mobile`
2. Run `yarn start --tunnel`
3. Use Expo Go app to test on real device
4. Sync components: `yarn playground:sync --to-playground ComponentName`

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

### ResponsiveLayout Hook

For web breakpoint management and sidebar state:

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

- `isMobile`: < 768px
- `isTablet`: 768px - 1024px
- `isDesktop`: ≥ 1024px

### Platform Detection Utility

For platform-specific logic:

```typescript
import { isWeb, isNative, platformSelect, Platform } from '../utils/platform';

// Simple checks
if (isWeb) {
  // Web-specific code
}

// Platform-specific values
const config = platformSelect({
  web: { theme: 'light', animation: 'smooth' },
  native: { theme: 'dark', animation: 'fast' },
  default: { theme: 'auto', animation: 'normal' },
});

// React Native style selection (future compatibility)
const styles = Platform.select({
  web: webStyles,
  ios: iosStyles,
  android: androidStyles,
  default: defaultStyles,
});
```

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
- Check component sync status: `yarn playground:check`
- Ensure touch targets are minimum 44dp

**Performance problems**

- Avoid deep nesting of primitives
- Use raw HTML for simple static content
- Profile with React DevTools

### Getting Help

1. Check existing primitives first - don't reinvent
2. Review [when-to-use-primitives.md](./when-to-use-primitives.md) for guidance
3. Test in playground before implementing in main app
4. Follow existing patterns from similar components

## Best Practices Summary

### ✅ DO:

- Think mobile-first for every component
- Use existing primitives for UI consistency
- Follow the styling hierarchy (Tailwind → @apply → raw CSS)
- Test in playground before shipping
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
_This guide focuses on practical decision-making for component development in our cross-platform architecture._
