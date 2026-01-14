---
type: doc
title: Primitives Quick Reference
status: done
created: 2026-01-09T00:00:00.000Z
updated: 2025-10-14T00:00:00.000Z
---

# Primitives Quick Reference

**[← Back to Primitives INDEX](./INDEX.md)**


Fast lookup guide for all primitive components with essential props and examples.

## 📝 Text & Typography

### Text (Cross-Platform)

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

**Examples:**
```tsx
<Text variant="strong" size="lg">Page Title</Text>
<Text>Default body text</Text>
<Text variant="subtle" size="sm">Helper text</Text>
<Text variant="error">Error message</Text>
```

### Web Alternative: CSS Typography Classes

For web-only code, prefer plain HTML with CSS classes:

```tsx
// Instead of Text primitive (simpler, no abstraction)
<p className="text-body">Main content text</p>
<span className="text-small text-subtle">Helper text</span>
<h1 className="text-title">Page title</h1>

// Available typography classes:
// text-title-large, text-title, text-subtitle, text-subtitle-2
// text-body, text-label, text-label-strong
// text-small, text-small-desktop

// Color classes: text-strong, text-subtle, text-muted, etc.
```

### Semantic Typography Helpers (Native Only)

```tsx
<Title>Page Title</Title>                    // size="lg" (24px), weight="bold" (default)
<Title size="sm">Section Title</Title>       // size="sm" (18px), weight="bold"
<Paragraph>Content paragraph</Paragraph>     // marginBottom={16}, lineHeight="1.4x"
<Label>Form label</Label>                    // size="sm", weight="strong", marginBottom={8}
<Caption>Helper text</Caption>               // size="sm", variant="subtle", marginTop={8}
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

### Flex

Unified flex layout container (replaces FlexRow, FlexColumn, FlexCenter, FlexBetween).

```tsx
<Flex
  direction="row|column"        // Default: "row"
  gap="none|xs|sm|md|lg|xl"
  justify="start|end|center|between|around|evenly"
  align="start|end|center|stretch|baseline"
  wrap={boolean}
>
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</Flex>
```

**Common Patterns:**
```tsx
// Horizontal row (default)
<Flex gap="md">
  <Text>Left</Text>
  <Text>Right</Text>
</Flex>

// Vertical column
<Flex direction="column" gap="md">
  <Text>Top</Text>
  <Text>Bottom</Text>
</Flex>

// Space between (like FlexBetween)
<Flex justify="between">
  <Text>Left</Text>
  <Text>Right</Text>
</Flex>

// Centered (like FlexCenter)
<Flex justify="center" align="center">
  <Text>Centered</Text>
</Flex>
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

### ScrollContainer

```tsx
<ScrollContainer
  height="auto|fit|full|custom-value"
  borderRadius="none|sm|md|lg|xl|custom-value"
  className="css-classes" // Web only
  style={CSSProperties}
  // Web-specific props:
  onScroll={(event) => {}} // Web only
  // Native-specific props:
  horizontal={boolean} // Native only
  showsVerticalScrollIndicator={boolean} // Native only
  showsHorizontalScrollIndicator={boolean} // Native only
  bounces={boolean} // Native only (iOS)
  overScrollMode="auto|always|never" // Native only (Android)
  scrollEventThrottle={16} // Native only
  onScrollEndDrag={() => {}} // Native only
  onMomentumScrollEnd={() => {}} // Native only
  refreshControl={RefreshControl} // Native only
>
  <Text>Scrollable content</Text>
</ScrollContainer>
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

### Portal

```tsx
<Portal>
  {/* Content rendered to document.body, escaping parent constraints */}
  <div className="fixed bottom-4 right-4">
    <Callout variant="success">Toast notification</Callout>
  </div>
</Portal>
```

**When to Use:**
- Toast notifications
- Right-aligned dropdowns that might be clipped
- Overlays escaping stacking contexts
- **NOT for modals** (use ModalProvider/Layout-Level instead)

**Quick Examples:**

```tsx
// Toast notification
<Portal>
  <div className="fixed bottom-4 right-4">
    <Callout variant="info" autoClose={5}>
      Changes saved!
    </Callout>
  </div>
</Portal>

// Right-aligned dropdown (escaping overflow: hidden)
{isOpen && (
  <Portal>
    <div style={{ position: 'fixed', top: buttonRect.bottom, right: buttonRect.right }}>
      <DropdownContent />
    </div>
  </Portal>
)}
```

### Tooltip

```tsx
<Tooltip
  id="unique-id"
  content="Tooltip text"
  place="top|top-start|top-end|right|bottom|left" // Default: 'top'
  noBorder={boolean} // Border is shown by default
  noArrow={boolean}
  maxWidth={400}
  disabled={boolean}
  showOnTouch={boolean} // Default: true
  clickable={boolean} // Allow hovering/clicking inside tooltip
  variant="simple|rich" // 'simple' for text, 'rich' for custom content
>
  <Button>Hover me</Button>
</Tooltip>
```

---

## 💬 Messaging Components

### Callout

```tsx
<Callout
  variant="info|success|warning|error"
  size="xs|sm|md" // Default: sm
  layout="base|minimal" // Default: base
  dismissible={boolean}
  autoClose={number} // seconds, web only
  onClose={() => {}}
  className="css-classes" // Web only
  testID="test-id"
>
  <Text>Callout message content</Text>
</Callout>
```

**Quick Examples:**

```tsx
<Callout variant="info">Information message</Callout>
<Callout variant="success">Operation completed!</Callout>
<Callout variant="warning" dismissible>Warning message</Callout>
<Callout variant="error" size="md">Critical error message</Callout>
<Callout variant="info" layout="minimal">Minimal info message</Callout>
<Callout variant="warning" autoClose={5}>Auto-dismiss in 5 seconds</Callout>
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
<Flex direction="column" gap="xs">
  <Label>Email Address</Label>
  <Input
    type="email"
    value={email}
    onChange={setEmail}
    error={!!emailError}
    errorMessage={emailError}
  />
</Flex>
```

### Header with Icon and Action

```tsx
<Flex justify="between" align="center">
  <Flex gap="sm" align="center">
    <Icon name="settings" />
    <Text weight="semibold">Settings</Text>
  </Flex>
  <Button type="subtle" iconName="close" iconOnly onClick={onClose} />
</Flex>
```

### Card Layout

```tsx
<Container
  padding="md"
  backgroundColor={theme.colors.bg.card}
  style={{ borderRadius: 12, marginBottom: 16 }}
>
  <Flex direction="column" gap="md">
    <Text variant="strong" size="lg">Card Title</Text>
    <Text>Card content goes here</Text>
    <Button type="primary">Action</Button>
  </Flex>
</Container>
```

### Loading State

```tsx
{
  loading ? (
    <Flex justify="center" align="center" style={{ padding: 20 }}>
      <Text variant="subtle">Loading...</Text>
    </Flex>
  ) : (
    <Flex direction="column" gap="md">
      {data.map((item) => (
        <ItemComponent key={item.id} item={item} />
      ))}
    </Flex>
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
    <Flex direction="column" gap="sm" align="center">
      <Icon name="upload" size="lg" />
      <Text>Drop files here or click to upload</Text>
      <Text variant="subtle" size="sm">
        Max 5MB per file
      </Text>
    </Flex>
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
    <Flex direction="column" gap="md">
      <Flex justify="between">
        <Text variant="strong" size="lg">Confirmation</Text>
        <Button type="subtle" iconName="close" iconOnly onClick={closeModal} />
      </Flex>
      <Spacer size="sm" />
      <Text>Are you sure you want to continue?</Text>
      <Flex gap="sm" justify="end">
        <Button type="secondary" onClick={closeModal}>
          Cancel
        </Button>
        <Button type="danger" onClick={confirmAction}>
          Confirm
        </Button>
      </Flex>
    </Flex>
  </Container>
</ModalContainer>
```

### Status Message with Callout

```tsx
<Flex direction="column" gap="md">
  <Callout variant="success" dismissible onClose={clearSuccessMessage}>
    Settings have been saved successfully!
  </Callout>

  <Callout variant="warning" layout="minimal">
    <Flex direction="column" gap="xs">
      <Text weight="semibold">Connection Issues Detected</Text>
      <Text size="sm">Some features may not work properly until connection is restored.</Text>
    </Flex>
  </Callout>

  <Callout variant="info" size="xs">
    <Flex gap="sm" align="center">
      <Text>New version available</Text>
      <Button type="light" size="small" onClick={updateApp}>Update</Button>
    </Flex>
  </Callout>
</Flex>
```

---

## 🚫 Common Mistakes

| ❌ Don't Do                               | ✅ Do Instead                                            |
| ----------------------------------------- | -------------------------------------------------------- |
| `<div className="flex">`                  | `<Flex>` or `<Flex direction="column">`                  |
| `<View style={{ flexDirection: 'row' }}>` | `<Flex>`                                                 |
| `<p>Text content</p>` (mobile)            | `<Text>Text content</Text>`                              |
| `<button onClick={}>`                     | `<Button onClick={}>`                                    |
| `<input type="file" />`                   | `<FileUpload onFilesSelected={}>`                        |
| `<div style={{ padding: 16 }}>`           | `<Container padding="md">`                               |
| Manual margin spacing between elements    | `<Spacer size="md" />`                                   |
| Custom modal backdrop implementation      | `<ModalContainer>` or `<OverlayBackdrop>`                |
| Using Portal for modals                   | Use ModalProvider or Layout-Level rendering instead      |
| `style={{ color: '#000' }}` on Text       | `variant="strong"` or `color={theme.colors.text.strong}` |
| Manual margin/padding for spacing         | Use Flex gap props or semantic components                |
| CSS classes in React Native               | Use component props                                      |
| Raw text outside Text components          | Always wrap text in Text components                      |
| Custom alert/notification components      | `<Callout variant="info\|success\|warning\|error">`      |
| Direct `createPortal()` usage             | Use `<Portal>` component for consistency                 |

## 🏗️ **Container + Flex Usage Pattern**

**Recommended Architecture**: Container + Layout separation

```tsx
// ✅ BEST PRACTICE: Container for styling, Flex for layout
<Container
  backgroundColor={theme.colors.bg.card}
  padding="md"
  style={{ borderRadius: 8 }}
>
  <Flex direction="column" gap="md">
    <Flex gap="sm" align="center">
      <Icon name="user" />
      <Text>Content</Text>
    </Flex>
  </Flex>
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
- **Flex**: Layout, spacing, alignment, content organization
- **Spacer**: Fixed spacing between non-flex elements

---

## 📖 Related Documentation

- [When to Use Primitives](./03-when-to-use-primitives.md) - Decision framework
- [Web-to-Native Migration Guide](./04-web-to-native-migration.md) - Step-by-step conversion patterns
- [Primitive Styling Guide](./05-primitive-styling-guide.md) - Color system and consistency rules
- [Theme System](../theme/README.md) - Color system and theming
- [Component Architecture](../component-architecture-workflow-explained.md) - Overall architecture explanation

---

_Last updated: 2026-01-14 - Consolidated Flex primitives, removed typography prop from Text, added CSS class alternative for web_

---

[← Back to Primitives INDEX](./INDEX.md)
