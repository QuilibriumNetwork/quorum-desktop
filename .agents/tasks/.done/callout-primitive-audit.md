# Callout Primitive Audit Report

## Overview
Comprehensive audit of existing error/success/warning message implementations that could benefit from the new Callout primitive component.

## Methodology
- Searched codebase for error/success/warning patterns
- Identified current implementation approaches
- Categorized by component type and replacement potential

---

## 1. PRIME CANDIDATES for Callout Replacement

### **InviteLink Component** (`src/components/message/InviteLink.tsx`)
**Current Implementation:**
```tsx
{displayError && (
  <Text variant="error" className="mb-2 text-center sm:text-left">
    <Trans>The invite link has expired or is invalid.</Trans>
  </Text>
)}
```

**Callout Replacement:**
```tsx
{displayError && (
  <Callout variant="error" size="sm" className="mb-2">
    <Trans>The invite link has expired or is invalid.</Trans>
  </Callout>
)}
```

### **CreateSpaceModal** (`src/components/modals/CreateSpaceModal.tsx`)
**Current Implementation:**
```tsx
{fileError && (
  <div className="error-label flex items-center justify-between mt-2">
    <span>{fileError}</span>
    <Icon
      name="times"
      className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
      onClick={clearFileError}
    />
  </div>
)}
```

**Callout Replacement:**
```tsx
{fileError && (
  <Callout
    variant="error"
    size="sm"
    className="mt-2"
    dismissible
    onClose={clearFileError}
  >
    {fileError}
  </Callout>
)}
```

### **JoinSpaceModal** (`src/components/modals/JoinSpaceModal.tsx`)
**Current Implementation:**
```tsx
<Input
  className="w-full max-w-[500px] mx-auto !text-sm"
  value={lookup}
  onChange={(value: string) => setLookup(value)}
  placeholder={t`Join Space`}
  error={!!error}
  errorMessage={error}
/>
```

**Note:** Input primitive should maintain its own error state. Could add Callout for additional context above the input.

### **UserSettingsModal** (`src/components/modals/UserSettingsModal.tsx`)
**Current Implementation:**
```tsx
{/* Custom overlay error display */}
{(isSaving || saveError) && (
  <div className="absolute inset-0 z-50 flex items-center justify-center">
    {saveError && (
      <div className="flex items-center gap-3">
        <Icon name="exclamation-circle" size={24} className="text-danger" />
        <div className="text-lg font-medium text-danger">{t`Save Failed`}</div>
      </div>
    )}
  </div>
)}
```

**Callout Replacement:** This could use a Callout for the error state, positioned at top of modal.

---

## 2. FILE UPLOAD Error Messages

### **FileUpload Primitive** (`src/components/primitives/FileUpload/FileUpload.web.tsx`)
**Current Implementation:** Uses `onError` callback with translated error messages
**Callout Opportunity:** Parent components could display FileUpload errors using Callout

**Files with FileUpload error handling:**
- `src/components/modals/CreateSpaceModal.tsx`
- `src/components/modals/UserSettingsModal.tsx`
- Various hooks: `useFileUpload.ts`, `useProfileImage.ts`, etc.

---

## 3. SEARCH Error States

### **SearchResults Component** (`src/components/search/SearchResults.tsx`)
**Current Implementation:**
```tsx
<Icon name="exclamation-triangle" className="error-icon" />
<Text className="error-message">
  {t`Search failed: ${error?.message || 'Unknown error'}`}
</Text>
```

**Callout Replacement:**
```tsx
<Callout variant="error" className="w-full">
  {t`Search failed: ${error?.message || 'Unknown error'}`}
</Callout>
```

---

## 4. SUCCESS Messages (Copy to Clipboard)

### **ClickToCopyContent** (`src/components/ui/ClickToCopyContent.tsx`, `.native.tsx`)
**Current Implementation:** Uses tooltip to show "Copied!" success message
**Callout Opportunity:** NO, LEAVE IT AS IT IS!

---

## 5. CONFIRMATION SYSTEM - HIGH PRIORITY

### **ConfirmationModal Component** (`src/components/modals/ConfirmationModal.tsx`, `.native.tsx`)

**Current Implementation - PROTIP Section:**
```tsx
{showProtip && protipAction && (
  <Container className="bg-info/10 border border-info rounded-lg p-3">
    <FlexRow className="items-start gap-2">
      <Icon
        name="info-circle"
        className="text-info flex-shrink-0 mt-0.5"
        size="sm"
      />
      <Text variant="subtle" className="text-sm">
        <Trans>
          TIP: Hold down shift when clicking {protipAction} to bypass this confirmation entirely.
        </Trans>
      </Text>
    </FlexRow>
  </Container>
)}
```

**Callout Replacement:**
```tsx
{showProtip && protipAction && (
  <Callout variant="info" size="sm" className="">
    <Trans>
      TIP: Hold down shift when clicking {protipAction} to bypass this confirmation entirely.
    </Trans>
  </Callout>
)}
```

### **useConfirmation Hook** (`src/hooks/ui/useConfirmation.ts`)

**Current Implementation - Blocked Error Display:**
The hook has a `blockedError` state that gets displayed by consuming components, typically as inline error text.

**Callout Opportunity:** Components using `blockedError` from useConfirmation could display this using Callout with `variant="error"`.

### **Related Components Using Confirmation System:**
- `src/components/modals/ConversationSettingsModal.tsx`
- `src/components/space/SpaceEditor.tsx`
- `src/components/space/ChannelEditor.tsx`
- Various message action components

**Benefits of Callout Integration:**
1. **Consistent PROTIP styling** across all confirmation modals
2. **Error state standardization** for blocked operations
3. **Cross-platform consistency** between web and mobile
4. **Dismissible functionality** for error states if needed

---

## 6. NOTIFICATION & PERMISSION States

### **UserSettingsModal - Notifications** (`src/components/modals/UserSettingsModal.tsx`)
**Current Implementation:**
```tsx
{!isNotificationSupported && (
  <div className="pt-2 text-sm text-warning">
    {t`Desktop notifications are not supported in this browser.`}
  </div>
)}

{permissionStatus === 'denied' && (
  <div className="pt-2 text-sm" style={{ color: 'var(--color-text-danger)' }}>
    {t`Notifications are blocked. Please enable them in your browser settings.`}
  </div>
)}
```

**Callout Replacement:**
```tsx
{!isNotificationSupported && (
  <Callout variant="warning" size="sm" layout="minimal">
    {t`Desktop notifications are not supported in this browser.`}
  </Callout>
)}

{permissionStatus === 'denied' && (
  <Callout variant="error" size="sm" layout="minimal">
    {t`Notifications are blocked. Please enable them in your browser settings.`}
  </Callout>
)}
```

---

## 6. FORM VALIDATION & SUCCESS in SpaceEditor

### **SpaceEditor - Success Message** (`src/components/space/SpaceEditor.tsx`)
**Current Implementation:**
```tsx
{success && (
  <div className="text-success-hex">
    <Trans>
      Successfully sent invite to {selectedUser?.displayName}
    </Trans>
  </div>
)}
```

**Callout Replacement:**
```tsx
{success && (
  <Callout variant="success" size="sm" layout="minimal" autoClose={5}>
    <Trans>
      Successfully sent invite to {selectedUser?.displayName}
    </Trans>
  </Callout>
)}
```

### **SpaceEditor - Error Validation** (`src/components/space/SpaceEditor.tsx`)
**Current Implementation:**
```tsx
{roleValidationError && (
  <div
    className="mt-4 text-sm"
    style={{ color: 'var(--color-text-danger)' }}
  >
    {roleValidationError}
  </div>
)}
```

**Callout Replacement:**
```tsx
{roleValidationError && (
  <Callout variant="error" size="sm" className="mt-4">
    {roleValidationError}
  </Callout>
)}
```

---

## 7. EXCLUDED: Primitive Internal Error States

### **Input, Select, TextArea Primitives**
These components maintain their own error/success states and should NOT use Callout:
- `Input.web.tsx` - `input-error-message` class
- `Select.web.tsx` - `quorum-select__error-message` class
- `TextArea.web.tsx` - `textarea-error-message` class

**Reason:** Primitive components need to maintain their own validation states for form compatibility and accessibility.

---

## 8. CONSOLE.ERROR (Not for Callout)

Found many `console.error()` statements throughout hooks and services. These are for debugging and should remain as-is.

---

## IMPLEMENTATION PRIORITY

### **High Priority (Immediate Impact)**
1. ✅ **InviteLink.tsx** - Replace `Text variant="error"` with Callout
2. ✅ **CreateSpaceModal.tsx** - Replace custom error-label with dismissible Callout
3. ✅ **UserSettingsModal.tsx** - Replace custom error overlay with Callout
4. ✅ **SearchResults.tsx** - Replace custom error display with Callout
5. ✅ **ConfirmationModal.tsx** - Replace custom PROTIP section with Callout (both web & native)

### **Medium Priority**
1. **SpaceEditor.tsx** - Replace inline error styling AND success message with Callout
   - Error: `roleValidationError` with `variant="error"`
   - Success: Invite sent message with `variant="success"` + autoClose
2. **UserSettingsModal.tsx notifications** - Replace warning/danger text with minimal Callout
3. **File upload error contexts** - Use Callout in parent components
4. **useConfirmation blockedError** - Components displaying blocked errors should use Callout
   - `ConversationSettingsModal.tsx`
   - `ChannelEditor.tsx`
   - Other confirmation-using components

### **Low Priority (Consider Later)**
1. **ClickToCopyContent** - Success feedback with minimal Callout (evaluate against current tooltip UX)
2. **JoinSpaceModal** - Additional context Callouts above Input (if needed)

---

## IMPLEMENTATION NOTES

1. **Dismissible Feature:** Most important for file upload errors and form validation errors
2. **Size Variants:** `sm` size most appropriate for inline errors, `xs` for minimal warnings
3. **Layout Variants:** `minimal` layout for notification states, `base` for errors
4. **Auto-dismiss:** Consider for success states (5 seconds)
5. **Cross-platform:** Ensure all replacements work on both web and mobile

---

## ESTIMATED IMPACT

**Files to Modify:** ~10-15 components
**Lines of Code:** ~60-100 lines of custom error/info handling replaced
**Benefits:**
- Consistent error/success messaging across app
- Better accessibility (ARIA labels, screen reader support)
- Unified styling and behavior
- Dismissible functionality
- Mobile-friendly design

---

## IMPLEMENTATION TRACKING

### **Completed Implementations**

#### **High Priority - COMPLETED**
1. ✅ **InviteLink.tsx** (`src/components/message/InviteLink.tsx`)
   - Replaced: `<Text variant="error">` → `<Callout variant="error" size="sm">`
   - Usage: Error messages for invalid/expired invite links

2. ✅ **CreateSpaceModal.tsx** (`src/components/modals/CreateSpaceModal.tsx`)
   - Replaced: Custom `error-label` div → `<Callout variant="error" size="sm" dismissible onClose={clearFileError}>`
   - Usage: File upload error messages with dismissible functionality

3. ✅ **UserSettingsModal.tsx** (`src/components/modals/UserSettingsModal.tsx`)
   - Replaced: Complex error overlay → `<Callout variant="error" size="sm" dismissible>`
   - Usage: Save operation error feedback positioned at top of modal

4. ✅ **SearchResults.tsx** (`src/components/search/SearchResults.tsx`)
   - Replaced: Custom error state with Icon/Text → `<Callout variant="error">`
   - Usage: Search failure error messages

5. ✅ **ConfirmationModal.tsx & .native.tsx** (`src/components/modals/`)
   - Replaced: Custom PROTIP section → `<Callout variant="info" size="sm">`
   - Usage: Shift+click bypass tips in confirmation dialogs

### **Pending Implementations**

#### **Medium Priority - TODO**
- **SpaceEditor.tsx** - Success messages and error validation
- **UserSettingsModal.tsx** - Notification permission states
- **File upload contexts** - Parent component error display
- **useConfirmation blockedError** - Various components using confirmation system

#### **Low Priority - TODO**
- **JoinSpaceModal** - Additional context callouts

---

## RECENT UPDATE: Color System Consolidation

**Date:** 2025-09-14
**Change:** Consolidated color system to use RGB-only approach

### What Changed:
- ❌ **Removed** all `-hex` color variants (`--danger-hex`, `--warning-hex`, etc.)
- ✅ **Kept** RGB color variants (`--danger`, `--warning`, etc.)
- 🔄 **Updated** all references to use `rgb(var(--danger))` instead of `var(--danger-hex)`

### Impact on Callout Implementation:
- All Callout examples in this audit now use the modern RGB approach
- `variant="error"` uses `rgb(var(--danger))` for consistent theming
- Both solid colors and opacity effects use single color source

---

*Updated: 2025-09-14*