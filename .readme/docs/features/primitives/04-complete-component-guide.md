# Complete Primitive Components Guide

**[← Back to Primitives INDEX](./INDEX.md)**

[← Back to Docs INDEX](/.readme/INDEX.md)

This comprehensive guide covers all primitive components in the Quorum Desktop application, with detailed examples and best practices for React Native development.

## Overview

Our primitive components provide a unified API that works across web and mobile platforms. Each component abstracts platform differences while providing platform-specific optimizations.

### Component Categories

#### 🎨 **UI Components**
- [Text & Typography](#text--typography) - Enhanced text rendering with automatic spacing
- [Button](#button) - Interactive buttons with multiple variants
- [Input](#input) - Text input fields with validation
- [TextArea](#textarea) - Multi-line text input
- [Select](#select) - Dropdown selection
- [Switch](#switch) - Toggle switches
- [RadioGroup](#radiogroup) - Radio button groups

#### 🎯 **Interactive Components**
- [Modal](#modal) - Overlay dialogs and modals
- [Tooltip](#tooltip) - Contextual tooltips
- [Icon](#icon) - Scalable icon system

#### 📐 **Layout Components**
- [Container](#container) - Base container with responsive behavior
- [FlexRow/FlexColumn](#flex-components) - Flexbox layout primitives
- [FlexCenter/FlexBetween](#flex-components) - Specialized flex layouts
- [ResponsiveContainer](#responsivecontainer) - Responsive layout container

#### 🎛️ **Utility Components**
- [ColorSwatch](#colorswatch) - Color display component
- [OverlayBackdrop](#overlaybackdrop) - Modal backdrop overlay
- [ModalContainer](#modalcontainer) - Modal content container

---

## Text & Typography

The Text primitive is the foundation of all text rendering in the app, with enhanced features for React Native compatibility.

### Enhanced Features ✨

- **Automatic line height** (1.4x font size) for better readability
- **Built-in spacing props** to reduce View wrapper verbosity
- **Semantic typography components** for common patterns
- **Better Android alignment** with `includeFontPadding: false`

### Basic Usage

```tsx
import { Text } from '../components/primitives/Text';

// Basic text
<Text>Hello World</Text>

// With variant and size
<Text variant="strong" size="lg">Important Text</Text>

// With custom spacing
<Text marginBottom={16} lineHeight={24}>Custom spaced text</Text>
```

### All Props

```tsx
interface NativeTextProps {
  children: React.ReactNode;
  
  // Styling
  variant?: 'default' | 'strong' | 'subtle' | 'muted' | 'error' | 'success' | 'warning' | 'link';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
  color?: string;
  
  // Enhanced spacing props
  marginBottom?: number;
  marginTop?: number;
  lineHeight?: number;
  
  // React Native specific
  numberOfLines?: number;
  onPress?: () => void;
  selectable?: boolean;
  accessible?: boolean;
  accessibilityLabel?: string;
  href?: string; // For links
  testId?: string;
}
```

### Semantic Typography Components

Use these pre-configured components for common patterns:

```tsx
import { 
  Paragraph, 
  Label, 
  Caption, 
  Title, 
  InlineText 
} from '../components/primitives/Text';

// Title with automatic spacing
<Title>Page Title</Title>

// Section heading (using Title with sm size)
<Title size="sm">Section Title</Title>

// Paragraph with bottom margin
<Paragraph>
  This paragraph has automatic bottom margin and proper line height.
</Paragraph>

// Label for form fields
<Label>Field Label:</Label>

// Caption text with top margin
<Caption>Additional information or helper text</Caption>

// Inline text (no automatic spacing)
<InlineText>Text within containers</InlineText>
```

### Web-to-Native Migration Examples

#### ❌ Web Version (Don't do this in native)
```tsx
// Web approach with CSS classes
<div className="mb-4">
  <p className="text-lg font-semibold text-gray-900">Section Title</p>
</div>
<p className="text-base text-gray-700 leading-relaxed">
  Content paragraph with CSS styling.
</p>
```

#### ✅ Native Version (Recommended)
```tsx
// Native approach with semantic components
<Title size="sm">Section Title</Title>
<Paragraph>
  Content paragraph with automatic spacing and line height.
</Paragraph>
```

#### ⚠️ Native Version (Avoid - too verbose)
```tsx
// Avoid: Manual View wrappers
<View style={{ marginBottom: 16 }}>
  <Text size="lg" weight="semibold" variant="strong">Section Title</Text>
</View>
<View style={{ marginBottom: 16 }}>
  <Text size="base" variant="default">Content paragraph</Text>
</View>
```

---

## Button

Interactive button component with multiple variants and states.

### Basic Usage

```tsx
import { Button } from '../components/primitives/Button';

<Button onPress={() => console.log('Pressed!')}>
  Click Me
</Button>
```

### All Props

```tsx
interface NativeButtonProps {
  children?: React.ReactNode;
  onClick: () => void;
  
  // Button types/variants
  type?: 'primary' | 'secondary' | 'light' | 'light-outline' | 'subtle' | 
        'subtle-outline' | 'danger' | 'primary-white' | 'secondary-white' | 
        'light-white' | 'light-outline-white' | 'disabled-onboarding' | 'unstyled';
  
  size?: 'small' | 'normal' | 'large';
  disabled?: boolean;
  
  // Icon support
  iconName?: IconName; // FontAwesome icon name
  iconOnly?: boolean; // Show only icon, no text
  
  // Native-specific
  hapticFeedback?: boolean;
  accessibilityLabel?: string;
  
  // Tooltip
  tooltip?: string;
  highlightedTooltip?: boolean;
  
  id?: string;
  className?: string;
}
```

### Examples

```tsx
// Primary button
<Button type="primary" onClick={handleSubmit}>
  Submit
</Button>

// Button with icon
<Button 
  type="secondary" 
  iconName="plus"
  onClick={handleAdd}
>
  Add Item
</Button>

// Icon-only button
<Button 
  type="light"
  iconName="user"
  iconOnly
  onClick={handleProfile}
  accessibilityLabel="View Profile"
/>

// Disabled state
<Button type="primary" disabled onClick={handleSubmit}>
  Cannot Click
</Button>

// Different sizes
<Button type="primary" size="small" onClick={handleClick}>Small</Button>
<Button type="primary" size="normal" onClick={handleClick}>Normal</Button>
<Button type="primary" size="large" onClick={handleClick}>Large</Button>
```

### Web-to-Native Migration

#### ❌ Web Version
```tsx
<button 
  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
  onClick={handleClick}
>
  Click Me
</button>
```

#### ✅ Native Version
```tsx
<Button type="primary" onClick={handleClick}>
  Click Me
</Button>
```

---

## Input

Text input component with validation and multiple variants.

### Basic Usage

```tsx
import { Input } from '../components/primitives/Input';

const [value, setValue] = useState('');

<Input 
  value={value}
  onChange={setValue}
  placeholder="Enter text..."
/>
```

### All Props

```tsx
interface InputNativeProps {
  // Basic props
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  
  // Input types
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  variant?: 'filled' | 'bordered' | 'onboarding';
  
  // Validation
  error?: boolean;
  errorMessage?: string;
  
  // States
  disabled?: boolean;
  autoFocus?: boolean;
  noFocusStyle?: boolean;
  
  // React Native specific
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 
                'number-pad' | 'decimal-pad' | 'url';
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  autoComplete?: 'off' | 'email' | 'name' | 'tel' | 'username' | 'password';
  secureTextEntry?: boolean;
  
  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
  
  // Styling
  style?: React.CSSProperties;
}
```

### Examples

```tsx
// Basic input
<Input 
  value={email}
  onChange={setEmail}
  placeholder="Enter your email"
  type="email"
/>

// Input with error
<Input 
  value={password}
  onChange={setPassword}
  type="password"
  error={passwordError}
  errorMessage="Password must be at least 8 characters"
/>

// Bordered variant
<Input 
  variant="bordered"
  placeholder="Bordered input style"
/>
```

### Web-to-Native Migration

#### ❌ Web Version
```tsx
<input 
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  className="border rounded px-3 py-2"
  placeholder="Email"
/>
```

#### ✅ Native Version
```tsx
<Input 
  type="email"
  value={email}
  onChange={setEmail}
  placeholder="Email"
/>
```

---

## Layout Components (Flex)

Flexbox-based layout primitives for consistent cross-platform layouts.

### FlexRow & FlexColumn

```tsx
import { FlexRow, FlexColumn } from '../components/primitives';

// Horizontal layout
<FlexRow gap="md" align="center">
  <Icon name="user" />
  <Text>User Profile</Text>
</FlexRow>

// Vertical layout
<FlexColumn gap="lg" align="stretch">
  <Title>Form Title</Title>
  <Input placeholder="Name" />
  <Input placeholder="Email" />
  <Button>Submit</Button>
</FlexColumn>
```

### Props

```tsx
interface FlexRowProps {
  children: ReactNode;
  
  // Alignment
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'end' | 'center' | 'stretch' | 'baseline';
  
  // Spacing
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | string;
  
  // Layout
  wrap?: boolean;
  
  // Styling
  className?: string;
  style?: CSSProperties;
  
  // Additional HTML attributes
  [key: string]: any;
}

// FlexColumn has the same props but different default flex direction
interface FlexColumnProps extends FlexRowProps {}
```

### Web-to-Native Migration

#### ❌ Web Version
```tsx
<div className="flex items-center space-x-4">
  <img src="icon.png" />
  <span>Text content</span>
</div>
```

#### ✅ Native Version
```tsx
<FlexRow gap="md" align="center">
  <Icon name="user" />
  <Text>Text content</Text>
</FlexRow>
```

---

## Best Practices Summary

### ✅ Do's

1. **Use semantic typography components** (Paragraph, Label, etc.) instead of manual View wrappers
2. **Leverage built-in spacing props** (marginTop, marginBottom) for Text components
3. **Use Flex primitives for layout** (FlexRow, FlexColumn) - they handle gaps, alignment, and spacing
4. **Use View for styling containers** - backgroundColor, borders, shadows, platform-specific props
5. **Prefer variant props** over custom styling
6. **Use testId props** for testing accessibility

### ❌ Don'ts

1. **Don't apply style props to Text components** - use container Views instead
2. **Don't use raw HTML elements** in native components
3. **Don't hardcode colors** - use theme variants
4. **Don't use View with manual flexbox** - use FlexRow/FlexColumn for layout instead
5. **Don't ignore accessibility props**

### 🏗️ **Architecture Pattern: Container + Layout**

**Best Practice**: Use View for styling containers, Flex primitives for content layout

```tsx
// ✅ RECOMMENDED: Separation of styling vs layout concerns
<View style={[styles.card, { backgroundColor: theme.colors.bg.card }]}>
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

// ❌ AVOID: Manual flexbox in View
<View style={{ flexDirection: 'column', gap: 16 }}>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Icon name="user" />
    <Text>User Profile</Text>
  </View>
</View>
```

**Why this pattern:**
- **View**: Handles visual styling (colors, borders, shadows)  
- **Flex primitives**: Handle layout, spacing, and alignment consistently
- **Better maintainability**: Consistent gap system vs manual margins
- **Cross-platform**: Flex primitives abstract platform differences

### Migration Strategy

1. **Identify web-specific patterns** (CSS classes, HTML elements)
2. **Map to primitive equivalents** (Button, Input, FlexRow, etc.)
3. **Use semantic components** where available
4. **Test on mobile simulator** to ensure proper behavior
5. **Validate accessibility** with screen readers

---

*Last updated: 2025-08-05*

---

[← Back to Primitives INDEX](./INDEX.md)