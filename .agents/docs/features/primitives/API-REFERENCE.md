# Primitives API Reference

**[← Back to Primitives INDEX](./INDEX.md)**

Complete API reference for all primitive components. Use this for quick prop lookups during development.

---

## Table of Contents

- [Text & Typography](#text--typography)
- [Buttons](#buttons)
- [Form Elements](#form-elements)
- [Layout Components](#layout-components)
- [Interactive Components](#interactive-components)
- [Messaging Components](#messaging-components)
- [Visual Components](#visual-components)

---

## Text & Typography

### Text

**Location**: `src/components/primitives/Text/Text.tsx`

**Props**:
- `variant?: 'default' | 'strong' | 'subtle' | 'muted' | 'error' | 'success' | 'warning' | 'link'` - Text style variant
- `size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl'` - Font size
- `weight?: 'normal' | 'medium' | 'semibold' | 'bold'` - Font weight
- `align?: 'left' | 'center' | 'right'` - Text alignment
- `marginTop?: number` - Top margin in pixels
- `marginBottom?: number` - Bottom margin in pixels
- `lineHeight?: number` - Line height multiplier
- `color?: string` - Custom text color (use theme colors preferred)
- `style?: CSSProperties | StyleProp<TextStyle>` - Additional styles
- `className?: string` - CSS classes (web only)
- `testID?: string` - Test identifier
- `numberOfLines?: number` - Text truncation (native only)
- `selectable?: boolean` - Enable text selection (native only)

**Example**:
```tsx
<Text variant="strong" size="lg" weight="semibold">
  Important Text
</Text>
```

---

### Title

**Location**: `src/components/primitives/Text/Text.tsx` (semantic wrapper)

**Props**:
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Title size (sm=18px, md=20px, lg=24px, xl=30px)
- `weight?: 'normal' | 'medium' | 'semibold' | 'bold'` - Font weight (default: bold)
- All other `Text` props

**Example**:
```tsx
<Title size="lg">Page Title</Title>
<Title size="sm" weight="normal">Subtitle</Title>
```

---

### Paragraph

**Location**: `src/components/primitives/Text/Text.tsx` (semantic wrapper)

**Props**:
- All `Text` props
- Automatic `marginBottom={16}` and `lineHeight="1.4x"`

**Example**:
```tsx
<Paragraph>
  This is a paragraph with automatic spacing and line height.
</Paragraph>
```

---

### Label

**Location**: `src/components/primitives/Text/Text.tsx` (semantic wrapper)

**Props**:
- All `Text` props
- Default `size="sm"`, `weight="strong"`, `marginBottom={8}`

**Example**:
```tsx
<Label>Form Field Label</Label>
```

---

### Caption

**Location**: `src/components/primitives/Text/Text.tsx` (semantic wrapper)

**Props**:
- All `Text` props
- Default `size="sm"`, `variant="subtle"`, `marginTop={8}`

**Example**:
```tsx
<Caption>Helper text or description</Caption>
```

---

### InlineText

**Location**: `src/components/primitives/Text/Text.tsx` (semantic wrapper)

**Props**:
- All `Text` props
- No automatic margins (use for inline text)

**Example**:
```tsx
<InlineText>Text without spacing</InlineText>
```

---

## Buttons

### Button

**Location**: `src/components/primitives/Button/Button.tsx`

**Props**:
- `type?: 'primary' | 'secondary' | 'light' | 'light-outline' | 'subtle' | 'subtle-outline' | 'danger' | 'primary-white' | 'secondary-white' | 'light-white' | 'light-outline-white' | 'disabled-onboarding' | 'unstyled'` - Button style variant
- `size?: 'small' | 'normal' | 'large'` - Button size
- `onClick?: () => void` - Click handler
- `disabled?: boolean` - Disable button interaction
- `fullWidth?: boolean` - Make button full width
- `fullWidthWithMargin?: boolean` - Full width with horizontal margin (native only)
- `iconName?: string` - Icon name to display
- `iconOnly?: boolean` - Show only icon, hide text
- `hapticFeedback?: boolean` - Enable haptic feedback on press (native only)
- `accessibilityLabel?: string` - Accessibility label (native only)
- `tooltip?: string` - Tooltip text
- `highlightedTooltip?: boolean` - Highlighted tooltip style
- `className?: string` - CSS classes (web only)
- `style?: CSSProperties | StyleProp<ViewStyle>` - Additional styles
- `testID?: string` - Test identifier

**Example**:
```tsx
<Button type="primary" onClick={handleSave}>Save</Button>
<Button type="secondary" iconName="plus" onClick={handleAdd}>Add Item</Button>
<Button type="light" iconName="settings" iconOnly onClick={handleSettings} />
<Button type="danger" fullWidth onClick={handleDelete}>Delete</Button>
```

---

## Form Elements

### Input

**Location**: `src/components/primitives/Input/Input.tsx`

**Props**:
- `value: string` - Input value (required)
- `onChange: (value: string) => void` - Change handler (required)
- `placeholder?: string` - Placeholder text
- `type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'` - Input type
- `variant?: 'filled' | 'bordered' | 'onboarding'` - Input style variant
- `error?: boolean` - Show error state
- `errorMessage?: string` - Error message to display
- `disabled?: boolean` - Disable input
- `noFocusStyle?: boolean` - Disable focus styling
- `autoFocus?: boolean` - Auto-focus on mount
- `className?: string` - CSS classes (web only)
- `style?: CSSProperties | StyleProp<ViewStyle>` - Additional styles
- `testID?: string` - Test identifier
- `accessibilityLabel?: string` - Accessibility label
- `onBlur?: () => void` - Blur event handler
- `onFocus?: () => void` - Focus event handler

**Native-specific props**:
- `keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad' | 'decimal-pad' | 'url'` - Keyboard type (native only)
- `returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send'` - Return key label (native only)
- `autoComplete?: 'off' | 'email' | 'name' | 'tel' | 'username' | 'password'` - Autocomplete type (native only)
- `secureTextEntry?: boolean` - Password masking (native only)
- `onSubmitEditing?: () => void` - Submit event handler (native only)

**Example**:
```tsx
<Input
  type="email"
  value={email}
  onChange={setEmail}
  placeholder="Enter your email"
  error={!!emailError}
  errorMessage={emailError}
/>
```

---

### TextArea

**Location**: `src/components/primitives/TextArea/TextArea.tsx`

**Props**:
- `value: string` - Textarea value (required)
- `onChange: (value: string) => void` - Change handler (required)
- `placeholder?: string` - Placeholder text
- `numberOfLines?: number` - Visible rows (default: 4)
- `variant?: 'filled' | 'bordered'` - Textarea style variant
- `error?: boolean` - Show error state
- `errorMessage?: string` - Error message to display
- `disabled?: boolean` - Disable textarea
- `className?: string` - CSS classes (web only)
- `style?: CSSProperties | StyleProp<ViewStyle>` - Additional styles
- `testID?: string` - Test identifier

**Example**:
```tsx
<TextArea
  value={description}
  onChange={setDescription}
  placeholder="Enter description"
  numberOfLines={6}
  error={!!descError}
  errorMessage={descError}
/>
```

---

### Select

**Location**: `src/components/primitives/Select/Select.web.tsx` (web), `src/components/primitives/Select/Select.native.tsx` (native)

**Props**:

**Core Props**:
- `value: string | string[]` - Selected value(s) (required)
- `onChange: (value: string | string[]) => void` - Change handler (required)
- `placeholder?: string` - Placeholder text (default: "Select an option")
- `options?: Array<{ label: string; value: string; icon?: string; avatar?: string; subtitle?: string; disabled?: boolean }>` - Select options
- `groups?: Array<{ groupLabel: string; options: Array<...> }>` - Grouped options
- `error?: boolean` - Show error state
- `errorMessage?: string` - Error message to display
- `disabled?: boolean` - Disable select
- `testID?: string` - Test identifier

**Display Props**:
- `size?: 'small' | 'medium' | 'large'` - Select size (default: 'medium')
- `variant?: 'filled' | 'bordered'` - Visual variant (default: 'filled')
- `fullWidth?: boolean` - Make select full width (default: false)
- `width?: string | number` - Custom width override

**Multiselect Props**:
- `multiple?: boolean` - Enable multiple selection (default: false)
- `renderSelectedValue?: (values: string[], options: SelectOption[]) => ReactNode` - Custom render for selected values
- `selectAllLabel?: string` - Label for "select all" option (default: "All")
- `clearAllLabel?: string` - Label for "clear all" option (default: "Clear")
- `maxDisplayedChips?: number` - Max number of chips to show before "+N more" (default: 3)
- `showSelectAllOption?: boolean` - Show select all/clear all actions (default: true)

**Compact Mode Props**:
- `compactMode?: boolean` - Enable compact icon-only display (default: false)
- `compactIcon?: string` - Icon to display in compact mode (default: 'filter')
- `showSelectionCount?: boolean` - Show selection count badge in compact mode (default: false)

**Web-specific Props**:
- `dropdownPlacement?: 'auto' | 'top' | 'bottom'` - Dropdown placement (default: 'auto')
- `maxHeight?: number | string` - Max dropdown height (default: 240)
- `name?: string` - Form field name for native form compatibility
- `id?: string` - Form field ID
- `autoFocus?: boolean` - Auto-focus on mount
- `className?: string` - CSS classes

**Native-specific Props**:
- `style?: StyleProp<ViewStyle>` - Additional styles

**Example - Basic**:
```tsx
<Select
  value={selectedOption}
  onChange={setSelectedOption}
  placeholder="Select an option"
  options={[
    { label: 'Option 1', value: 'opt1' },
    { label: 'Option 2', value: 'opt2' },
  ]}
/>
```

**Example - Multiselect**:
```tsx
<Select
  multiple
  value={selectedOptions}
  onChange={setSelectedOptions}
  placeholder="Select multiple"
  options={[
    { label: 'Option 1', value: 'opt1' },
    { label: 'Option 2', value: 'opt2' },
    { label: 'Option 3', value: 'opt3' },
  ]}
  maxDisplayedChips={2}
/>
```

**Example - Compact Mode**:
```tsx
<Select
  compactMode
  compactIcon="filter"
  multiple
  showSelectionCount
  value={selectedFilters}
  onChange={setSelectedFilters}
  options={[
    { label: 'All', value: 'all' },
    { label: 'Mentions', value: 'mentions' },
    { label: 'Threads', value: 'threads' },
  ]}
/>
```

**Example - With Icons and Subtitles**:
```tsx
<Select
  value={selectedUser}
  onChange={setSelectedUser}
  options={[
    {
      label: 'John Doe',
      value: 'user1',
      icon: 'user',
      subtitle: 'Admin',
    },
    {
      label: 'Jane Smith',
      value: 'user2',
      avatar: '/avatars/jane.png',
      subtitle: 'Member',
    },
  ]}
/>
```

---

### FileUpload

**Location**: `src/components/primitives/FileUpload/FileUpload.tsx`

**Props**:
- `onFilesSelected: (files: File[]) => void` - File selection handler (required)
- `accept?: Record<string, string[]>` - Accepted file types (e.g., `{ 'image/*': ['.png', '.jpg'] }`)
- `multiple?: boolean` - Allow multiple file selection
- `maxSize?: number` - Maximum file size in bytes
- `minSize?: number` - Minimum file size in bytes
- `disabled?: boolean` - Disable file upload
- `onError?: (error: string) => void` - Error handler
- `testId?: string` - Test identifier

**Web-specific props**:
- `onDragActiveChange?: (active: boolean) => void` - Drag state handler (web only)
- `validator?: (file: File) => string | null` - Custom file validator (web only)

**Native-specific props**:
- `showCameraOption?: boolean` - Show camera option (native only)
- `imageQuality?: number` - Image quality 0-1 (native only)
- `allowsEditing?: boolean` - Allow image editing (native only)

**Example**:
```tsx
<FileUpload
  onFilesSelected={handleFiles}
  accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
  multiple
  maxSize={5 * 1024 * 1024} // 5MB
  onError={handleError}
>
  <Text>Drop files here or click to upload</Text>
</FileUpload>
```

---

## Layout Components

### FlexRow

**Location**: `src/components/primitives/FlexRow/FlexRow.tsx`

**Props**:
- `gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'` - Space between children
- `justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'` - Horizontal distribution
- `align?: 'start' | 'end' | 'center' | 'stretch' | 'baseline'` - Vertical alignment
- `wrap?: boolean` - Allow wrapping
- `style?: CSSProperties | StyleProp<ViewStyle>` - Additional styles
- `className?: string` - CSS classes (web only)
- `testID?: string` - Test identifier

**Example**:
```tsx
<FlexRow gap="md" justify="between" align="center">
  <Text>Left content</Text>
  <Button>Right action</Button>
</FlexRow>
```

---

### FlexColumn

**Location**: `src/components/primitives/FlexColumn/FlexColumn.tsx`

**Props**:
- `gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'` - Space between children
- `justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'` - Vertical distribution
- `align?: 'start' | 'end' | 'center' | 'stretch'` - Horizontal alignment
- `style?: CSSProperties | StyleProp<ViewStyle>` - Additional styles
- `className?: string` - CSS classes (web only)
- `testID?: string` - Test identifier

**Example**:
```tsx
<FlexColumn gap="lg" align="center">
  <Title>Heading</Title>
  <Paragraph>Content</Paragraph>
  <Button>Action</Button>
</FlexColumn>
```

---

### FlexCenter

**Location**: `src/components/primitives/FlexCenter/FlexCenter.tsx`

**Props**:
- Same as `FlexRow` with `justify="center"` and `align="center"` by default

**Example**:
```tsx
<FlexCenter>
  <Text>Centered content</Text>
</FlexCenter>
```

---

### FlexBetween

**Location**: `src/components/primitives/FlexBetween/FlexBetween.tsx`

**Props**:
- Same as `FlexRow` with `justify="between"` and `align="center"` by default

**Example**:
```tsx
<FlexBetween>
  <Text>Left</Text>
  <Text>Right</Text>
</FlexBetween>
```

---

### Container

**Location**: `src/components/primitives/Container/Container.tsx`

**Props**:
- `width?: 'auto' | 'full' | 'fit' | string | number` - Container width
- `maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | string | number` - Maximum width
- `padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string | number` - Padding
- `margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'auto' | string | number` - Margin
- `backgroundColor?: string` - Background color
- `className?: string` - CSS classes (web only)
- `style?: CSSProperties | StyleProp<ViewStyle>` - Additional styles
- `testId?: string` - Test identifier

**Web-specific props**:
- `onClick?: (event: MouseEvent) => void` - Click handler (web only)
- `onMouseEnter?: (event: MouseEvent) => void` - Mouse enter handler (web only)
- `onMouseLeave?: (event: MouseEvent) => void` - Mouse leave handler (web only)
- `role?: string` - ARIA role (web only)
- `aria-label?: string` - ARIA label (web only)

**Native-specific props**:
- `onPress?: () => void` - Press handler (native only)
- `accessible?: boolean` - Enable accessibility (native only)
- `accessibilityLabel?: string` - Accessibility label (native only)
- `accessibilityRole?: string` - Accessibility role (native only)
- `accessibilityHint?: string` - Accessibility hint (native only)

**Example**:
```tsx
<Container
  backgroundColor={theme.colors.bg.card}
  padding="md"
  style={{ borderRadius: 12 }}
>
  <Text>Container content</Text>
</Container>
```

---

### Spacer

**Location**: `src/components/primitives/Spacer/Spacer.tsx`

**Props**:
- `size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number` - Spacer size (required)
- `direction?: 'vertical' | 'horizontal'` - Spacer direction (default: vertical)
- `testId?: string` - Test identifier
- `className?: string` - CSS classes (web only)

**Example**:
```tsx
<Spacer size="md" />
<Spacer size={20} direction="horizontal" />
```

---

### ResponsiveContainer

**Location**: `src/components/primitives/ResponsiveContainer/ResponsiveContainer.tsx`

**Props**:
- `className?: string` - CSS classes (web only)
- `style?: CSSProperties | StyleProp<ViewStyle>` - Additional styles
- Adapts to screen size automatically

**Example**:
```tsx
<ResponsiveContainer>
  <Text>Content that adapts to screen size</Text>
</ResponsiveContainer>
```

---

### ScrollContainer

**Location**: `src/components/primitives/ScrollContainer/ScrollContainer.tsx`

**Props**:
- `height?: 'auto' | 'fit' | 'full' | string | number` - Container height
- `borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | string | number` - Border radius
- `className?: string` - CSS classes (web only)
- `style?: CSSProperties | StyleProp<ViewStyle>` - Additional styles

**Web-specific props**:
- `onScroll?: (event: UIEvent) => void` - Scroll handler (web only)

**Native-specific props**:
- `horizontal?: boolean` - Enable horizontal scrolling (native only)
- `showsVerticalScrollIndicator?: boolean` - Show vertical scrollbar (native only)
- `showsHorizontalScrollIndicator?: boolean` - Show horizontal scrollbar (native only)
- `bounces?: boolean` - Enable bounce effect (native only, iOS)
- `overScrollMode?: 'auto' | 'always' | 'never'` - Overscroll mode (native only, Android)
- `scrollEventThrottle?: number` - Scroll event throttle in ms (native only)
- `onScrollEndDrag?: () => void` - Drag end handler (native only)
- `onMomentumScrollEnd?: () => void` - Momentum scroll end handler (native only)
- `refreshControl?: RefreshControl` - Pull-to-refresh control (native only)

**Example**:
```tsx
<ScrollContainer height={400} borderRadius="md">
  <FlexColumn gap="md">
    {/* Scrollable content */}
  </FlexColumn>
</ScrollContainer>
```

---

## Interactive Components

### Switch

**Location**: `src/components/primitives/Switch/Switch.tsx`

**Props**:
- `value: boolean` - Switch state (required)
- `onChange: (value: boolean) => void` - Change handler (required)
- `disabled?: boolean` - Disable switch
- `size?: 'small' | 'normal' | 'large'` - Switch size
- `label?: string` - Label text
- `testID?: string` - Test identifier

**Example**:
```tsx
<Switch
  value={isEnabled}
  onChange={setIsEnabled}
  label="Enable notifications"
/>
```

---

### RadioGroup

**Location**: `src/components/primitives/RadioGroup/RadioGroup.tsx`

**Props**:
- `value: string` - Selected value (required)
- `onChange: (value: string) => void` - Change handler (required)
- `options: Array<{ label: string; value: string }>` - Radio options (required)
- `direction?: 'vertical' | 'horizontal'` - Layout direction (default: vertical)
- `disabled?: boolean` - Disable all options
- `testID?: string` - Test identifier

**Example**:
```tsx
<RadioGroup
  value={selectedOption}
  onChange={setSelectedOption}
  options={[
    { label: 'Option 1', value: 'opt1' },
    { label: 'Option 2', value: 'opt2' },
  ]}
  direction="horizontal"
/>
```

---

### Modal

**Location**: `src/components/primitives/Modal/Modal.tsx`

**Props**:
- `isOpen: boolean` - Modal visibility (required)
- `onClose: () => void` - Close handler (required)
- `size?: 'small' | 'medium' | 'large' | 'fullscreen'` - Modal size
- `closeOnBackdrop?: boolean` - Close on backdrop click
- `showCloseButton?: boolean` - Show close button
- `children: ReactNode` - Modal content

**Example**:
```tsx
<Modal
  isOpen={showModal}
  onClose={closeModal}
  size="medium"
  closeOnBackdrop
>
  <Text>Modal content</Text>
</Modal>
```

---

### ModalContainer

**Location**: `src/components/primitives/ModalContainer/ModalContainer.tsx`

**Props**:
- `visible: boolean` - Modal visibility (required)
- `onClose: () => void` - Close handler (required)
- `closeOnBackdropClick?: boolean` - Close on backdrop click
- `showBackdrop?: boolean` - Show backdrop
- `backdropBlur?: boolean` - Blur backdrop
- `zIndex?: string | number` - Z-index value
- `className?: string` - CSS classes (web only)
- `animationDuration?: number` - Animation duration in ms
- `closeOnEscape?: boolean` - Close on Escape key (web only)

**Example**:
```tsx
<ModalContainer
  visible={showModal}
  onClose={closeModal}
  closeOnBackdropClick
  backdropBlur
>
  <Container backgroundColor={theme.colors.bg.card} padding="lg">
    <Text>Modal content</Text>
  </Container>
</ModalContainer>
```

---

### OverlayBackdrop

**Location**: `src/components/primitives/OverlayBackdrop/OverlayBackdrop.tsx`

**Props**:
- `visible: boolean` - Backdrop visibility (required)
- `onBackdropClick?: () => void` - Backdrop click handler
- `zIndex?: string | number` - Z-index value
- `blur?: boolean` - Enable blur effect
- `opacity?: number` - Backdrop opacity (0-1)
- `className?: string` - CSS classes (web only)
- `closeOnBackdropClick?: boolean` - Enable click to close (default: true)

**Example**:
```tsx
<OverlayBackdrop
  visible={showOverlay}
  onBackdropClick={closeOverlay}
  blur
  opacity={0.7}
>
  <Container>Overlay content</Container>
</OverlayBackdrop>
```

---

### Portal

**Location**: `src/components/primitives/Portal/Portal.web.tsx`

**Description**: Renders children into a portal at `document.body`, escaping parent container constraints. Used for overlays that need to break out of stacking contexts (toasts, right-aligned dropdowns).

**Props**:
- `children: ReactNode` - Content to render in portal (required)

**When to Use**:
- ✅ Toast notifications that need to appear above all content
- ✅ Right-aligned dropdowns that might be clipped by parent containers with `overflow: hidden`
- ✅ Overlays that need to escape stacking context issues
- ❌ **NOT for modals** - Modals use rendering location (ModalProvider, Layout-Level), not portals

**Example**:
```tsx
// Toast notification
<Portal>
  <div className="fixed bottom-4 right-4">
    <Callout variant="success">Operation successful!</Callout>
  </div>
</Portal>

// Right-aligned dropdown
{isOpen && (
  <Portal>
    <div className="dropdown-panel" style={{ position: 'fixed', top, left }}>
      {/* Dropdown content */}
    </div>
  </Portal>
)}
```

**Note**: This is a web-only component. React Native would require a different implementation using a native portal library.

---

### Tooltip

**Location**: `src/components/primitives/Tooltip/Tooltip.tsx`

**Props**:
- `content: string` - Tooltip text (required)
- `position?: 'top' | 'bottom' | 'left' | 'right'` - Tooltip position
- `trigger?: 'hover' | 'click' | 'focus'` - Trigger type
- `children: ReactNode` - Element to attach tooltip to

**Example**:
```tsx
<Tooltip content="Click to edit" position="top">
  <Button iconName="edit" iconOnly />
</Tooltip>
```

---

## Messaging Components

### Callout

**Location**: `src/components/primitives/Callout/Callout.tsx`

**Props**:
- `variant: 'info' | 'success' | 'warning' | 'error'` - Callout style (required)
- `size?: 'xs' | 'sm' | 'md'` - Callout size (default: sm)
- `layout?: 'base' | 'minimal'` - Layout style (default: base)
- `dismissible?: boolean` - Show dismiss button
- `autoClose?: number` - Auto-dismiss after N seconds (web only)
- `onClose?: () => void` - Close handler
- `className?: string` - CSS classes (web only)
- `testID?: string` - Test identifier
- `children: ReactNode` - Callout content

**Example**:
```tsx
<Callout variant="success" dismissible onClose={clearMessage}>
  Operation completed successfully!
</Callout>

<Callout variant="warning" layout="minimal">
  Connection issues detected
</Callout>

<Callout variant="error" size="md">
  Critical error occurred
</Callout>

<Callout variant="info" autoClose={5}>
  Auto-dismiss in 5 seconds
</Callout>
```

---

## Visual Components

### Icon

**Location**: `src/components/primitives/Icon/Icon.tsx`

**Props**:
- `name: string` - Icon name (required)
- `size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'` - Icon size
- `color?: string` - Icon color
- `style?: CSSProperties | StyleProp<ViewStyle>` - Additional styles
- `testID?: string` - Test identifier

**Example**:
```tsx
<Icon name="settings" size="lg" color={theme.colors.accent[500]} />
```

---

### ColorSwatch

**Location**: `src/components/primitives/ColorSwatch/ColorSwatch.tsx`

**Props**:
- `color: string` - Hex color value (required)
- `size?: 'small' | 'medium' | 'large'` - Swatch size
- `shape?: 'circle' | 'square'` - Swatch shape
- `showBorder?: boolean` - Show border
- `onClick?: () => void` - Click handler
- `testID?: string` - Test identifier

**Example**:
```tsx
<ColorSwatch
  color="#FF5733"
  size="medium"
  shape="circle"
  showBorder
  onClick={handleColorSelect}
/>
```

---

## Quick Patterns

### Form Field with Label and Error

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

### Card with Header and Actions

```tsx
<Container backgroundColor={theme.colors.bg.card} padding="md">
  <FlexColumn gap="md">
    <FlexBetween>
      <Title size="sm">Card Title</Title>
      <Button type="subtle" iconName="close" iconOnly onClick={onClose} />
    </FlexBetween>
    <Paragraph>Card content</Paragraph>
    <FlexRow gap="sm" justify="end">
      <Button type="secondary" onClick={onCancel}>Cancel</Button>
      <Button type="primary" onClick={onSave}>Save</Button>
    </FlexRow>
  </FlexColumn>
</Container>
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
    style={{ borderRadius: 12, maxWidth: 500 }}
  >
    <FlexColumn gap="md">
      <Title size="sm">Modal Title</Title>
      <Text>Modal content</Text>
      <FlexRow gap="sm" justify="end">
        <Button type="secondary" onClick={closeModal}>Cancel</Button>
        <Button type="primary" onClick={handleConfirm}>Confirm</Button>
      </FlexRow>
    </FlexColumn>
  </Container>
</ModalContainer>
```

---

## Related Documentation

- [Primitives INDEX](./INDEX.md) - Complete primitives documentation hub
- [Quick Reference](./02-primitives-AGENTS.md) - Detailed examples and patterns
- [When to Use Primitives](./03-when-to-use-primitives.md) - Decision framework
- [Migration Guide](./04-web-to-native-migration.md) - Web to native migration patterns
- [Styling Guide](./05-primitive-styling-guide.md) - Color system and styling rules

---

_Created: 2025-10-08_
_Last updated: 2025-10-14 - Added Portal primitive documentation_
