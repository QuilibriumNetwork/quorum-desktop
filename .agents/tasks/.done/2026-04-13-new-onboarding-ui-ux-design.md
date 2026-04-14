# New Onboarding UI/UX - Design Spec

> **Branch:** `feat/new-onboarding-ui-ux`
> **Goal:** Replace the SDK-driven `<PasskeyModal>` + split `Login`/`Onboarding` components with a unified, step-by-step onboarding flow that Quorum Desktop fully owns.

---

## Architecture

**Pattern:** Orchestrator + step components + unified state machine hook.

### Components

| Component | File | Role |
|---|---|---|
| `OnboardingFlow` | `src/components/onboarding/OnboardingFlow.tsx` | Thin orchestrator: renders `ProgressBar` + current step component based on hook state |
| `ProgressBar` | `src/components/onboarding/ProgressBar.tsx` | 5-segment pill progress indicator with empty/active/completed states |
| `LoadingStep` | `src/components/onboarding/steps/LoadingStep.tsx` | Spinner while checking returning user |
| `WelcomeStep` | `src/components/onboarding/steps/WelcomeStep.tsx` | Step 0: logo, tagline, Create/Import buttons, tooltip |
| `ImportKeyStep` | `src/components/onboarding/steps/ImportKeyStep.tsx` | Import flow: file dropzone, validation, link back to create |
| `CreatePasskeyStep` | `src/components/onboarding/steps/CreatePasskeyStep.tsx` | Step 1a: create passkey button, inline error states with retry/fallback |
| `SaveKeyToPasskeyStep` | `src/components/onboarding/steps/SaveKeyToPasskeyStep.tsx` | Step 1b: save key to passkey, auto-fallback on failure |
| `BackupKeyStep` | `src/components/onboarding/steps/BackupKeyStep.tsx` | Step 2a: download key backup or skip |
| `SecurityWarningStep` | `src/components/onboarding/steps/SecurityWarningStep.tsx` | Step 2b: lock icon, warning text, "I understand" |
| `DisplayNameStep` | `src/components/onboarding/steps/DisplayNameStep.tsx` | Step 3: name input + validation |
| `ProfilePhotoStep` | `src/components/onboarding/steps/ProfilePhotoStep.tsx` | Step 4: file upload with avatar preview, skip option |
| `CompleteStep` | `src/components/onboarding/steps/CompleteStep.tsx` | Step 5: welcome message, "Enter Quorum" |

### Hook

| Hook | File | Role |
|---|---|---|
| `useUnifiedOnboardingFlow` | `src/hooks/business/user/useUnifiedOnboardingFlow.ts` | Single state machine composing `usePasskeyFlow` (SDK), passkey adapter, key backup, and profile persistence |

### What Gets Replaced

| Old | New |
|---|---|
| `Login.tsx` (web) | `WelcomeStep` + orchestrator handles `<PasskeyModal>` removal |
| `Onboarding.tsx` (web) | Individual step components + orchestrator |
| `useAuthenticationFlow` (web imports) | Absorbed into `useUnifiedOnboardingFlow` |
| `useOnboardingFlowLogic` (web imports) | Absorbed into `useUnifiedOnboardingFlow` |

### What Stays

- `Login.native.tsx`, `Onboarding.native.tsx`, `OnboardingStyles.native.tsx` — untouched
- `usePasskeyAdapter` (.web.ts / .native.ts) — still bridges `usePasskeysContext`
- `useKeyBackup` — still handles file download, consumed by unified hook
- Old hook files (`useAuthenticationFlow.ts`, `useOnboardingFlowLogic.ts`) — kept alive for native path, just no longer imported from web

---

## App.tsx Integration

### Current Mounting Logic

`App.tsx` has a 4-branch conditional (lines 114-152):
1. `isDevRoute` → Router (dev playground)
2. `user && currentPasskeyInfo` → Main app (authenticated)
3. `landing && !currentPasskeyInfo` → `<Login>` (no stored credentials)
4. `landing` (has `currentPasskeyInfo` but no `user`) → `<Onboarding>` (post-passkey)

Plus a `useEffect` (lines 85-96) that auto-sets `user` when `currentPasskeyInfo.completedOnboarding === true`.

### New Mounting Logic

Branches 3 and 4 collapse into one: `landing && !user` → `<OnboardingFlow>`. The logic becomes:

1. `isDevRoute` → Router (unchanged)
2. `user && currentPasskeyInfo` → Main app (unchanged)
3. `landing && !user` → `<OnboardingFlow setUser={setUser} />`
4. else → `<Connecting />` (unchanged)

**The existing `useEffect` for auto-login (lines 85-96) stays.** It handles the case where `currentPasskeyInfo` already exists with `completedOnboarding: true` (e.g., page refresh for an authenticated user). This runs before the orchestrator ever mounts, so there's no race condition. The orchestrator's `loading` step handles the different case: credentials exist but `completedOnboarding` is false or undefined (returning user who needs profile fetch).

**The `currentPasskeyInfo` check is removed from the branch condition.** The orchestrator handles both "no credentials" (shows welcome) and "has credentials, needs onboarding" (runs loading step) internally.

---

## State Machine

Single `step` value drives the entire flow:

```
loading → (returning user?) → [skip to main app]
                             → welcome

welcome → create-passkey-1a     ("Create New Account")
        → import-key            ("I already have an account")

import-key → create-passkey-1a  (file parsed, isImportMode=true)
           → welcome            ("Create new account instead")

create-passkey-1a → save-key-to-passkey   (registration success)
                  → [inline error state]   (error, stays on same step)
                  → backup-key             ("Continue without passkey")

save-key-to-passkey → backup-key           (success)
                    → backup-key           (failure, auto-fallback)

backup-key → security-warning              (key downloaded)
           → display-name                  ("I've already saved my key" — skips warning)

security-warning → display-name            ("I understand")

display-name → profile-photo               (name saved)

profile-photo → complete                   (photo saved or skipped)

complete → [main app]                      ("Enter Quorum")
```

### Step Type

```typescript
type OnboardingStep =
  | 'loading'
  | 'welcome'
  | 'import-key'
  | 'create-passkey-1a'
  | 'save-key-to-passkey'
  | 'backup-key'
  | 'security-warning'
  | 'display-name'
  | 'profile-photo'
  | 'complete';
```

### Progress Dot Mapping

| Dot | Steps |
|-----|-------|
| (none) | loading, welcome, import-key |
| 1 | create-passkey-1a, save-key-to-passkey |
| 2 | backup-key, security-warning |
| 3 | display-name |
| 4 | profile-photo |
| 5 (active) | complete |

Three visual states: empty (future), active (current), completed (past). On the `complete` step, dot 5 is **active** (not completed), so the user sees 4 filled dots + 1 active dot. This signals "you're here" rather than "you're past here."

---

## Hook Design: `useUnifiedOnboardingFlow`

### Composition

Internally composes:
- `usePasskeyFlow` from `@quilibrium/quilibrium-js-sdk-channels` — all WebAuthn logic. Called with `onStepChange` callback at construction time (not via `useEffect` subscription).
- `usePasskeyAdapter` — bridges `usePasskeysContext` for stored passkey info. This is the **sole source of truth** for `currentPasskeyInfo`; the hook never reads `localStorage['passkeys-list']` directly.
- `useKeyBackup` — file download logic
- `useQuorumApiClient` — for `getUserRegistration` and `uploadRegistration` callbacks (makes this a Category B hook, not shareable to quorum-shared without abstraction)
- Profile persistence logic from current `useOnboardingFlowLogic` (name, photo, fetchUser, completeOnboarding)

### Return Shape

```typescript
interface UseUnifiedOnboardingFlowOptions {
  setUser: (user: {
    displayName: string;
    state: string;
    status: string;
    userIcon: string;
    address: string;
  }) => void;
}

interface UseUnifiedOnboardingFlowReturn {
  // Step state
  step: OnboardingStep;
  dotIndex: number | null;        // null for welcome/import/loading, 1-5 otherwise

  // Passkey state (proxied from usePasskeyFlow — SDK returns `step`, we expose as `passkeyStep`)
  passkeyStep: PasskeyFlowStep;   // renamed from SDK's `step` to avoid collision with OnboardingStep
  passkeyError: PasskeyFlowError | null;
  isImportMode: boolean;
  isPasskeySupported: boolean;
  canRetry: boolean;              // from SDK; true when error is retryable (not `not_supported`)

  // Import error (separate from passkey errors)
  importError: string | null;     // set when importKeyFile rejects (invalid file format)

  // Profile state
  address: string | null;
  displayName: string;
  profileImagePreview: string | null;  // lifted from step component to survive remounts

  // Actions — welcome
  startNewAccount: () => Promise<void>;   // async: generates keypair, may auto-skip passkey on Electron
  startImportAccount: () => void;         // sync: just transitions to import-key step

  // Actions — passkey (thin wrappers calling SDK's usePasskeyFlow methods)
  createPasskey: () => Promise<void>;          // wraps SDK's startRegistration()
  saveToPasskey: () => Promise<void>;          // wraps SDK's completeRegistration()
  continueWithoutPasskey: () => Promise<void>; // wraps SDK's proceedWithoutPasskey()
  retryPasskey: () => void;                    // wraps SDK's retry()
  importKeyFile: (file: File) => Promise<void>;// wraps SDK's importKeyFile(), sets importError on failure

  // Actions — onboarding
  downloadKey: () => Promise<void>;          // calls useKeyBackup, transitions to security-warning on success, stays on backup-key on failure
  skipKeyBackup: () => void;                 // "I've already saved my key" — transitions directly to display-name
  acknowledgeSecurityWarning: () => void;
  setDisplayName: (name: string) => void;
  saveDisplayName: () => void;
  saveProfilePhoto: (url?: string) => void;
  setProfileImagePreview: (url: string | null) => void;  // for ProfilePhotoStep to persist preview across remounts
  completeOnboarding: () => void;            // calls setUser (captured from options) and updates passkey storage

  // Validation
  canProceedWithName: boolean;
}
```

### Step Transitions via `onStepChange` Callback

The unified hook passes an `onStepChange` callback to `usePasskeyFlow` **at construction time** (not via `useEffect`). This callback closes over the unified hook's `setStep` dispatcher:

```typescript
// Inside useUnifiedOnboardingFlow:
const passkey = usePasskeyFlow({
  fqAppPrefix: 'Quorum',
  getUserRegistration,
  uploadRegistration,
  onStepChange: (sdkStep: PasskeyFlowStep) => {
    // sdkStep is the SDK's step value; we translate to our OnboardingStep
    if (sdkStep === 'awaiting_completion') setStep('save-key-to-passkey');
    if (sdkStep === 'success') setStep('backup-key');
    if (sdkStep === 'ready_with_keypair') setStep('create-passkey-1a');
    // errors during completion auto-fallback to backup-key
    // errors during registration stay on create-passkey-1a (no setStep needed)
  },
  onError: (error) => {
    // If we were on save-key-to-passkey (completing), auto-fallback
    if (stepRef.current === 'save-key-to-passkey') {
      setStep('backup-key');
    }
    // If on create-passkey-1a (registering), stay — inline error shows
  },
});
```

**Translation layer:** The SDK hook returns `step` (type `PasskeyFlowStep`). The unified hook exposes this as `passkeyStep` to avoid naming collision with its own `step` (type `OnboardingStep`). Internally: `passkeyStep: passkey.step`.

### Returning User Detection

On mount, the `loading` step runs a `useEffect`:

1. Read `currentPasskeyInfo` from `usePasskeyAdapter` (which reads from `usePasskeysContext`, which reads from `localStorage['passkeys-list']`). **Never read localStorage directly.**
2. If `currentPasskeyInfo` exists with an address and `completedOnboarding !== true`: fetch remote profile via `fetchUser()` (same logic as current `useOnboardingFlowLogic.fetchUser`)
3. If valid profile decrypted: call `setUser` (captured from options), never show onboarding
4. If no `currentPasskeyInfo` or fetch fails: transition to `welcome`

Note: If `completedOnboarding === true`, the `App.tsx` `useEffect` already sets `user` before the orchestrator mounts, so this path is never reached.

### Address in Electron/Fallback Skip Path

When `isPasskeySupported === false` and the user clicks "Create New Account":

1. `startNewAccount()` generates the keypair and derives the address (same logic as current `useAuthenticationFlow.startNewAccount`)
2. Sets `address` in hook state
3. Then calls `continueWithoutPasskey()` which wraps SDK's `proceedWithoutPasskey()` (uses the already-generated keypair)
4. On completion, transitions to `backup-key`

The address is established **before** the SDK fallback call, not by it.

---

## Orchestrator: `OnboardingFlow.tsx`

Thin component that:
1. Calls `useUnifiedOnboardingFlow({ setUser })`
2. Renders `ProgressBar` when `flow.dotIndex !== null`
3. Renders the current step component via a step-to-component map
4. Wraps step in a fade transition container

### Step Rendering

```typescript
const STEP_MAP: Record<OnboardingStep, React.ComponentType<StepProps>> = {
  'loading': LoadingStep,
  'welcome': WelcomeStep,
  'import-key': ImportKeyStep,
  'create-passkey-1a': CreatePasskeyStep,
  'save-key-to-passkey': SaveKeyToPasskeyStep,
  'backup-key': BackupKeyStep,
  'security-warning': SecurityWarningStep,
  'display-name': DisplayNameStep,
  'profile-photo': ProfilePhotoStep,
  'complete': CompleteStep,
};
```

### Step Props

```typescript
interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}
```

All step components receive the full hook return and destructure what they need.

### Layout

The orchestrator owns the outer layout (centering, max-width `460px` constraint). Step components render only their content.

---

## Transitions

**CSS fade, 200ms, no external library.**

When `step` changes, the step container gets a new React `key`, forcing remount. A CSS `@keyframes fadeIn` animation runs on mount:

```css
@keyframes onboarding-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.onboarding-step {
  animation: onboarding-fade-in 200ms ease-in;
}
```

**State survival across remounts:** Because `key` changes force remount, any local `useState` in step components is destroyed. All state that must persist across step transitions is lifted into the hook:
- `profileImagePreview` (for `ProfilePhotoStep` avatar preview)
- All other persistent state (`displayName`, `address`, etc.) is already in the hook

Step components are stateless renderers with the exception of ephemeral UI state (e.g., drag-active indicator) that is fine to reset.

---

## Step Component Details

### Error Handling in `CreatePasskeyStep`

Error state is inline, not a separate step. When `passkeyError` is non-null, the step renders contextual copy based on `passkeyError.code`:

| Code | Message |
|---|---|
| `user_cancelled` | "You cancelled the passkey setup. You can try again, or continue without Passkey (still secure, just without device hardware protection)." |
| `not_supported` | "Passkeys aren't supported on this browser. You'll need to continue without Passkey (still secure, just without device hardware protection)." |
| `timeout` | "The passkey setup timed out. You can try again, or continue without Passkey (still secure, just without device hardware protection)." |
| `unknown` | "Passkey setup failed. You can try again, or continue without Passkey (still secure, just without device hardware protection)." |

Each error message has a tooltip icon showing `passkeyError.rawMessage` for debugging.

Buttons: "Try Again" (shown when `canRetry === true`, calls `retryPasskey()`) and "Continue without passkey" (always shown, calls `continueWithoutPasskey()`). When `canRetry === false` (i.e., `not_supported`), only "Continue without passkey" is shown.

### Error Handling in `ImportKeyStep`

When `importError` is non-null, the step renders:
- Text: "Invalid Key File"
- The `importError` string displayed below
- "Try Again" button that clears the error and resets the dropzone

### Inline Loading in Passkey Steps

When `passkeyStep` is `'registering'` or `'completing'`, the action button shows a spinner and is disabled. No separate loading step.

### `SaveKeyToPasskeyStep` Failure

On failure, auto-transitions to `backup-key`. No retry button (retrying creates orphan passkeys per spec). A brief toast or inline message: "Couldn't save to passkey. Your account key will be stored with standard encryption on this device, still secure, but without hardware protection."

### `BackupKeyStep` Behavior

Two actions with different transitions:
- **"Download Key Backup"** → calls `downloadKey()`. On success, transitions to `security-warning`. On failure (e.g., key export rejected), stays on `backup-key` with a toast error. `downloadKey` does NOT call `markKeyAsExported` on failure.
- **"I've already saved my key"** → calls `skipKeyBackup()`. Transitions directly to `display-name`, skipping `security-warning`. This matches the reference flow doc (Step 2a → Step 3).

### `BackupKeyStep` Platform-Specific Copy

The step checks `window.electron` to show different explanatory text:
- **Web:** "When using Quorum on a browser, your messages are saved locally to your browser. If you clear your browser storage or switch browsers, your old messages and keys may disappear."
- **Electron:** "If you uninstall the app from your device, you will lose your old messages and keys."

This matches the current `Onboarding.tsx` behavior (lines 160-176).

### Tooltips (per spec)

| Step | Trigger | Content |
|---|---|---|
| Welcome | "Read more about Quorum" | "Quorum is a decentralized messaging platform where you own your identity. No email, no phone number, just a secure key that only you control." |
| Create Passkey | "What is a Passkey?" | "A passkey uses your device's security features (Face ID, fingerprint, or PIN) to protect your account. It's more secure than a password and you don't have to remember anything." |
| Save Key to Passkey | "What is the Account Key?" | "Your account key is your unique identity in Quorum. It's like a master password that proves you are you, but it's generated automatically and stored securely in your passkey." |
| Backup Key | "Why do I need to do this?" | "Without this backup, losing your device means losing your account. There's no 'forgot password' option. This is the price you pay for privacy :-)" |

---

## i18n

All user-facing strings use Lingui:
- `t` from `@lingui/core/macro` for plain strings
- `<Trans>` from `@lingui/react/macro` for JSX interpolation

Run `yarn extract` after implementation to update message catalogs.

---

## Returning User Flow

On mount, the `loading` step runs:
1. Read `currentPasskeyInfo` from `usePasskeyAdapter` (reads `usePasskeysContext`, which reads `localStorage['passkeys-list']`)
2. If credentials found with an address and `completedOnboarding !== true`: fetch remote profile (reuses logic from current `useOnboardingFlowLogic.fetchUser`)
3. If valid profile decrypted: call `setUser` directly, never show onboarding
4. If no credentials or fetch fails: transition to `welcome`

---

## Electron / Fallback Behavior

`usePasskeyFlow` from the SDK detects Electron (`window.electron`) and sets `isPasskeySupported = false`. The unified hook uses this to auto-skip passkey steps when the user clicks "Create New Account" or completes key import:

1. `startNewAccount()` (async) checks `isPasskeySupported`
2. If `false`: generates keypair, derives address, calls `continueWithoutPasskey()` (which wraps SDK's `proceedWithoutPasskey()`), then transitions to `backup-key`
3. `CreatePasskeyStep` and `SaveKeyToPasskeyStep` are never rendered

For browsers without PRF/LargeBlob support (detected via `localStorage['quorum-master-prf-incompatibility']`), same behavior.

The user still sees `WelcomeStep` (and `ImportKeyStep` if importing). The skip only affects the passkey creation steps.

---

## Parent Integration (App.tsx)

### Current (lines 114-152)

```
isDevRoute        → Router
user && cpi       → Main app
landing && !cpi   → <Login>
landing           → <Onboarding>
else              → <Connecting>
```

### New

```
isDevRoute        → Router              (unchanged)
user && cpi       → Main app            (unchanged)
landing && !user  → <OnboardingFlow>    (replaces both Login and Onboarding branches)
else              → <Connecting>         (unchanged)
```

The `useEffect` auto-login (lines 85-96) stays. It fires before the orchestrator mounts for users with `completedOnboarding: true`, preventing any flash of the onboarding UI.

Both old branches (`landing && !currentPasskeyInfo` and `landing` with passkey info) collapse into `landing && !user`. The orchestrator handles both "no credentials" and "has credentials, needs onboarding" internally.

---

## Visual Design

### Reference
- **Figma screens:** `.agents/reports/onboarding-flow/quorum-onboarding-design/` (dark theme)
- **Canonical copy:** GitHub issue QuilibriumNetwork/quorum-desktop#106
- **Copy source of truth:** The GitHub issue takes priority over Figma where they differ. Figma is authoritative for layout and visual treatment only.

### Theme

Follow the system theme via the existing `ThemeProvider` with `system` mode. No forced theme during onboarding. Both light and dark themes must work.

**Cleanup:** The current onboarding uses hardcoded `-white` button variants (`primary-white`, `light-outline-white`, `secondary-white`, `btn-disabled-onboarding`) and an `onboarding` input variant designed for the old blue gradient background. These are **no longer needed**. The new onboarding uses standard themed primitives (`primary`, `secondary`, `subtle` buttons; `filled` or `bordered` inputs). The old `-white` variants and `onboarding` input variant become cleanup candidates after this work.

### Background

**Remove `bg-radial--accent-noise`** from the onboarding screens. Replace with a flat surface color:

```
background-color: var(--surface-2);
```

Dark: `#2c252e` / Light: `#eeeef3`. This matches the Figma mockups and provides enough contrast against the content area. The `otis-redding.png` noise texture is no longer used by onboarding.

The `App.tsx` wrapper for the onboarding branch changes from:
```html
<div className="bg-radial--accent-noise flex flex-col min-h-screen text-main">
```
to:
```html
<div className="bg-onboarding flex flex-col min-h-screen text-main">
```

Where `.bg-onboarding` is a new utility class:
```scss
.bg-onboarding {
  background-color: var(--surface-2);
}
```

### Layout Structure

All steps share a consistent vertical layout, centered on screen:

```
┌─────────────────────────────────────────────────────┐
│ [Logo]  (top-left, small — hidden on welcome step)  │
│                                                     │
│                                                     │
│              [Progress Bar]  (when applicable)       │
│              [Step Icon]     (when applicable)       │
│              [Title]                                 │
│              [Description]                           │
│              [Content]       (inputs, dropzone, etc) │
│              [Primary Button]                        │
│              [Secondary Button / Link]               │
│              [Tooltip Link]                          │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- **Content column:** `max-width: 460px`, centered horizontally, centered vertically with flexbox
- **Logo placement:**
  - `welcome` step: large logo centered above the title (part of content flow)
  - All other steps: small logo fixed top-left corner
- **Logo component:** Reuse existing `<Logo />` from `src/components/Logo.tsx` (SVG, inherits `currentColor`)

### Progress Bar

**Shape:** 5 rounded rectangular segments (pills), not circular dots. This matches the Figma designs.

**Dimensions per segment:** ~32px wide, ~6px tall, border-radius fully rounded, ~8px gap between segments.

**Colors (via CSS variables):**
- Completed: `var(--accent)` (blue by default)
- Active: `var(--accent)` (same as completed)
- Empty: `var(--surface-5)` (subtle gray)

Visually, completed and active segments look the same (both filled with accent color). The active segment is simply the rightmost filled one. This matches the Figma where there's no visual distinction between completed and active.

**Placement:** Centered above the title, with spacing below.

**Component name update:** `ProgressBar` → `ProgressBar` (better reflects the pill/segment shape).

### Primitives Usage

| Element | Primitive | Variant/Type |
|---|---|---|
| Primary action buttons | `<Button>` | `type="primary"` |
| Secondary action buttons | `<Button>` | `type="secondary"` or `type="subtle"` |
| Disabled buttons | `<Button>` | `disabled` prop (standard disabled styling) |
| Text inputs | `<Input>` | `variant="filled"` with `label` and `labelType="static"` |
| Disabled inputs (address) | `<Input>` | `variant="filled"` + `disabled` prop |
| Tooltips | `<Tooltip>` | Standard, triggered by info icon or link text |
| Icons | `<Icon>` | Tabler icons via `name` prop |
| File dropzone | `<FileUpload>` | Standard wrapper with dashed-border children |
| Logo | `<Logo>` | Existing component, `className` for sizing |

### Icons per Step

| Step | Icon | Details |
|---|---|---|
| `backup-key` (success confirmation) | `circle-check` | Green (`text-success`), placed above title |
| `security-warning` | `lock` | Standard, placed above title |
| Passkey error states | `alert-circle` | Red (`text-danger`), inline with error message |
| Import dropzone | `upload` | Inside the dashed dropzone area |
| Loading | `spinner` | With `icon-spin` class |
| Account Address info | `help-circle` or `info-circle` | Next to "Account Address" label, triggers tooltip |

### Per-Step Copy (from GitHub issue #106)

**Step 0: Welcome**
- Title: "Sign in into Quorum"
- Text: "Your communities, your rules - no platform can ban you."
- Primary: "Create New Account"
- Secondary: "I already have an account"
- Link: "Read more about Quorum"
- Tooltip: "Quorum is a decentralized messaging platform where you own your identity. No email, no phone number - just a secure key that only you control."

**Step 1a: Create Passkey**
- Title: "Create Passkey"
- Text: "Passkeys use your device's built-in security to protect your account. This requires two quick confirmations via your device."
- Primary: "Create Passkey"
- Link: "What is a Passkey?"
- Tooltip: "A passkey uses your device's security features (Face ID, fingerprint, or PIN) to protect your account. It's more secure than a password and you don't have to remember anything."

**Step 1b: Save Account Key to Passkey**
- Title: "Save Your Account Key"
- Text: "Now let's store your account key inside your passkey. One more confirmation needed."
- Primary: "Save to Passkey"
- Link: "What is the Account Key?"
- Tooltip: "Your account key is your unique identity in Quorum. It's like a master password that proves you are you - but it's generated automatically and stored securely in your passkey."

**Step 2a: Backup Key**
- Title: "Back Up Your Account Key"
- Text: "You'll need this file to recover your account if you lose access to your device."
- Primary: "Download Key Backup"
- Link: "I've already saved my key"
- Link: "Why do I need to do this?"
- Tooltip: "Without this backup, losing your device means losing your account - there's no 'forgot password' option. This is the price you pay for privacy :-)"

**Step 2b: Security Warning**
- Icon: Lock
- Title: "Keep your Key Safe!"
- Text: "Keep the file you downloaded safe and private! Anyone with this file can access your account."
- Primary: "I understand"

**Step 3: Display Name**
- Title: "What should we call you?"
- Text: "This is how others will see you in Quorum. You can change this anytime in Settings."
- Input: "Enter your name" (placeholder), "User Name" label with required asterisk
- Input (disabled): "Account Address" label with info icon tooltip
- Primary: "Continue" (disabled until valid name)
- Tooltip (on Account Address info icon): "Your account address is a unique public identifier derived from your account key. Others can use it to find and message you. Think of it like a username that can never change."

**Step 4: Profile Photo**
- Title: "Add a profile photo"
- Text: "Help others recognize you with a profile picture."
- Primary: "Continue"
- Link: "Skip for now"

**Step 5: Complete**
- Title: "You're all set!"
- Text: "Welcome to Quorum, [Name]! Your account is secured and ready to go."
- Primary: "Enter Quorum"

**Import Step: Import Key**
- Title: "Import your account key"
- Text: "Select or drag your account key file to restore your account."
- Dropzone: file drop area accepting `.key` files
- Primary: "Continue" (disabled until file selected)
- Link: "Create new account instead"

### Post-Implementation Cleanup

After the new onboarding is complete and tested, the following can be removed:
- `bg-radial--accent-noise` class (if not used elsewhere)
- Button types: `primary-white`, `secondary-white`, `light-white`, `light-outline-white`, `btn-disabled-onboarding`
- Input variant: `onboarding`
- `_passkey-modal.scss` (SDK modal styles, no longer mounted)
- Any references to `otis-redding.png` noise texture (if only used by onboarding)

---

## Scope Boundaries

### In Scope
- All web components and hooks described above
- App.tsx mounting logic rework
- Visual design implementation (themed background, standard primitives, progress bar)
- CSS for step transitions and progress bar
- Removal of `<PasskeyModal>` from web path
- SDK package version bump in `package.json`

### Out of Scope
- Native variants (`Login.native.tsx`, `Onboarding.native.tsx`) — addressed separately
- Migration to `quorum-shared` — build locally first, migrate after testing
- Cleanup of old onboarding-specific styles/variants — follow-up task after testing
- New passkey features (retry step 1b, orphan cleanup, QR import)
- Import via QR code — future feature noted in issue #106

---

## Dependencies

- `@quilibrium/quilibrium-js-sdk-channels` with `usePasskeyFlow` hook exported (branch `feat/passkey-modal-new-ui-ux`, version TBD)

---

## Reference Documents

- [GitHub issue #106](https://github.com/QuilibriumNetwork/quorum-desktop/issues/106) — canonical copy and flow spec
- [Figma designs](./../reports/onboarding-flow/quorum-onboarding-design/) — visual layout reference (dark theme)
- [New onboarding flow spec](./../reports/onboarding-flow/new-onboarding-flow-inline-passkey-2025-12-08.md)
- [Passkey flow analysis](./../reports/onboarding-flow/passkey-authentication-flow-analysis-2025-11-23.md)
- [Passkey flow simplified](./../reports/onboarding-flow/passkey-flow-simplified-2025-11-23.md)
- [SDK hook extraction plan](D:/GitHub/Quilibrium/quilibrium-js-sdk-channels/.agents/tasks/2026-04-13-passkey-hook-extraction-plan.md)

---

*Created: 2026-04-13*
*Updated: 2026-04-13 — added visual design section, resolved copy source of truth, fixed review issues*
