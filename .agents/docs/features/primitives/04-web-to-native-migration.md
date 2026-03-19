---
type: doc
title: Web-to-Native Migration Guide
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-10-14T00:00:00.000Z
---

# Web-to-Native Migration Guide

**[← Back to Primitives INDEX](./INDEX.md)**


Complete guide for converting web components to React Native using our cross-platform primitives.

## Table of Contents

1. [Migration Strategy Overview](#migration-strategy-overview)
   - [Component Logic Extraction](#️-important-component-logic-extraction)
   - [Step-by-Step Process](#step-by-step-process)
   - [Native Component Styling Guidelines](#-native-component-styling-guidelines)
2. [Common Migration Patterns](#common-migration-patterns)
3. [Text & Typography](#text--typography)
4. [Layout Conversion](#layout-conversion)
5. [Form Elements](#form-elements)
6. [Interactive Elements](#interactive-elements)
7. [Styling Differences](#styling-differences)
8. [Common Pitfalls](#common-pitfalls)
9. [Testing Checklist](#testing-checklist)

---

## Migration Strategy Overview

### ⚠️ **IMPORTANT: Component Logic Extraction**

Before migrating any component, the component logic **MUST** be extracted in a surgical way following these guidelines:

📋 **Read**: [Cross-Platform Hooks Refactoring Plan](/.agents/tasks/todo/mobile-dev/cross-platform-hooks-refactoring-plan.md)

**Key Requirements:**

- **Business logic** must be separated from platform-specific APIs
- Use **adapter pattern** for hooks that mix business logic with platform APIs
- Use **direct imports** instead of barrel exports to avoid Import Chain Problem
- Ensure **90% code sharing** between web and native versions

### Step-by-Step Process

1. **🔍 Analyze Web Component** - Identify HTML elements, CSS classes, and interactions
2. **⚡ Extract Logic First** - Refactor hooks using adapter pattern (see refactoring plan)
3. **📋 Map to Primitives** - Find equivalent primitive components
4. **🔄 Convert Structure** - Replace HTML with primitive components
5. **🎨 Apply Styling** - Use props instead of CSS classes (see styling guidelines below)
6. **📱 Test Mobile** - Verify behavior on mobile simulator
7. **♿ Validate Accessibility** - Ensure screen reader compatibility

### ✨ **Native Component Styling Guidelines**

**Critical Rules for Native Components:**

1. **Mirror Web Component Style** - Native styling must visually match the web version exactly
2. **Use Text Primitive Helpers** - Always use the correct helper components:
   - `<Title>` for headings (h1, h2, h3, etc.)
   - `<Paragraph>` for body text and descriptions
   - `<Text>` for inline text and labels
   - `<Label>` for form field labels
3. **Use Style Props Over Hardcoded Styles** - Prefer primitive props over inline `style` objects:

   ```tsx
   // ✅ Good - Use props
   <Title size="lg" weight="bold" color="white" align="center">
   <Paragraph size="sm" color="subtle" align="center">
   <Button type="primary" size="large">

   // ❌ Bad - Hardcoded styles
   <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#ffffff' }}>
   <Text style={{ fontSize: 14, color: '#666666', textAlign: 'center' }}>
   ```

4. **Maintain Visual Consistency** - Colors, spacing, typography, and layout must match web version
5. **Use Semantic Components** - Choose components that reflect the content's meaning, not just appearance

### Quick Reference Table

| Web Element          | Native Primitive            | Key Differences                     |
| -------------------- | --------------------------- | ----------------------------------- |
| `<div>` with flexbox | `<Flex>`, `<Flex direction="column">` | Use gap prop instead of margin |
| `<p>`, `<span>`      | `<Text>`, `<Paragraph>`     | All text must be wrapped            |
| `<button>`           | `<Button>`                  | Use onClick instead of click events |
| `<input>`            | `<Input>`                   | Different keyboard types available  |
| `<textarea>`         | `<TextArea>`                | Multiline handled differently       |
| `<select>`           | `<Select>`                  | Custom dropdown implementation      |

---

## Common Migration Patterns

### Key Migration Patterns

- Replace `<div>` with flexbox layout → `<Flex>`; for styling wrappers → `<View>` (native)
- Replace `<button>` with `<Button type="primary">`
- Replace `<input>` with `<Input>`
- Use component props instead of CSS classes
- Wrap all text in `<Text>` components

---

## Text & Typography

### Basic Text Conversion

#### ❌ Web Patterns

```tsx
// Multiple text elements with margins
<div>
  <h2 className="text-2xl font-bold mb-4">Section Title</h2>
  <p className="text-gray-700 mb-6 leading-relaxed">
    This is a paragraph with some content that needs proper spacing.
  </p>
  <span className="text-sm text-gray-500">Helper text</span>
</div>
```

#### ✅ Native Conversion

```tsx
import { Title, Paragraph, Text } from '../components/primitives';

// Using semantic typography components with proper props
<>
  <Title size="lg" weight="bold">
    Section Title
  </Title>
  <Paragraph color="default">
    This is a paragraph with some content that needs proper spacing.
  </Paragraph>
  <Text size="sm" color="subtle">
    Helper text
  </Text>
</>;
```

### Typography Hierarchy

| Web CSS Class            | Native Component | Props                         |
| ------------------------ | ---------------- | ----------------------------- |
| `.text-3xl.font-bold`    | `<Title>`        | `size="xl" weight="bold"`     |
| `.text-xl.font-semibold` | `<Title>`        | `size="lg" weight="semibold"` |
| `.text-base`             | `<Paragraph>`    | Default paragraph styling     |
| `.text-sm.font-medium`   | `<Text>`         | `size="sm" weight="medium"`   |
| `.text-sm.text-gray-500` | `<Text>`         | `size="sm" color="subtle"`    |

---

## Common Pitfalls

### Input Field Conversion

#### ❌ Web Input (Similar to UserProfileEdit pattern)

```tsx
<div className="user-profile-content">
  <div className="user-profile-content-section-header small-caps">
    Display Name
  </div>
  <input
    className="w-[190px] border border-gray-300 rounded px-3 py-2"
    value={displayName}
    onChange={(e) => setDisplayName(e.target.value)}
    placeholder="Enter display name"
  />
  {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
</div>
```

#### ✅ How This Would Look With Primitives

```tsx
// Native equivalent using primitives (Text primitive is native-only)
// Note: The web version above already uses plain HTML + CSS classes — no migration needed on web
import { Input, Text, Flex } from '../primitives';

<Flex direction="column" gap="xs">
  <Text size="sm" variant="subtle">
    Display Name
  </Text>
  <Input
    value={displayName}
    onChange={setDisplayName}
    placeholder="Enter display name"
    error={displayNameError}
  />
</Flex>;
```

### Select/Dropdown Conversion

#### ❌ Web Select

```tsx
<select
  value={country}
  onChange={(e) => setCountry(e.target.value)}
  className="w-full px-3 py-2 border border-gray-300 rounded-md"
>
  <option value="">Select country</option>
  <option value="us">United States</option>
  <option value="ca">Canada</option>
</select>
```

#### ✅ Native Select

```tsx
import { Select } from '../components/primitives';

<Select
  value={country}
  onChange={setCountry}
  placeholder="Select country"
  options={[
    { label: 'United States', value: 'us' },
    { label: 'Canada', value: 'ca' },
  ]}
/>;
```

---

## Interactive Elements

### Button Conversion

#### ❌ Web Buttons

```tsx
// Save button
<button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
  Save Profile
</button>

// Secondary action button
<button className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50">
  Send Message
</button>

// Icon-only button
<button className="p-2 text-gray-400 hover:text-gray-600">
  <i className="fas fa-ellipsis-vertical"></i>
</button>
```

#### ✅ Native Buttons

```tsx
// Using primitives for button patterns
import { Button, Icon } from '../primitives';
import { TouchableOpacity } from 'react-native';

// Primary action button
<Button
  type="primary"
  disabled={isDisabled}
  onClick={handleSave}
>
  Save Profile
</Button>

// Secondary action button with icon
<Button
  type="secondary"
  size="small"
  iconName="paper-plane"
  onClick={handleAction}
>
  Send Message
</Button>

// Icon-only button pattern
<TouchableOpacity onPress={handleMenuAction}>
  <Icon name="ellipsis-vertical" />
</TouchableOpacity>
```

---

## Styling Differences

### Color System Migration

#### Web Code (Current Approach)

```tsx
// From ChannelList component header styling — this is how web code looks today
// Web uses plain HTML elements with CSS typography/theme classes
<div className="space-header bg-surface-1 border-default rounded">
  <div className="space-header-name truncate">
    <span className="font-bold text-strong">Space Name</span>
  </div>
  <p className="text-subtle">Space description</p>
  <span className="text-accent">Online users: 5</span>
</div>
```

#### ✅ Native Equivalent

```tsx
// Native version using Text primitive and theme system
import { Text } from '../primitives';
import { View } from 'react-native';

<View style={headerStyle}>
  <View style={styles.spaceName}>
    <Text weight="bold" variant="strong">
      Space Name
    </Text>
  </View>
  <Text variant="subtle">Space description</Text>
  <Text variant="link">Online users: 5</Text>
</View>;
```

### Spacing System

#### ❌ Web Tailwind Spacing

```tsx
<div className="p-4 m-2 space-y-3">
  <p className="mb-4">Content</p>
</div>
```

#### ✅ Native Spacing

```tsx
// Using Flex gap
<Flex direction="column" gap="sm" style={{ padding: 16, margin: 8 }}>
  <Paragraph>Content</Paragraph>
</Flex>

// Or using Text spacing props
<Text marginBottom={16}>Content</Text>
```

---

## Common Pitfalls

### ❌ Pitfall 1: Using HTML Elements

```tsx
// DON'T: HTML elements won't work in React Native
<div>
  <p>This will crash on mobile</p>
  <button onClick={handleClick}>Won't work</button>
</div>
```

### ✅ Solution: Use Primitives

```tsx
// DO: Use primitive components
<Flex direction="column">
  <Text>This works on mobile</Text>
  <Button onClick={handleClick}>Works everywhere</Button>
</Flex>
```

### ❌ Pitfall 2: CSS Classes on Native

```tsx
// DON'T: CSS classes don't work in React Native (from UserProfile example)
<Text className="text-strong font-bold">User Name</Text>
<Text className="text-subtle text-xs">User address</Text>
```

### ✅ Solution: Use Props

```tsx
// DO: Use component props
<Text variant="strong" weight="bold">User Name</Text>
<Text variant="subtle" size="xs">User address</Text>
<Text
  size="lg"
  weight="medium"
  style={{ color: 'white', textAlign: 'center' }}
>
  Welcome, {user.displayName}!
</Text>
```

### ❌ Pitfall 3: Missing Text Wrappers

```tsx
// DON'T: Naked text will crash React Native (common in ChannelList)
<View>
  Space Name
  <Icon name="users" />5 members
</View>
```

### ✅ Solution: Wrap All Text (ChannelList)

```tsx
// DO: All text must be in Text components (real pattern from Quilibrium)
<View style={styles.spaceHeaderName}>
  <Text weight="bold" variant="strong">
    {spaceName}
  </Text>
  <Icon name="users" />
  <Text variant="subtle" size="sm">
    5 members
  </Text>
</View>
```

---

## Testing Checklist

### ✅ Pre-Migration Checklist

- [ ] Identify all HTML elements used
- [ ] Map CSS classes to primitive props
- [ ] Plan layout structure with Flex components
- [ ] Identify form validation requirements
- [ ] Note any complex interactions

### ✅ Post-Migration Checklist

- [ ] All HTML elements replaced with primitives
- [ ] No CSS classes used (use props instead)
- [ ] All text wrapped in Text components
- [ ] Layout works on mobile simulator
- [ ] Touch targets are appropriate size (min 44px)
- [ ] Keyboard navigation works
- [ ] Screen reader accessibility tested
- [ ] Form validation messages display correctly
- [ ] Error states handled properly
- [ ] Loading states implemented

### ✅ Mobile-Specific Testing

- [ ] Test on iOS simulator
- [ ] Test on Android simulator
- [ ] Verify keyboard types (email, numeric, etc.)
- [ ] **Test keyboard covering inputs** - Ensure KeyboardAvoidingView works properly
- [ ] Test with larger accessibility font sizes
- [ ] Verify haptic feedback (if implemented)
- [ ] Test scroll behavior and content overflow
- [ ] Verify safe area handling

### ✅ Keyboard Handling (Critical for Mobile)

From mobile onboarding implementation, we learned:

```tsx
// ✅ Always wrap components with form inputs in KeyboardAvoidingView
<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
>
  <YourFormComponent />
</KeyboardAvoidingView>
```

**Key lessons:**

- KeyboardAvoidingView must wrap the entire screen layout
- Different behavior needed for iOS vs Android
- Test thoroughly to ensure keyboard doesn't cover inputs

---

## Summary

Key principles for successful web-to-native migration:

1. **Replace HTML with Primitives** - Interactive and layout elements have primitive equivalents; use `<View>` for styling containers
2. **Use Props Over Classes** - Component props replace CSS classes
3. **Wrap All Text** - React Native requires all text in Text components
4. **Layout with Flex** - Use Flex instead of CSS Grid
5. **Theme Colors** - Use theme system instead of hardcoded colors
6. **Test Early** - Run mobile simulator frequently during migration
7. **Accessibility First** - Include proper labels and keyboard navigation

Following these patterns will ensure your components work seamlessly across web and mobile platforms.

---

_Last updated: 2026-03-15 - Removed Container references (dropped); replaced with div (web) / View (native) in examples_

---

[← Back to Primitives INDEX](./INDEX.md)
