# Primitives Documentation Index

Complete guide to the cross-platform primitive component system for React Native + Web development.

## 📚 Documentation Structure

### 🚀 **Getting Started**

1. [**01-introduction-and-concepts.md**](./01-introduction-and-concepts.md) - Architecture overview, concepts, and philosophy
2. [**02-primitives-AGENTS.md**](./02-primitives-AGENTS.md) - Comprehensive component reference with all props and examples
3. [**03-when-to-use-primitives.md**](./03-when-to-use-primitives.md) - Decision framework for when to use vs avoid primitives

### 🔄 **Migration & Advanced**

4. [**04-web-to-native-migration.md**](./04-web-to-native-migration.md) - Step-by-step migration guide with patterns and examples
5. [**05-primitive-styling-guide.md**](./05-primitive-styling-guide.md) - Color system, semantic classes, and consistency rules

---

## 🎯 **Quick Navigation**

### **New to Primitives?**

Start with [01-introduction-and-concepts.md](./01-introduction-and-concepts.md) to understand the architecture and philosophy.

### **Need Component Reference?**

Use [API-REFERENCE.md](./API-REFERENCE.md) for quick prop lookups, or [02-primitives-AGENTS.md](./02-primitives-AGENTS.md) for comprehensive component documentation with all props and examples.

### **Architecture Decisions?**

Refer to [03-when-to-use-primitives.md](./03-when-to-use-primitives.md) for guidance on when to use primitives.

### **Converting Web Components?**

Jump to [04-web-to-native-migration.md](./04-web-to-native-migration.md) for step-by-step conversion patterns.

### **Styling Questions?**

Check [05-primitive-styling-guide.md](./05-primitive-styling-guide.md) for color system and consistency rules.

---

## 🏗️ **Core Concepts**

### **Cross-Platform Architecture**

- Shared primitive components work on both web and mobile
- Platform-specific implementations (.web.tsx, .native.tsx)
- Unified API with platform optimizations

### **Container + Layout Pattern**

- **View**: Styling containers (colors, borders, shadows)
- **Flex primitives**: Layout, spacing, alignment
- **Text**: Enhanced with automatic spacing and line height

### **Design System Integration**

- Semantic color variables and theme system
- Consistent spacing, typography, and interactive states
- Accessibility-first approach

---

## 📋 **Common Patterns**

### **Form Field Group**

```tsx
<FlexColumn gap="xs">
  <Label>Email Address</Label>
  <Input
    type="email"
    value={email}
    onChange={setEmail}
    error={!!emailError}
    errorMessage={emailError}
  />
</FlexColumn>
```

### **Card Layout**

```tsx
<View
  style={{
    backgroundColor: theme.colors.bg.card,
    padding: 16,
    borderRadius: 12,
  }}
>
  <FlexColumn gap="md">
    <SectionHeading>Card Title</SectionHeading>
    <Paragraph>Card content goes here</Paragraph>
    <Button type="primary">Action</Button>
  </FlexColumn>
</View>
```

### **Header with Action**

```tsx
<FlexRow justify="between" align="center">
  <FlexRow gap="sm" align="center">
    <Icon name="settings" />
    <Text weight="semibold">Settings</Text>
  </FlexRow>
  <Button type="subtle" iconName="close" iconOnly onClick={onClose} />
</FlexRow>
```

### **Status Messages**

```tsx
<FlexColumn gap="sm">
  <Callout variant="success" dismissible>
    Operation completed successfully!
  </Callout>
  <Callout variant="warning" layout="minimal">
    Connection issues detected. Some features may not work.
  </Callout>
  <Callout variant="info" size="xs">
    New version available
  </Callout>
</FlexColumn>
```

---

## 🎯 **Component Categories**

### **Text & Typography**

- Text, Paragraph, Title (with size & weight props), Label, Caption, InlineText

### **Interactive Elements**

- Button, Input, TextArea, Select, Switch, RadioGroup, FileUpload

### **Layout Components**

- FlexRow, FlexColumn, FlexCenter, FlexBetween, Container, ResponsiveContainer, ScrollContainer, Spacer

### **Modal & Overlay**

- Modal, Tooltip, OverlayBackdrop, ModalContainer

### **Messaging Components**

- Callout

### **Visual Components**

- Icon, ColorSwatch

---

## 🚫 **Common Mistakes to Avoid**

| ❌ Don't Do                       | ✅ Do Instead                             |
| --------------------------------- | ----------------------------------------- |
| `<div className="flex">`          | `<FlexRow>` or `<FlexColumn>`             |
| `<p>Text content</p>`             | `<Text>Text content</Text>`               |
| `<button onClick={}>`             | `<Button onClick={}>`                     |
| Manual margin/padding for spacing | Use Flex gap props or semantic components |
| CSS classes in React Native       | Use component props                       |
| Custom alert/notification divs    | `<Callout variant="...">`                 |

---

## 📖 **Related Documentation**

- [Main Documentation Index](../../../INDEX.md) - Complete project documentation
- [Quick Reference Guide](../../../AGENTS.md) - Fast lookup for common tasks and file locations
- [API Reference](./API-REFERENCE.md) - Quick prop lookup for all primitives
- [Agents Workflow Guide](../../../agents-workflow.md) - How to use documentation effectively
- [Component Architecture Guide](../component-architecture-workflow-explained.md) - Overall architecture explanation
- [Modal System](../modals.md) - Modal implementation patterns
- [Theming System](../cross-platform-theming.md) - Color system and theming
- [Responsive Layout](../responsive-layout.md) - Responsive design patterns

---

_Last updated: 2025-10-08_

---

[← Back to Main INDEX](../../INDEX.md)
