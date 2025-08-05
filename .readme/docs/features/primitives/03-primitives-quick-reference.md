# Primitives Quick Reference

**[← Back to Primitives INDEX](./INDEX.md)**

[← Back to Docs INDEX](/.readme/INDEX.md)

Fast lookup guide for all primitive components with essential props and examples.

## 📝 Text & Typography

### Text
```tsx
<Text 
  variant="default|strong|subtle|muted|error|success|warning|link"
  size="xs|sm|base|lg|xl|2xl|3xl"
  weight="normal|medium|semibold|bold"
  align="left|center|right"
  marginTop={number}
  marginBottom={number}
  lineHeight={number}
>
  Content
</Text>
```

### Semantic Typography
```tsx
<Title>Page Title</Title>                    // size="2xl", weight="bold", marginBottom={8}
<SectionHeading>Section</SectionHeading>     // size="lg", weight="semibold", marginBottom={12}
<Paragraph>Content paragraph</Paragraph>     // marginBottom={16}, lineHeight="1.4x"
<Label>Form label</Label>                    // size="sm", weight="strong", marginBottom={8}
<Caption>Helper text</Caption>               // size="sm", variant="subtle", marginTop={8}
<InlineText>No spacing</InlineText>          // No automatic margins
```

---

## 🎨 Buttons

### Button
```tsx
<Button 
  type="primary|secondary|light|light-outline|subtle|subtle-outline|danger|unstyled"
  size="small|normal|large"
  onClick={() => {}}
  disabled={boolean}
  iconName="icon-name"
  iconOnly={boolean}
  hapticFeedback={boolean}
  accessibilityLabel="description"
  tooltip="tooltip text"
>
  Button Text
</Button>
```

**Quick Examples:**
```tsx
<Button type="primary" onClick={save}>Save</Button>
<Button type="secondary" iconName="plus" onClick={add}>Add</Button>
<Button type="light" iconName="settings" iconOnly onClick={settings} />
```

---

## 📝 Form Elements

### Input
```tsx
<Input 
  value={string}
  onChange={(value) => {}}
  placeholder="placeholder text"
  type="text|email|password|number|tel|url|search"
  variant="filled|bordered|onboarding"
  error={boolean}
  errorMessage="error text"
  disabled={boolean}
  keyboardType="default|email-address|numeric|phone-pad|number-pad"
  returnKeyType="done|go|next|search|send"
  autoComplete="off|email|name|tel|username|password"
  secureTextEntry={boolean}
/>
```

### TextArea
```tsx
<TextArea 
  value={string}
  onChange={(value) => {}}
  placeholder="placeholder text"
  numberOfLines={4}
  variant="filled|bordered"
  error={boolean}
  errorMessage="error text"
/>
```

### Select
```tsx
<Select 
  value={string}
  onChange={(value) => {}}
  placeholder="Select option"
  options={[
    { label: 'Display Text', value: 'value' },
    { label: 'Another Option', value: 'other' }
  ]}
  error={boolean}
  errorMessage="error text"
/>
```

---

## 🔄 Layout Components

### FlexRow
```tsx
<FlexRow 
  gap="none|xs|sm|md|lg|xl"
  justify="start|end|center|between|around|evenly"
  align="start|end|center|stretch|baseline"
  wrap={boolean}
>
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</FlexRow>
```

### FlexColumn
```tsx
<FlexColumn 
  gap="none|xs|sm|md|lg|xl"
  justify="start|end|center|between|around|evenly"
  align="start|end|center|stretch"
>
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</FlexColumn>
```

### FlexCenter & FlexBetween
```tsx
<FlexCenter>                    // justify="center", align="center"
  <Text>Centered content</Text>
</FlexCenter>

<FlexBetween>                   // justify="between", align="center"
  <Text>Left</Text>
  <Text>Right</Text>
</FlexBetween>
```

---

## 🎛️ Interactive Components

### Switch
```tsx
<Switch 
  value={boolean}
  onChange={(value) => {}}
  disabled={boolean}
  size="small|normal|large"
  label="Switch label"
/>
```

### RadioGroup
```tsx
<RadioGroup 
  value={string}
  onChange={(value) => {}}
  options={[
    { label: 'Option 1', value: 'option1' },
    { label: 'Option 2', value: 'option2' }
  ]}
  direction="vertical|horizontal"
  disabled={boolean}
/>
```

### Modal
```tsx
<Modal 
  isOpen={boolean}
  onClose={() => {}}
  size="small|medium|large|fullscreen"
  closeOnBackdrop={boolean}
  showCloseButton={boolean}
>
  <Text>Modal content</Text>
</Modal>
```

### Tooltip
```tsx
<Tooltip 
  content="Tooltip text"
  position="top|bottom|left|right"
  trigger="hover|click|focus"
>
  <Button>Hover me</Button>
</Tooltip>
```

---

## 🎨 Visual Components

### Icon
```tsx
<Icon 
  name="icon-name"
  size="xs|sm|md|lg|xl|2xl"
  color="hex-color"
  style={StyleObject}
/>
```

### ColorSwatch
```tsx
<ColorSwatch 
  color="hex-color"
  size="small|medium|large"
  shape="circle|square"
  showBorder={boolean}
  onClick={() => {}}
/>
```

---

## 📱 Native-Specific Props

### Common React Native Props
```tsx
// Accessibility
accessibilityLabel="Screen reader description"
testID="automation-test-id"

// Touch & Haptics
hapticFeedback={true}               // Button vibration on press

// Keyboard
keyboardType="email-address"        // Input keyboard type
returnKeyType="done"                // Return key label
autoComplete="email"                // Autofill suggestion

// Text
numberOfLines={2}                   // Text truncation
selectable={true}                   // Text selection
secureTextEntry={true}              // Password masking
```

---

## 🎨 Theme Integration

### Using Theme Colors
```tsx
import { useTheme } from '../components/primitives/theme';

const theme = useTheme();

// Available theme colors
theme.colors.bg.app              // Main app background
theme.colors.bg.card             // Card/panel background
theme.colors.text.strong         // Primary text
theme.colors.text.main           // Default text
theme.colors.text.subtle         // Secondary text
theme.colors.text.muted          // Disabled text
theme.colors.accent[500]         // Accent color variations
theme.colors.surface[1-10]       // Surface color levels
theme.colors.border.default      // Border color
theme.colors.utilities.danger    // Error/danger
theme.colors.utilities.success   // Success
theme.colors.utilities.warning   // Warning
theme.colors.utilities.info      // Info
```

### Applying Theme Colors
```tsx
// In component styles
<View style={{ backgroundColor: theme.colors.bg.card }}>
  <Text color={theme.colors.text.strong}>Themed text</Text>
</View>

// Using variants (preferred)
<Text variant="strong">Uses theme.colors.text.strong automatically</Text>
<Text variant="error">Uses theme.colors.utilities.danger automatically</Text>
```

---

## ⚡ Common Patterns

### Form Field Group
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

### Header with Icon and Action
```tsx
<FlexRow justify="between" align="center">
  <FlexRow gap="sm" align="center">
    <Icon name="settings" />
    <Text weight="semibold">Settings</Text>
  </FlexRow>
  <Button type="subtle" iconName="close" iconOnly onClick={onClose} />
</FlexRow>
```

### Card Layout
```tsx
<FlexColumn 
  gap="md" 
  style={{ 
    backgroundColor: theme.colors.bg.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16
  }}
>
  <SectionHeading>Card Title</SectionHeading>
  <Paragraph>Card content goes here</Paragraph>
  <Button type="primary">Action</Button>
</FlexColumn>
```

### Loading State
```tsx
{loading ? (
  <FlexCenter style={{ padding: 20 }}>
    <Text variant="subtle">Loading...</Text>
  </FlexCenter>
) : (
  <FlexColumn gap="md">
    {data.map(item => <ItemComponent key={item.id} item={item} />)}
  </FlexColumn>
)}
```

---

## 🚫 Common Mistakes

| ❌ Don't Do | ✅ Do Instead |
|-------------|---------------|
| `<div className="flex">` | `<FlexRow>` or `<FlexColumn>` |
| `<View style={{ flexDirection: 'row' }}>` | `<FlexRow>` |
| `<p>Text content</p>` | `<Text>Text content</Text>` |
| `<button onClick={}>` | `<Button onClick={}>` |
| `style={{ color: '#000' }}` on Text | `variant="strong"` or `color={theme.colors.text.strong}` |
| Manual margin/padding for spacing | Use Flex gap props or semantic components |
| CSS classes in React Native | Use component props |
| Raw text outside Text components | Always wrap text in Text components |

## 🏗️ **View vs Flex Usage Pattern**

**Recommended Architecture**: Container + Layout separation

```tsx
// ✅ BEST PRACTICE: View for styling, Flex for layout
<View style={{ backgroundColor: theme.colors.bg.card, padding: 16, borderRadius: 8 }}>
  <FlexColumn gap="md">
    <FlexRow gap="sm" align="center">
      <Icon name="user" />
      <Text>Content</Text>
    </FlexRow>
  </FlexColumn>
</View>

// ❌ AVOID: Manual flexbox in View
<View style={{ flexDirection: 'column', gap: 16, backgroundColor: '...' }}>
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Icon name="user" />
    <Text>Content</Text>
  </View>
</View>
```

**When to use:**
- **View**: Styling containers (colors, borders, shadows, platform props)
- **FlexRow/FlexColumn**: Layout, spacing, alignment, content organization

---

## 📖 Related Documentation

- [Complete Primitives Guide](./04-complete-component-guide.md) - Detailed documentation with examples
- [Web-to-Native Migration Guide](./02-web-to-native-migration.md) - Step-by-step conversion patterns
- [Theme System](../theme/README.md) - Color system and theming
- [Component Architecture](../component-architecture-workflow-explained.md) - Overall architecture explanation

---

*Last updated: 2025-08-05*

---

[← Back to Primitives INDEX](./INDEX.md)