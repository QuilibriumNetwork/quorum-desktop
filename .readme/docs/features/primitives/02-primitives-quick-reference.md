# Primitives Quick Reference

**[← Back to Primitives INDEX](./INDEX.md)**

[← Back to Docs INDEX](/.readme/INDEX.md)

**READY FOR OFFICIAL DOCS: _Last review: 2025-08-14 10:45 UTC_**

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
<Title>Page Title</Title>                    // size="lg" (24px), weight="bold" (default)
<Title size="sm">Section Title</Title>       // size="sm" (18px), weight="bold"
<Title size="xl" weight="normal">Hero</Title> // size="xl" (30px), normal weight
<Paragraph>Content paragraph</Paragraph>     // marginBottom={16}, lineHeight="1.4x"
<Label>Form label</Label>                    // size="sm", weight="strong", marginBottom={8}
<Caption>Helper text</Caption>               // size="sm", variant="subtle", marginTop={8}
<InlineText>No spacing</InlineText>          // No automatic margins
```

### Title Props

```tsx
<Title
  size="sm|md|lg|xl" // sm=18px, md=20px, lg=24px, xl=30px
  weight="normal|medium|semibold|bold" // Default: bold
>
  Title Text
</Title>
```

---

## 🎨 Buttons

### Button

```tsx
<Button
  type="primary|secondary|light|light-outline|subtle|subtle-outline|danger|primary-white|secondary-white|light-white|light-outline-white|disabled-onboarding|unstyled"
  size="small|normal|large"
  onClick={() => {}}
  disabled={boolean}
  fullWidth={boolean}
  fullWidthWithMargin={boolean} // Native only
  iconName="icon-name"
  iconOnly={boolean}
  hapticFeedback={boolean} // Native only
  accessibilityLabel="description" // Native only
  tooltip="tooltip text"
  highlightedTooltip={boolean}
  className="css-classes" // Web only
>
  Button Text
</Button>
```

**Quick Examples:**

```tsx
<Button type="primary" onClick={save}>Save</Button>
<Button type="secondary" iconName="plus" onClick={add}>Add</Button>
<Button type="light" iconName="settings" iconOnly onClick={settings} />
<Button type="primary" fullWidth onClick={submit}>Full Width Button</Button>
<Button type="light-white" onClick={onWhiteBackground}>White Variant</Button>
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
  noFocusStyle={boolean}
  autoFocus={boolean}
  className="css-classes" // Web only
  style={CSSProperties}
  testID="test-id"
  accessibilityLabel="description"
  // Native-specific props:
  keyboardType="default|email-address|numeric|phone-pad|number-pad|decimal-pad|url" // Native only
  returnKeyType="done|go|next|search|send" // Native only
  autoComplete="off|email|name|tel|username|password" // Native only
  secureTextEntry={boolean} // Native only
  onSubmitEditing={() => {}} // Native only
  onBlur={() => {}}
  onFocus={() => {}}
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
    { label: 'Another Option', value: 'other' },
  ]}
  error={boolean}
  errorMessage="error text"
/>
```

### FileUpload

```tsx
<FileUpload
  onFilesSelected={(files) => {}}
  accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
  multiple={boolean}
  maxSize={number} // bytes
  minSize={number} // bytes
  disabled={boolean}
  onError={(error) => {}}
  testId="file-upload"
  // Web-specific props:
  onDragActiveChange={(active) => {}} // Web only
  validator={(file) => string | null} // Web only
  // Native-specific props:
  showCameraOption={boolean} // Native only
  imageQuality={number} // Native only (0-1)
  allowsEditing={boolean} // Native only
>
  <Text>Drop files here or click to upload</Text>
</FileUpload>
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

### Container

```tsx
<Container
  width="auto|full|fit|custom-value"
  maxWidth="xs|sm|md|lg|xl|2xl|full|custom-value"
  padding="none|xs|sm|md|lg|xl|custom-value"
  margin="none|xs|sm|md|lg|xl|auto|custom-value"
  backgroundColor="hex-color"
  className="css-classes" // Web only
  style={CSSProperties}
  testId="container"
  // Web-specific props:
  onClick={(event) => {}} // Web only
  onMouseEnter={(event) => {}} // Web only
  onMouseLeave={(event) => {}} // Web only
  role="button" // Web only
  aria-label="description" // Web only
  // Native-specific props:
  onPress={() => {}} // Native only
  accessible={boolean} // Native only
  accessibilityLabel="description" // Native only
  accessibilityRole="button" // Native only
  accessibilityHint="hint" // Native only
>
  <Text>Container content</Text>
</Container>
```

### Spacer

```tsx
<Spacer
  size="xs|sm|md|lg|xl|number"
  direction="vertical|horizontal" // Default: vertical
  testId="spacer"
  className="css-classes" // Web only
/>
```

### ResponsiveContainer

```tsx
<ResponsiveContainer className="css-classes">
  <Text>Responsive content that adapts to screen size</Text>
</ResponsiveContainer>
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
    { label: 'Option 2', value: 'option2' },
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

### ModalContainer

```tsx
<ModalContainer
  visible={boolean}
  onClose={() => {}}
  closeOnBackdropClick={boolean}
  showBackdrop={boolean}
  backdropBlur={boolean}
  zIndex="9999"
  className="css-classes"
  animationDuration={300} // ms
  closeOnEscape={boolean}
>
  <Text>Modal content</Text>
</ModalContainer>
```

### OverlayBackdrop

```tsx
<OverlayBackdrop
  visible={boolean}
  onBackdropClick={() => {}}
  zIndex="9999"
  blur={boolean}
  opacity={0.5}
  className="css-classes"
  closeOnBackdropClick={boolean} // Default: true
>
  <Text>Content rendered on top of backdrop</Text>
</OverlayBackdrop>
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
theme.colors.bg.app; // Main app background
theme.colors.bg.card; // Card/panel background
theme.colors.text.strong; // Primary text
theme.colors.text.main; // Default text
theme.colors.text.subtle; // Secondary text
theme.colors.text.muted; // Disabled text
theme.colors.accent[500]; // Accent color variations
theme.colors.surface[1 - 10]; // Surface color levels
theme.colors.border.default; // Border color
theme.colors.utilities.danger; // Error/danger
theme.colors.utilities.success; // Success
theme.colors.utilities.warning; // Warning
theme.colors.utilities.info; // Info
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
<Container
  padding="md"
  backgroundColor={theme.colors.bg.card}
  style={{ borderRadius: 12, marginBottom: 16 }}
>
  <FlexColumn gap="md">
    <Title size="sm">Card Title</Title>
    <Paragraph>Card content goes here</Paragraph>
    <Button type="primary">Action</Button>
  </FlexColumn>
</Container>
```

### Loading State

```tsx
{
  loading ? (
    <FlexCenter style={{ padding: 20 }}>
      <Text variant="subtle">Loading...</Text>
    </FlexCenter>
  ) : (
    <FlexColumn gap="md">
      {data.map((item) => (
        <ItemComponent key={item.id} item={item} />
      ))}
    </FlexColumn>
  );
}
```

### File Upload Area

```tsx
<FileUpload
  onFilesSelected={handleFiles}
  accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.gif'] }}
  multiple
  maxSize={5 * 1024 * 1024} // 5MB
>
  <Container
    padding="xl"
    style={{
      border: '2px dashed #ccc',
      borderRadius: 8,
      textAlign: 'center',
    }}
  >
    <FlexColumn gap="sm" align="center">
      <Icon name="upload" size="lg" />
      <Text>Drop files here or click to upload</Text>
      <Text variant="subtle" size="sm">
        Max 5MB per file
      </Text>
    </FlexColumn>
  </Container>
</FileUpload>
```

### Modal with Backdrop

```tsx
<ModalContainer
  visible={showModal}
  onClose={closeModal}
  closeOnBackdropClick
  backdropBlur
>
  <Container
    backgroundColor={theme.colors.bg.card}
    padding="lg"
    style={{ borderRadius: 12, maxWidth: 400, width: '90vw' }}
  >
    <FlexColumn gap="md">
      <FlexBetween>
        <Title size="sm">Confirmation</Title>
        <Button type="subtle" iconName="close" iconOnly onClick={closeModal} />
      </FlexBetween>
      <Spacer size="sm" />
      <Text>Are you sure you want to continue?</Text>
      <FlexRow gap="sm" justify="end">
        <Button type="secondary" onClick={closeModal}>
          Cancel
        </Button>
        <Button type="danger" onClick={confirmAction}>
          Confirm
        </Button>
      </FlexRow>
    </FlexColumn>
  </Container>
</ModalContainer>
```

---

## 🚫 Common Mistakes

| ❌ Don't Do                               | ✅ Do Instead                                            |
| ----------------------------------------- | -------------------------------------------------------- |
| `<div className="flex">`                  | `<FlexRow>` or `<FlexColumn>`                            |
| `<View style={{ flexDirection: 'row' }}>` | `<FlexRow>`                                              |
| `<p>Text content</p>`                     | `<Text>Text content</Text>`                              |
| `<button onClick={}>`                     | `<Button onClick={}>`                                    |
| `<input type="file" />`                   | `<FileUpload onFilesSelected={}>`                        |
| `<div style={{ padding: 16 }}>`           | `<Container padding="md">`                               |
| Manual margin spacing between elements    | `<Spacer size="md" />`                                   |
| Custom modal backdrop implementation      | `<ModalContainer>` or `<OverlayBackdrop>`                |
| `style={{ color: '#000' }}` on Text       | `variant="strong"` or `color={theme.colors.text.strong}` |
| Manual margin/padding for spacing         | Use Flex gap props or semantic components                |
| CSS classes in React Native               | Use component props                                      |
| Raw text outside Text components          | Always wrap text in Text components                      |

## 🏗️ **View vs Flex Usage Pattern**

**Recommended Architecture**: Container + Layout separation

```tsx
// ✅ BEST PRACTICE: Container for styling, Flex for layout
<Container
  backgroundColor={theme.colors.bg.card}
  padding="md"
  style={{ borderRadius: 8 }}
>
  <FlexColumn gap="md">
    <FlexRow gap="sm" align="center">
      <Icon name="user" />
      <Text>Content</Text>
    </FlexRow>
  </FlexColumn>
</Container>

// ❌ AVOID: Manual flexbox in View/Container
<View style={{ flexDirection: 'column', gap: 16, backgroundColor: '...' }}>
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Icon name="user" />
    <Text>Content</Text>
  </View>
</View>
```

**When to use:**

- **Container**: Styling containers (colors, borders, shadows, padding, accessibility)
- **FlexRow/FlexColumn**: Layout, spacing, alignment, content organization
- **Spacer**: Fixed spacing between non-flex elements

---

## 📖 Related Documentation

- [When to Use Primitives](./03-when-to-use-primitives.md) - Decision framework
- [Web-to-Native Migration Guide](./04-web-to-native-migration.md) - Step-by-step conversion patterns
- [Primitive Styling Guide](./05-primitive-styling-guide.md) - Color system and consistency rules
- [Theme System](../theme/README.md) - Color system and theming
- [Component Architecture](../component-architecture-workflow-explained.md) - Overall architecture explanation

---

_Last updated: 2025-08-14_

---

[← Back to Primitives INDEX](./INDEX.md)
