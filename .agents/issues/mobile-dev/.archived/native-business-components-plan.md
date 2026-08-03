---
type: task
title: Native Business Components Implementation Plan
status: in-progress
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
---

# Native Business Components Implementation Plan

## Overview

We have successfully restructured the mobile playground with a clear separation between UI primitives testing and business components testing. The next phase is to begin implementing native business components that leverage our extracted business logic hooks.

## Current Status

### ✅ Completed

- **Cross-platform architecture**: 63/64 components have business logic extracted into hooks
- **Mobile playground structure**: Three-level navigation (Main → Primitives/Business → Individual tests)
- **Shared codebase**: 90% of code is shared between web and mobile platforms
- **Platform detection utilities**: Available in `src/utils/platform.ts`
- **Authentication hook**: `useAuthenticationFlow` ready for implementation

### 🎯 Ready for Implementation

- **Authentication components**: Login and Onboarding screens
- **Core messaging components**: Using existing chat and direct message hooks
- **Space management**: Space creation and channel navigation

## Implementation Strategy

### Phase 1: Authentication Flow

**Priority: High**

**Components to create:**

- `Login.native.tsx` - Native login screen using `useAuthenticationFlow`
- `Onboarding.native.tsx` - New user registration flow
- `AuthenticationTestScreen.tsx` - Playground wrapper (already exists as placeholder)

**Business logic hooks available:**

- `useAuthenticationFlow()` - Complete auth state management
- `useUploadRegistration()` - User registration API calls
- `useRegistration()` - Registration data fetching

**Testing approach:**

- Create each component incrementally
- Test in mobile playground immediately after creation
- Verify cross-platform compatibility with web versions

### Phase 2: Core Messaging

**Priority: Medium**

**Components to create:**

- `DirectMessages.native.tsx` - Chat interface using message hooks
- `MessageComposer.native.tsx` - Message input and sending
- `MessageList.native.tsx` - Message display and scrolling

**Business logic hooks available:**

- `useDirectMessages()` - Message fetching and state
- `useMessageSending()` - Send message functionality
- `useMessageHistory()` - Message pagination

### Phase 3: Space Management

**Priority: Medium**

**Components to create:**

- `SpacesList.native.tsx` - Available spaces display
- `ChannelsList.native.tsx` - Channels within a space
- `Space.native.tsx` - Main space interface

**Business logic hooks available:**

- `useSpaces()` - Spaces data management
- `useChannels()` - Channel navigation and state
- `useSpaceMembers()` - Member management

## Development Workflow

### 1. Component Creation Process

```typescript
// Example: Login.native.tsx
import { useAuthenticationFlow } from '@/hooks/business/user/useAuthenticationFlow';
import { Button, Input, FlexColumn } from '@/primitives';

export function Login({ onSuccess }: LoginProps) {
  const { authMode, isAuthenticating, startNewAccount } = useAuthenticationFlow();

  // Native-specific UI using primitives
  return (
    <FlexColumn className="p-4">
      {/* Implementation using cross-platform primitives */}
    </FlexColumn>
  );
}
```

### 2. Testing Integration

- Each component gets added to `BusinessMenuScreen.tsx`
- Immediate testing in mobile playground
- Verify platform detection and feature compatibility

### 3. Navigation Setup

- Use React Navigation for mobile-specific routing
- Maintain compatibility with web routing patterns
- Test deep linking and state persistence

## Technical Considerations

### Mobile-Specific Requirements

- **Touch interactions**: Ensure all components work with touch input
- **Screen sizes**: Test on various mobile viewport dimensions
- **Performance**: Optimize for mobile hardware limitations
- **Navigation**: Implement mobile-appropriate navigation patterns

### Cross-Platform Compatibility

- **Primitive usage**: Only use components from `src/components/primitives/`
- **Platform detection**: Use `isNative()`, `isWeb()` utilities when needed
- **Shared state**: Leverage existing context providers and hooks
- **Styling**: Follow primitives-first styling approach (see Native Styling Guidelines below)

### Error Handling

- **Network errors**: Handle API failures gracefully
- **Authentication errors**: Clear error states and user feedback
- **Fallback states**: Loading and error boundaries for all components

## Next Steps

1. **Start with Authentication** - Begin with `Login.native.tsx` as it's foundational
2. **Incremental testing** - Test each component in playground before moving to next
3. **Document learnings** - Update this plan with discoveries and best practices
4. **Cross-platform verification** - Ensure web app continues working during mobile development

## Native Styling Guidelines

### **Research-Based Best Practice: Primitives-First Approach**

After researching React Native styling best practices for 2025, we determined that our existing primitive system already provides comprehensive design tokens, eliminating the need for additional shared style files.

### **✅ What Our Primitives Already Provide**

**Typography** (`Text.native.tsx`):

```typescript
// Font sizes: xs(12), sm(14), base(16), lg(18), xl(20), 2xl(24), 3xl(30)
// Font weights: normal(400), medium(500), semibold(600), bold(700)
<Text size="2xl" weight="semibold" variant="strong">Welcome!</Text>
```

**Spacing** (`Container.native.tsx`):

```typescript
// Padding/margin: none(0), xs(4), sm(8), md(16), lg(24), xl(32)
<Container padding="lg" margin="md">Content</Container>
```

**Colors** (Theme system):

```typescript
const { colors } = useTheme();
// colors.text.strong/main/subtle/muted
// colors.accent.DEFAULT/100/300/700
// colors.surface[0-10]
// colors.utilities.danger/success/warning
```

**Component Variants**:

- Button: 10+ variants with complete theming
- Input/TextArea: Form styling with focus states
- Modal: Layout and animation patterns
- Layout: FlexRow, FlexColumn, FlexCenter, etc.

### **✅ Recommended Implementation Pattern**

**Use Primitives (90% of styling needs)**:

```typescript
export const Onboarding = () => {
  const { colors } = useTheme();

  return (
    <Container padding="lg" style={{ backgroundColor: colors.surface[0] }}>
      <Text size="2xl" weight="semibold" variant="strong" align="center">
        Welcome to Quorum!
      </Text>
      <Button type="primary-white" size="large">
        Create New Account
      </Button>
    </Container>
  );
};
```

**Minimal Component-Specific Styles (10% of cases)**:

```typescript
// Only for unique layouts not covered by primitives
const styles = StyleSheet.create({
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  logo: {
    width: 64,
    height: 64,
  },
  // NO text, button, spacing styles - use primitives instead!
});
```

### **✅ Key Benefits**

- **Design Consistency**: Primitives ensure identical styling across platforms
- **Performance**: StyleSheet.create optimization + no inline style recreation
- **Maintainability**: Changes to primitives propagate automatically
- **Developer Experience**: No need to memorize spacing tokens or color values
- **Theme Integration**: Automatic dark/light mode + accent color support

### **❌ What NOT to Create**

- ❌ Separate `.styles.native.ts` files
- ❌ Shared style token files (spacing.ts, typography.ts)
- ❌ Custom shadow helpers (primitives handle this)
- ❌ Inline styles (performance impact)
- ❌ Hardcoded colors/sizes (use theme + primitives)

### **🎯 Implementation Workflow**

1. **Start with primitives**: Use Container, Text, Button, Input, etc.
2. **Add theme colors**: `const { colors } = useTheme()` for dynamic colors
3. **Minimal custom styles**: Only for unique layouts via StyleSheet.create
4. **Test consistency**: Compare with web version visually

This approach leverages our existing investment in the primitive system and follows 2025 React Native best practices.

## Risk Mitigation

- **Backup strategy**: All changes committed incrementally
- **Rollback plan**: Revert capability maintained throughout development
- **Testing strategy**: Both platforms tested after each major change
- **Code review**: Mobile components follow existing web patterns

---

_Created: 2025-08-08_
