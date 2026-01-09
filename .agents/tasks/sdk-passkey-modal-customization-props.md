---
type: task
title: SDK PasskeyModal Customization Props Enhancement
status: in-progress
complexity: high
ai_generated: true
created: 2025-11-21T00:00:00.000Z
updated: '2026-01-09'
---

# SDK PasskeyModal Customization Props Enhancement

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Target Repository**: `quilibrium-js-sdk-channels`
**Consumer Repository**: `quorum-desktop`

**Files** (in SDK):
- `src/components/modals/PasskeyModal.tsx` - Main component to enhance
- `src/components/modals/PasskeyModal.css` - Styles (already customizable via consumer CSS)
- `src/components/context/PasskeysContext.tsx` - Context provider
- `src/index.ts` - Exports

**Files** (in Consumer - for reference):
- `src/components/onboarding/Onboarding.tsx:94-100` - Current SDK usage
- `src/components/onboarding/Login.tsx:35-39` - Current SDK usage
- `src/styles/_passkey-modal.scss` - Consumer CSS overrides

---

## Background & Objectives

### Current Situation

The `quilibrium-js-sdk-channels` package provides a `PasskeyModal` component for WebAuthn passkey registration. Currently:

1. **Layout is fixed**: The component renders as a modal overlay with `position: fixed`
2. **Texts are hardcoded**: All UI strings are in English and embedded in the component
3. **Structure is rigid**: No way to customize the rendering approach (modal vs inline)

### Consumer Needs (quorum-desktop)

| Need | Current State | Desired State |
|------|---------------|---------------|
| **Layout flexibility** | Fixed modal only | Option for inline/embedded rendering |
| **Text customization** | Hardcoded English | Props-based labels with defaults |
| **i18n support** | None | Pass translated strings via props |
| **Styling control** | CSS override only | CSS + className props for containers |
| **Multi-step integration** | Standalone modal | Embeddable in onboarding wizard |

### Design Principles

1. **100% Backwards Compatible**: Existing implementations must work unchanged
2. **Progressive Enhancement**: New props are optional with sensible defaults
3. **Generic SDK**: Changes benefit all consumers, not just quorum-desktop
4. **Clean API**: Props should be intuitive and well-documented
5. **No i18n Library in SDK**: Translations handled by consumer's build process

---

## i18n Architecture: Why Props-Based Labels Work

### The Key Insight

The SDK does **NOT** need any i18n library (Lingui, react-intl, etc.). Here's why:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BUILD TIME                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  quilibrium-js-sdk-channels              quorum-desktop             │
│  ┌───────────────────────┐               ┌───────────────────────┐ │
│  │ yarn build            │               │ yarn build            │ │
│  │                       │               │                       │ │
│  │ PasskeyModal.tsx      │               │ Onboarding.tsx        │ │
│  │ - Accepts string props│   ─────────►  │ + Lingui/Babel        │ │
│  │ - No i18n library     │    linked     │ + Vite bundling       │ │
│  └───────────────────────┘               └───────────────────────┘ │
│           │                                       │                 │
│           ▼                                       ▼                 │
│    dist/index.js                          dist/web/assets/         │
│    (static JS, generic)                   (final bundle + i18n)    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### How Lingui Integration Works

**Step 1: Consumer code uses Lingui macros**
```typescript
// In quorum-desktop/src/components/onboarding/Onboarding.tsx
import { t } from '@lingui/core/macro';

<PasskeyModal
  labels={{
    createTitle: t`Create Your Quorum Passkey`,  // ← Lingui macro
  }}
/>
```

**Step 2: Consumer's Babel transforms the macro (at build time)**
```typescript
// After Babel processing in quorum-desktop build
<PasskeyModal
  labels={{
    createTitle: i18n._("Create Your Quorum Passkey"),  // ← Runtime call
  }}
/>
```

**Step 3: At runtime, i18n returns translated string**
```typescript
// When user has Italian locale active
i18n._("Create Your Quorum Passkey")
// Returns: "Crea la tua Passkey Quorum"
```

**Step 4: SDK receives plain string**
```typescript
// What the SDK component actually receives:
<PasskeyModal
  labels={{
    createTitle: "Crea la tua Passkey Quorum",  // ← Just a string!
  }}
/>
```

### Why This Works

| Layer | Responsibility | i18n Awareness |
|-------|---------------|----------------|
| **SDK** | Accept `string` props, render them | None needed |
| **Consumer Build** | Transform `t` macros via Babel | Yes (Lingui) |
| **Consumer Runtime** | Load locale, return translated strings | Yes (Lingui) |

The SDK is completely agnostic to how the consumer generates the strings. It could be:
- Lingui (`t`Create Passkey``)
- react-intl (`intl.formatMessage(...)`)
- Hard-coded strings (`"Create Passkey"`)
- Any other i18n solution

### Benefits of This Approach

1. **SDK stays lightweight** - No i18n dependencies to bundle
2. **Consumer has full control** - Use any i18n library or none
3. **No coordination needed** - SDK and consumer can use different tools
4. **Translation workflow unchanged** - Consumer manages all translations

---

## What & Why

**What**: Enhance the `PasskeyModal` component in `quilibrium-js-sdk-channels` to accept customization props for labels, render mode, and container styling.

**Why**:
- Enable per-product branding and localization
- Allow integration into multi-step flows (onboarding wizards)
- Maintain a single SDK codebase serving multiple products
- Avoid fork/branch maintenance burden

**Value**: Products using the SDK can fully customize the passkey UX while benefiting from shared security logic and updates.

---

## Prerequisites

- [x] Review current PasskeyModal implementation in SDK
- [x] Identify all hardcoded strings that need externalization
- [x] Design props interface that covers all customization needs
- [ ] Plan migration path for existing consumers
- [ ] Ensure no breaking changes to existing API

---

## SDK Analysis (Verified 2025-11-21)

### Confirmed Architecture

```
quilibrium-js-sdk-channels/
├── src/
│   ├── index.ts                         # Exports: PasskeyModal, PasskeysProvider, usePasskeysContext
│   ├── components/
│   │   ├── context/PasskeysContext.tsx  # State: showPasskeyPrompt, passkeyRegistrationComplete, etc.
│   │   └── modals/PasskeyModal.tsx      # UI: ~567 lines, hardcoded strings
│   └── passkeys/types.ts                # register(), completeRegistration(), authenticate()
├── dist/
│   ├── index.js / index.esm.js          # Bundled (React external)
│   └── index.css                        # Extracted, minified CSS
└── rollup.config.js                     # postcss({ extract: true }), external: ['react', 'react-dom']
```

### Current Props Interface (from source)

```typescript
// PasskeyModal.tsx lines 19-30
export const PasskeyModal = ({
  fqAppPrefix,
  getUserRegistration,
  uploadRegistration,
} : {
  fqAppPrefix: string;
  getUserRegistration: (address: string) => Promise<secureChannel.UserRegistration>;
  uploadRegistration: ({ address, registration }: {
    address: string;
    registration: secureChannel.UserRegistration;
  }) => Promise<void>;
}) => { ... }
```

### Context State (PasskeysContext.tsx)

The modal reads/writes these context values:
- `showPasskeyPrompt: { value: boolean; importMode?: boolean }` - visibility control
- `passkeyRegistrationComplete: boolean | undefined` - success/failure state
- `passkeyRegistrationError: string | undefined` - error message
- `currentPasskeyInfo` - stored passkey data after registration

### Hardcoded Strings Inventory (from PasskeyModal.tsx)

| Line | String | Context |
|------|--------|---------|
| 63 | `'Import Existing Key'` | Title (import mode) |
| 65 | `'Create Passkey'` | Title (create mode) |
| 92-93 | `'An error was encountered while attempting to register the passkey.'` | Error state |
| 99-103 | `'If your browser told you...'` | Browser unsupported hint |
| 107 | `'Your passkey has been successfully created.'` | Success message |
| 109 | `'To save the account, you will need to perform one more passkey interaction...'` | Continue prompt |
| 112-113 | `"Use Passkeys to save your account..."` | Import with keypair |
| 114-115 | `'To begin, import your existing key file...'` | Import initial |
| 117-118 | `"Use Passkeys to access your account..."` | Create mode |
| 131-132 | `'Drop key file here or click to select'` | Dropzone placeholder |
| 272, 378, 545 | `'Continue'` | Primary button |
| 459-462 | `'Proceed Without Passkeys'` | Warning button |
| 559 | `'Cancel'` | Secondary button |

### Dynamic Content Notes

1. **Dropzone filename**: `acceptedFiles[0].name` shown when file selected
2. **Error display**: `passkeyRegistrationError` from context rendered directly
3. **Electron detection**: `window.electron` check affects flow

### CSS Loading Order Confirmed

1. SDK's `dist/index.css` bundled via rollup postcss (extracted)
2. Consumer imports SDK → CSS included in bundle
3. Consumer's `_passkey-modal.scss` imported after → **overrides work**

---

## Implementation Plan

### Phase 1: Define Props Interface

Create a comprehensive TypeScript interface for customization:

```typescript
// New types to add to SDK
// Based on verified string inventory from PasskeyModal.tsx

interface PasskeyModalLabels {
  // Titles (lines 63, 65)
  createTitle?: string;           // Default: "Create Passkey"
  importTitle?: string;           // Default: "Import Existing Key"

  // Success state (line 107)
  successMessage?: string;        // Default: "Your passkey has been successfully created."

  // Error state (lines 92-93)
  errorMessage?: string;          // Default: "An error was encountered while attempting to register the passkey."

  // Instructions - context-dependent (lines 109, 112-115, 117-118)
  createInstructions?: string;    // Default: "Use Passkeys to access your account, with the security of your own device's secure element..."
  importInstructions?: string;    // Default: "To begin, import your existing key file. Drop it in the area below..."
  importWithKeypairInstructions?: string;  // Default: "Use Passkeys to save your account..."
  continueInstructions?: string;  // Default: "To save the account, you will need to perform one more passkey interaction..."

  // Dropzone (lines 131-132)
  dropzoneText?: string;          // Default: "Drop key file here or click to select"
  // Note: filename display uses acceptedFiles[0].name - not customizable

  // Buttons (lines 272, 378, 459-462, 545, 559)
  continueButton?: string;        // Default: "Continue"
  cancelButton?: string;          // Default: "Cancel"
  proceedWithoutButton?: string;  // Default: "Proceed Without Passkeys"

  // Error guidance (lines 99-103)
  browserUnsupportedHint?: string; // Default: "If your browser told you the passkey option cannot be used with the site..."
}

type PasskeyModalRenderMode = 'modal' | 'inline';

interface PasskeyModalClassNames {
  backdrop?: string;
  container?: string;
  header?: string;
  content?: string;
  icon?: string;
  button?: string;
  dropzone?: string;
}

interface PasskeyModalProps {
  // Existing required props (unchanged)
  fqAppPrefix: string;
  getUserRegistration: (address: string) => Promise<UserRegistration>;
  uploadRegistration: (params: UploadRegistrationParams) => Promise<void>;

  // NEW: Customization props (all optional)
  labels?: Partial<PasskeyModalLabels>;
  renderMode?: PasskeyModalRenderMode;  // Default: 'modal'
  classNames?: PasskeyModalClassNames;

  // NEW: Render customization
  hideBackdrop?: boolean;               // For inline mode styling
  onComplete?: () => void;              // Callback when registration completes
  onCancel?: () => void;                // Callback when user cancels
}
```

**Done when**: Interface is defined, exported from SDK, and documented

### Phase 2: Externalize Hardcoded Strings

Update `PasskeyModal.tsx` to use props with defaults:

```typescript
// Inside PasskeyModal component
const defaultLabels: PasskeyModalLabels = {
  createTitle: 'Create Passkey',
  importTitle: 'Import Existing Key',
  successMessage: 'Your passkey has been successfully created.',
  // ... all other defaults
};

const mergedLabels = { ...defaultLabels, ...labels };
```

**Current hardcoded strings to externalize** (from `PasskeyModal.tsx`):
- Line 63-65: Title strings
- Line 91-93: Error message
- Line 98-104: Browser unsupported hint
- Line 107: Success message
- Line 109: Continue instructions
- Line 111-115: Import mode instructions
- Line 117-118: Create mode instructions
- Line 130-133: Dropzone text
- Line 272, 378, 462, 545, 560: Button labels

**Done when**: All strings use `mergedLabels.propertyName` pattern

### Phase 3: Implement Render Mode

Add conditional rendering based on `renderMode` prop:

```typescript
const PasskeyModal = ({ renderMode = 'modal', hideBackdrop, ...props }) => {
  const isInline = renderMode === 'inline';

  // Conditional backdrop
  const backdropClasses = cn(
    'passkey-modal-backdrop',
    isInline && 'passkey-modal-backdrop--inline',
    hideBackdrop && 'passkey-modal-backdrop--hidden',
    classNames?.backdrop
  );

  // Conditional container positioning
  const containerClasses = cn(
    'passkey-modal-container',
    isInline && 'passkey-modal-container--inline',
    classNames?.container
  );

  return (
    <div className={backdropClasses}>
      <div className={containerClasses}>
        {/* existing content */}
      </div>
    </div>
  );
};
```

**CSS additions** (in `PasskeyModal.css`):
```css
/* Inline mode overrides */
.passkey-modal-backdrop--inline {
  position: relative;
  background-color: transparent;
  backdrop-filter: none;
  width: 100%;
  height: auto;
  z-index: auto;
}

.passkey-modal-container--inline {
  position: relative;
  top: auto;
  left: auto;
  transform: none;
  width: 100%;
  max-width: none;
}

.passkey-modal-backdrop--hidden {
  background: transparent;
  backdrop-filter: none;
}
```

**Done when**: Both `modal` and `inline` modes render correctly

### Phase 4: Add Callback Props

Implement completion and cancellation callbacks:

```typescript
// In success handling (multiple locations in PasskeyModal.tsx)
// Lines: 204, 346, 454, 540
if (onComplete) {
  onComplete();
}
setPasskeyRegistrationComplete(true);

// In cancel handling (line 552-557)
if (onCancel) {
  onCancel();
}
setShowPasskeyPrompt({ ...showPasskeyPrompt, value: false });
```

**Important Context Interaction Notes**:

1. **State still managed by context**: Callbacks are ADDITIONS, not replacements
   - `setPasskeyRegistrationComplete(true)` still called → context updated
   - `onComplete()` fires AFTER state update for consumer to react

2. **Multiple success paths**: Registration can complete via:
   - Normal passkey flow (lines 204, 346)
   - "Proceed Without Passkeys" fallback (lines 454, 540)
   - All paths should trigger `onComplete`

3. **Cancel resets state**: The cancel handler already:
   - Clears error: `setPasskeyRegistrationError(undefined)`
   - Clears completion: `setPasskeyRegistrationComplete(undefined)`
   - Hides modal: `setShowPasskeyPrompt({ value: false })`

**Done when**: Callbacks fire at appropriate lifecycle points WITHOUT breaking existing context state management

### Phase 5: Update Exports & Documentation

1. **Update SDK exports** (`src/index.ts`):
```typescript
export type {
  PasskeyModalProps,
  PasskeyModalLabels,
  PasskeyModalRenderMode,
  PasskeyModalClassNames,
} from './components/modals/PasskeyModal';
```

2. **Add JSDoc comments** to all new props

3. **Update SDK README** with:
   - New props documentation
   - Migration guide (none needed - fully backwards compatible)
   - Examples for each customization scenario

**Done when**: Types exported, documented, README updated

---

## Verification

### Backwards Compatibility Tests

✅ **Existing usage still works**
```typescript
// This must continue to work unchanged
<PasskeyModal
  fqAppPrefix="Quorum"
  getUserRegistration={...}
  uploadRegistration={...}
/>
```
- Test: Build SDK, link to quorum-desktop, verify current behavior unchanged

✅ **Default labels appear correctly**
- Test: Use component without `labels` prop, verify English defaults

### New Feature Tests

✅ **Custom labels render**
```typescript
<PasskeyModal
  fqAppPrefix="Quorum"
  labels={{
    createTitle: "Create Your Quorum Passkey",
    successMessage: "Welcome to Quorum!",
  }}
  ...
/>
```
- Test: Custom strings appear in UI

✅ **Inline mode renders correctly**
```typescript
<PasskeyModal
  renderMode="inline"
  hideBackdrop={true}
  ...
/>
```
- Test: Component renders inline without fixed positioning

✅ **Callbacks fire**
- Test: `onComplete` fires after successful registration
- Test: `onCancel` fires when user clicks Cancel

✅ **Custom classNames applied**
- Test: Additional classes appear on elements

### Integration Tests

✅ **TypeScript compiles in SDK**
- Run: `npx tsc --noEmit` in SDK repo

✅ **TypeScript compiles in consumer**
- Run: `npx tsc --noEmit` in quorum-desktop

✅ **Full registration flow works**
- Test: Complete passkey creation in quorum-desktop with new props

✅ **i18n works via props (Lingui)**
- Test: Pass `labels` using Lingui `t` macro
- Test: Switch locale, verify labels update
- Test: Verify SDK bundle has no i18n dependencies

---

## Example Consumer Usage (quorum-desktop)

After SDK enhancement, `Onboarding.tsx` can be updated:

```typescript
import { PasskeyModal } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';

// In component:
<PasskeyModal
  fqAppPrefix="Quorum"
  getUserRegistration={async (address) => (await apiClient.getUser(address)).data}
  uploadRegistration={uploadRegistration}

  // NEW: Localized labels
  labels={{
    createTitle: t`Create Your Quorum Passkey`,
    importTitle: t`Import Your Quorum Key`,
    successMessage: t`Your passkey has been created successfully!`,
    createInstructions: t`Secure your Quorum account with a passkey...`,
    continueButton: t`Continue`,
    cancelButton: t`Cancel`,
  }}

  // NEW: Inline rendering for multi-step onboarding
  renderMode="inline"
  hideBackdrop={true}
  classNames={{
    container: 'onboarding-passkey-step',
  }}

  // NEW: Flow control
  onComplete={() => onboardingFlow.advanceToNextStep()}
  onCancel={() => onboardingFlow.goBack()}
/>
```

---

## Definition of Done

- [ ] Props interface defined and exported from SDK
- [ ] All hardcoded strings externalized with defaults
- [ ] `renderMode` prop implemented ('modal' | 'inline')
- [ ] `classNames` prop implemented for all major elements
- [ ] Callback props (`onComplete`, `onCancel`) implemented
- [ ] SDK README updated with full documentation
- [ ] TypeScript compiles in both SDK and consumer
- [ ] Backwards compatibility verified (existing usage unchanged)
- [ ] Manual testing of all new features complete
- [ ] SDK version bumped (minor version - new features, no breaking changes)

---

## Notes

- This task is for planning/tracking in quorum-desktop
- Actual implementation will be done in `quilibrium-js-sdk-channels` repo
- After SDK changes, a follow-up task will update quorum-desktop to use new props
- CSS customization already works via `_passkey-modal.scss` - this enhancement adds props-based customization

---

## Related Documentation

- SDK Repository: `D:\GitHub\Quilibrium\quilibrium-js-sdk-channels`
- Current SDK Usage: `src/components/onboarding/Onboarding.tsx:94-100`
- Current CSS Overrides: `src/styles/_passkey-modal.scss`
- README Integration Info: `README.md:70-81`

---
