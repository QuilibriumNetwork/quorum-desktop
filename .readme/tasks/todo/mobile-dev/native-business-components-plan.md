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
- **Styling**: Use Tailwind classes that work across platforms

### Error Handling
- **Network errors**: Handle API failures gracefully
- **Authentication errors**: Clear error states and user feedback
- **Fallback states**: Loading and error boundaries for all components

## Next Steps

1. **Start with Authentication** - Begin with `Login.native.tsx` as it's foundational
2. **Incremental testing** - Test each component in playground before moving to next
3. **Document learnings** - Update this plan with discoveries and best practices
4. **Cross-platform verification** - Ensure web app continues working during mobile development

## Risk Mitigation

- **Backup strategy**: All changes committed incrementally
- **Rollback plan**: Revert capability maintained throughout development  
- **Testing strategy**: Both platforms tested after each major change
- **Code review**: Mobile components follow existing web patterns

---

*Created: 2025-08-08*