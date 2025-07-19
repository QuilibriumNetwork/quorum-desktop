# Enhanced Component Architecture Proposal (Revised)

## Current Problem

- **Code Duplication**: Quorum Mobile mirrors much of the Quorum Desktop codebase, leading to maintenance overhead and potential inconsistencies.
- **"Everything else is mirrored instead of being shared"** - complex React components are duplicated when they could be reused.

## Proposed Solution: Cassie's Two-Layer Architecture

Implement a **minimal-change architecture** that extracts only the "raw HTML portion" into platform-specific primitives while keeping all existing business logic unchanged.

### Core Principle
> "if each concrete UI component were its own thing, essentially boiling down the raw HTML to the simple components only, everything else is a react component, that actually would make unification between mobile and desktop quite easy, just sub out the simple components"

### Layer 1: Platform-Specific Primitives

Extract **only the raw HTML/React Native rendering** into tightly contained components. These should match your existing component APIs exactly.

#### Example: Button Component

**Button.web.tsx** (preserves your current HTML structure):
```tsx
import React from 'react';
import './Button.scss'; // Keep existing SCSS

export function Button({ 
  type = 'primary', 
  size, 
  disabled, 
  onClick, 
  children, 
  className,
  icon,
  id
}) {
  const baseClass = disabled ? 'btn-disabled' : `btn-${type}`;
  const buttonId = id || `button-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <span
      id={buttonId}
      className={
        baseClass +
        (size === 'small' ? ' btn-small' : '') +
        (icon ? ' quorum-button-icon' : '') +
        (className ? ' ' + className : '')
      }
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      {children}
    </span>
  );
}
```

**Button.native.tsx** (React Native equivalent):
```tsx
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

export function Button({ 
  type = 'primary', 
  size, 
  disabled, 
  onClick, 
  children, 
  className, // ignored on mobile
  icon,
  id // ignored on mobile
}) {
  return (
    <Pressable
      onPress={() => {
        if (!disabled) onClick();
      }}
      style={[
        styles.button,
        styles[`btn${type.charAt(0).toUpperCase() + type.slice(1)}`],
        size === 'small' && styles.btnSmall,
        disabled && styles.btnDisabled
      ]}
    >
      <Text style={[styles.text, disabled && styles.textDisabled]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: 12, borderRadius: 6 },
  btnPrimary: { backgroundColor: '#007bff' },
  btnSecondary: { backgroundColor: '#6c757d' },
  // ... other styles matching your SCSS
});
```

### Layer 2: Shared Business Logic (Zero Changes)

**All existing complex components remain completely unchanged.** They continue to import and use components exactly as before.

#### Example: Your Existing Components Stay the Same

**Your current component that uses Button**:
```tsx
// This file stays EXACTLY the same - no changes needed
import Button from './Button'; // Auto-resolves to Button.web.tsx or Button.native.tsx
import ReactTooltip from './ReactTooltip';

const MyFeature = () => {
  return (
    <>
      <Button 
        type="primary" 
        size="small"
        onClick={handleClick}
        tooltip="Click me!"
        className="my-custom-class"
      >
        Save Changes
      </Button>
      {/* All your existing tooltip logic, etc. stays the same */}
    </>
  );
};
```

### Key Requirements

1. **"Raw HTML portion strictly within tightly contained components"**
   - ❌ No `<span>`, `<div>`, `<Pressable>`, `<Text>` in business logic components
   - ✅ Only abstract components like `<Button>`, `<Input>`, `<Card>`

2. **Preserve Existing APIs**
   - New primitives must accept the same props your existing components expect
   - No breaking changes to existing component usage

3. **Avoid react-native-web dependency**
   - Web primitives use standard HTML + CSS/SCSS
   - Mobile primitives use pure React Native

### Implementation Strategy

#### Phase 1: Identify Primitives
Extract components that contain "raw HTML":
- Button, Input, Select, Textarea
- Layout components: Container, Row, Column
- Basic UI: Card, Modal backdrop, etc.

#### Phase 2: Create Platform Versions
For each primitive:
1. **`.web.tsx`**: Extract existing HTML/SCSS exactly as-is
2. **`.native.tsx`**: Create React Native equivalent with same props
3. **`index.ts`**: Let bundler auto-resolve platform

#### Phase 3: Zero-Change Migration
- Existing imports continue working: `import Button from './Button'`
- Complex components remain unchanged
- Business logic, state management, routing all stay the same

### Directory Structure

```
src/
  components/
    Button/
      Button.web.tsx      // Your current Button logic + HTML
      Button.native.tsx   // React Native equivalent
      Button.scss         // Web-only styles
      index.ts           // Platform resolution
    Input/
      Input.web.tsx
      Input.native.tsx
      Input.scss
      index.ts
    MyComplexFeature.tsx  // UNCHANGED - imports Button and works on both platforms
    AnotherFeature.tsx    // UNCHANGED - imports primitives, logic stays same
```

### Expected Outcome

- **90%+ of your codebase shared** between platforms
- **Only primitive UI components** have platform-specific implementations
- **All business logic, state, routing, complex components shared**
- **No API changes** - existing components continue working unchanged
- **No react-native-web complexity**

This approach achieves Cassie's vision: **"everything else can then be shared instead of being mirrors"** with minimal disruption to your existing codebase.