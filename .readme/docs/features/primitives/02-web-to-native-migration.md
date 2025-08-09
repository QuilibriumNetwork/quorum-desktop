# Web-to-Native Migration Guide

**[← Back to Primitives INDEX](./INDEX.md)**

[← Back to Docs INDEX](/.readme/INDEX.md)

Complete guide for converting web components to React Native using our cross-platform primitives.

## Table of Contents

1. [Migration Strategy Overview](#migration-strategy-overview)
   - [Component Logic Extraction](#️-important-component-logic-extraction)
   - [Step-by-Step Process](#step-by-step-process)
   - [Native Component Styling Guidelines](#-native-component-styling-guidelines)
2. [Common Patterns](#common-patterns)
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

📋 **Read**: [Cross-Platform Hooks Refactoring Plan](/.readme/tasks/todo/mobile-dev/cross-platform-hooks-refactoring-plan.md)

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
   <Button type="primary-white" size="large">
   
   // ❌ Bad - Hardcoded styles
   <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#ffffff' }}>
   <Text style={{ fontSize: 14, color: '#666666', textAlign: 'center' }}>
   ```
4. **Maintain Visual Consistency** - Colors, spacing, typography, and layout must match web version
5. **Use Semantic Components** - Choose components that reflect the content's meaning, not just appearance

### Quick Reference Table

| Web Element | Native Primitive | Key Differences |
|-------------|------------------|-----------------|
| `<div>` with flexbox | `<FlexRow>`, `<FlexColumn>` | Use gap prop instead of margin |
| `<p>`, `<span>` | `<Text>`, `<Paragraph>` | All text must be wrapped |
| `<button>` | `<Button>` | Use onClick instead of click events |
| `<input>` | `<Input>` | Different keyboard types available |
| `<textarea>` | `<TextArea>` | Multiline handled differently |
| `<select>` | `<Select>` | Custom dropdown implementation |

---

## Common Patterns

### Pattern 1: Card Component

#### ❌ Web Version
```tsx
const UserCard = ({ user }) => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-4">
    <div className="flex items-center mb-4">
      <img src={user.avatar} alt="Avatar" className="w-12 h-12 rounded-full mr-4" />
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
        <p className="text-sm text-gray-600">{user.email}</p>
      </div>
    </div>
    <p className="text-gray-700 leading-relaxed">{user.bio}</p>
    <button 
      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      onClick={() => handleContact(user.id)}
    >
      Contact
    </button>
  </div>
);
```

#### ✅ Native Version
```tsx
import { FlexRow, FlexColumn, Text, Paragraph, Button } from '../components/primitives';

const UserCard = ({ user }) => (
  <FlexColumn 
    gap="md" 
    style={{ 
      backgroundColor: theme.colors.bg.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3
    }}
  >
    <FlexRow gap="md" align="center">
      <Icon name="user" size="lg" />
      <FlexColumn gap="xs">
        <Text size="lg" weight="semibold" variant="strong">{user.name}</Text>
        <Text size="sm" variant="subtle">{user.email}</Text>
      </FlexColumn>
    </FlexRow>
    <Paragraph>{user.bio}</Paragraph>
    <Button 
      type="primary" 
      onClick={() => handleContact(user.id)}
    >
      Contact
    </Button>
  </FlexColumn>
);
```

### Pattern 2: Form Layout

#### ❌ Web Version
```tsx
const ContactForm = () => (
  <form className="space-y-6">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          First Name
        </label>
        <input 
          type="text" 
          className="w-full border border-gray-300 rounded-md px-3 py-2"
          placeholder="Enter first name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Last Name
        </label>
        <input 
          type="text" 
          className="w-full border border-gray-300 rounded-md px-3 py-2"
          placeholder="Enter last name"
        />
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Message
      </label>
      <textarea 
        rows="4" 
        className="w-full border border-gray-300 rounded-md px-3 py-2"
        placeholder="Your message..."
      />
    </div>
    <button 
      type="submit" 
      className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
    >
      Send Message
    </button>
  </form>
);
```

#### ✅ Native Version
```tsx
import { FlexColumn, FlexRow, Label, Input, TextArea, Button } from '../components/primitives';

const ContactForm = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [message, setMessage] = useState('');

  return (
    <FlexColumn gap="lg">
      <FlexRow gap="md">
        <FlexColumn gap="xs" style={{ flex: 1 }}>
          <Label>First Name</Label>
          <Input 
            value={firstName}
            onChange={setFirstName}
            placeholder="Enter first name"
          />
        </FlexColumn>
        <FlexColumn gap="xs" style={{ flex: 1 }}>
          <Label>Last Name</Label>
          <Input 
            value={lastName}
            onChange={setLastName}
            placeholder="Enter last name"
          />
        </FlexColumn>
      </FlexRow>
      
      <FlexColumn gap="xs">
        <Label>Message</Label>
        <TextArea 
          value={message}
          onChange={setMessage}
          placeholder="Your message..."
          numberOfLines={4}
        />
      </FlexColumn>
      
      <Button 
        type="primary" 
        onClick={handleSubmit}
      >
        Send Message
      </Button>
    </FlexColumn>
  );
};
```

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
  <Title size="lg" weight="bold">Section Title</Title>
  <Paragraph color="default">
    This is a paragraph with some content that needs proper spacing.
  </Paragraph>
  <Text size="sm" color="subtle">Helper text</Text>
</>
```

### Typography Hierarchy

| Web CSS Class | Native Component | Props |
|---------------|------------------|-------|
| `.text-3xl.font-bold` | `<Title>` | `size="xl" weight="bold"` |
| `.text-xl.font-semibold` | `<Title>` | `size="lg" weight="semibold"` |
| `.text-base` | `<Paragraph>` | Default paragraph styling |
| `.text-sm.font-medium` | `<Text>` | `size="sm" weight="medium"` |
| `.text-sm.text-gray-500` | `<Text>` | `size="sm" color="subtle"` |

### Real-World Example: Onboarding Step

Based on actual mobile onboarding implementation:

#### ❌ Web Version
```tsx
<div className="w-full max-w-[460px] px-4 py-4 text-center text-white">
  <h2 className="text-2xl font-semibold mb-4">Welcome to Quorum!</h2>
  <p className="font-semibold mb-4">Important first-time user information:</p>
  <p className="mb-4">Quorum is peer-to-peer and end-to-end encrypted...</p>
  <button className="bg-white text-blue-600 py-2 px-4 rounded-full w-full">
    Save User Key
  </button>
</div>
```

#### ✅ Native Version
```tsx
<AuthContent>
  <Title size="xl" align="center" color="white">
    {t`Welcome to Quorum!`}
  </Title>
  
  <Paragraph weight="semibold" color="white" align="center">
    {t`Important first-time user information:`}
  </Paragraph>
  
  <Paragraph color="white" align="center">
    {t`Quorum is peer-to-peer and end-to-end encrypted...`}
  </Paragraph>
  
  <Button
    type="primary-white"
    style={{ width: '100%', marginBottom: 16 }}
    onClick={handleDownloadKey}
  >
    {t`Save User Key`}
  </Button>
</AuthContent>
```

---

## Layout Conversion

### Flexbox Layouts

#### ❌ Web CSS
```tsx
<div className="flex items-center justify-between p-4 bg-gray-100">
  <div className="flex items-center space-x-3">
    <img src="icon.png" className="w-6 h-6" />
    <span className="font-medium">Title</span>
  </div>
  <button className="text-blue-600 hover:text-blue-700">
    Action
  </button>
</div>
```

#### ✅ Native Primitive
```tsx
<FlexRow 
  justify="between" 
  align="center" 
  style={{ 
    padding: 16, 
    backgroundColor: theme.colors.surface[1] 
  }}
>
  <FlexRow gap="sm" align="center">
    <Icon name="settings" size="md" />
    <Text weight="medium">Title</Text>
  </FlexRow>
  <Button type="subtle" onClick={handleAction}>
    Action
  </Button>
</FlexRow>
```

### Grid to Flex Conversion

#### ❌ Web Grid
```tsx
<div className="grid grid-cols-3 gap-4">
  <div className="bg-white p-4 rounded">Item 1</div>
  <div className="bg-white p-4 rounded">Item 2</div>
  <div className="bg-white p-4 rounded">Item 3</div>
</div>
```

#### ✅ Native Flex
```tsx
<FlexRow gap="md" wrap>
  {items.map(item => (
    <FlexColumn 
      key={item.id}
      style={{ 
        flex: 1, 
        minWidth: 120,
        backgroundColor: theme.colors.bg.card,
        padding: 16,
        borderRadius: 8 
      }}
    >
      <Text>{item.title}</Text>
    </FlexColumn>
  ))}
</FlexRow>
```

---

## Form Elements

### Input Field Conversion

#### ❌ Web Input
```tsx
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Email Address
  </label>
  <input 
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
    placeholder="Enter your email"
  />
  {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
</div>
```

#### ✅ Native Input
```tsx
import { Label, Input } from '../components/primitives';

<>
  <Label>Email Address</Label>
  <Input 
    type="email"
    value={email}
    onChange={setEmail}
    placeholder="Enter your email"
    error={!!error}
    errorMessage={error}
    keyboardType="email-address"
    autoComplete="email"
  />
</>
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
    { label: 'Canada', value: 'ca' }
  ]}
/>
```

---

## Interactive Elements

### Button Conversion

#### ❌ Web Buttons
```tsx
// Primary button
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
  Primary Action
</button>

// Secondary button
<button className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50">
  Secondary Action
</button>

// Icon button
<button className="p-2 text-gray-400 hover:text-gray-600">
  <svg>...</svg>
</button>
```

#### ✅ Native Buttons
```tsx
import { Button } from '../components/primitives';

// Primary button
<Button type="primary" onClick={handlePrimary}>
  Primary Action
</Button>

// Secondary button
<Button type="secondary" onClick={handleSecondary}>
  Secondary Action
</Button>

// Icon button
<Button 
  type="light"
  iconName="settings"
  iconOnly
  onClick={handleSettings}
  accessibilityLabel="Settings"
/>
```

---

## Styling Differences

### Color System Migration

#### ❌ Web Tailwind Classes
```tsx
<div className="bg-gray-100 text-gray-900 border-gray-300">
  <p className="text-blue-600">Link text</p>
  <p className="text-red-500">Error text</p>
</div>
```

#### ✅ Native Theme Colors
```tsx
import { useTheme } from '../components/primitives/theme';

const theme = useTheme();

<View style={{ 
  backgroundColor: theme.colors.surface[1], 
  borderColor: theme.colors.border.default 
}}>
  <Text variant="link">Link text</Text>
  <Text variant="error">Error text</Text>
</View>
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
// Using FlexColumn gap
<FlexColumn gap="sm" style={{ padding: 16, margin: 8 }}>
  <Paragraph>Content</Paragraph>
</FlexColumn>

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
<FlexColumn>
  <Text>This works on mobile</Text>
  <Button onClick={handleClick}>Works everywhere</Button>
</FlexColumn>
```

### ❌ Pitfall 2: CSS Classes on Native
```tsx
// DON'T: CSS classes don't work in React Native
<Text className="text-blue-600 font-bold">Styled text</Text>
```

### ✅ Solution: Use Props
```tsx
// DO: Use component props (learned from mobile onboarding)
<Text color="accent" weight="bold">Styled text</Text>
```

### ❌ Pitfall 3: Missing Text Wrappers
```tsx
// DON'T: Naked text will crash React Native
<View>
  Raw text content
</View>
```

### ✅ Solution: Wrap All Text
```tsx
// DO: All text must be in Text components
<View>
  <Text>Raw text content</Text>
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

## Quick Migration Commands

### Search and Replace Patterns

Common find/replace patterns for VS Code:

```regex
// Replace div with flexbox classes
Find: <div className="flex ([^"]*)"[^>]*>
Replace: <FlexRow $1>

// Replace paragraph tags
Find: <p className="([^"]*)"[^>]*>([^<]*)</p>
Replace: <Paragraph>$2</Paragraph>

// Replace button elements
Find: <button ([^>]*) onClick=\{([^}]*)\}[^>]*>([^<]*)</button>
Replace: <Button onClick={$2}>$3</Button>
```

---

## Summary

Key principles for successful web-to-native migration:

1. **Replace HTML with Primitives** - Every HTML element has a primitive equivalent
2. **Use Props Over Classes** - Component props replace CSS classes
3. **Wrap All Text** - React Native requires all text in Text components
4. **Layout with Flex** - Use FlexRow/FlexColumn instead of CSS Grid
5. **Theme Colors** - Use theme system instead of hardcoded colors
6. **Test Early** - Run mobile simulator frequently during migration
7. **Accessibility First** - Include proper labels and keyboard navigation

Following these patterns will ensure your components work seamlessly across web and mobile platforms.

---

*Last updated: December 9, 2024 at 11:45 AM*

---

[← Back to Primitives INDEX](./INDEX.md)