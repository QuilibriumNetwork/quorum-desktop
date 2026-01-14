---
type: doc
title: Introduction and Core Concepts
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-10-14T00:00:00.000Z
---

# Introduction and Core Concepts

**[← Back to Primitives INDEX](./INDEX.md)**


## What Are Primitive Components?

Primitive components are the foundation of our cross-platform UI system. They provide a unified API that works seamlessly across web and React Native, abstracting platform differences while enabling platform-specific optimizations.

## ⚠️ **Platform Requirements - IMPORTANT**

### **Mobile (React Native)**

- ✅ **Primitives are MANDATORY** - React Native requires specific components
- ❌ **Cannot use HTML elements** (`<div>`, `<span>`, `<p>`, etc.)
- ❌ **Cannot use CSS classes** - Must use style objects

### **Web**

- 🤔 **Primitives are RECOMMENDED** but not required
- ✅ **Can still use raw HTML** when it makes sense
- ✅ **Mix primitives with existing HTML/CSS** during migration

### **Shared Components**

- ✅ **Use primitives ONLY** if component must work on both web AND mobile
- 🎯 **Otherwise, choose based on practicality** (see [When to Use Primitives](./03-when-to-use-primitives.md))

## 🎯 **Core Philosophy**

### **Mobile-First Cross-Platform Development**

Every component is designed to work on both desktop and mobile from day one. This isn't "responsive web design" – it's true cross-platform development with React Native.

### **Consistency Through Abstraction**

Rather than learning different APIs for web vs mobile, you learn one API that works everywhere. Platform differences are handled internally.

### **Progressive Enhancement**

Start with basic functionality that works everywhere, then add platform-specific features (haptic feedback, keyboard types, etc.) where beneficial.

---

## 🏗️ **Architecture Overview**

### **File Structure Pattern**

```
src/components/primitives/Button/
├── index.ts              # Exports the appropriate version
├── Button.web.tsx        # Web-specific implementation
├── Button.native.tsx     # React Native implementation
├── Button.scss    # Web styles
└── types.ts             # Shared type definitions
```

### **Import Resolution**

```tsx
// This automatically imports the right version
import { Button } from '../components/primitives/Button';

// Metro (React Native) picks Button.native.tsx
// Webpack (Web) picks Button.web.tsx
```

### **Shared Type System**

```tsx
// types.ts - shared across platforms
export interface BaseButtonProps {
  type?:
    | 'primary'
    | 'secondary'
    | 'light'
    | 'light-outline'
    | 'subtle'
    | 'danger'
    | 'unstyled';
  size?: 'small' | 'normal' | 'large';
  disabled?: boolean;
  fullWidth?: boolean;
  iconName?: IconName;
  iconOnly?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}

// Platform-specific props are conditionally added
export interface NativeButtonProps extends BaseButtonProps {
  hapticFeedback?: boolean; // Only on native
  accessibilityLabel?: string;
  fullWidthWithMargin?: boolean;
}
```

---

## 🎨 **Design System Integration**

### **Semantic Color Variables**

Instead of hardcoded colors, use semantic variables that automatically adapt to light/dark themes:

```tsx
// ❌ Hardcoded colors
<Container style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>

// ✅ Semantic colors (Quilibrium system)
<Container className="bg-surface-1 border-default">

// ✅ Or with theme variables
<Container style={{ backgroundColor: theme.colors.bg.surface1 }}>
```

### **Consistent Spacing System**

```tsx
// Standardized gap values used across Quilibrium
gap: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// Maps to consistent pixel values
// xs: 4px,  sm: 8px,  md: 16px,  lg: 24px,  xl: 32px

// Real usage in UserProfile component:
<Flex gap="sm" align="center">
  <Icon name="user" />
  <Text variant="strong">User Profile</Text>
</Flex>
```

### **Typography Hierarchy**

```tsx
// Semantic typography components in Quilibrium
<Text variant="strong" size="xl">Main page title</Text>
<Text variant="strong" size="lg">Section title</Text>
<Text variant="default">Body content</Text>
<Text variant="subtle" size="sm">Helper text</Text>
<Text variant="error">Error message</Text>

// Real usage from SwitchTestScreen:
<Text size="sm" variant="default">
  Basic Switch ({basicSwitch ? 'ON' : 'OFF'})
</Text>
```

---

## 🚀 **Key Benefits**

### **1. Development Speed**

- Write once, works everywhere
- No need to learn platform-specific APIs
- Consistent behavior reduces debugging

### **2. Design Consistency**

- Unified color system and spacing
- Consistent interactive states (hover, focus, disabled)
- Automatic theme switching (light/dark)

### **3. Maintainability**

- Bug fixes apply to all platforms
- API changes happen in one place
- Predictable component behavior

### **4. Accessibility**

- Built-in screen reader support
- Proper touch targets on mobile
- Keyboard navigation on web

### **5. Future-Proof**

- Easy to add new platforms (e.g., desktop apps)
- Component evolution without breaking changes
- A/B testing and analytics integration points

---

## 🎯 **Container + Layout Architecture**

### **Core Pattern: Separation of Concerns**

Our architecture separates **styling** from **layout** for maximum flexibility and consistency:

```tsx
// ✅ REAL EXAMPLE: From UserProfile component
<Container
  className="user-profile"
  onClick={(e: React.MouseEvent) => e.stopPropagation()}
>
  <Flex gap="sm" align="center">
    <Icon name="user" />
    <Text variant="strong">{user.name}</Text>
  </Flex>

  <Flex gap="xs" align="center">
    <Text variant="subtle" size="sm">
      Address:
    </Text>
    <ClickToCopyContent text={user.address} tooltipText="Copy address">
      <Text variant="subtle" className="font-mono">
        {user.address.slice(0, 8)}...
      </Text>
    </ClickToCopyContent>
  </Flex>
</Container>
```

### **Component Responsibilities**

#### **Container (Styling Container)**

- Visual styling: colors, borders, shadows, border radius
- Click/press handlers that work cross-platform
- Background colors and themed styling
- CSS classes and inline styles

#### **Flex Primitive (Layout)**

- Content organization and spacing (gap: 'xs' | 'sm' | 'md' | 'lg' | 'xl')
- Direction: direction="row" (default) | "column"
- Alignment: align="center" | "start" | "end" | "stretch"
- Justification: justify="start" | "center" | "between" | "around"
- Responsive behavior and wrapping

#### **Text Components (Content)**

- Typography and text rendering
- Built-in spacing props for better mobile experience
- Semantic variants (strong, subtle, error, etc.)

### **Why This Pattern Works**

1. **Predictable Spacing**: Gap system eliminates margin calculation issues
2. **Platform Consistency**: Flex primitives handle platform differences automatically
3. **Maintainable**: Clear separation between styling and layout concerns
4. **Flexible**: Mix and match containers with different layout patterns

---

## 📱 **Mobile-First Enhancements**

### **Enhanced Text Component**

React Native text handling is different from web. Our Text primitive solves common issues:

```tsx
// ✅ Real example: Enhanced Text from Quilibrium codebase
<Text variant="strong" size="lg" marginBottom={8}>
  Switch Component Demo
</Text>
<Text variant="subtle" align="center">
  Cross-platform toggle switch with multiple sizes and variants
</Text>

// ❌ Web approach (doesn't work well on mobile)
<div style={{ marginBottom: 16 }}>
  <p>Text without proper mobile optimizations</p>
</div>
```

**Enhancements:**

- **Automatic line height** (1.4x font size) for better readability
- **Built-in spacing props** to reduce View wrapper verbosity
- **Better Android alignment** with `includeFontPadding: false`
- **Semantic components** (Paragraph, Label, etc.) for common patterns

### **Touch-Optimized Interactions**

```tsx
// Real example from UserProfile component
<Button
  type="primary"
  size="small"
  onClick={() => sendMessage(user)}
  iconName="paper-plane"
  tooltip="Send direct message"
>
  Message
</Button>

// With mobile-specific props
<Button
  type="primary"
  onClick={handleSave}
  hapticFeedback={true}                    // Tactile feedback on mobile
  accessibilityLabel="Save user profile"  // Screen reader support
>
  Save Profile
</Button>
```

### **Platform-Specific Input Types**

```tsx
// Real examples from Quilibrium forms
<Input
  type="email"
  placeholder="Enter email address"
  keyboardType="email-address"    // Shows @ key on mobile keyboards
  autoComplete="email"            // Enables autofill
  returnKeyType="done"            // Custom return key label
  error={emailError}
/>

<Input
  type="password"
  placeholder="Enter passphrase"
  secureTextEntry={true}          // Hide password on mobile
  autoComplete="current-password"
  error={passwordError}
/>
```

---

## 🔄 **Migration Strategy**

### **From Web to Cross-Platform**

1. **Identify Platform-Specific Code**
   - HTML elements (`<div>`, `<button>`, `<input>`)
   - CSS classes and styling
   - Web-only event handlers

2. **Map to Primitive Equivalents**
   - `<div>` → `<Container>` (styling) + `<Flex>` (layout)
   - `<button>` → `<Button>` with type, size, and icon props
   - `<input>` → `<Input>` with error handling and mobile keyboard types
   - CSS classes → component props and semantic variants

3. **Use Semantic Components**
   - `<p>` → `<Text variant="default">`
   - `<h2>` → `<Text variant="strong" size="lg">`
   - `<strong>` → `<Text variant="strong">`
   - `<small>` → `<Text variant="subtle" size="sm">`

4. **Test on Mobile**
   - Run in React Native simulator
   - Verify touch targets are appropriate size
   - Test keyboard behavior and accessibility

### **Gradual Adoption**

You don't need to convert everything at once:

```tsx
// ✅ Real example: Mix primitives with existing SCSS during migration
<div className="user-profile-complex-layout">
  {' '}
  {/* Keep existing SCSS */}
  <Flex gap="sm" align="center">
    <Icon name="user" />
    <Text variant="strong">{user.name}</Text>
  </Flex>
  {/* Use primitive buttons for consistency */}
  <Flex gap="xs">
    <Button type="secondary" size="small" onClick={() => kickUser(user)}>
      Remove User
    </Button>
    <Button type="primary" size="small" onClick={() => sendMessage(user)}>
      Send Message
    </Button>
  </Flex>
</div>
```

---

## 🎯 **When to Use Primitives**

### **Always Use For:**

- **Interactive elements**: Button, Input, Select, Modal, Switch
- **Layout containers**: Flex for consistent spacing
- **Design system elements**: Text (required on mobile), Icon

### **Consider For:**

- **Simple containers**: Use View if you need theme consistency
- **Form elements**: Primitives provide consistent validation/error states

### **Don't Force For:**

- **Highly specialized components**: Complex animations, charts
- **Third-party integrations**: When the library expects specific HTML structures
- **Performance-critical sections**: Where extra abstraction layers could impact performance

---

## 🚀 **Getting Started**

### **Next Steps**

1. **Need quick component reference?** → [02-primitives-quick-reference.md](./02-primitives-quick-reference.md)
2. **Understanding when to use primitives?** → [03-when-to-use-primitives.md](./03-when-to-use-primitives.md)
3. **Converting web components?** → [04-web-to-native-migration.md](./04-web-to-native-migration.md)

### **Development Workflow**

1. Design your component using primitives
2. Test on web first (faster iteration)
3. Test on mobile simulator to verify behavior
4. Add platform-specific enhancements if needed
5. Validate accessibility with screen readers

---

_Last updated: 2026-01-14 - Updated to use unified Flex primitive_

---

[← Back to Primitives INDEX](./INDEX.md)
