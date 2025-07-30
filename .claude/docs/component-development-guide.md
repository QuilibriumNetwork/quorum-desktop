# Component Development Guidelines

[← Back to INDEX](../INDEX.md)

This guide provides step-by-step instructions for creating new components and converting existing components to work seamlessly across desktop and mobile platforms using our primitive-based architecture.

**For architectural concepts and reasoning**, see [`components-shared-arch-masterplan.md`](../tasks/todo/mobile-dev/components-shared-arch-masterplan.md).  
**For implementation timeline and phases**, see [`mobile-dev-plan.md`](../tasks/todo/mobile-dev/mobile-dev-plan.md).

## Development Workflow Overview

Since we're shipping mobile ASAP, **all primitives must be developed for both web and native simultaneously**. This ensures consistency and prevents delays when mobile development accelerates.

## Quick Decision Tree

### 1. Identify Component Type

**Is it a Primitive?**

- Contains raw HTML elements (`<div>`, `<span>`, `<button>`, etc.)
- Has minimal business logic
- Focuses on rendering and basic interactions
- Examples: Button, Input, Card, Modal

**Is it a Business Component?**

- Uses other components (primitives or business)
- Contains complex logic, state management
- Handles data fetching, transformations
- Examples: Message, Channel, UserProfile

## Development Workflow

### Workflow A: Creating NEW Primitives

**Timeline**: 1-2 days per primitive (both platforms)

#### Step 1: Setup & Planning (30 min)

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

**Planning Checklist**:

- [ ] Define desktop UX behavior
- [ ] Define mobile UX differences (if any)
- [ ] Identify shared vs platform-specific props
- [ ] Review existing Tailwind classes to reuse

#### Step 2: Define Interface (15 min)

```typescript
export interface MyPrimitiveProps {
  // Common props for both platforms
  children: React.ReactNode;
  disabled?: boolean;
  onPress?: () => void;

  // Web-specific props (ignored on mobile)
  className?: string;
  id?: string;

  // Mobile-specific props (ignored on web)
  testID?: string;
}
```

#### Step 3: Web Implementation (2-4 hours)

```tsx
import React from 'react';
import { MyPrimitiveProps } from './MyPrimitive.types';
import './MyPrimitive.scss';

export function MyPrimitive({
  children,
  disabled,
  onPress,
  className,
  id,
}: MyPrimitiveProps) {
  return (
    <div
      id={id}
      className={`
        my-primitive
        ${disabled ? 'my-primitive--disabled' : ''}
        ${className || ''}
      `}
      onClick={disabled ? undefined : onPress}
    >
      {children}
    </div>
  );
}
```

**Web Testing Checklist**:

- [ ] Test in Chrome DevTools device simulation
- [ ] Verify responsive behavior on different screen sizes
- [ ] Test keyboard interactions (Tab, Enter, Space)
- [ ] Verify hover/focus states work
- [ ] Check accessibility with screen reader

#### Step 4: Mobile Implementation (2-4 hours)

```tsx
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { MyPrimitiveProps } from './MyPrimitive.types';

export function MyPrimitive({
  children,
  disabled,
  onPress,
  testID,
}: MyPrimitiveProps) {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      style={[styles.container, disabled && styles.disabled]}
    >
      <Text style={[styles.text, disabled && styles.disabledText]}>
        {children}
      </Text>
    </Pressable>
  );
}

// React Native uses density-independent pixels (dp), not CSS units
const styles = StyleSheet.create({
  container: {
    padding: 12, // 12dp
    borderRadius: 6, // 6dp
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16, // 16dp
    fontWeight: '500',
  },
  disabledText: {
    color: '#999',
  },
});
```

**Mobile Testing Checklist**:

- [ ] Test on iOS Simulator
- [ ] Test on Android Emulator
- [ ] Verify touch targets are 44dp minimum
- [ ] Test on physical device if available
- [ ] Check performance with React Native debugger

#### Step 5: Web Styling (1-2 hours)

```scss
// Follow "Tailwind First, Raw CSS When Needed" approach

.my-primitive {
  @apply p-3 rounded-md text-center font-medium;
  @apply transition-colors duration-200;
  @apply cursor-pointer select-none;
}

.my-primitive--disabled {
  @apply opacity-50 cursor-not-allowed;
}

// Only use raw CSS for complex patterns Tailwind can't handle
.my-primitive--animated {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### Step 6: Platform Resolution (15 min)

```typescript
// Platform auto-resolution - bundler handles this
export { MyPrimitive } from './MyPrimitive';
export type { MyPrimitiveProps } from './MyPrimitive.types';
```

#### Step 7: Final Testing & Documentation (30 min)

- [ ] Test primitive in a real business component
- [ ] Verify imports work correctly in both environments
- [ ] Document any platform-specific behaviors
- [ ] Add to primitive inventory/documentation

### Workflow B: Converting EXISTING Components to Primitives

**Timeline**: 2-4 hours per component (depends on complexity)

This workflow helps convert existing components like `Button.jsx`, `Modal.tsx` to primitive architecture.

#### Step 1: Analysis (30 min)

**Analyze the existing component**:

```bash
# Example: Converting existing Button.jsx
# 1. Read the current implementation
cat src/components/Button.jsx

# 2. Identify what needs to be extracted
# - Raw HTML elements (<span>, <button>, etc.)
# - CSS classes and styling
# - Event handlers
# - Props interface
```

**Analysis Checklist**:

- [ ] Identify all raw HTML elements used
- [ ] List all props and their types
- [ ] Note any complex styling or animations
- [ ] Check if component is used throughout codebase
- [ ] Identify any business logic that should stay in business components

#### Step 2: Create Primitive Structure (15 min)

```bash
# Create new primitive folder
mkdir -p src/components/primitives/Button
cd src/components/primitives/Button
```

#### Step 3: Extract & Convert Web Implementation (1-2 hours)

```tsx
// Button.web.tsx - extracted from existing Button.jsx
import React from 'react';
import { ButtonProps } from './Button.types';
import './Button.scss';

export function Button({
  type = 'primary',
  size,
  disabled,
  onClick,
  children,
  className,
  icon,
  id,
}: ButtonProps) {
  // Copy existing logic exactly - minimal changes
  const baseClass = disabled ? 'btn-disabled' : `btn-${type}`;
  const buttonId = id || `button-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <span
      id={buttonId}
      className={
        baseClass +
        (size === 'small' ? ' btn-small' : '') +
        (icon ? ' quorum-button-icon' : '') +
        (className ? ' ' + className : '')
      }
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      {children}
    </span>
  );
}
```

**Conversion Guidelines**:

- ✅ Keep existing HTML structure initially
- ✅ Preserve all existing props and behavior
- ✅ Copy existing CSS/SCSS files
- ❌ Don't change business logic during conversion
- ❌ Don't break existing component usage

#### Step 4: Create Native Equivalent (2-3 hours)

Study the web implementation and create React Native equivalent:

```tsx
// Button.native.tsx - match web behavior exactly
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { ButtonProps } from './Button.types';

export function Button({
  type = 'primary',
  size,
  disabled,
  onClick,
  children,
}: ButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onClick}
      style={[
        styles.button,
        styles[type],
        size === 'small' && styles.small,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.text,
          styles[`${type}Text`],
          disabled && styles.disabledText,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

// Match existing Button.scss styles in React Native StyleSheet
const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16, // Match .btn padding
    paddingVertical: 8, // Match .btn padding
    borderRadius: 6, // Match .btn border-radius
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#007bff', // Match .btn-primary background
  },
  // ... convert all existing CSS to StyleSheet
});
```

#### Step 5: Update Imports (30 min)

Replace existing imports throughout codebase:

```bash
# Find all usages of old component
grep -r "import.*Button.*from" src/
grep -r "from.*Button" src/

# Update imports - Example:
# OLD: import Button from '../Button';
# NEW: import { Button } from '../primitives/Button';
```

#### Step 6: Testing & Validation (1 hour)

- [ ] All existing usages still work
- [ ] No visual regressions on web
- [ ] Mobile version matches web behavior
- [ ] No breaking changes in component API

### Workflow C: Creating NEW Business Components

Business components use primitives and work on both platforms automatically.

```tsx
// MyFeature.tsx - Works on BOTH platforms unchanged
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Container } from '../primitives/Container';
import { Modal } from '../primitives/Modal';

export function MyFeature() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Complex business logic here
  const handleSubmit = () => {
    // API calls, validation, etc.
  };

  return (
    <>
      <Container className="p-4 space-y-4">
        <Input
          value={inputValue}
          onChange={setInputValue}
          placeholder="Enter value..."
        />
        <Button onClick={() => setIsModalOpen(true)}>Open Settings</Button>
      </Container>

      <Modal
        title="Settings"
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      >
        {/* Modal content works on both platforms */}
        <div className="space-y-4">
          <Input value={inputValue} onChange={setInputValue} />
          <Button onClick={handleSubmit}>Save</Button>
        </div>
      </Modal>
    </>
  );
}
```

## Development Environment Setup

### Required Tools

#### For Web Development (Current)

- **Node.js** (v18+)
- **Yarn** (package manager)
- **Vite** (dev server)
- **Chrome DevTools** with device simulation

#### For React Native Development (Mobile)

- **React Native CLI** or **Expo CLI**
- **iOS Simulator** (macOS) or **Android Studio Emulator**
- **Physical device** for final testing

### Setup Commands

```bash
# Web development (current)
yarn install
yarn dev

# React Native setup (when mobile development starts)
npx create-expo-app mobile-test-env
cd mobile-test-env
yarn start
```

## Platform-Specific Considerations

### Large Tablet Support (iPad Pro, Galaxy Tab)

For React Native primitives that need tablet optimization:

```tsx
// MyPrimitive.native.tsx
import { Dimensions } from 'react-native';

export function MyPrimitive(props: MyPrimitiveProps) {
  const screenWidth = Dimensions.get('window').width;
  const isLargeTablet = screenWidth > 768;

  return (
    <View
      style={[styles.container, isLargeTablet && styles.largeTabletContainer]}
    >
      {/* Component content */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  largeTabletContainer: {
    maxWidth: 500, // 500dp max width
    alignSelf: 'center',
  },
});
```

## Styling Guidelines

### Web Styling Hierarchy

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

.card-hover {
  @apply card-base hover:shadow-md;
}
```

3. **Raw CSS for Complex Patterns Only**

```scss
.complex-animation {
  @apply card-base;

  /* Tailwind can't handle this cleanly */
  animation: complexBounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

### Design System Integration

Always use existing design tokens:

**Colors:**

- `bg-surface-0`, `bg-surface-1`, `bg-surface-2`
- `text-strong`, `text-main`, `text-subtle`, `text-muted`
- `bg-accent`, `text-accent`, `border-accent`

**Spacing:**

- `p-1` to `p-12`, `m-1` to `m-12`
- `space-x-*`, `space-y-*` for consistent gaps

**Typography:**

- `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`
- `font-normal`, `font-medium`, `font-semibold`, `font-bold`

## Primitive Categories & Conversion Priority

Based on codebase audit, primitives are organized by category and implementation priority:

### Phase 1A: Foundation Layout Primitives (Highest Priority)

**Based on actual repeated patterns found in codebase:**

1. **ModalContainer/OverlayBackdrop** → `primitives/ModalContainer/`, `primitives/OverlayBackdrop/`
   - **Pattern**: `fixed inset-0 z-[9999] flex items-center justify-center bg-overlay backdrop-blur`
   - **Found In**: AppWithSearch.tsx (5+ times), Modal.tsx, Modal-OLD.tsx
   - **Impact**: Eliminates most repeated backdrop code

2. **FlexRow/FlexBetween/FlexCenter** → `primitives/FlexRow/`, `primitives/FlexBetween/`, `primitives/FlexCenter/`
   - **Pattern**: `flex items-center justify-between` and variants
   - **Found In**: Space.tsx, ChannelList.tsx, AppWithSearch.tsx throughout
   - **Impact**: Standardizes flex layouts across app

3. **ResponsiveContainer** → `primitives/ResponsiveContainer/`
   - **Pattern**: Complex width calculations with media queries
   - **Found In**: Container.tsx, main content areas, chat layouts
   - **Impact**: Centralizes responsive layout logic

### Phase 1B: Core Interaction Primitives

4. **Button.jsx** → `primitives/Button/`
5. **Modal.tsx** → `primitives/Modal/` (uses ModalContainer, becomes drawer on mobile)

### Phase 2: Form & UI Elements

6. **Input.tsx** → `primitives/Input/`
7. **ReactTooltip.tsx** → `primitives/Tooltip/`
8. **ToggleSwitch.tsx** → `primitives/Switch/`
9. Raw `<select>` elements → `primitives/Select/`
10. Raw `<textarea>` elements → `primitives/TextArea/`

### Phase 3: Specialized Primitives

11. Card patterns → `primitives/Card/`
12. Icon button patterns → `primitives/IconButton/`

## Testing Strategy

### Testing Matrix

| Component | Web Chrome | Web Safari | iOS Simulator | Android Emulator | Physical Device |
| --------- | ---------- | ---------- | ------------- | ---------------- | --------------- |
| Button    | [ ]        | [ ]        | [ ]           | [ ]              | [ ]             |
| Modal     | [ ]        | [ ]        | [ ]           | [ ]              | [ ]             |
| Input     | [ ]        | [ ]        | [ ]           | [ ]              | [ ]             |

### Automated Testing

```bash
# Type checking (both platforms)
yarn tsc

# Web testing
yarn test
yarn lint

# React Native testing (when available)
yarn test:native
```

### Manual Testing Checklist

#### Primitive Components

- [ ] Renders correctly on web with all style variants
- [ ] Renders correctly on mobile with proper touch targets (44dp minimum)
- [ ] All interactions work (click, press, hover, focus)
- [ ] Handles disabled state properly
- [ ] TypeScript types are complete and accurate
- [ ] Responsive behavior works on different screen sizes
- [ ] Large tablet optimization (if applicable)
- [ ] Accessibility attributes are present
- [ ] Performance is smooth on both platforms

#### Business Components

- [ ] Uses only primitives (no raw HTML elements)
- [ ] Complex logic works identically on both platforms
- [ ] State management is platform-agnostic
- [ ] API calls and data handling work on both platforms
- [ ] Error states are handled consistently
- [ ] Loading states work on both platforms

#### Conversion Validation

- [ ] All existing usages still work after conversion
- [ ] No visual regressions on web
- [ ] Mobile version matches web behavior functionally
- [ ] No breaking changes in component API
- [ ] Import paths are updated correctly
- [ ] CSS/styling is preserved

## Best Practices

### ✅ DO:

- Use primitives for ALL UI elements
- Keep business logic in shared components
- Maintain identical APIs across platforms
- Use TypeScript for type safety
- Follow existing naming conventions
- Use `.native.tsx` extension for React Native files
- **Styling**: Use Tailwind utilities first, then `@apply` for patterns
- **Styling**: Extract shared patterns into reusable semantic classes
- **Styling**: Use existing design tokens (accent, surface, text colors)

### ❌ DON'T:

- Use raw HTML in business components
- Put business logic in primitives
- Create platform-specific business components
- Break existing component APIs
- Mix concerns (UI rendering + business logic)
- Use `.mobile.tsx` extension (not recognized by React Native tooling)
- **Styling**: Write raw CSS for basic layouts (use Tailwind)
- **Styling**: Create one-off CSS classes without `@apply`
- **Styling**: Ignore the existing design system colors/spacing

## Common Patterns

### Modal Pattern

```tsx
// Business component using Modal primitive
const [isOpen, setIsOpen] = useState(false);

return (
  <>
    <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
    <Modal title="My Modal" visible={isOpen} onClose={() => setIsOpen(false)}>
      {/* Content automatically becomes drawer on mobile */}
    </Modal>
  </>
);
```

### Form Pattern

```tsx
// Form using Input and Button primitives
export function MyForm() {
  const [formData, setFormData] = useState({});

  return (
    <div className="space-y-4">
      <Input
        value={formData.name}
        onChange={(value) => setFormData({ ...formData, name: value })}
        placeholder="Name"
      />
      <Button type="primary" onClick={handleSubmit}>
        Submit
      </Button>
    </div>
  );
}
```

### List Pattern

```tsx
// List using Container and Card primitives
export function MyList({ items }) {
  return (
    <Container className="space-y-2">
      {items.map((item) => (
        <Card key={item.id} className="p-4">
          <Text className="font-medium">{item.title}</Text>
          <Text className="text-subtle">{item.description}</Text>
        </Card>
      ))}
    </Container>
  );
}
```

## Platform Resolution Reference

### File Extensions

- ✅ `.web.tsx` for web-specific code (uses CSS: px, rem, em, %)
- ✅ `.native.tsx` for React Native code (uses density-independent pixels: dp)
- ✅ `.ios.tsx` for iOS-specific code (optional)
- ✅ `.android.tsx` for Android-specific code (optional)
- ❌ Never use `.mobile.tsx` (not supported by tooling)

### Import Resolution

```typescript
// This import automatically resolves to the correct platform file:
import { Button } from '../primitives/Button';

// Bundler selects:
// - Button.web.tsx on web
// - Button.native.tsx on React Native
// - Button.ios.tsx on iOS (if exists, takes priority)
// - Button.android.tsx on Android (if exists, takes priority)
```

Following these guidelines ensures your components work seamlessly across desktop and mobile while maintaining consistency with the existing codebase and design system.
