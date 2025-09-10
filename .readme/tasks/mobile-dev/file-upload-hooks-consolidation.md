# File Upload Hooks Consolidation Task



## Overview

Currently, we have multiple file upload implementations that could be consolidated for better maintainability and cross-platform consistency.

## Current State

### Existing File Upload Hooks

1. **`useFileUpload`** (`src/hooks/business/ui/useFileUpload.ts`)
   - **Created**: During modal business logic extraction (commit `1d9900dc`)
   - **Used by**: `CreateSpaceModal.tsx` (space creation)
   - **Purpose**: General-purpose file uploads for UI components
   - **Features**: Generic dropzone wrapper, configurable accept types, multiple files
   - **Implementation**: Uses react-dropzone directly

2. **`useWebFileUpload`** (`src/hooks/business/user/useWebFileUpload.ts`)
   - **Created**: During onboarding business logic extraction (commit `e46a5d38`)
   - **Used by**: `Onboarding.tsx` and `Onboarding.native.tsx` (user profile images)
   - **Purpose**: Specialized for user/profile image uploads during onboarding
   - **Features**: Image-specific processing, ArrayBuffer handling, data URL generation
   - **Cross-platform**: Has native counterpart in `useFileUpload.native.ts`

### New FileUpload Primitive Component

- **Location**: `src/components/primitives/FileUpload/`
- **Purpose**: Unified cross-platform file upload component
- **Implementation**: 
  - Web: Uses react-dropzone (similar to existing hooks)
  - Native: Uses platform-specific pickers (react-native-image-picker, react-native-document-picker)
- **Features**: 
  - Consistent API across platforms
  - Lingui internationalization
  - Human-readable error messages (MB instead of bytes)
  - Proper error styling with CSS variables

## Migration Strategy

### Phase 1: Keep Current System (CURRENT)
- ✅ All existing hooks work fine
- ✅ New FileUpload primitive is ready for new features
- ✅ Both systems coexist without conflicts

### Phase 2: Gradual Migration (TODO)

#### High Priority
1. **Migrate `useFileUpload` (ui) users** to FileUpload primitive:
   - `CreateSpaceModal.tsx` - Replace hook with component approach
   - Benefits: Cross-platform support for future mobile space creation

#### Medium Priority
2. **Keep `useWebFileUpload` for now**:
   - Specialized for onboarding image handling
   - Has complex image processing features (ArrayBuffer, data URLs)
   - Already has cross-platform implementation
   - Consider migration only if onboarding gets full primitive treatment

#### Low Priority
3. **Future new features**:
   - Always use FileUpload primitive for new file upload needs
   - Avoid creating more file upload hooks

## Technical Considerations

### Pros of Migration
- **Unified API**: Same interface across web and mobile
- **Better Mobile UX**: Native pickers instead of web dropzone
- **Consistency**: All file uploads work the same way
- **Maintenance**: Single codebase to maintain

### Cons of Migration
- **Breaking Changes**: Need to refactor existing components
- **Feature Parity**: Ensure primitive supports all existing hook features
- **Testing**: Need to verify all existing functionality works

### Migration Complexity
- `useFileUpload` (ui): **Low complexity** - straightforward dropzone replacement
- `useWebFileUpload`: **Medium complexity** - has specialized image processing features

## Action Items

- [ ] Create migration plan for `CreateSpaceModal.tsx`
- [ ] Verify FileUpload primitive supports all `useFileUpload` features
- [ ] Test cross-platform behavior of FileUpload primitive
- [ ] Consider adding image processing features to FileUpload primitive if needed for `useWebFileUpload` migration

## Notes

- The new FileUpload primitive is essentially the evolution of the file upload hook pattern
- Both existing hooks serve legitimate different purposes and were created during separate business logic extractions
- No rush to migrate - current system works well
- Focus on using the primitive for new features rather than forced migration

---

*Created: August 8, 2025*
*Status: Planning*
*Priority: Medium*
