# Channel Business Logic Extraction - Lessons Learned

## Overview

Successfully extracted business logic from Channel.tsx (730+ lines → ~400 lines) while refactoring to use primitives. Key lessons for future component refactoring.

## Architecture Pattern Used

- **Business Logic Hooks**: `useChannelData`, `useChannelMessages`, `useMessageComposer`
- **Primitive Components**: Button, Icon, Container, FlexRow, TextArea
- **Custom Components**: MessageTextArea (for fragile textarea behavior)

## Critical Issues & Solutions

### 1. Navigation Breaking After Refactoring

**Problem**: Space navigation stopped working after business logic extraction

- First navigation worked (messages → space)
- Subsequent navigation failed (space → space, space → messages)
- URL changed but component didn't update

**Root Cause**: Unstable function reference in `generateSidebarContent()`

```js
// ❌ BAD - Creates new function on every render
const generateSidebarContent = () => { ... };

// ✅ GOOD - Stable reference with proper dependencies
const generateSidebarContent = useCallback(() => { ... }, [roles, activeMembers, members, noRoleMembers]);
```

**Solution**: Wrap extracted functions with `useCallback` and proper dependencies

### 2. React Query Hook Dependencies

**Key Learning**: When extracting React Query hooks, ensure:

- Query keys include all relevant parameters (`spaceId`, `channelId`)
- Hook dependencies match the data being used
- No stale references to old query data

### 3. Complex Component State Management

**TextArea Complexity**: Message textarea has intricate behavior (auto-resize, Enter submission, file handling)

- Created dedicated `MessageTextArea` component
- Avoided over-abstracting fragile behavior
- Maintained explicit height/row calculations

### 4. Primitive Migration Strategy

**Button Icons**: Original FontAwesome icons → Button primitives with `iconName`

- Added `unstyled` Button variant for full className control
- Updated both web and native implementations
- Fixed CSS specificity issues (used `!important` for border-radius overrides)

### 5. Hook Extraction Pattern

```js
// Extract by concern, not by component structure
useChannelData(); // Space info, members, roles, sidebar content
useChannelMessages(); // Message list, permissions, user mapping
useMessageComposer(); // Input state, file uploads, submission
```

## Best Practices Identified

### Do's ✅

- Use `useCallback` for extracted functions with dependencies
- Maintain explicit dependencies in hook arrays
- Test navigation thoroughly after extraction
- Keep complex UI behavior in dedicated components
- Update both web and native primitives when making changes

### Don'ts ❌

- Don't extract functions without memoization
- Don't assume React Query will handle all re-rendering
- Don't over-abstract fragile components (like textarea)
- Don't change primitive APIs without updating both platforms
- Don't ignore CSS specificity issues when using primitives

## Testing Strategy

1. **Navigation First**: Test all routing scenarios before other features
2. **Component Key Props**: Use `key={spaceId-channelId}` for debugging
3. **Revert & Compare**: Keep ability to revert to working state for comparison
4. **Incremental Changes**: Extract business logic first, then refactor UI

## For DirectMessage.tsx Refactoring

- Apply same hook extraction pattern
- Watch for similar navigation issues
- Reuse MessageTextArea component for consistency
- Test message composer functionality thoroughly
- Consider shared hooks between Channel and DirectMessage where appropriate

---

_Created: 2025-08-02_
_Component: Channel.tsx → useChannelData, useChannelMessages, useMessageComposer_
_Result: 730+ lines → ~400 lines, navigation preserved, primitives integrated_
