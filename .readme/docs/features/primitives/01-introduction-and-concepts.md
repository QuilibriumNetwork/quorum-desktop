# Introduction and Core Concepts

**[← Back to Primitives INDEX](./INDEX.md)**

[← Back to Docs INDEX](/.readme/INDEX.md)

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
- 🎯 **Otherwise, choose based on practicality** (see [When to Use Primitives](./06-when-to-use-primitives.md))

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
interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
  type?: 'primary' | 'secondary' | 'light';
  disabled?: boolean;
}

// Platform-specific props are conditionally added
interface NativeButtonProps extends ButtonProps {
  hapticFeedback?: boolean;  // Only on native
  accessibilityLabel?: string;
}
```

---

## 🎨 **Design System Integration**

### **Semantic Color Variables**
Instead of hardcoded colors, use semantic variables that automatically adapt to light/dark themes:

```tsx
// ❌ Hardcoded colors
<View style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>

// ✅ Semantic colors
<View style={{ backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.default }}>
```

### **Consistent Spacing System**
```tsx
// Standardized gap values
gap: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// Maps to consistent pixel values
xs: 4px,  sm: 8px,  md: 16px,  lg: 24px,  xl: 32px
```

### **Typography Hierarchy**
```tsx
// Semantic typography components
<Title>Main page title</Title>           // lg (24px), bold, auto-spacing
<Title size="sm">Section title</Title>   // sm (18px), bold, auto-spacing  
<Paragraph>Body content</Paragraph>      // base, normal, auto-spacing
<Label>Form field label</Label>          // sm, medium, auto-spacing
<Caption>Helper text</Caption>           // sm, subtle, auto-spacing
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
// ✅ RECOMMENDED: Container + Layout pattern
<View style={{ backgroundColor: colors.bg.card, padding: 16, borderRadius: 8 }}>
  <FlexColumn gap="md">
    <FlexRow gap="sm" align="center">
      <Icon name="user" />
      <Text>User Profile</Text>
    </FlexRow>
    <FlexColumn gap="xs">
      <Label>Email:</Label>
      <Input value={email} onChange={setEmail} />
    </FlexColumn>
  </FlexColumn>
</View>
```

### **Component Responsibilities**

#### **View (Styling Container)**
- Visual styling: colors, borders, shadows, border radius
- Platform-specific props (e.g., elevation on Android)
- Background colors and images
- Padding and margins for the container itself

#### **Flex Primitives (Layout)**
- Content organization and spacing
- Gap between child elements
- Alignment and justification
- Responsive behavior

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
// ✅ Enhanced Text with automatic improvements
<Text marginBottom={16} lineHeight={24}>
  This text has proper line height and spacing for mobile
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
<Button 
  type="primary"
  onClick={handlePress}
  hapticFeedback={true}           // Tactile feedback on mobile
  accessibilityLabel="Save document"  // Screen reader support
>
  Save
</Button>
```

### **Platform-Specific Input Types**
```tsx
<Input 
  type="email"
  keyboardType="email-address"    // Shows @ key on mobile keyboards
  autoComplete="email"            // Enables autofill
  returnKeyType="done"            // Custom return key label
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
   - `<div>` → `<View>` (styling) + `<FlexRow>`/`<FlexColumn>` (layout)
   - `<button>` → `<Button>`
   - `<input>` → `<Input>`
   - CSS classes → component props

3. **Use Semantic Components**
   - `<p>` → `<Paragraph>` or `<Text>`
   - `<h2>` → `<Title size="sm">`
   - `<label>` → `<Label>`

4. **Test on Mobile**
   - Run in React Native simulator
   - Verify touch targets are appropriate size
   - Test keyboard behavior and accessibility

### **Gradual Adoption**
You don't need to convert everything at once:

```tsx
// ✅ Mix primitives with existing code during migration
<div className="existing-complex-layout">
  <FlexRow gap="sm" align="center">
    <Icon name="user" />
    <Text variant="strong">User Profile</Text>
  </FlexRow>
  <Button type="primary" onClick={handleSave}>
    Save Changes
  </Button>
</div>
```

---

## 🎯 **When to Use Primitives**

### **Always Use For:**
- **Interactive elements**: Button, Input, Select, Modal, Switch
- **Layout containers**: FlexRow, FlexColumn for consistent spacing
- **Design system elements**: Text with semantic colors, Icon

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
1. **New to converting web components?** → [02-web-to-native-migration.md](./02-web-to-native-migration.md)
2. **Need quick component reference?** → [03-primitives-quick-reference.md](./03-primitives-quick-reference.md)
3. **Building complex components?** → [04-complete-component-guide.md](./04-complete-component-guide.md)

### **Development Workflow**
1. Design your component using primitives
2. Test on web first (faster iteration)
3. Test on mobile simulator to verify behavior
4. Add platform-specific enhancements if needed
5. Validate accessibility with screen readers

---

*Last updated: 2025-08-05*

---

[← Back to Primitives INDEX](./INDEX.md)